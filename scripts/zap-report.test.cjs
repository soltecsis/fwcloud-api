const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');
const { test } = require('node:test');
const { openapi, queries, describe } = require('../.github/zap/scope.cjs');
const { render } = require('../.github/zap/report.cjs');

function fixture() {
  const resources = {
    cloud: 101,
    firewall: 201,
    table: 301,
    route: 401,
    ipobj: 501,
    rule: 601,
    audit: 701,
  };
  const ci = { commit: 'a'.repeat(40), runId: '10', runAttempt: '2' };
  const check = {
    name: 'activated 2FA rejects absent code',
    passed: true,
    kind: 'http',
    ...describe('POST', '/user/login'),
    actor: 'mfa-user',
    expectedStatus: 401,
    actualStatus: 401,
  };
  return {
    ci,
    scope: openapi(resources),
    scanExitCode: 0,
    zap: {
      ...ci,
      completed: true,
      passiveQueueRemaining: 0,
      packagedRules: { fail: 0, warn: 0, pass: 112 },
      alerts: [],
      operations: queries(resources).map((query) => ({
        ...describe(query.method, query.path),
        expectedStatus: 200,
        observedStatuses: [200],
        importStatus: 'reached',
        alerts: [],
      })),
    },
    before: { ...ci, phase: 'before', completed: true, checks: [check], requests: [] },
    after: {
      ...ci,
      phase: 'after',
      completed: true,
      checks: [{ name: 'scan preserved business state', kind: 'assertion', passed: true }],
      requests: [],
    },
  };
}

test('Markdown combines declared ZAP routes with separate HTTP controls', () => {
  const data = fixture();
  const { markdown, result } = render(data);
  assert.equal(result, 'PASSED');
  assert.ok(markdown.includes('/fwclouds/{cloud}/firewalls/{firewall}/routingTables/{table}'));
  assert.ok(!markdown.includes('/fwclouds/101'));
  assert.ok(markdown.includes('mfa-user | POST | `/user/login` | 401 | 401 | Correcto'));
  assert.ok(markdown.includes('scan preserved business state | — | — | — | — | — | Correcto'));
  assert.ok(markdown.includes('no cobertura de todos los ataques'));
});

test('native risk and gate classification are distinct and alerts refer only to known routes', () => {
  const data = fixture();
  data.zap.alerts = [
    {
      pluginId: 10037,
      riskCode: 1,
      instances: 2,
      gateLevel: 'INFO',
      operations: [{ operationId: 'audit', instances: 1 }],
      unmappedInstances: 1,
    },
  ];
  data.zap.operations.find((operation) => operation.operationId === 'audit').alerts =
    data.zap.alerts;
  const { markdown, result } = render(data);
  assert.equal(result, 'PASSED');
  assert.ok(markdown.includes('https://www.zaproxy.org/docs/alerts/10037/'));
  assert.ok(markdown.includes('riesgo 1; INFO; 2'));
  assert.ok(markdown.includes('`/auditlogs/{audit}` (1)'));
});

test('missing operations, phases and incomplete imports cannot appear as a passed report', () => {
  const data = fixture();
  data.zap.operations[0].importStatus = 'unexpected_response';
  data.zap.operations[0].observedStatuses = [401];
  data.zap.operations.pop();
  data.after = null;
  const { markdown, result } = render(data);
  assert.equal(result, 'INCOMPLETE');
  assert.ok(markdown.includes('Respuesta inesperada | 401'));
  assert.ok(markdown.includes('No intentada'));
  assert.ok(markdown.includes('No ejecutado'));
  assert.ok(markdown.includes('no se consideran ejecutadas ni correctas'));
  data.zap.operations.push(null);
  data.scope.paths['/ignored'] = null;
  assert.equal(render(data).result, 'INCOMPLETE');
});

test('scanner warnings, cancelled/failed steps and failed assertions retain failure', () => {
  for (const change of [
    (data) => {
      data.scanExitCode = 2;
    },
    (data) => {
      data.zap.packagedRules.warn = 1;
    },
    (data) => {
      data.outcomes = { after: 'cancelled' };
    },
    (data) => {
      data.before.checks[0].passed = false;
    },
  ]) {
    const data = fixture();
    change(data);
    assert.equal(render(data).result, 'FAILED');
  }
  const data = fixture();
  data.before.checks[0].actualStatus = 200;
  assert.equal(render(data).result, 'INCOMPLETE');
});

test('pending requests and escaped check names remain visible without a false success', () => {
  const data = fixture();
  data.before.requests = [
    {
      ...describe('GET', '/auditlogs'),
      actor: 'manager-a',
      outcome: 'pending',
      actualStatus: null,
    },
  ];
  data.before.checks[0].name = 'control <img src=x> | [link](https://example.invalid)';
  const { markdown, result } = render(data);
  assert.equal(result, 'INCOMPLETE');
  assert.ok(markdown.includes('Pendiente'));
  assert.ok(!markdown.includes('<img'));
  assert.ok(markdown.includes('\\[link\\]'));
});

test('reports never copy native URLs, payloads, credentials or unrecognized route metadata', () => {
  const data = fixture();
  const canary = 'PRIVATE_COOKIE_TOKEN_PASSWORD';
  data.zap.operations[0].route = canary;
  data.zap.operations[0].url = `http://example.invalid/${canary}`;
  data.zap.alerts = [
    {
      pluginId: 10096,
      riskCode: 0,
      instances: 2,
      gateLevel: 'INFO',
      name: canary,
      evidence: canary,
      requestHeader: canary,
      instancesDetail: [{ uri: canary }],
      operations: [{ operationId: canary, instances: 1 }],
      unmappedInstances: 2,
    },
  ];
  data.before.body = canary;
  data.before.checks[0].route = canary;
  data.before.checks[0].cookie = canary;
  data.before.checks[0].actor = canary;
  data.before.requests = [{ operationId: canary, actualStatus: canary, outcome: 'error' }];
  const { markdown, result } = render(data);
  assert.equal(result, 'FAILED');
  assert.ok(!markdown.includes(canary));
  assert.ok(!markdown.includes('example.invalid'));
});

test('report CLI writes the same Markdown to the artifact and Actions, including partial failures', (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'fwcloud-dast-report-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const data = fixture();
  const summary = path.join(directory, 'actions.md');
  for (const [file, value] of Object.entries({
    'authenticated.openapi.json': data.scope,
    'authenticated.json': data.zap,
    'http-before.json': data.before,
    'http-after.json': data.after,
  }))
    fs.writeFileSync(path.join(directory, file), JSON.stringify({ ...value, commit }));
  const env = {
    ...process.env,
    ANALYSIS_COMMIT: commit,
    GITHUB_RUN_ID: '10',
    GITHUB_RUN_ATTEMPT: '2',
    DAST_REPORT_DIR: directory,
    GITHUB_STEP_SUMMARY: summary,
    ZAP_EXIT_CODE: '0',
  };
  const run = () =>
    spawnSync(process.execPath, ['.github/zap/report.cjs'], { encoding: 'utf8', env });
  const success = run();
  assert.equal(success.status, 0, success.stderr);
  assert.equal(
    fs.readFileSync(path.join(directory, 'summary.md'), 'utf8'),
    fs.readFileSync(summary, 'utf8'),
  );
  fs.rmSync(path.join(directory, 'http-after.json'));
  assert.equal(run().status, 1);
  assert.ok(fs.readFileSync(path.join(directory, 'summary.md'), 'utf8').includes('INCOMPLETE'));
  fs.writeFileSync(path.join(directory, 'authenticated.json'), '{broken');
  assert.equal(run().status, 1);
  fs.writeFileSync(
    path.join(directory, 'authenticated.json'),
    JSON.stringify({ ...data.zap, commit: 'f'.repeat(40) }),
  );
  assert.equal(run().status, 1);
});
