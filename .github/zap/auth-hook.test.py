import importlib.util
import json
import os
import re
import tempfile
import unittest
from types import SimpleNamespace
from unittest.mock import Mock, patch

spec = importlib.util.spec_from_file_location('auth_hook', '.github/zap/auth-hook.py')
hook = importlib.util.module_from_spec(spec)
spec.loader.exec_module(hook)


class EvidenceTests(unittest.TestCase):
    def setUp(self):
        hook.reached_queries = 0

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

    def test_filter_only_matches_known_audit_session_id_not_other_timestamps(self):
        zap = SimpleNamespace(ascan=Mock(), replacer=Mock(), alertFilter=Mock())
        paths = {'/auditlogs': {'get': {'operationId': 'audit-list'}},
                 '/auditlogs/12': {'get': {'operationId': 'audit'}},
                 '/fwcloud/all/get': {'get': {'operationId': 'cloud-list'}}}
        with tempfile.TemporaryDirectory() as root, patch.object(hook, 'ROOT', root + '/'), patch.dict(
                os.environ, {'CI': 'true', 'ANALYSIS_COMMIT': 'a' * 40,
                             'ZAP_AUTH_HEADER_VALUE': 'private-cookie', 'ZAP_AUDIT_SESSION_ID': '1704114087'}):
            with open(root + '/authenticated.openapi.json', 'w') as destination:
                json.dump({'paths': paths}, destination)
            hook.zap_started(zap, 'unused')
        filters = zap.alertFilter.add_global_alert_filter.call_args_list
        self.assertEqual(len(filters), 2)
        for args, values in filters:
            self.assertEqual(args, ('10096', '0'))
            self.assertEqual(values['methods'], 'GET')
            self.assertIsNone(re.search(values['url'], hook.BASE + '/fwcloud/all/get'))
            self.assertIsNone(re.search(values['url'], hook.BASE + '/auditlogs/999'))
            self.assertIsNone(re.search(values['evidence'], '1704114088'))
            self.assertIsNone(re.search(values['parameter'], 'Set-Cookie'))
            self.assertIsNotNone(re.search(values['evidence'], '1704114087'))

    def test_import_counts_reached_queries_and_uses_verified_revision(self):
        message = {'requestHeader': 'GET ' + hook.BASE + '/auditlogs HTTP/1.1\r\n',
                   'responseHeader': 'HTTP/1.1 200 OK\r\n', 'responseBody': '{}'}
        zap = SimpleNamespace(core=SimpleNamespace(messages=lambda **kwargs: [message],
                              jsonreport=lambda: '{"site":[]}', version='2.17.0'),
                              pscan=SimpleNamespace(records_to_scan='0'))
        with tempfile.TemporaryDirectory() as root, patch.object(hook, 'ROOT', root + '/'), patch.dict(
                os.environ, {'ANALYSIS_COMMIT': 'a' * 40, 'GITHUB_SHA': 'f' * 40, 'GITHUB_RUN_ATTEMPT': '2'}):
            with open(root + '/authenticated.openapi.json', 'w') as destination:
                json.dump({'paths': {'/auditlogs': {'get': {}}}}, destination)
            hook.zap_active_scan(zap, hook.BASE, 'policy')
            hook.zap_pre_shutdown(zap)
            with open(root + '/authenticated.json') as source:
                result = json.load(source)
            self.assertEqual(result['authenticatedQueriesReached'], 1)
            self.assertEqual(result['commit'], 'a' * 40)
            self.assertEqual(result['runAttempt'], '2')

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
