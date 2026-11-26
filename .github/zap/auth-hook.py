"""Bounded packaged scan hooks and public evidence, never raw traffic."""
import json
import os
import re
from collections import Counter
from datetime import datetime, timezone
from urllib.parse import urlparse

ROOT = '/zap/wrk/reports/dast/'
CATALOG = '/zap/wrk/.github/zap/routes.json'
RULES = '/zap/wrk/.github/zap/rules.tsv'
BASE = 'http://127.0.0.1:3131'
state = None
targets = {}
# Verified audit session identifier and the audit URL patterns where it may appear.
session_timestamp = None


def new_report():
    return {'completed': False, 'stage': 'not_started', 'actor': 'manager-a',
            'operations': [], 'alerts': [], 'authenticatedQueriesReached': 0,
            'passiveQueueRemaining': None, 'generatedAt': None,
            'commit': os.environ.get('ANALYSIS_COMMIT'),
            'runId': os.environ.get('GITHUB_RUN_ID'),
            'runAttempt': os.environ.get('GITHUB_RUN_ATTEMPT')}


def save():
    global state
    if state is None:
        state = new_report()
    state['generatedAt'] = datetime.now(timezone.utc).isoformat()
    with open(ROOT + 'authenticated.json.tmp', 'w') as destination:
        json.dump(state, destination, indent=2)
    os.replace(ROOT + 'authenticated.json.tmp', ROOT + 'authenticated.json')


def load_scope():
    with open(ROOT + 'authenticated.openapi.json') as source:
        spec = json.load(source)
    with open(CATALOG) as source:
        catalog = json.load(source)
    operations = {}
    for path, methods in spec['paths'].items():
        for method, operation in methods.items():
            operation_id = operation['operationId']
            definition = catalog[operation_id]
            pattern = ''.join('[0-9]+' if part.startswith('{') else re.escape(part)
                              for part in re.split(r'(\{[a-z]+\})', definition['route']))
            if method.upper() != definition['method'] or not re.fullmatch(pattern, path):
                raise RuntimeError('OpenAPI operation differs from the declared route catalog')
            operations[(method.upper(), path)] = {
                'operationId': operation_id, 'method': definition['method'],
                'route': definition['route'], 'expectedStatus': 200,
                'importStatus': 'not_attempted', 'observedStatuses': [], 'alerts': []}
    if not operations:
        raise RuntimeError('Authenticated scope is empty')
    return operations


def zap_started(zap, target):
    global state, targets, session_timestamp
    state, targets, session_timestamp = new_report(), {}, None
    save()  # Clear stale success before any operation which can fail.
    if os.environ.get('CI') != 'true' or not os.environ.get('ZAP_AUTH_HEADER_VALUE'):
        raise RuntimeError('Authenticated scan requires disposable CI credentials')
    if not re.fullmatch(r'[a-f0-9]{40}', os.environ.get('ANALYSIS_COMMIT', '')):
        raise RuntimeError('Authenticated scan requires the verified checkout revision')
    targets = load_scope()
    state.update(stage='importing', operations=list(targets.values()), zapVersion=zap.core.version)
    save()
    paths = '|'.join(re.escape(BASE + path) for _, path in targets)
    allowed = r'^(?:' + paths + r')(?:\?.*)?$'
    zap.ascan.exclude_from_scan(r'^(?!(?:' + paths + r')(?:\?.*)?$).*')
    zap.replacer.add_rule('Synthetic CI Origin', True, 'REQ_HEADER', False,
                          'Origin', 'https://zap.invalid', url=allowed)
    # Keep 10096 enabled except the exact persisted audit correlation hash.
    session_id = os.environ.get('ZAP_AUDIT_SESSION_ID', '')
    if not re.fullmatch(r'[0-9]{1,10}', session_id) or int(session_id) > 2147483647:
        raise RuntimeError('Missing verified audit correlation identifier')
    urls = ['^' + re.escape(BASE + path) + r'(?:\?.*)?$'
            for (method, path), operation in targets.items()
            if (operation['operationId'] in ('audit', 'audit-list')
                and method == 'GET' and re.fullmatch(r'/auditlogs(?:/[0-9]+)?', path))]
    session_timestamp = (session_id, urls)
    for url in urls:
        zap.alertFilter.add_global_alert_filter(
            '10096', '0', url=url, urlisregex=True,
            parameter=r'^$', parameterisregex=True, enabled=True, methods='GET',
            evidence='^' + session_id + '$', evidenceisregex=True)


def is_session_timestamp(alert):
    """Same criteria as the global 10096 filter: rule, GET, no parameter, exact value, audit URL."""
    if session_timestamp is None:
        return False
    session_id, urls = session_timestamp
    return (alert.get('pluginId') == '10096' and alert.get('method') == 'GET'
            and alert.get('param') == '' and alert.get('evidence') == session_id
            and any(re.fullmatch(url, alert.get('url', '')) for url in urls))


def zap_get_alerts(zap, baseurl, ignore_scan_rules, out_of_scope_dict):
    # ZAP defers global filters while an alert's message has no site node, so the packaged
    # gate can count the original Low risk. Apply the same scoped rule before it reads alerts.
    ids, start = [], 0
    while True:
        alerts = zap.alert.alerts(start=start, count=500)
        ids += [alert['id'] for alert in alerts
                if alert.get('risk') != 'Informational' and is_session_timestamp(alert)]
        if len(alerts) < 500:
            break
        start += len(alerts)
    if ids:
        zap.alert.update_alerts_risk(','.join(ids), 0)


def known_path(uri):
    try:
        parsed, base = urlparse(uri), urlparse(BASE)
        if parsed.scheme == base.scheme and parsed.netloc == base.netloc:
            return parsed.path
    except (TypeError, ValueError):
        pass
    return None


def zap_active_scan(zap, target, policy):
    if not targets:
        raise RuntimeError('Authenticated scope was not initialized')
    reached = set()
    start = 0
    while True:
        messages = zap.core.messages(baseurl=BASE, start=start, count=500)
        for message in messages:
            first = message.get('requestHeader', '').split('\r\n')[0].split(' ')
            response = message.get('responseHeader', '').split(' ')
            if len(first) < 2 or len(response) < 2:
                continue
            key = (first[0], known_path(first[1]))
            if key not in targets or not re.fullmatch(r'[1-5][0-9]{2}', response[1]):
                continue
            operation = targets[key]
            status = int(response[1])
            operation['observedStatuses'] = sorted(set(operation['observedStatuses'] + [status]))
            if status == 200 and message.get('responseBody', '').strip():
                reached.add(key)
        if len(messages) < 500:
            break
        start += len(messages)
    for key, operation in targets.items():
        operation['importStatus'] = ('reached' if key in reached else
                                     'unexpected_response' if operation['observedStatuses'] else 'not_reached')
    state.update(authenticatedQueriesReached=len(reached), stage='import_checked')
    save()  # Persist missing/unauthorized routes before the official scan fails.
    if reached != set(targets):
        raise RuntimeError('ZAP import did not reach every authenticated query')
    state['stage'] = 'active_scan_requested'
    save()


def aggregate_alerts(report):
    with open(RULES) as source:
        rules = {parts[0]: parts[1] for line in source
                 if not line.startswith('#') and len(parts := line.strip().split('\t')) >= 2}
    by_path = {path: operation for (_, path), operation in targets.items()}
    for operation in targets.values():
        operation['alerts'] = []
    alerts = []
    for site in report.get('site', []):
        for alert in site.get('alerts', []):
            plugin, risk = int(alert['pluginid']), int(alert['riskcode'])
            instances = alert.get('instances', [])
            associated = Counter()
            for instance in instances:
                operation = by_path.get(known_path(instance.get('uri', '')))
                if operation:
                    associated[operation['operationId']] += 1
            level = 'INFO' if risk == 0 else rules.get(str(plugin), 'WARN')
            entry = {'pluginId': plugin, 'riskCode': risk, 'instances': len(instances),
                     'gateLevel': level, 'operations': [
                         {'operationId': key, 'instances': count} for key, count in associated.items()],
                     'unmappedInstances': len(instances) - sum(associated.values())}
            alerts.append(entry)
            for operation in targets.values():
                if operation['operationId'] in associated:
                    operation['alerts'].append({'pluginId': plugin, 'riskCode': risk,
                                                'gateLevel': level, 'instances': associated[operation['operationId']]})
    return alerts


def zap_pre_shutdown(zap):
    state['passiveQueueRemaining'] = int(zap.pscan.records_to_scan)
    state['stage'] = 'collecting_results'
    save()
    if state['passiveQueueRemaining'] != 0:
        raise RuntimeError('Passive scan did not finish')
    state['alerts'] = aggregate_alerts(json.loads(zap.core.jsonreport()))
    state.update(completed=True, stage='completed', zapVersion=zap.core.version)
    save()


def pre_exit(fail_count, warn_count, pass_count):
    global state
    if state is None:
        state = new_report()
    state['packagedRules'] = {'fail': fail_count, 'warn': warn_count, 'pass': pass_count}
    save()
