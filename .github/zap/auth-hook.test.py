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
    def test_timestamp_session_check_publishes_counts_only(self):
        uri = hook.BASE + '/auditlogs'
        evidence = '1704114087'
        canary = 'private-cookie-password-token-TOTP-key'
        raw = {'site': [{'alerts': [{'pluginid': '10096', 'riskcode': '1',
                                    'instances': [{'uri': uri, 'method': 'GET',
                                                   'evidence': evidence}]}]}]}
        message = {'requestHeader': f'GET {uri} HTTP/1.1\r\nCookie: {canary}\r\n',
                   'responseBody': json.dumps({'auditLogs': [{'sessionId': int(evidence),
                                                            'description': canary}]})}
        zap = SimpleNamespace(pscan=SimpleNamespace(records_to_scan='0'),
                              core=SimpleNamespace(jsonreport=lambda: json.dumps(raw), version='2.17.0',
                                                   messages=lambda **kwargs: [message]))
        with tempfile.TemporaryDirectory() as root, patch.object(hook, 'ROOT', root + '/'):
            hook.zap_pre_shutdown(zap)
            hook.pre_exit(0, 1, 111)
            with open(root + '/authenticated.json') as source:
                result = json.load(source)
        self.assertEqual(result['timestampSessionDiagnostics'], {
            'instances': 1, 'checkedInstances': 1, 'matchingSessionId': 1, 'uncheckedInstances': 0})
        for sensitive in [evidence, canary, uri]:
            self.assertNotIn(sensitive, json.dumps(result))
        self.assertEqual(result['packagedRules']['warn'], 1)

    def test_timestamp_check_requires_matching_method_url_and_field(self):
        uri = hook.BASE + '/auditlogs'
        raw = {'site': [{'alerts': [{'pluginid': '10096', 'instances': [
            {'uri': uri, 'method': 'GET', 'evidence': '1704114087'},
            {'uri': uri + '/1', 'method': 'GET', 'evidence': '1704114087'},
            {'uri': uri + '/2', 'method': 'GET', 'evidence': '1704114087'},
        ]}]}]}
        messages = [
            {'requestHeader': f'GET {uri} HTTP/1.1\r\n',
             'responseBody': '{"other":1704114087,"sessionId":123}'},
            {'requestHeader': f'POST {uri} HTTP/1.1\r\n',
             'responseBody': '{"sessionId":1704114087}'},
            {'requestHeader': f'GET {uri}/1 HTTP/1.1\r\n', 'responseBody': 'not JSON'},
        ]
        zap = SimpleNamespace(core=SimpleNamespace(messages=lambda **kwargs: messages))
        self.assertEqual(hook.timestamp_session_diagnostics(zap, raw), {
            'instances': 3, 'checkedInstances': 1, 'matchingSessionId': 0, 'uncheckedInstances': 2})

    def test_timestamp_check_paginates_and_handles_unavailable_messages(self):
        uri = hook.BASE + '/auditlogs/1'
        raw = {'site': [{'alerts': [{'pluginid': '10096', 'instances': [
            {'uri': uri, 'method': 'GET', 'evidence': '1704114087'},
        ]}]}]}
        offsets = []

        def messages(**kwargs):
            offsets.append(kwargs['start'])
            if kwargs['start'] == 0:
                return [{'requestHeader': '', 'responseBody': ''}] * 500
            return [{'requestHeader': f'GET {uri} HTTP/1.1\r\n',
                     'responseBody': '{"auditLog":{"sessionId":1704114087}}'}]

        zap = SimpleNamespace(core=SimpleNamespace(messages=messages))
        self.assertEqual(hook.timestamp_session_diagnostics(zap, raw)['matchingSessionId'], 1)
        self.assertEqual(offsets, [0, 500])

        def unavailable(**kwargs):
            raise RuntimeError('private-cookie-token')

        zap.core.messages = unavailable
        self.assertEqual(hook.timestamp_session_diagnostics(zap, raw), {
            'instances': 1, 'checkedInstances': 0, 'matchingSessionId': 0, 'uncheckedInstances': 1})

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
