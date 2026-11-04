"""Exercise portrait editing using disposable certificates and synthetic images."""
import io
import unittest
from pathlib import Path
from unittest.mock import patch
from PIL import Image, ImageDraw
import test_regressions as fixtures
from database import db, Certificate
from portrait_editor import create_layers, layer_paths, compose, DEFAULT_TRANSFORM
from storage import atomic_image_save

web = fixtures.web


class PortraitEditorTests(unittest.TestCase):
    setUp = fixtures.Regressions.setUp
    tearDown = fixtures.Regressions.tearDown
    new_client = fixtures.Regressions.new_client
    bootstrap = fixtures.Regressions.bootstrap
    login = fixtures.Regressions.login
    cert = fixtures.Regressions.cert

    def editable_certificate(self):
        token = self.bootstrap()
        with self.client.session_transaction() as session:
            owner = session['owner']
        certificate = self.cert(owner=owner)
        background = Image.new('RGBA', (200,400), 'blue')
        portrait = Image.new('RGBA', (80,160), 'red')
        foreground = Image.new('RGBA', (200,400))
        ImageDraw.Draw(foreground).rectangle((0,0,200,30), fill='green')
        editor = create_layers(web.USER_OUTPUTS_FOLDER, background, portrait, foreground,
                               {'x':60, 'y':240, 'width':80, 'height':160})
        atomic_image_save(compose(background,portrait,foreground,editor,DEFAULT_TRANSFORM),certificate.filepath)
        certificate.render_metadata = {'editor':editor,'renderer_version':3,'font':{'size':80}}
        db.session.commit()
        return certificate, {'X-CSRF-Token':token}

    def test_editor_layers_are_private_and_manifest_has_no_internal_paths(self):
        cert, headers = self.editable_certificate()
        base = f'/api/user/certificates/{cert.id}/editor'
        response = self.client.get(base)
        self.assertEqual(response.status_code,200)
        self.assertEqual(response.json['portrait_rect']['x'],60)
        self.assertNotIn('asset_key',response.text); self.assertNotIn(self.temp.name,response.text)
        other = self.new_client(); self.bootstrap(other)
        for client, status in [(self.client,200),(other,404)]:
            self.assertEqual(client.get(base).status_code,status)
            for name in ('background','portrait','foreground'):
                with client.get(base+'/'+name) as result:
                    self.assertEqual(result.status_code,status)
                    self.assertEqual(result.headers['Cache-Control'],'no-store')
        self.assertEqual(other.post(f'/api/user/certificates/{cert.id}/adjust',json={}).status_code,403)
        self.login(other)
        self.assertEqual(other.get(base).status_code,200)
        self.assertEqual(self.client.get(base+'/unknown').status_code,404)

    def test_save_changes_only_portrait_and_updates_existing_history_without_ai(self):
        cert, headers = self.editable_certificate()
        old_file, original_photo, generated = Path(cert.filepath), Path(cert.original_photo_filepath), cert.generated_at
        values = {'scale':.5,'offset_x':.1,'offset_y':-.2}
        with patch.object(web,'remove_background',side_effect=AssertionError('AI must not run')):
            response = self.client.post(f'/api/user/certificates/{cert.id}/adjust',json={'revision':0,'transform':values},headers=headers)
        self.assertEqual(response.status_code,200)
        db.session.refresh(cert)
        self.assertFalse(old_file.exists());self.assertTrue(original_photo.exists())
        self.assertEqual(Certificate.query.count(),1)
        self.assertEqual(cert.generated_at,generated);self.assertEqual(cert.client_code_snapshot,'00001')
        self.assertEqual(cert.render_metadata['editor']['revision'],1)
        self.assertEqual(cert.render_metadata['editor']['transform'],values)
        self.assertEqual(cert.render_metadata['font'],{'size':80})
        with Image.open(cert.filepath) as result:
            self.assertEqual(result.size,(200,400))
            self.assertEqual(result.getpixel((10,10)),(0,128,0,255))
            self.assertEqual(result.getpixel((70,350)),(0,0,255,255))
            self.assertEqual(result.getpixel((110,210)),(255,0,0,255))
        with self.client.get('/api/user/download/'+cert.filename) as result:
            self.assertEqual(result.status_code,200)
            downloaded=Image.open(io.BytesIO(result.data));self.assertEqual(downloaded.getpixel((110,210)),(255,0,0,255))
        manifest=self.client.get(f'/api/user/certificates/{cert.id}/editor').json
        self.assertEqual(manifest['transform'],values);self.assertEqual(manifest['revision'],1)

    def test_invalid_transform_is_rejected_without_changing_certificate(self):
        cert, headers = self.editable_certificate(); before=Path(cert.filepath).read_bytes()
        bad = [None,{}, {'scale':True,'offset_x':0,'offset_y':0},
               {'scale':float('nan'),'offset_x':0,'offset_y':0},
               {'scale':float('inf'),'offset_x':0,'offset_y':0},
               {'scale':2.51,'offset_x':0,'offset_y':0},
               {'scale':1,'offset_x':2,'offset_y':0},
               {'scale':1,'offset_x':0,'offset_y':-1},
               {'scale':'1','offset_x':0,'offset_y':0}]
        for transform in bad:
            response=self.client.post(f'/api/user/certificates/{cert.id}/adjust',json={'revision':0,'transform':transform},headers=headers)
            self.assertEqual(response.status_code,400,transform)
        self.assertEqual(Path(cert.filepath).read_bytes(),before)
        self.assertEqual(cert.render_metadata['editor']['revision'],0)

    def test_stale_revision_and_missing_csrf_are_rejected(self):
        cert,headers=self.editable_certificate();url=f'/api/user/certificates/{cert.id}/adjust'
        data={'revision':0,'transform':{'scale':1.2,'offset_x':0,'offset_y':0}}
        self.assertEqual(self.client.post(url,json=data).status_code,403)
        self.assertEqual(self.client.post(url,json=data,headers=headers).status_code,200)
        current=cert.filename
        self.assertEqual(self.client.post(url,json=data,headers=headers).status_code,409)
        self.assertEqual(cert.filename,current);self.assertEqual(cert.render_metadata['editor']['revision'],1)

    def test_guest_cannot_save_another_sessions_certificate(self):
        cert,headers=self.editable_certificate();other=self.new_client();token=self.bootstrap(other)
        response=other.post(f'/api/user/certificates/{cert.id}/adjust',json={'revision':0,'transform':DEFAULT_TRANSFORM},headers={'X-CSRF-Token':token})
        self.assertEqual(response.status_code,404)

    def test_commit_failure_restores_previous_png_and_removes_new_file(self):
        cert,headers=self.editable_certificate();before=Path(cert.filepath).read_bytes();old_name=cert.filename
        with self.assertLogs(web.app.logger,level='ERROR'),patch.object(db.session,'commit',side_effect=RuntimeError('disk error')):
            response=self.client.post(f'/api/user/certificates/{cert.id}/adjust',json={'revision':0,'transform':{'scale':1.1,'offset_x':0,'offset_y':0}},headers=headers)
        self.assertEqual(response.status_code,500)
        db.session.refresh(cert)
        self.assertEqual(cert.filename,old_name);self.assertEqual(Path(cert.filepath).read_bytes(),before)
        self.assertEqual([p.name for p in Path(web.USER_OUTPUTS_FOLDER).glob('*.png')],[old_name])
        self.assertEqual(cert.render_metadata['editor']['revision'],0)

    def test_save_works_after_agent_or_templates_change(self):
        cert,headers=self.editable_certificate()
        self.agent.agent_name='New master name';self.agent.mdrt_tier='TOT';db.session.commit()
        response=self.client.post(f'/api/user/certificates/{cert.id}/adjust',json={'revision':0,'transform':{'scale':.8,'offset_x':0,'offset_y':0}},headers=headers)
        self.assertEqual(response.status_code,200)
        self.assertEqual(cert.agent_name_snapshot,'Example Agent');self.assertEqual(cert.tier_snapshot,'MDRT')

    def test_deleting_certificate_removes_cached_layers(self):
        cert,headers=self.editable_certificate()
        paths=layer_paths(web.USER_OUTPUTS_FOLDER,cert.render_metadata['editor'])
        headers=self.login()
        self.assertEqual(self.client.delete(f'/api/certificates/{cert.id}',headers=headers).status_code,200)
        self.assertFalse(paths['background'].parent.exists())

    def test_legacy_certificate_has_clear_unavailable_response(self):
        self.bootstrap()
        with self.client.session_transaction() as session:owner=session['owner']
        cert=self.cert(owner=owner)
        response=self.client.get(f'/api/user/certificates/{cert.id}/editor')
        self.assertEqual(response.status_code,409)
        self.assertIn('newly generated',response.json['error'])
