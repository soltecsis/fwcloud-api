const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { test } = require('node:test');
const { resolveContext, verifyCoverage, prepare, recordEvidence } = require('./sonar-analysis.cjs');
const yaml = require('js-yaml');
const sha = 'a'.repeat(40);
const run = { repository: { full_name: 'org/api' }, id: 10, run_attempt: 2, workflow_id: 9,
  status: 'completed', conclusion: 'success', head_sha: sha, event: 'pull_request', head_branch: 'feature',
  head_repository: { id: 2, full_name: 'fork/api' }, pull_requests: [] };
const pr = { number: 7, state: 'open', base: { ref: 'ENS', repo: { full_name: 'org/api' } },
  head: { sha, ref: 'feature', repo: { id: 2 } } };
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

async function resolve(t, { editRun = () => {}, editPR = () => {}, editArtifacts = () => {}, editWorkflow = () => {} } = {}) {
  const current = structuredClone(run), pull = structuredClone(pr);
  const workflow = { name: 'FWCloud-API CI', path: '.github/workflows/nodejs.yml' };
  const artifacts = [{ name: 'backend-coverage-node22-mysql8-10-2', id: 99, size_in_bytes: 42, expired: false }];
  editRun(current); editPR(pull); editArtifacts(artifacts); editWorkflow(workflow);
  const listPulls = () => {}, listArtifacts = () => {};
  const outputs = {};
  const github = { rest: {
    actions: { getWorkflowRun: async () => ({ data: current }), getWorkflow: async () => ({ data: workflow }), listWorkflowRunArtifacts: listArtifacts },
    repos: { listPullRequestsAssociatedWithCommit: listPulls }, pulls: { get: async () => ({ data: pull }) },
  }, paginate: async endpoint => endpoint === listPulls ? [pull] : artifacts };
  const directory = temporary(t);
  // resolveContext writes only trusted aggregate context; isolate its cwd in tests.
  const original = process.cwd();
  process.chdir(directory);
  try {
    const result = await resolveContext({ github, context: { repo: { owner: 'org', repo: 'api' }, payload: { workflow_run: run } },
      core: { setOutput: (key, value) => { outputs[key] = value; } } });
    return { result, outputs };
  } finally { process.chdir(original); }
}

test('resolves a fork PR via the authenticated commit association when event PRs are empty', async t => {
  const { result, outputs } = await resolve(t);
  assert.equal(result.pr, 7);
  assert.equal(result.artifactId, 99);
  assert.match(outputs.args, /-Dsonar\.pullrequest\.base=ENS/);
  assert.match(outputs.args, new RegExp(`-Dsonar.scm.revision=${sha}`));
});

for (const [name, edit] of [
  ['a different producer', { editWorkflow: w => { w.path = '.github/workflows/other.yml'; } }],
  ['failed CI', { editRun: r => { r.conclusion = 'failure'; } }],
  ['an old rerun attempt', { editRun: r => { r.run_attempt = 3; } }],
  ['a changed PR revision', { editPR: p => { p.head.sha = 'b'.repeat(40); } }],
  ['a different source repository', { editPR: p => { p.head.repo.id = 3; } }],
  ['branch argument injection', { editPR: p => { p.head.ref = 'feature -Dsonar.host.url=https://other.invalid'; } }],
  ['missing coverage', { editArtifacts: a => { a.length = 0; } }],
  ['ambiguous coverage', { editArtifacts: a => { a.push({ ...a[0], id: 100 }); } }],
  ['expired coverage', { editArtifacts: a => { a[0].expired = true; } }],
]) test(`rejects ${name}`, async t => { await assert.rejects(resolve(t, edit)); });

test('accepts branch analysis only from the owning repository', async t => {
  const { outputs } = await resolve(t, { editRun: r => { r.event = 'push'; r.head_repository.full_name = 'org/api'; } });
  assert.match(outputs.args, /-Dsonar.branch.name=feature/);
  assert.ok(!outputs.args.includes('pullrequest'));
  await assert.rejects(resolve(t, { editRun: r => { r.event = 'push'; } }));
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

test('replaces hostile PR settings without following their symlink and rejects symlinked sources', t => {
  const directory = temporary(t);
  const source = path.join(directory, 'source'), coverage = path.join(directory, 'coverage');
  fs.mkdirSync(path.join(source, 'src'), { recursive: true });
  fs.mkdirSync(path.join(source, 'tests'));
  fs.mkdirSync(coverage);
  fs.writeFileSync(path.join(source, 'src/a.ts'), 'export const a = 1;\n');
  execFileSync('git', ['init', '--quiet', source]);
  execFileSync('git', ['-C', source, 'add', 'src/a.ts']);
  execFileSync('git', ['-C', source, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '--quiet', '-m', 'fixture']);
  const commit = execFileSync('git', ['-C', source, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const trusted = path.resolve(__dirname, '..');
  const target = path.join(directory, 'private.properties');
  fs.writeFileSync(target, 'private-canary');
  fs.symlinkSync(target, path.join(source, 'sonar-project.properties'));
  fs.writeFileSync(path.join(coverage, 'lcov.info'), lcov);
  const metadata = { ...evidence(), commit };
  fs.writeFileSync(path.join(coverage, 'analysis.json'), JSON.stringify(metadata));
  const result = prepare(source, coverage, trusted, { ...reference, commit });
  assert.equal(fs.readFileSync(target, 'utf8'), 'private-canary');
  assert.equal(fs.readFileSync(path.join(source, 'sonar-project.properties'), 'utf8'), fs.readFileSync(path.join(trusted, 'sonar-project.properties'), 'utf8'));
  assert.equal(result.coverageReportSha256, digest(lcov));
  fs.symlinkSync(target, path.join(source, 'src/escape.ts'));
  assert.throws(() => prepare(source, coverage, trusted, { ...reference, commit }), /Symlinks/);
});

test('failure evidence cannot claim a passed Quality Gate', t => {
  const original = process.cwd(), directory = temporary(t);
  const originalSummary = process.env.GITHUB_STEP_SUMMARY;
  process.env.GITHUB_STEP_SUMMARY = path.join(directory, 'summary.md');
  fs.mkdirSync(path.join(directory, 'reports/sonar'), { recursive: true });
  fs.mkdirSync(path.join(directory, 'source/.scannerwork'), { recursive: true });
  fs.writeFileSync(path.join(directory, 'source/.scannerwork/report-task.txt'),
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

test('privileged workflow uses trusted utilities, official scanner and an explicit evidence allowlist', () => {
  const w = yaml.load(fs.readFileSync('.github/workflows/sonarqube.yml', 'utf8'));
  assert.deepEqual(w.permissions, { contents: 'read', actions: 'read', 'pull-requests': 'read' });
  assert.deepEqual(w.on.workflow_run.workflows, ['FWCloud-API CI']);
  const steps = w.jobs.sonar.steps;
  const scanner = steps.find(s => s.id === 'scan');
  assert.equal(scanner.with.skipSignatureVerification, false);
  assert.equal(scanner.env.SONAR_HOST_URL, 'https://sonarcloud.io');
  assert.match(scanner.uses, /^SonarSource\/sonarqube-scan-action@[a-f0-9]{40}$/);
  for (const step of steps) {
    assert.ok(!/npm (ci|install)|npm run|node source\/|require\(['"]\.\/source/.test(step.run || step.with?.script || ''));
    if (step.env?.SONAR_TOKEN) assert.equal(step.id, 'scan');
    if (step.uses?.startsWith('actions/checkout')) assert.equal(step.with['persist-credentials'], false);
  }
  const upload = steps.find(s => s.uses?.startsWith('actions/upload-artifact'));
  assert.equal(upload.with.path, 'reports/sonar/metadata.json');
  const ci = yaml.load(fs.readFileSync('.github/workflows/nodejs.yml', 'utf8'));
  for (const job of ['quality', 'secrets', 'sca', 'dast', 'test']) {
    assert.match(ci.jobs[job].steps.find(s => s.uses?.startsWith('actions/checkout')).with.ref, /pull_request.head.sha/);
  }
});
