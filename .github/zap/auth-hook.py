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


def zap_started(zap, target):
    if os.environ.get('CI') != 'true' or not os.environ.get('ZAP_AUTH_HEADER_VALUE'):
        raise RuntimeError('Authenticated scan requires disposable CI credentials')
    with open(ROOT + 'authenticated.openapi.json') as source:
        spec = json.load(source)
    paths = '|'.join(re.escape(BASE + path) for path in spec['paths'])
    allowed = r'^(?:' + paths + r')(?:\?.*)?$'
    zap.ascan.exclude_from_scan(r'^(?!(?:' + paths + r')(?:\?.*)?$).*')
    zap.replacer.add_rule('Synthetic CI Origin', True, 'REQ_HEADER', False,
                         'Origin', 'https://zap.invalid', url=allowed)


def zap_active_scan(zap, target, policy):
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


def session_ids(value):
    """Inspect JSON in memory without retaining bodies or session values in evidence."""
    if isinstance(value, dict):
        for key, child in value.items():
            if key == 'sessionId' and type(child) is int:
                yield str(child)
            else:
                yield from session_ids(child)
    elif isinstance(value, list):
        for child in value:
            yield from session_ids(child)


def timestamp_session_diagnostics(zap, report):
    instances = [instance
                 for site in report.get('site', []) for alert in site.get('alerts', [])
                 if str(alert.get('pluginid')) == '10096'
                 for instance in alert.get('instances', [])]
    result = {'instances': len(instances), 'checkedInstances': 0,
              'matchingSessionId': 0, 'uncheckedInstances': len(instances)}
    if not instances:
        return result
    # Match both method and exact URL; a value from another response is not evidence.
    targets = {(instance.get('method'), instance.get('uri')) for instance in instances}
    responses = {}
    try:
        start = 0
        while True:
            messages = zap.core.messages(baseurl=BASE, start=start, count=500)
            for message in messages:
                first = message.get('requestHeader', '').split('\r\n')[0].split(' ')
                if len(first) < 2 or (first[0], first[1]) not in targets:
                    continue
                try:
                    body = json.loads(message.get('responseBody', ''))
                except (TypeError, ValueError):
                    continue
                responses.setdefault((first[0], first[1]), set()).update(session_ids(body))
            if len(messages) < 500:
                break
            start += len(messages)
    except Exception:
        # Optional diagnostics must not change the official scan's outcome.
        # Never copy exception text: it may contain headers or credentials.
        return result
    for instance in instances:
        key = (instance.get('method'), instance.get('uri'))
        evidence = str(instance.get('evidence', ''))
        if key in responses and re.fullmatch(r'[0-9]{10}', evidence):
            result['checkedInstances'] += 1
            if evidence in responses[key]:
                result['matchingSessionId'] += 1
    result['uncheckedInstances'] -= result['checkedInstances']
    return result


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
              'timestampSessionDiagnostics': timestamp_session_diagnostics(zap, report),
              'authenticatedQueriesReached': 10, 'passiveQueueRemaining': 0,
              'generatedAt': datetime.now(timezone.utc).isoformat(),
              'commit': os.environ.get('GITHUB_SHA'), 'runId': os.environ.get('GITHUB_RUN_ID')}
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
