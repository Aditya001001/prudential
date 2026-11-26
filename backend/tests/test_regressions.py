"""Regression coverage runs against an in-memory DB and disposable files only."""
import io
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from datetime import datetime
from types import SimpleNamespace

os.environ['DATABASE_URL'] = 'sqlite:///:memory:'
os.environ['COOKIE_SECURE'] = 'false'
os.environ['SECRET_KEY'] = 'regression-test-secret-not-for-deployment'
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from werkzeug.security import generate_password_hash
from PIL import Image
import app_with_db as web
from database import db, Agent, Certificate, SystemAsset, CSVUploadHistory, GenerationJob
from db_services import create_agent, create_certificate, import_agents_from_csv, update_agent
from storage import staged_delete, safe_path


def png(size=(200, 400), color=(120, 20, 30, 255)):
    stream = io.BytesIO()
    Image.new('RGBA', size, color).save(stream, 'PNG')
    stream.seek(0)
    return stream


class Regressions(unittest.TestCase):
    serial = 0

    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        root = Path(self.temp.name)
        self.folders = {key: str(root / name) for key, name in [
            ('ADMIN_ASSETS_FOLDER', 'admin_assets'), ('USER_UPLOADS_FOLDER', 'uploads'),
            ('USER_OUTPUTS_FOLDER', 'outputs'), ('USER_PHOTOS_FOLDER', 'photos')]}
        self.patch = patch.multiple(web, **self.folders)
        self.patch.start()
        for path in self.folders.values(): Path(path).mkdir()
        for folder in ('backgrounds', 'badges', 'nametags', 'layers', 'versions', 'csv_history'):
            (root / 'admin_assets' / folder).mkdir()
        self.context = web.app.app_context()
        self.context.push()
        db.drop_all(); db.create_all()
        web.app.config.update(TESTING=True, ADMIN_PASSWORD_HASH=generate_password_hash('admin123'), SESSION_COOKIE_SECURE=False)
        Regressions.serial += 1
        self.client = self.new_client()
        self.agent = create_agent('00001', 'Example Agent', 'MDRT')

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        self.context.pop()
        self.patch.stop()
        self.temp.cleanup()

    def new_client(self):
        client = web.app.test_client()
        client.environ_base['REMOTE_ADDR'] = f'192.0.{Regressions.serial // 250}.{Regressions.serial % 250 + 1}'
        return client

    def bootstrap(self, client=None):
        return (client or self.client).get('/api/auth/session').json['csrf_token']

    def login(self, client=None):
        client = client or self.client
        token = self.bootstrap(client)
        result = client.post('/api/auth/login', json={'username': 'admin', 'password': 'admin123'}, headers={'X-CSRF-Token': token})
        self.assertEqual(result.status_code, 200)
        return {'X-CSRF-Token': result.json['csrf_token']}

    def master_file(self, content):
        path = Path(self.temp.name) / 'master.csv'; path.write_text(content)
        return str(path)

    def cert(self, owner=None, photo=True):
        filename = 'certificate.png'
        path = Path(web.USER_OUTPUTS_FOLDER) / filename; path.write_bytes(png().getvalue())
        cert = create_certificate(self.agent.id, filename, str(path))
        cert.generated_by = owner
        if photo:
            cert.original_photo_filename = 'original.png'
            cert.original_photo_filepath = str(Path(web.USER_PHOTOS_FOLDER) / 'original.png')
            Path(cert.original_photo_filepath).write_bytes(png().getvalue())
        db.session.commit()
        return cert

    def place_asset(self, kind, name, color):
        folder = {'background': 'backgrounds', 'badge': 'badges', 'nametag': 'nametags', 'layer': 'layers'}[kind]
        path = Path(web.ADMIN_ASSETS_FOLDER) / folder / f'{name}.png'
        size = (web.REFERENCE_WIDTH, web.REFERENCE_HEIGHT) if kind in ('background', 'layer') else (300, 150)
        Image.new('RGBA', size, color).save(path)
        return path

    def test_validate_composed_poster_accepts_matching_render(self):
        self.place_asset('background', 'MDRT', (10, 20, 30, 255))
        reference, _ = web.build_validation_reference('MDRT', [])
        poster = reference.resize((web.REFERENCE_WIDTH, web.REFERENCE_HEIGHT)).convert('RGBA')
        self.assertTrue(web.validate_composed_poster(poster, 'MDRT', []))

    def test_validate_composed_poster_rejects_wrong_tier_artwork(self):
        self.place_asset('background', 'MDRT', (10, 20, 30, 255))
        self.place_asset('background', 'COT', (240, 230, 220, 255))
        tampered_reference, _ = web.build_validation_reference('COT', [])
        tampered = tampered_reference.resize((web.REFERENCE_WIDTH, web.REFERENCE_HEIGHT)).convert('RGBA')
        self.assertFalse(web.validate_composed_poster(tampered, 'MDRT', []))

    def test_validate_composed_poster_rejects_fabricated_badge(self):
        self.place_asset('background', 'MDRT', (10, 20, 30, 255))
        self.place_asset('badge', 'LM', (255, 215, 0, 255))
        with_badge_reference, _ = web.build_validation_reference('MDRT', ['LM'])
        with_badge = with_badge_reference.resize((web.REFERENCE_WIDTH, web.REFERENCE_HEIGHT)).convert('RGBA')
        self.assertFalse(web.validate_composed_poster(with_badge, 'MDRT', []))

    def test_validate_composed_poster_ignores_portrait_and_name_text_differences(self):
        self.place_asset('background', 'MDRT', (10, 20, 30, 255))
        reference, _ = web.build_validation_reference('MDRT', [])
        poster = reference.resize((web.REFERENCE_WIDTH, web.REFERENCE_HEIGHT)).convert('RGBA')
        draw = web.ImageDraw.Draw(poster)
        photo_ratios = web.POSITION_RATIOS['agent_photo']
        draw.rectangle([0, int(web.REFERENCE_HEIGHT * (1 - photo_ratios['height_ratio'])),
                       web.REFERENCE_WIDTH, web.REFERENCE_HEIGHT], fill=(0, 255, 0, 255))
        self.assertTrue(web.validate_composed_poster(poster, 'MDRT', []))

    def test_validate_composed_poster_handles_missing_assets_gracefully(self):
        poster = Image.new('RGBA', (web.REFERENCE_WIDTH, web.REFERENCE_HEIGHT), (0, 0, 0, 255))
        self.assertTrue(web.validate_composed_poster(poster, 'MDRT', []))

    def test_valid_composed_poster_is_used_directly_and_is_not_editable(self):
        self.place_asset('background', 'MDRT', (10, 20, 30, 255))
        reference, _ = web.build_validation_reference('MDRT', [])
        poster_bytes = io.BytesIO()
        reference.resize((web.REFERENCE_WIDTH, web.REFERENCE_HEIGHT)).convert('RGBA').save(poster_bytes, 'PNG')
        poster_bytes.seek(0)
        token = self.bootstrap()
        with patch.object(web, 'enqueue_generation', return_value=SimpleNamespace(id='rq-composed')):
            response = self.client.post('/api/user/upload-photo', data={
                'client_code': '00001', 'photo': (png(), 'portrait.png'),
                'composed_poster': (poster_bytes, 'composed-poster.png'),
            }, headers={'X-CSRF-Token': token})
        self.assertEqual(response.status_code, 202)
        job_id = response.json['job']['id']
        self.assertIsNotNone(db.session.get(GenerationJob, job_id).composed_poster_filename)
        result = web.process_generation_job(job_id)
        self.assertEqual(result['status'], 'completed')
        certificate = Certificate.query.one()
        self.assertEqual(certificate.render_metadata.get('client_composed'), True)
        self.assertNotIn('editor', certificate.render_metadata)
        status = self.client.get(f'/api/user/generation-jobs/{job_id}')
        self.assertFalse(status.json['job']['certificate']['editable'])
        # No per-layer editor state exists, so repositioning must be refused
        # rather than silently doing nothing or crashing.
        adjust = self.client.post(f'/api/user/certificates/{certificate.id}/adjust',
                                  json={'revision': 0, 'transform': {'scale': 1, 'offset_x': 0, 'offset_y': 0}},
                                  headers={'X-CSRF-Token': token})
        self.assertEqual(adjust.status_code, 409)

    def test_tampered_composed_poster_falls_back_to_server_render_and_is_editable(self):
        self.place_asset('background', 'MDRT', (10, 20, 30, 255))
        self.place_asset('background', 'COT', (240, 230, 220, 255))
        tampered_reference, _ = web.build_validation_reference('COT', [])
        poster_bytes = io.BytesIO()
        tampered_reference.resize((web.REFERENCE_WIDTH, web.REFERENCE_HEIGHT)).convert('RGBA').save(poster_bytes, 'PNG')
        poster_bytes.seek(0)
        token = self.bootstrap()

        def generate(agent, path):
            output = Path(web.USER_OUTPUTS_FOLDER) / 'server-rendered.png'
            output.write_bytes(png().getvalue())
            return output.name, str(output), {'renderer_version': 6, 'editor': {'version': 1}}

        with patch.object(web, 'enqueue_generation', return_value=SimpleNamespace(id='rq-tampered')):
            response = self.client.post('/api/user/upload-photo', data={
                'client_code': '00001', 'photo': (png(), 'portrait.png'),
                'composed_poster': (poster_bytes, 'composed-poster.png'),
            }, headers={'X-CSRF-Token': token})
        self.assertEqual(response.status_code, 202)
        job_id = response.json['job']['id']
        with self.assertLogs(web.app.logger, level='WARNING'), patch.object(web, 'generate_certificate_for_agent', side_effect=generate):
            result = web.process_generation_job(job_id)
        self.assertEqual(result['status'], 'completed')
        certificate = Certificate.query.one()
        self.assertNotIn('client_composed', certificate.render_metadata)
        status = self.client.get(f'/api/user/generation-jobs/{job_id}')
        self.assertTrue(status.json['job']['certificate']['editable'])

    def test_admin_endpoints_require_authentication(self):
        for method, url in [('get','/api/admin/status'),('get','/api/agents'),('get','/api/certificates/history'),('get','/api/admin/csv-history'),('get','/api/certificates/photo/anything.png'),('delete','/api/admin/delete-csv'),('put',f'/api/agents/{self.agent.id}'),('delete','/api/certificates/1')]:
            self.assertEqual(getattr(self.client, method)(url).status_code, 401, url)

    def test_csrf_and_bad_credentials(self):
        self.assertEqual(self.client.post('/api/auth/login', json={}).status_code, 403)
        token = self.bootstrap()
        response = self.client.post('/api/auth/login', json={'username':'admin','password':'wrong'}, headers={'X-CSRF-Token':token})
        self.assertEqual(response.status_code, 401)
        self.assertEqual(self.client.get('/api/auth/session').json['authenticated'], False)

    def test_logout_revokes_copied_cookie(self):
        headers = self.login()
        cookie = self.client.get_cookie('prudential_session').value
        self.assertEqual(self.client.get('/api/admin/status').status_code, 200)
        self.assertEqual(self.client.post('/api/auth/logout', headers=headers).status_code, 200)
        copied = self.new_client(); copied.set_cookie('prudential_session', cookie)
        self.assertEqual(copied.get('/api/admin/status').status_code, 401)

    def test_private_certificate_is_scoped_to_session(self):
        self.bootstrap()
        with self.client.session_transaction() as session: owner = session['owner']
        cert = self.cert(owner)
        with self.client.get('/api/user/preview/' + cert.filename) as response:self.assertEqual(response.status_code,200)
        other = self.new_client(); self.bootstrap(other)
        self.assertEqual(other.get('/api/user/preview/' + cert.filename).status_code, 404)
        self.assertEqual(other.get('/api/user/download/' + cert.filename).status_code, 404)
        self.login(other)
        with other.get('/api/user/preview/' + cert.filename) as response:self.assertEqual(response.status_code,200)

    def test_invalid_import_is_atomic(self):
        p = self.master_file('Client Cd,Agent Name,MDRT Title,Life Member\n00002,Valid,TOT,No\n00003,Invalid,BAD,Yes\n')
        result = import_agents_from_csv(p)
        self.assertFalse(result['success']); self.assertEqual(Agent.query.count(), 1)

    def test_missing_columns_and_duplicates_fail(self):
        for content in ['wrong,columns\n1,2\n', 'Client Cd,Agent Name,MDRT Title\n00002,A,TOT\n00002,B,COT\n']:
            self.assertFalse(import_agents_from_csv(self.master_file(content))['success'])
            self.assertEqual(Agent.query.count(), 1)

    def test_badges_leading_zeroes_and_merge(self):
        p = self.master_file('Client Cd,Agent Name,MDRT Title,Life Member,Honor Roll,Quarter Century\n00002,New Agent,tot,No,HR,False\n')
        self.assertTrue(import_agents_from_csv(p)['success'])
        agent = Agent.query.filter_by(client_code='00002').one()
        self.assertFalse(agent.life_member); self.assertTrue(agent.honor_roll); self.assertFalse(agent.quarter_century)
        self.assertEqual(agent.mdrt_tier, 'TOT'); self.assertEqual(Agent.query.count(), 2)

    def test_failed_commit_rolls_back_import(self):
        p = self.master_file('Client Cd,Agent Name,MDRT Title\n00002,New Agent,TOT\n')
        with patch.object(db.session, 'commit', side_effect=RuntimeError('simulated disk failure')):
            self.assertFalse(import_agents_from_csv(p)['success'])
        self.assertEqual(Agent.query.count(), 1)

    def test_invalid_master_upload_leaves_no_history_or_asset(self):
        headers = self.login()
        response = self.client.post('/api/admin/upload-csv', data={'csv': (io.BytesIO(b'bad,columns\n1,2'), 'master.csv')}, headers=headers)
        self.assertEqual(response.status_code, 400)
        self.assertEqual(CSVUploadHistory.query.count(), 0)
        self.assertEqual(SystemAsset.query.count(), 0)
        self.assertEqual(list((Path(web.ADMIN_ASSETS_FOLDER)/'csv_history').iterdir()), [])

    def test_successful_master_upload_commits_metadata_together(self):
        headers = self.login()
        content=b'Client Cd,Agent Name,MDRT Title\n00002,New Agent,TOT\n'
        response=self.client.post('/api/admin/upload-csv', data={'csv':(io.BytesIO(content),'master.csv')}, headers=headers)
        self.assertEqual(response.status_code,200)
        self.assertEqual(CSVUploadHistory.query.count(),1); self.assertEqual(SystemAsset.query.count(),1)
        self.assertEqual(Agent.query.count(),2)

    def test_clear_and_agent_delete_preserve_history(self):
        cert = self.cert(); identifier = cert.id
        headers = self.login()
        self.assertEqual(self.client.delete('/api/admin/delete-csv', headers=headers).status_code,200)
        db.session.expire_all()
        cert=db.session.get(Certificate,identifier)
        self.assertIsNone(cert.agent_id); self.assertEqual(cert.client_code_snapshot,'00001')
        self.assertEqual(cert.agent_name_snapshot,'Example Agent')
        self.assertTrue(Path(cert.filepath).exists())

    def test_single_agent_delete_sets_null_reference(self):
        cert=self.cert(); identifier=cert.id; agent_id=self.agent.id
        headers=self.login()
        self.assertEqual(self.client.delete(f'/api/agents/{agent_id}',headers=headers).status_code,200)
        db.session.expire_all()
        self.assertIsNone(db.session.get(Certificate,identifier).agent_id)

    def test_historical_badges_ignore_current_agent_changes(self):
        cert=self.cert(); self.agent.life_member=True; db.session.commit()
        self.login()
        row=self.client.get('/api/certificates/history').json['certificates'][0]
        self.assertFalse(row['life_member'])

    def test_asset_validation_preserves_previous_asset(self):
        headers=self.login(); path=Path(web.ADMIN_ASSETS_FOLDER)/'backgrounds/MDRT.png'; path.write_bytes(png((300,300)).getvalue()); before=path.read_bytes()
        response=self.client.post('/api/admin/upload-backgrounds',data={'MDRT':(io.BytesIO(b'not an image'),'fake.png')},headers=headers)
        self.assertEqual(response.status_code,400); self.assertEqual(path.read_bytes(),before)
        self.assertEqual(SystemAsset.query.count(),0)

    def test_asset_versions_are_immutable(self):
        headers=self.login()
        for color in ['red','blue']:
            response=self.client.post('/api/admin/upload-backgrounds',data={'MDRT':(png((300,300),color),'image.jpg')},headers=headers)
            self.assertEqual(response.status_code,200)
        self.assertEqual(len(list((Path(web.ADMIN_ASSETS_FOLDER)/'versions').glob('*.png'))),2)
        self.assertEqual(SystemAsset.query.count(),1)
        with self.client.get('/api/admin/preview-asset/backgrounds/MDRT.png') as response:self.assertEqual(response.status_code,200)

    def test_delete_removes_original_and_generated_image(self):
        cert=self.cert(); filename=Path(cert.filepath); photo=Path(cert.original_photo_filepath)
        headers=self.login()
        self.assertEqual(self.client.delete(f'/api/certificates/{cert.id}',headers=headers).status_code,200)
        self.assertFalse(filename.exists()); self.assertFalse(photo.exists())

    def test_staged_delete_restores_after_database_failure(self):
        path=Path(self.temp.name)/'restore.txt';path.write_text('keep')
        with self.assertRaises(RuntimeError):
            with staged_delete([path]): raise RuntimeError('commit failed')
        self.assertEqual(path.read_text(),'keep')

    def test_failed_generation_cleans_up_files(self):
        token=self.bootstrap()
        with patch.object(web, 'enqueue_generation', return_value=SimpleNamespace(id='rq-failed')):
            response=self.client.post('/api/user/upload-photo',data={'client_code':'00001','photo':(png(),'portrait.png')},headers={'X-CSRF-Token':token})
        self.assertEqual(response.status_code,202)
        with self.assertLogs(web.app.logger, level='ERROR'), patch.object(web,'generate_certificate_for_agent',side_effect=RuntimeError('failed')):
            result = web.process_generation_job(response.json['job']['id'])
        self.assertEqual(result['status'], 'failed')
        self.assertEqual(GenerationJob.query.one().status, 'failed')
        for folder in ('USER_UPLOADS_FOLDER','USER_PHOTOS_FOLDER','USER_OUTPUTS_FOLDER'):
            self.assertEqual(list(Path(getattr(web,folder)).iterdir()),[])

    def test_per_owner_queue_limit_rejects_without_writing_files(self):
        token=self.bootstrap()
        original = web.app.config['GENERATION_QUEUE_PER_OWNER']
        web.app.config['GENERATION_QUEUE_PER_OWNER'] = 1
        try:
            with patch.object(web, 'enqueue_generation', return_value=SimpleNamespace(id='rq-first')):
                first=self.client.post('/api/user/upload-photo',data={'client_code':'00001','photo':(png(),'portrait.png')},headers={'X-CSRF-Token':token})
            self.assertEqual(first.status_code,202)
            response=self.client.post('/api/user/upload-photo',data={'client_code':'00001','photo':(png(),'portrait.png')},headers={'X-CSRF-Token':token})
            self.assertEqual(response.status_code,429)
            self.assertEqual(len(list(Path(web.USER_PHOTOS_FOLDER).iterdir())),1)
        finally:
            web.app.config['GENERATION_QUEUE_PER_OWNER'] = original

    def test_generation_records_owner_and_snapshots(self):
        token=self.bootstrap()
        def generate(agent,path):
            output=Path(web.USER_OUTPUTS_FOLDER)/'unique.png'; output.write_bytes(png().getvalue())
            return output.name,str(output),{'renderer_version':2}
        with patch.object(web, 'enqueue_generation', return_value=SimpleNamespace(id='rq-complete')):
            response=self.client.post('/api/user/upload-photo',data={'client_code':'00001','photo':(png(),'portrait.png')},headers={'X-CSRF-Token':token})
        self.assertEqual(response.status_code,202)
        with patch.object(web,'generate_certificate_for_agent',side_effect=generate):
            result = web.process_generation_job(response.json['job']['id'])
        self.assertEqual(result['status'], 'completed')
        cert=Certificate.query.one();self.assertEqual(cert.client_code_snapshot,'00001');self.assertTrue(cert.generated_by)
        self.assertTrue(cert.original_photo_filename.endswith('.jpg'))
        self.assertLessEqual(cert.original_photo_size, 5 * 1024 * 1024)
        self.assertEqual(list(Path(web.USER_UPLOADS_FOLDER).iterdir()),[])
        with self.client.get('/api/user/download/unique.png') as response:self.assertEqual(response.status_code,200)
        db.session.refresh(cert);self.assertEqual(cert.download_count,1)

    def test_generation_status_is_scoped_to_the_creating_browser(self):
        token=self.bootstrap()
        with patch.object(web, 'enqueue_generation', return_value=SimpleNamespace(id='rq-status')):
            response=self.client.post('/api/user/upload-photo',data={'client_code':'00001','photo':(png(),'portrait.png')},headers={'X-CSRF-Token':token})
        self.assertEqual(response.status_code,202)
        job_id=response.json['job']['id']
        status=self.client.get(f'/api/user/generation-jobs/{job_id}')
        self.assertEqual(status.status_code,200)
        self.assertEqual(status.json['job']['status'],'queued')
        self.assertEqual(status.json['job']['queue_position'],1)
        other=self.new_client();self.bootstrap(other)
        self.assertEqual(other.get(f'/api/user/generation-jobs/{job_id}').status_code,404)

    def test_unavailable_queue_removes_stored_photo_and_job(self):
        token=self.bootstrap()
        with self.assertLogs(web.app.logger, level='ERROR'), patch.object(web, 'enqueue_generation', side_effect=OSError('redis down')):
            response=self.client.post('/api/user/upload-photo',data={'client_code':'00001','photo':(png(),'portrait.png')},headers={'X-CSRF-Token':token})
        self.assertEqual(response.status_code,503)
        self.assertEqual(GenerationJob.query.count(),0)
        self.assertEqual(list(Path(web.USER_PHOTOS_FOLDER).iterdir()),[])

    def test_renderer_fits_tall_portrait_and_has_fixed_dimensions(self):
        path=Path(web.ADMIN_ASSETS_FOLDER)/'backgrounds/MDRT.png';path.write_bytes(png((600,900)).getvalue())
        portrait=Image.new('RGBA',(100,1000),'white')
        with patch.object(web,'remove_background',return_value=portrait):
            filename,output,metadata=web.generate_certificate_for_agent(self.agent,'unused.png')
        with Image.open(output) as image:self.assertEqual(image.size,(1800,3184))
        self.assertEqual(metadata['output_size'],[1800,3184]);self.assertIn('background/MDRT',metadata['assets'])
        self.assertNotIn('Example',filename)

    def test_renderer_keeps_padded_nametag_visible_and_caches_correct_foreground(self):
        (Path(web.ADMIN_ASSETS_FOLDER)/'backgrounds/MDRT.png').write_bytes(png((600,900)).getvalue())
        tag = Image.new('RGBA', (1873,3334))
        tag.paste((255,0,255,255), (25,2404,1803,3164))
        tag.save(Path(web.ADMIN_ASSETS_FOLDER)/'nametags/MDRT.png')
        with patch.object(web,'remove_background',return_value=Image.new('RGBA',(200,400),'white')), \
             patch.object(web,'draw_3d_metallic_text') as draw_name:
            _, output, metadata = web.generate_certificate_for_agent(self.agent,'unused.png')
        bounds = metadata['name_tag']['bounds']
        expected = (bounds['x'], bounds['y'], bounds['x']+bounds['width'], bounds['y']+bounds['height'])
        from portrait_editor import layer_paths
        with Image.open(layer_paths(web.USER_OUTPUTS_FOLDER,metadata['editor'])['foreground']) as foreground:
            self.assertEqual(foreground.getchannel('A').getbbox(),expected)
        self.assertLessEqual(expected[2],1800-90)
        self.assertLessEqual(expected[3],3184-90)
        with Image.open(output) as poster:
            self.assertEqual(poster.getpixel((expected[2]-2,expected[3]-2)),(255,0,255,255))
        self.assertEqual(draw_name.call_args.args[3:5],(930,2780))
        self.assertEqual(metadata['renderer_version'],6)

    def test_tier_overlay_alignment_and_badges_above_it_survive_portrait_edits(self):
        from portrait_editor import layer_paths, render_saved_layers
        self.agent.life_member = self.agent.honor_roll = self.agent.quarter_century = True
        root = Path(web.ADMIN_ASSETS_FOLDER)
        for badge in ('LM', 'HR', 'QC'):
            (root / 'badges' / f'{badge}.png').write_bytes(png((20, 20), 'lime').getvalue())
        for tier in ('MDRT', 'COT', 'TOT'):
            with self.subTest(tier=tier):
                self.agent.mdrt_tier = tier
                (root / 'backgrounds' / f'{tier}.png').write_bytes(png((1873, 3334), 'yellow').getvalue())
                overlay = Image.new('RGBA', (180, 320))
                overlay.paste('blue', (0, 110, 70, 260))
                overlay.paste('purple', (170, 310, 180, 320))
                overlay.save(root / 'layers' / f'{tier}.png')
                with patch.object(web, 'remove_background', return_value=Image.new('RGBA', (200, 400), 'red')):
                    _, output, metadata = web.generate_certificate_for_agent(self.agent, 'unused.png')
                with Image.open(output) as poster:
                    self.assertEqual(poster.size, (1800, 3184))
                    self.assertEqual(poster.getpixel((5, 5)), (255, 255, 0, 255))
                    self.assertEqual(poster.getpixel((1799, 3183)), (128, 0, 128, 255))
                    for y in (1400, 1850, 2300):
                        self.assertEqual(poster.getpixel((230, y)), (0, 255, 0, 255))
                self.assertEqual(metadata['canvas_layers']['background']['bounds'], [0, 0, 1800, 3184])
                self.assertEqual(metadata['canvas_layers']['tier_overlay']['bounds'], [0, 0, 1800, 3184])
                editor = metadata['editor']
                adjusted = render_saved_layers(web.USER_OUTPUTS_FOLDER, editor, {'scale': 1.2, 'offset_x': .05, 'offset_y': 0})
                for y in (1400, 1850, 2300):
                    self.assertEqual(adjusted.getpixel((230, y)), (0, 255, 0, 255))

    def test_pagination_filtering_and_private_metadata(self):
        self.cert();self.login()
        response=self.client.get('/api/certificates/history?per_page=1&search=Example')
        self.assertEqual(response.json['total'],1);self.assertEqual(len(response.json['certificates']),1)
        self.assertEqual(self.client.get('/api/certificates/history?per_page=101').status_code,400)
        self.assertEqual(self.client.get('/api/certificates/history?from=bad').status_code,400)
        self.assertNotIn('filepath',self.client.get('/api/certificates/recent').json['certificates'][0])
        readiness=self.client.get('/api/user/check-system').json;self.assertNotIn('status',readiness)

    def test_unsafe_paths_and_unknown_api_routes(self):
        with self.assertRaises(Exception):safe_path(web.USER_OUTPUTS_FOLDER,'../cert.key')
        self.assertEqual(self.client.get('/api/not-a-route').status_code,404)
        self.assertEqual(self.client.get('/api/not-a-route').content_type,'application/json')

    def test_render_config_exposes_layout_and_asset_urls_for_client_compositing(self):
        (Path(web.ADMIN_ASSETS_FOLDER)/'backgrounds/MDRT.png').write_bytes(png((10,10)).getvalue())
        (Path(web.ADMIN_ASSETS_FOLDER)/'badges/LM.png').write_bytes(png((10,10)).getvalue())
        update_agent(self.agent.id, life_member=True)
        response = self.client.get('/api/user/render-config/00001')
        self.assertEqual(response.status_code, 200)
        body = response.json
        self.assertEqual(body['agent'], {'name': 'Example Agent', 'tier': 'MDRT', 'badges': ['LM']})
        self.assertEqual(body['output_size'], [web.REFERENCE_WIDTH, web.REFERENCE_HEIGHT])
        self.assertEqual(body['layout'], web.POSITION_RATIOS)
        self.assertEqual(body['assets']['background'], 'user/assets/background/MDRT.png')
        self.assertEqual(body['assets']['badges'], {'LM': 'user/assets/badge/LM.png'})
        # No nametag asset was uploaded for MDRT, so the URL is omitted.
        self.assertIsNone(body['assets']['nametag'])
        self.assertEqual(body['font'], {'url': '/fonts/AvenirBlack.ttf', 'family': 'Avenir Black'})

    def test_render_config_unknown_client_code_returns_404(self):
        response = self.client.get('/api/user/render-config/does-not-exist')
        self.assertEqual(response.status_code, 404)

    def test_user_asset_serves_known_assets_and_rejects_unknown_or_path_tricks(self):
        (Path(web.ADMIN_ASSETS_FOLDER)/'backgrounds/MDRT.png').write_bytes(png((10,10)).getvalue())
        ok = self.client.get('/api/user/assets/background/MDRT.png')
        self.assertEqual(ok.status_code, 200)
        self.assertEqual(ok.mimetype, 'image/png')
        self.assertEqual(self.client.get('/api/user/assets/background/UNKNOWN.png').status_code, 404)
        self.assertEqual(self.client.get('/api/user/assets/badge/MDRT.png').status_code, 404)
        self.assertEqual(self.client.get('/api/user/assets/background/..%2f..%2fetc%2fpasswd').status_code, 404)
        self.assertEqual(self.client.get('/api/user/assets/notakind/MDRT.png').status_code, 404)

    def test_quarantine_preserves_referenced_and_recent_files(self):
        import time
        from storage import quarantine_unreferenced
        folder=Path(web.USER_OUTPUTS_FOLDER)
        for name in ['referenced.png','orphan.png','recent.png']:
            (folder/name).write_text('preserve bytes')
        for name in ['referenced.png','orphan.png']:
            os.utime(folder/name,(time.time()-7200,)*2)
        destination=Path(self.temp.name)/'quarantine'
        count=quarantine_unreferenced(folder.parent,{'outputs':{'referenced.png'}},destination)
        self.assertEqual(count,1)
        self.assertTrue((folder/'referenced.png').exists());self.assertTrue((folder/'recent.png').exists())
        self.assertFalse((folder/'orphan.png').exists())
        self.assertEqual((destination/'outputs/orphan.png').read_text(),'preserve bytes')
        self.assertTrue((destination/'manifest.json').exists())



if __name__=='__main__':unittest.main()
