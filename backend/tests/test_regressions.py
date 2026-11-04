"""Regression coverage runs against an in-memory DB and disposable files only."""
import io
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from datetime import datetime

os.environ['DATABASE_URL'] = 'sqlite:///:memory:'
os.environ['COOKIE_SECURE'] = 'false'
os.environ['SECRET_KEY'] = 'regression-test-secret-not-for-deployment'
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from werkzeug.security import generate_password_hash
from PIL import Image
import app_with_db as web
from database import db, Agent, Certificate, SystemAsset, CSVUploadHistory
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
        with self.assertLogs(web.app.logger, level='ERROR'), patch.object(web,'generate_certificate_for_agent',side_effect=RuntimeError('failed')):
            response=self.client.post('/api/user/upload-photo',data={'client_code':'00001','photo':(png(),'portrait.png')},headers={'X-CSRF-Token':token})
        self.assertEqual(response.status_code,500)
        for folder in ('USER_UPLOADS_FOLDER','USER_PHOTOS_FOLDER','USER_OUTPUTS_FOLDER'):
            self.assertEqual(list(Path(getattr(web,folder)).iterdir()),[])

    def test_busy_generator_rejects_without_writing_files(self):
        token=self.bootstrap();web.GENERATION_SLOT.acquire()
        try:
            response=self.client.post('/api/user/upload-photo',data={'client_code':'00001','photo':(png(),'portrait.png')},headers={'X-CSRF-Token':token})
            self.assertEqual(response.status_code,429)
        finally:web.GENERATION_SLOT.release()

    def test_generation_records_owner_and_snapshots(self):
        token=self.bootstrap()
        def generate(agent,path):
            output=Path(web.USER_OUTPUTS_FOLDER)/'unique.png'; output.write_bytes(png().getvalue())
            return output.name,str(output),{'renderer_version':2}
        with patch.object(web,'generate_certificate_for_agent',side_effect=generate):
            response=self.client.post('/api/user/upload-photo',data={'client_code':'00001','photo':(png(),'portrait.png')},headers={'X-CSRF-Token':token})
        self.assertEqual(response.status_code,200)
        cert=Certificate.query.one();self.assertEqual(cert.client_code_snapshot,'00001');self.assertTrue(cert.generated_by)
        self.assertEqual(list(Path(web.USER_UPLOADS_FOLDER).iterdir()),[])
        with self.client.get('/api/user/download/unique.png') as response:self.assertEqual(response.status_code,200)
        db.session.refresh(cert);self.assertEqual(cert.download_count,1)

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
        self.assertEqual(draw_name.call_args.args[3:5],(930,2750))
        self.assertEqual(metadata['renderer_version'],4)

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
