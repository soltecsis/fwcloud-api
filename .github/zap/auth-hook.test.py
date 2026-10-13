import importlib.util
import json
import tempfile
import unittest
from types import SimpleNamespace
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('auth_hook', '.github/zap/auth-hook.py')
hook = importlib.util.module_from_spec(spec)
spec.loader.exec_module(hook)


class EvidenceTests(unittest.TestCase):
    def test_report_never_copies_sensitive_fields(self):
        canary = 'private-cookie-password-token-TOTP-key'
        raw = {'site': [{'alerts': [{'pluginid': '10037', 'riskcode': '1', 'name': canary,
                                    'instances': [{'requestHeader': canary}], 'evidence': canary}]}]}
        zap = SimpleNamespace(pscan=SimpleNamespace(records_to_scan='0'),
                              core=SimpleNamespace(jsonreport=lambda: json.dumps(raw), version='2.17.0'))
        with tempfile.TemporaryDirectory() as root, patch.object(hook, 'ROOT', root + '/'):
            hook.zap_pre_shutdown(zap)
            hook.pre_exit(0, 0, 112)
            with open(root + '/authenticated.json') as source:
                result = json.load(source)
            self.assertNotIn(canary, json.dumps(result))
            self.assertEqual(result['alerts'], [{'pluginId': 10037, 'riskCode': 1, 'instances': 1}])
            self.assertTrue(result['completed'])

    def test_incomplete_passive_scan_fails(self):
        with self.assertRaises(RuntimeError):
            hook.zap_pre_shutdown(SimpleNamespace(pscan=SimpleNamespace(records_to_scan='1')))

    def test_import_of_unauthorized_pages_does_not_start_active_scan(self):
        message = {'requestHeader': 'GET http://127.0.0.1:3131/auditlogs HTTP/1.1\r\n',
                   'responseHeader': 'HTTP/1.1 401 Unauthorized\r\n', 'responseBody': '{}'}
        zap = SimpleNamespace(core=SimpleNamespace(messages=lambda **kwargs: [message]))
        with tempfile.TemporaryDirectory() as root, patch.object(hook, 'ROOT', root + '/'):
            with open(root + '/authenticated.openapi.json', 'w') as destination:
                json.dump({'paths': {'/auditlogs': {'get': {}}}}, destination)
            with self.assertRaises(RuntimeError):
                hook.zap_active_scan(zap, hook.BASE, 'API-Minimal')


if __name__ == '__main__':
    unittest.main()
