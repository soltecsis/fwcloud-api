"""Packaged API Scan hooks: bounded queries, Origin and credential-free evidence.

The official script owns import, active/passive scanning and rule/exit policy.
"""
import json
import os
import re
from datetime import datetime, timezone
from urllib.parse import urlparse

ROOT = '/zap/wrk/reports/dast/'
BASE = 'http://127.0.0.1:3131'
reached_queries = 0


def zap_started(zap, target):
    if os.environ.get('CI') != 'true' or not os.environ.get('ZAP_AUTH_HEADER_VALUE'):
        raise RuntimeError('Authenticated scan requires disposable CI credentials')
    if not re.fullmatch(r'[a-f0-9]{40}', os.environ.get('ANALYSIS_COMMIT', '')):
        raise RuntimeError('Authenticated scan requires the verified checkout revision')
    with open(ROOT + 'authenticated.openapi.json') as source:
        spec = json.load(source)
    paths = '|'.join(re.escape(BASE + path) for path in spec['paths'])
    allowed = r'^(?:' + paths + r')(?:\?.*)?$'
    zap.ascan.exclude_from_scan(r'^(?!(?:' + paths + r')(?:\?.*)?$).*')
    zap.replacer.add_rule('Synthetic CI Origin', True, 'REQ_HEADER', False,
                         'Origin', 'https://zap.invalid', url=allowed)
    # Audit sessionId is an opaque numeric correlation hash, not Unix time.
    # Keep 10096 enabled: only this exact, persisted fixture value on the two
    # authorized audit reads is a false positive. Other timestamps still block.
    session_id = os.environ.get('ZAP_AUDIT_SESSION_ID', '')
    if not re.fullmatch(r'\d{1,10}', session_id) or int(session_id) > 2147483647:
        raise RuntimeError('Missing verified audit correlation identifier')
    for path, operations in spec['paths'].items():
        if (operations.get('get', {}).get('operationId') in ('audit', 'audit-list')
                and re.fullmatch(r'/auditlogs(?:/\d+)?', path)):
            zap.alertFilter.add_global_alert_filter(
                '10096', '0', url='^' + re.escape(BASE + path) + r'(?:\?.*)?$', urlisregex=True,
                parameter=r'^$', parameterisregex=True, enabled=True, methods='GET',
                evidence='^' + session_id + '$', evidenceisregex=True)


def zap_active_scan(zap, target, policy):
    global reached_queries
    # Import must reach authorized content inside ZAP, not just see 401/403 pages.
    with open(ROOT + 'authenticated.openapi.json') as source:
        spec = json.load(source)
    expected = {(method.upper(), path) for path, operations in spec['paths'].items() for method in operations}
    reached = set()
    for message in zap.core.messages(baseurl=BASE, count=1000):
        first = message['requestHeader'].split('\r\n')[0].split(' ')
        if len(first) >= 2 and message['responseHeader'].split(' ')[1] == '200':
            key = (first[0], urlparse(first[1]).path)
            if key in expected and message['responseBody'].strip():
                reached.add(key)
    if reached != expected:
        raise RuntimeError('ZAP import did not reach every authenticated query')
    reached_queries = len(reached)


def zap_pre_shutdown(zap):
    if int(zap.pscan.records_to_scan) != 0:
        raise RuntimeError('Passive scan did not finish')
    report = json.loads(zap.core.jsonreport())
    # Allowlist numeric fields only. Never copy names, URLs, headers, bodies,
    # evidence, attack strings, cookies or private context into public artifacts.
    alerts = [{'pluginId': int(alert['pluginid']), 'riskCode': int(alert['riskcode']),
               'instances': len(alert.get('instances', []))}
              for site in report.get('site', []) for alert in site.get('alerts', [])]
    output = {'completed': True, 'zapVersion': zap.core.version, 'alerts': alerts,
              'authenticatedQueriesReached': reached_queries, 'passiveQueueRemaining': 0,
              'generatedAt': datetime.now(timezone.utc).isoformat(),
              'commit': os.environ.get('ANALYSIS_COMMIT'), 'runId': os.environ.get('GITHUB_RUN_ID'),
              'runAttempt': os.environ.get('GITHUB_RUN_ATTEMPT')}
    with open(ROOT + 'authenticated.json', 'w') as destination:
        json.dump(output, destination, indent=2)


def pre_exit(fail_count, warn_count, pass_count):
    destination = ROOT + 'authenticated.json'
    output = {'completed': False}
    if os.path.exists(destination):
        with open(destination) as source:
            output = json.load(source)
    output['packagedRules'] = {'fail': fail_count, 'warn': warn_count, 'pass': pass_count}
    with open(destination, 'w') as target:
        json.dump(output, target, indent=2)
