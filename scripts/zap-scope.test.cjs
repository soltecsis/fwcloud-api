const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');
const yaml = require('js-yaml');
const { openapi, queries, tableUrl } = require('../.github/zap/scope.cjs');

test('ZAP imports only the public login operation with valid-shaped synthetic inputs', () => {
  const scope = yaml.load(fs.readFileSync('.github/zap/login.openapi.yaml', 'utf8'));
  assert.deepEqual(Object.keys(scope.paths), ['/user/login']);
  assert.deepEqual(Object.keys(scope.paths['/user/login']), ['post']);
  assert.equal(scope.servers[0].url, 'http://127.0.0.1:3131');
  const operation = scope.paths['/user/login'].post;
  assert.deepEqual(operation.security, []);
  const body = operation.requestBody.content['application/json'];
  assert.deepEqual(body.schema.required, [
    'customer',
    'username',
    'password',
    'authCode',
    'publicKey',
  ]);
  assert.match(body.example.username, /^[a-zA-Z0-9]{3,32}$/);
  assert.ok(body.example.password.length >= 6 && body.example.password.length <= 64);
});

test('authenticated scope imports ten queries and cannot import the controlled write', () => {
  const r = {
    cloud: 101,
    firewall: 201,
    table: 301,
    route: 401,
    ipobj: 100001,
    rule: 501,
    audit: 601,
  };
  const scope = openapi(r);
  assert.equal(Object.keys(scope.paths).length, 10);
  assert.deepEqual(Object.keys(scope.paths[tableUrl(r)]), ['get']);
  assert.ok(!JSON.stringify(scope).includes('password'));
  assert.ok(!JSON.stringify(scope).includes('token'));
  assert.ok(!scope.paths['/user/login']);
  for (const query of queries(r)) {
    assert.ok(query.method === 'GET' || (query.method === 'PUT' && query.path.endsWith('/get')));
    assert.equal(Object.keys(scope.paths[query.path])[0], query.method.toLowerCase());
  }
});

test('CI publishes an explicit authenticated artifact allowlist and gates both scans', () => {
  const workflow = yaml.load(fs.readFileSync('.github/workflows/nodejs.yml', 'utf8'));
  const steps = workflow.jobs.dast.steps;
  const scan = steps.find((step) => step.id === 'authenticated_zap');
  const before = steps.find((step) => step.id === 'http_before');
  const publicIndex = steps.findIndex((step) => step.name === 'Official ZAP API Scan (login only)');
  const fixtureIndex = steps.findIndex(
    (step) => step.name === 'Create synthetic accounts after public reports are finished',
  );
  assert.ok(before && fixtureIndex > publicIndex);
  assert.match(scan.run, /zap-api-scan\.py/);
  assert.match(scan.run, /test "\$STATUS" -eq 0/);
  assert.ok(!scan.run.includes('-I'));
  assert.ok(!scan.run.includes(' -r ') && !scan.run.includes(' -J '));
  const upload = steps.find((step) => step.name?.startsWith('Publish credential-free'));
  assert.ok(upload.if.includes('steps.http_before.outcome'));
  assert.deepEqual(upload.with.path.trim().split('\n'), [
    'reports/dast/http-before.json',
    'reports/dast/http-after.json',
    'reports/dast/authenticated.json',
    'reports/dast/authenticated.openapi.json',
  ]);
});

test('CI runs the pinned official action and blocks scanner findings/errors', () => {
  const workflow = yaml.load(fs.readFileSync('.github/workflows/nodejs.yml', 'utf8'));
  const scan = workflow.jobs.dast.steps.find(
    (step) => step.name === 'Official ZAP API Scan (login only)',
  );
  assert.match(scan.uses, /^zaproxy\/action-api-scan@[a-f0-9]{40}$/);
  assert.equal(scan.with.fail_action, true);
  assert.equal(scan.with.allow_issue_writing, false);
  assert.equal(scan.with.target, '.github/zap/login.openapi.yaml');
  assert.match(scan.with.cmd_options, /(?:^|\s)-c\s+\.github\/zap\/rules\.tsv(?:\s|$)/);
  assert.ok(!scan.with.cmd_options.split(/\s+/).includes('-I'));
  assert.ok(workflow.jobs['backend-ci'].needs.includes('dast'));
  const rules = fs.readFileSync('.github/zap/rules.tsv', 'utf8');
  assert.ok(!/^100000\s+(INFO|IGNORE)/m.test(rules));
  assert.ok(!/^10096\s+(INFO|IGNORE)/m.test(rules));
  assert.ok(!/\tIGNORE\t/.test(rules));
});
