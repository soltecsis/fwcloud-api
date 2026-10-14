const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { execFileSync, spawnSync } = require('node:child_process');
const vm = require('node:vm');
const { test } = require('node:test');
const { verifyCoverage, prepare, recordEvidence } = require('./sonar-analysis.cjs');
const yaml = require('js-yaml');
const sha = 'a'.repeat(40);
const reference = { repository: 'org/api', commit: sha, runId: 10, runAttempt: 2, event: 'pull_request' };
const lcov = Buffer.from('SF:src/a.ts\nDA:1,1\nend_of_record\n');
const digest = value => createHash('sha256').update(value).digest('hex');
const evidence = () => ({ ...reference, node: 'v22.1.0', database: 'mysql8', coverageExpected: true,
  testOutcome: 'success', tests: { tests: 1, failures: 0 }, errors: [], coverageReportSha256: digest(lcov) });

function temporary(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'fwcloud-sonar-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return directory;
}

function checkout(t, event = 'push') {
  const directory = temporary(t);
  const source = path.join(directory, 'source'), coverage = path.join(directory, 'coverage');
  fs.mkdirSync(path.join(source, 'src'), { recursive: true });
  fs.mkdirSync(path.join(source, 'tests'));
  fs.mkdirSync(coverage);
  fs.writeFileSync(path.join(source, 'src/a.ts'), 'export const a = 1;\n');
  fs.copyFileSync(path.resolve(__dirname, '../sonar-project.properties'), path.join(source, 'sonar-project.properties'));
  execFileSync('git', ['init', '--quiet', source]);
  execFileSync('git', ['-C', source, 'add', 'src/a.ts']);
  execFileSync('git', ['-C', source, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '--quiet', '-m', 'fixture']);
  const commit = execFileSync('git', ['-C', source, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const env = { GITHUB_REPOSITORY: 'org/api', GITHUB_RUN_ID: '10', GITHUB_RUN_ATTEMPT: '2',
    GITHUB_EVENT_NAME: event, GITHUB_REF_NAME: 'ENS', ANALYSIS_COMMIT: commit,
    ...(event === 'pull_request' ? { PR_NUMBER: '7', GITHUB_HEAD_REF: 'feature', GITHUB_BASE_REF: 'ENS' } : {}) };
  fs.writeFileSync(path.join(coverage, 'lcov.info'), lcov);
  fs.writeFileSync(path.join(coverage, 'analysis.json'), JSON.stringify({ ...evidence(), commit, event }));
  return { source, coverage, env };
}

for (const event of ['push', 'pull_request', 'workflow_dispatch']) {
  test(`imports same-run coverage and constructs native scan arguments for ${event}`, t => {
    const { source, coverage, env } = checkout(t, event);
    const { metadata, args } = prepare(source, coverage, env);
    assert.equal(metadata.commit, env.ANALYSIS_COMMIT);
    assert.equal(metadata.coverageReportSha256, digest(lcov));
    assert.equal(fs.readFileSync(path.join(source, 'reports/coverage/lcov.info'), 'utf8'), lcov.toString());
    assert.ok(args.includes(`-Dsonar.scm.revision=${metadata.commit}`));
    if (event === 'pull_request') {
      assert.ok(args.includes('-Dsonar.pullrequest.base=ENS'));
      assert.ok(args.includes('-Dsonar.pullrequest.key=7'));
      assert.ok(!args.includes('-Dsonar.branch.name='));
    } else assert.ok(args.includes('-Dsonar.branch.name=ENS'));
  });
}

test('rejects stale revision, old attempts, missing coverage and argument injection before scanning', t => {
  const { source, coverage, env } = checkout(t);
  for (const override of [{ ANALYSIS_COMMIT: sha }, { GITHUB_RUN_ATTEMPT: '3' },
    { GITHUB_REF_NAME: 'ENS -Dsonar.host.url=https://other.invalid' }, { GITHUB_EVENT_NAME: 'pull_request_target' }]) {
    assert.throws(() => prepare(source, coverage, { ...env, ...override }));
  }
  fs.unlinkSync(path.join(coverage, 'lcov.info'));
  assert.throws(() => prepare(source, coverage, env));
});

test('requires the tested SHA, execution, successful reference tests and exact LCOV bytes', () => {
  assert.deepEqual(verifyCoverage(evidence(), lcov, reference), ['src/a.ts']);
  for (const changed of [{ commit: 'b'.repeat(40) }, { runAttempt: 1 }, { repository: 'other/api' },
    { node: 'v20.1.0' }, { testOutcome: 'failure' }, { tests: { tests: 0, failures: 0 } },
    { errors: ['incomplete'] }, { coverageReportSha256: 'b'.repeat(64) }]) {
    assert.throws(() => verifyCoverage({ ...evidence(), ...changed }, lcov, reference));
  }
});

test('rejects compiled, absolute, traversal and incomplete LCOV records', () => {
  for (const text of ['SF:dist/src/a.js\nDA:1,1\nend_of_record\n',
    'SF:/home/runner/src/a.ts\nDA:1,1\nend_of_record\n',
    'SF:src/../../private.ts\nDA:1,1\nend_of_record\n',
    'SF:src/a.ts\nDA:1,1\n', 'SF:src/a.ts\nend_of_record\n']) {
    const data = Buffer.from(text);
    assert.throws(() => verifyCoverage({ ...evidence(), coverageReportSha256: digest(data) }, data, reference));
  }
});

test('reports a missing mapped source without importing or silently discarding the LCOV', t => {
  const { source, coverage, env } = checkout(t);
  const data = Buffer.from(lcov.toString() + 'SF:src/container.ts\nDA:1,1\nend_of_record\n');
  const metadataPath = path.join(coverage, 'analysis.json');
  const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
  metadata.coverageReportSha256 = digest(data);
  fs.writeFileSync(path.join(coverage, 'lcov.info'), data);
  fs.writeFileSync(metadataPath, JSON.stringify(metadata));
  assert.throws(() => prepare(source, coverage, env), error =>
    error.code !== 'ENOENT' && /LCOV references missing original sources: src\/container\.ts/.test(error.message));
  assert.equal(fs.existsSync(path.join(source, 'reports/coverage/lcov.info')), false);
});

test('rejects symlinked analyzed sources', t => {
  const { source, coverage, env } = checkout(t);
  const directory = path.dirname(source);
  const target = path.join(directory, 'private.properties');
  fs.writeFileSync(target, 'private-canary');
  fs.symlinkSync(target, path.join(source, 'src/escape.ts'));
  assert.throws(() => prepare(source, coverage, env), /Symlinks/);
});

test('failure evidence cannot claim a passed Quality Gate', t => {
  const original = process.cwd(), directory = temporary(t);
  const originalSummary = process.env.GITHUB_STEP_SUMMARY;
  process.env.GITHUB_STEP_SUMMARY = path.join(directory, 'summary.md');
  fs.mkdirSync(path.join(directory, 'reports/sonar'), { recursive: true });
  fs.mkdirSync(path.join(directory, '.scannerwork'), { recursive: true });
  fs.writeFileSync(path.join(directory, '.scannerwork/report-task.txt'),
    'ceTaskId=task-123\ndashboardUrl=https://other.invalid/dashboard?id=private-canary\n');
  process.chdir(directory);
  try {
    recordEvidence(reference, 'failure');
    const result = JSON.parse(fs.readFileSync('reports/sonar/metadata.json', 'utf8'));
    assert.equal(result.qualityGate, 'FAILED_OR_INCOMPLETE');
    assert.equal(result.ceTaskId, 'task-123');
    assert.equal(result.dashboardUrl, undefined);
    assert.ok(!Object.hasOwn(result, 'token'));
  } finally {
    process.chdir(original);
    if (originalSummary === undefined) delete process.env.GITHUB_STEP_SUMMARY;
    else process.env.GITHUB_STEP_SUMMARY = originalSummary;
  }
});

test('same-workflow scan downloads only this execution coverage and exposes the token only to the scanner', () => {
  const ci = yaml.load(fs.readFileSync('.github/workflows/nodejs.yml', 'utf8'));
  assert.ok(!fs.existsSync('.github/workflows/sonarqube.yml'));
  assert.deepEqual(ci.permissions, { contents: 'read' });
  assert.deepEqual(ci.jobs.sonar.needs, ['quality', 'test', 'secrets', 'sca', 'dast']);
  const steps = ci.jobs.sonar.steps;
  const scanner = steps.find(s => s.id === 'scan');
  assert.equal(scanner.with.skipSignatureVerification, false);
  assert.equal(scanner.env.SONAR_HOST_URL, 'https://sonarcloud.io');
  assert.match(scanner.uses, /^SonarSource\/sonarqube-scan-action@[a-f0-9]{40}$/);
  for (const step of steps) {
    assert.ok(!/npm (ci|install)|npm run/.test(step.run || ''));
    if (step.env?.SONAR_TOKEN) assert.equal(step.id, 'scan');
    if (step.uses?.startsWith('actions/checkout')) assert.equal(step.with['persist-credentials'], false);
  }
  const upload = steps.find(s => s.uses?.startsWith('actions/upload-artifact'));
  assert.equal(upload.with.path, 'reports/sonar/metadata.json');
  const download = steps.find(s => s.uses?.startsWith('actions/download-artifact'));
  assert.equal(download.with.name, 'backend-coverage-node22-mysql8-${{ github.run_id }}-${{ github.run_attempt }}');
  assert.equal(download.with['run-id'], undefined);
  assert.equal(download.with['github-token'], undefined);
  assert.equal(download.with['artifact-ids'], undefined);
  for (const job of ['quality', 'secrets', 'sca', 'dast', 'test']) {
    assert.match(ci.jobs[job].steps.find(s => s.uses?.startsWith('actions/checkout')).with.ref, /pull_request.head.sha/);
  }
});

test('backend-ci requires Sonar success except for tokenless fork/Dependabot runs', t => {
  const ci = yaml.load(fs.readFileSync('.github/workflows/nodejs.yml', 'utf8'));
  const gate = ci.jobs['backend-ci'].steps[0];
  assert.ok(ci.jobs['backend-ci'].needs.includes('sonar'));
  const expression = ci.jobs.sonar.if.replace(/^\$\{\{\s*|\s*\}\}$/g, '').trim();
  assert.equal(gate.env.SONAR_REQUIRED.replace(/^\$\{\{\s*|\s*\}\}$/g, '').replace(/\s+/g, ' ').trim(), expression.replace(/\s+/g, ' '));
  const summary = path.join(temporary(t), 'summary.md');
  for (const [event, repo, actor, author, required] of [
    ['push', 'org/api', 'developer', 'developer', true],
    ['workflow_dispatch', 'org/api', 'developer', 'developer', true],
    ['pull_request', 'org/api', 'developer', 'developer', true],
    ['pull_request', 'fork/api', 'developer', 'developer', false],
    ['pull_request', 'org/api', 'dependabot[bot]', 'dependabot[bot]', false],
    ['pull_request', 'org/api', 'developer', 'dependabot[bot]', false],
  ]) {
    const github = { event_name: event, repository: 'org/api', actor,
      event: { pull_request: { head: { repo: { full_name: repo } }, user: { login: author } } } };
    assert.equal(vm.runInNewContext(expression, { github }), required);
    for (const status of ['success', 'failure', 'cancelled', 'skipped']) {
      const env = { ...process.env, QUALITY_RESULT: 'success', TEST_RESULT: 'success', SECRETS_RESULT: 'success',
        SCA_RESULT: 'success', DAST_RESULT: 'success', SONAR_REQUIRED: String(required), SONAR_RESULT: status,
        GITHUB_STEP_SUMMARY: summary };
      const result = spawnSync('bash', ['-e', '-c', gate.run], { env, encoding: 'utf8' });
      assert.equal(result.status === 0, required ? status === 'success' : status === 'skipped', `${event}/${repo}/${actor}/${status}`);
      env.TEST_RESULT = 'failure';
      assert.notEqual(spawnSync('bash', ['-e', '-c', gate.run], { env }).status, 0);
    }
  }
});
