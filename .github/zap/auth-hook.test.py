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


def message(path='/auditlogs', status=200, body='{}'):
    return {'requestHeader': 'GET ' + hook.BASE + path + ' HTTP/1.1\r\n',
            'responseHeader': 'HTTP/1.1 ' + str(status) + ' Response\r\n', 'responseBody': body}


class EvidenceTests(unittest.TestCase):
    def setUp(self):
        hook.state, hook.targets = None, {}
        self.root = self.enterContext(tempfile.TemporaryDirectory())
        self.enterContext(patch.object(hook, 'ROOT', self.root + '/'))
        self.enterContext(patch.object(hook, 'CATALOG', os.path.abspath('.github/zap/routes.json')))
        self.enterContext(patch.object(hook, 'RULES', os.path.abspath('.github/zap/rules.tsv')))
        self.enterContext(patch.dict(os.environ, {
            'CI': 'true', 'ANALYSIS_COMMIT': 'a' * 40, 'GITHUB_SHA': 'f' * 40,
            'GITHUB_RUN_ID': '12', 'GITHUB_RUN_ATTEMPT': '2',
            'ZAP_AUTH_HEADER_VALUE': 'private-cookie', 'ZAP_AUDIT_SESSION_ID': '1704114087'}))

    def laboratory(self, paths=None, messages=None, report=None):
        with open(self.root + '/authenticated.openapi.json', 'w') as destination:
            json.dump({'paths': paths or {'/auditlogs': {'get': {'operationId': 'audit-list'}}}}, destination)
        history = [message()] if messages is None else messages
        zap = SimpleNamespace(ascan=Mock(), replacer=Mock(), alertFilter=Mock(),
                              pscan=SimpleNamespace(records_to_scan='0'),
                              core=SimpleNamespace(version='2.17.0',
                                  messages=lambda start=0, count=500, **kwargs: history[start:start + count],
                                  jsonreport=lambda: json.dumps(report or {'site': []})))
        hook.zap_started(zap, 'unused')
        return zap

    def evidence(self):
        with open(self.root + '/authenticated.json') as source:
            return json.load(source)

    def test_report_never_copies_sensitive_fields(self):
        canary = 'private-cookie-password-token-TOTP-key'
        raw = {'site': [{'alerts': [{'pluginid': '10037', 'riskcode': '1', 'name': canary,
               'instances': [{'uri': hook.BASE + '/auditlogs?token=' + canary,
                              'requestHeader': canary}], 'evidence': canary}]}]}
        zap = self.laboratory(messages=[message('/auditlogs?secret=' + canary, body=canary)], report=raw)
        hook.zap_active_scan(zap, hook.BASE, 'policy')
        hook.zap_pre_shutdown(zap)
        hook.pre_exit(0, 0, 112)
        result = self.evidence()
        self.assertNotIn(canary, json.dumps(result))
        self.assertNotIn('uri', json.dumps(result))
        self.assertEqual(result['alerts'][0]['gateLevel'], 'INFO')
        self.assertEqual(result['alerts'][0]['operations'], [{'operationId': 'audit-list', 'instances': 1}])
        self.assertTrue(result['completed'])

    def test_filter_only_matches_known_audit_session_id_not_other_timestamps(self):
        zap = self.laboratory(paths={
            '/auditlogs': {'get': {'operationId': 'audit-list'}},
            '/auditlogs/12': {'get': {'operationId': 'audit'}},
            '/fwcloud/all/get': {'get': {'operationId': 'cloud-list'}}})
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
        zap = self.laboratory()
        hook.zap_active_scan(zap, hook.BASE, 'policy')
        hook.zap_pre_shutdown(zap)
        result = self.evidence()
        self.assertEqual(result['authenticatedQueriesReached'], 1)
        self.assertEqual(result['commit'], 'a' * 40)
        self.assertEqual(result['runAttempt'], '2')
        self.assertEqual(result['operations'][0]['observedStatuses'], [200])

    def test_incomplete_passive_scan_preserves_partial_evidence(self):
        zap = self.laboratory()
        hook.zap_active_scan(zap, hook.BASE, 'policy')
        zap.pscan.records_to_scan = '1'
        with self.assertRaises(RuntimeError):
            hook.zap_pre_shutdown(zap)
        hook.pre_exit(0, 0, 112)
        self.assertFalse(self.evidence()['completed'])
        self.assertEqual(self.evidence()['passiveQueueRemaining'], 1)

    def test_import_failure_keeps_unauthorized_and_missing_routes(self):
        zap = self.laboratory(paths={
            '/auditlogs': {'get': {'operationId': 'audit-list'}},
            '/auditlogs/12': {'get': {'operationId': 'audit'}}}, messages=[message(status=401)])
        with self.assertRaises(RuntimeError):
            hook.zap_active_scan(zap, hook.BASE, 'policy')
        hook.pre_exit(0, 0, 0)
        result = self.evidence()
        self.assertFalse(result['completed'])
        self.assertEqual(result['operations'][0]['observedStatuses'], [401])
        self.assertEqual(result['operations'][0]['importStatus'], 'unexpected_response')
        self.assertEqual(result['operations'][1]['importStatus'], 'not_reached')

    def test_stale_success_is_cleared_before_initialization_can_fail(self):
        with open(self.root + '/authenticated.json', 'w') as destination:
            json.dump({'completed': True, 'cookie': 'private-cookie'}, destination)
        with patch.dict(os.environ, {'CI': 'false'}), self.assertRaises(RuntimeError):
            hook.zap_started(Mock(), 'unused')
        hook.pre_exit(0, 0, 0)
        self.assertFalse(self.evidence()['completed'])
        self.assertNotIn('private-cookie', json.dumps(self.evidence()))

    def test_scope_cannot_publish_an_arbitrary_path_under_a_known_operation(self):
        with self.assertRaises(RuntimeError):
            self.laboratory(paths={'/auditlogs/private-cookie': {'get': {'operationId': 'audit'}}})
        self.assertNotIn('private-cookie', json.dumps(self.evidence()))

    def test_alert_association_keeps_unmapped_instances_without_publishing_urls(self):
        canary = 'private-cookie'
        instances = [{'uri': hook.BASE + '/auditlogs/12?token=' + canary},
                     {'uri': hook.BASE + '/auditlogs/12', 'method': 'POST'},
                     {'uri': hook.BASE + '/unknown/' + canary},
                     {'uri': 'https://outside.invalid/auditlogs/12'}]
        zap = self.laboratory(paths={'/auditlogs/12': {'get': {'operationId': 'audit'}}},
              messages=[message('/auditlogs/12')],
              report={'site': [{'alerts': [{'pluginid': '10096', 'riskcode': '1', 'instances': instances}]}]})
        hook.zap_active_scan(zap, hook.BASE, 'policy')
        hook.zap_pre_shutdown(zap)
        result = self.evidence()
        self.assertEqual(result['alerts'][0]['operations'], [{'operationId': 'audit', 'instances': 2}])
        self.assertEqual(result['alerts'][0]['unmappedInstances'], 2)
        self.assertEqual(result['alerts'][0]['gateLevel'], 'WARN')
        self.assertEqual(result['operations'][0]['route'], '/auditlogs/{audit}')
        self.assertNotIn(canary, json.dumps(result))
        self.assertNotIn('outside.invalid', json.dumps(result))

    def test_import_pages_history_and_rejects_an_empty_200(self):
        zap = self.laboratory(messages=[message('/unknown')] * 500 + [message()])
        hook.zap_active_scan(zap, hook.BASE, 'policy')
        self.assertEqual(self.evidence()['authenticatedQueriesReached'], 1)
        zap = self.laboratory(messages=[message(body='')])
        with self.assertRaises(RuntimeError):
            hook.zap_active_scan(zap, hook.BASE, 'policy')


if __name__ == '__main__':
    unittest.main()
