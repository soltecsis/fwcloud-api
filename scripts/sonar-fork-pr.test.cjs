const assert = require('node:assert/strict');
const { execFileSync, spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const yaml = require('js-yaml');
const { resolve, prepareFork } = require('./sonar-fork-pr.cjs');

const repository = { id: 12, full_name: 'soltecsis/fwcloud-api' };
const fork = {
  id: 42,
  full_name: 'developer/fwcloud-api',
  owner: { login: 'developer' },
  fork: true,
};
const run = {
  id: 123,
  run_attempt: 2,
  repository,
  head_repository: fork,
  head_branch: 'fix/feature',
  head_sha: 'a'.repeat(40),
  path: '.github/workflows/nodejs.yml',
  event: 'pull_request',
  conclusion: 'success',
  actor: { login: 'developer' },
  pull_requests: [],
};
const pr = {
  number: 7,
  state: 'open',
  user: { login: 'developer' },
  head: { repo: fork, ref: run.head_branch, sha: run.head_sha },
  base: { repo: repository, ref: 'fixes', sha: 'b'.repeat(40) },
};
const artifact = {
  id: 456,
  name: 'backend-coverage-node22-mysql8-123',
  digest: `sha256:${'c'.repeat(64)}`,
  workflow_run: { id: run.id },
  expired: false,
  size_in_bytes: 5000,
};
const trusted = path.resolve(__dirname, '..');

function fixtureRequest(candidate = pr, items = [artifact]) {
  return async (request) => {
    const url = new URL(request, 'https://example.invalid');
    if (url.pathname === '/pulls') {
      assert.equal(url.searchParams.get('state'), 'open');
      assert.equal(url.searchParams.get('base'), 'fixes');
      assert.equal(url.searchParams.get('head'), 'developer:fix/feature');
      return [candidate];
    }
    assert.equal(url.pathname, '/actions/runs/123/artifacts');
    assert.equal(url.searchParams.get('name'), artifact.name);
    return { total_count: items.length, artifacts: items };
  };
}

test('resolves the exact open fixes PR from GitHub even when the run lists no PRs', async () => {
  const selected = await resolve({ repository, workflow_run: run }, fixtureRequest());
  assert.equal(selected.pr, 7);
  assert.equal(selected.commit, run.head_sha);
  assert.equal(selected.baseCommit, pr.base.sha);
  assert.equal(selected.sourceRepository, fork.full_name);
  assert.equal(selected.artifactId, artifact.id);
  assert.equal(selected.digest, 'c'.repeat(64));
});

test('rejects unexpected workflow events and ignores stale, closed, unrelated or Dependabot PRs', async () => {
  for (const update of [
    { conclusion: 'failure' },
    { event: 'push' },
    { path: '.github/workflows/another.yml' },
    { head_repository: repository },
    { head_branch: null },
    { actor: { login: 'dependabot[bot]' } },
  ]) {
    await assert.rejects(
      resolve({ repository, workflow_run: { ...run, ...update } }, assert.fail),
      /Unexpected workflow run context/,
    );
  }
  for (const candidate of [
    { ...pr, base: { ...pr.base, ref: 'main' } },
    { ...pr, head: { ...pr.head, sha: 'd'.repeat(40) } },
    { ...pr, head: { ...pr.head, repo: { ...fork, id: 99 } } },
    { ...pr, state: 'closed' },
    { ...pr, user: { login: 'dependabot[bot]' } },
  ]) {
    const request = fixtureRequest(candidate);
    assert.equal(
      await resolve({ repository, workflow_run: run }, (url) => {
        assert.match(url, /^\/pulls\?/);
        return request(url);
      }),
      null,
    );
  }
});

test('fails if the artifact is missing, ambiguous, expired, excessive or from another run', async () => {
  for (const items of [
    [],
    [artifact, { ...artifact, id: 457 }],
    [{ ...artifact, expired: true }],
    [{ ...artifact, digest: null }],
    [{ ...artifact, size_in_bytes: 33 * 1024 * 1024 }],
    [{ ...artifact, workflow_run: { id: 321 } }],
  ]) {
    await assert.rejects(
      resolve({ repository, workflow_run: run }, fixtureRequest(pr, items)),
      /Expected one bounded, unexpired coverage artifact/,
    );
  }
});

function temporary(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'fwcloud-fork-sonar-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return directory;
}

function checkout(t) {
  const directory = temporary(t);
  const origin = path.join(directory, 'origin');
  const source = path.join(directory, 'candidate');
  const coverage = path.join(directory, 'coverage');
  const git = (where, ...args) =>
    execFileSync('git', ['-C', where, ...args], { encoding: 'utf8' }).trim();
  fs.mkdirSync(origin);
  fs.mkdirSync(coverage);
  git(origin, 'init', '--initial-branch=fixes', '--quiet');
  git(origin, 'config', 'user.name', 'Fixture');
  git(origin, 'config', 'user.email', 'fixture@example.invalid');
  fs.mkdirSync(path.join(origin, 'src'));
  fs.mkdirSync(path.join(origin, 'tests'));
  fs.writeFileSync(path.join(origin, 'src/a.ts'), 'export const a = 1;\n');
  fs.writeFileSync(path.join(origin, 'tests/a.spec.ts'), '// fixture\n');
  fs.writeFileSync(
    path.join(origin, 'sonar-project.properties'),
    'sonar.projectKey=fork-ignored\n',
  );
  fs.writeFileSync(path.join(origin, 'package.json'), '{}\n');
  git(origin, 'add', '.');
  git(origin, 'commit', '--quiet', '-m', 'base');
  const baseCommit = git(origin, 'rev-parse', 'HEAD');
  git(origin, 'switch', '-c', run.head_branch, '--quiet');
  fs.writeFileSync(path.join(origin, 'src/a.ts'), 'export const a = 2;\n');
  git(origin, 'commit', '-am', 'head', '--quiet');
  const commit = git(origin, 'rev-parse', 'HEAD');
  git(directory, 'clone', '--quiet', '--no-checkout', origin, source);
  git(source, 'sparse-checkout', 'set', '--no-cone', '/src/', '/tests/');
  git(source, 'checkout', '--quiet', '--detach', commit);
  const lcov = 'SF:src/a.ts\nDA:1,1\nend_of_record\n';
  const report = {
    repository: repository.full_name,
    sourceRepository: fork.full_name,
    event: 'pull_request',
    commit,
    runId: run.id,
    runAttempt: 1,
    pullRequestNumber: String(pr.number),
    pullRequestBaseRef: 'fixes',
    node: 'v22.1.0',
    database: 'mysql8',
    coverageExpected: true,
    testOutcome: 'success',
    tests: { tests: 1, failures: 0 },
    errors: [],
    coverageReportSha256: createHash('sha256').update(lcov).digest('hex'),
  };
  const setReport = (data) =>
    fs.writeFileSync(path.join(coverage, 'analysis.json'), JSON.stringify({ ...report, ...data }));
  setReport({});
  fs.writeFileSync(path.join(coverage, 'lcov.info'), lcov);
  return {
    source,
    coverage,
    setReport,
    selected: {
      pr: pr.number,
      sourceRepository: fork.full_name,
      branch: run.head_branch,
      baseCommit,
      commit,
      runId: run.id,
      runAttempt: run.run_attempt,
      artifactId: artifact.id,
    },
  };
}

test('prepares the exact git revision using only trusted scanner settings and same-PR coverage', (t) => {
  const { source, coverage, selected } = checkout(t);
  const result = prepareFork(source, coverage, trusted, selected);
  assert.equal(result.metadata.projectKey, 'soltecsis_fwcloud-api');
  assert.equal(result.metadata.commit, selected.commit);
  assert.equal(result.metadata.baseCommit, selected.baseCommit);
  assert.equal(result.metadata.coverageRunAttempt, 1);
  assert.equal(result.metadata.coverageArtifactId, artifact.id);
  assert.match(result.args, /-Dsonar.pullrequest.key=7 /);
  assert.match(result.args, /-Dsonar.pullrequest.base=fixes /);
  assert.ok(result.args.includes(`-Dsonar.scm.revision=${selected.commit}`));
  assert.ok(fs.existsSync(path.join(source, 'reports/coverage/lcov.info')));
  assert.equal(fs.existsSync(path.join(source, 'package.json')), false);
  for (const file of ['sonar-project.properties', 'tsconfig.sonar.json']) {
    assert.deepEqual(
      fs.readFileSync(path.join(source, file)),
      fs.readFileSync(path.join(trusted, file)),
    );
  }
});

test('rejects mismatched PR provenance, stale base and unexpected sparse checkout entries', (t) => {
  const { source, coverage, selected, setReport } = checkout(t);
  for (const update of [
    { sourceRepository: 'other/fwcloud-api' },
    { pullRequestNumber: '8' },
    { pullRequestBaseRef: 'main' },
  ]) {
    setReport(update);
    assert.throws(
      () => prepareFork(source, coverage, trusted, selected),
      /Coverage artifact is not for this pull request/,
    );
  }
  setReport({});
  assert.throws(
    () => prepareFork(source, coverage, trusted, { ...selected, baseCommit: 'f'.repeat(40) }),
    /PR base changed/,
  );
  fs.mkdirSync(path.join(source, 'reports'));
  assert.throws(() => prepareFork(source, coverage, trusted, selected), /Unexpected paths/);
  assert.equal(fs.existsSync(path.join(source, 'reports/coverage/lcov.info')), false);
});

test('extracts only coverage inputs and rejects duplicate or non-regular inputs', (t) => {
  const directory = temporary(t);
  const destination = path.join(directory, 'coverage');
  const script = path.join(trusted, 'scripts/extract-sonar-coverage.py');
  for (const mode of ['duplicate', 'symlink', 'oversize', 'valid']) {
    const archive = path.join(directory, `${mode}.zip`);
    execFileSync('python3', [
      '-c',
      `
import stat
import sys
import warnings
from zipfile import ZipFile, ZipInfo
warnings.filterwarnings('ignore', category=UserWarning)
mode = sys.argv[2]
with ZipFile(sys.argv[1], 'w') as archive:
    data = ZipInfo('analysis.json')
    if mode == 'symlink':
        data.create_system = 3
        data.external_attr = (stat.S_IFLNK | 0o777) << 16
    archive.writestr(data, '{}' if mode != 'oversize' else 'a' * (64 * 1024))
    archive.writestr('lcov.info', 'coverage')
    archive.writestr('package.json', '{}')
    if mode == 'duplicate':
        archive.writestr('lcov.info', 'another report')
`,
      archive,
      mode,
    ]);
    const result = spawnSync('python3', [script, archive, destination], { encoding: 'utf8' });
    if (mode === 'valid') {
      assert.equal(result.status, 0, result.stderr);
      assert.deepEqual(fs.readdirSync(destination).sort(), ['analysis.json', 'lcov.info']);
    } else {
      assert.notEqual(result.status, 0);
      assert.equal(fs.existsSync(destination), false);
    }
  }
});

test('privileged workflow is read-only in GitHub and runs no fork workflow, script or scanner configuration', () => {
  const central = yaml.load(fs.readFileSync('.github/workflows/sonarqube-fork-pr.yml', 'utf8'));
  const job = central.jobs['sonar-fork-pr'];
  assert.deepEqual(central.on, {
    workflow_run: { workflows: ['FWCloud-API CI'], types: ['completed'] },
  });
  assert.deepEqual(central.permissions, {});
  assert.deepEqual(job.permissions, { actions: 'read', contents: 'read', 'pull-requests': 'read' });
  assert.match(job.if, /github.repository == 'soltecsis\/fwcloud-api'/);
  assert.match(job.if, /workflow_run.head_repository.fork == true/);
  const [trustedCheckout, sourceCheckout] = job.steps.filter((step) =>
    step.uses?.startsWith('actions/checkout'),
  );
  assert.equal(trustedCheckout.with.ref, '${{ github.workflow_sha }}');
  assert.equal(sourceCheckout.with.ref, '${{ steps.resolve.outputs.head_sha }}');
  assert.equal(sourceCheckout.with['persist-credentials'], false);
  assert.equal(sourceCheckout.with['sparse-checkout'], '/src/\n/tests/\n');
  assert.equal(sourceCheckout.with['sparse-checkout-cone-mode'], false);
  const scan = job.steps.find((step) => step.id === 'scan');
  assert.equal(scan.env.SONAR_TOKEN, '${{ secrets.SONAR_PR_ANALYSIS_TOKEN }}');
  assert.equal(scan.with.projectBaseDir, 'candidate');
  assert.equal(scan.with.skipSignatureVerification, false);
  const commands = job.steps.flatMap((step) => (step.run ? [step.run] : [])).join('\n');
  assert.doesNotMatch(commands, /npm |node candidate|python3 candidate|unzip /);
  assert.equal(job.steps.filter((step) => step.env?.SONAR_TOKEN).length, 1);
  const ci = yaml.load(fs.readFileSync('.github/workflows/nodejs.yml', 'utf8'));
  const producer = ci.jobs.test.steps.find(
    (step) => step.name === 'Bind reference coverage to the tested revision',
  );
  assert.equal(producer.env.PR_BASE_REF, '${{ github.event.pull_request.base.ref }}');
  assert.equal(producer.env.PR_NUMBER, '${{ github.event.pull_request.number }}');
});
