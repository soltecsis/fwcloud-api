const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync, execFileSync } = require('node:child_process');
const { test } = require('node:test');

const script = path.join(__dirname, 'ci-reports.cjs');
const gitDir = execFileSync('git', ['rev-parse', '--absolute-git-dir'], { encoding: 'utf8' }).trim();

function collect(t, { missing = false, failures = 0, outcome = 'success', coverage = false, coverageFiles = false } = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'fwcloud-ci-reports-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  if (!missing) {
    fs.mkdirSync(path.join(directory, 'reports/tests'), { recursive: true });
    fs.writeFileSync(path.join(directory, 'reports/tests/junit.xml'), '<testsuites/>');
    fs.writeFileSync(path.join(directory, 'reports/tests/results.json'), JSON.stringify({
      stats: { tests: 2, passes: 2 - failures, failures, pending: 0, duration: 25 },
      failures: [{ title: 'DO_NOT_INCLUDE_IN_SUMMARY' }],
    }));
  }
  if (coverageFiles) {
    fs.mkdirSync(path.join(directory, 'reports/coverage'), { recursive: true });
    fs.writeFileSync(path.join(directory, 'reports/coverage/lcov.info'), 'SF:src/example.ts\nend_of_record\n');
    fs.writeFileSync(path.join(directory, 'reports/coverage/index.html'), '<html></html>');
    fs.writeFileSync(path.join(directory, 'reports/coverage/coverage-summary.json'), JSON.stringify({
      total: Object.fromEntries(['lines', 'statements', 'functions', 'branches'].map(key =>
        [key, { total: 2, covered: 1, skipped: 0, pct: 50 }])),
    }));
  }
  const summaryPath = path.join(directory, 'summary.md');
  const result = spawnSync(process.execPath, [script], {
    cwd: directory,
    encoding: 'utf8',
    env: { ...process.env, GIT_DIR: gitDir, TEST_OUTCOME: outcome,
      COVERAGE_EXPECTED: String(coverage), GITHUB_STEP_SUMMARY: summaryPath },
  });
  assert.equal(result.error, undefined);
  const metadata = JSON.parse(fs.readFileSync(path.join(directory, 'reports/metadata.json'), 'utf8'));
  const summary = fs.readFileSync(summaryPath, 'utf8');
  assert.ok(!summary.includes('DO_NOT_INCLUDE_IN_SUMMARY'));
  return { result, metadata, summary };
}

test('accepts complete test evidence without requiring coverage on every matrix job', t => {
  const { result, metadata } = collect(t);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(metadata.tests.passes, 2);
  assert.equal(metadata.coverage, null);
});

test('rejects successful test steps without their reports and still writes metadata', t => {
  const { result, metadata } = collect(t, { missing: true });
  assert.equal(result.status, 1);
  assert.equal(metadata.tests, null);
  assert.ok(metadata.errors.length > 0);
});

test('preserves failure when the runner fails even if test statistics look successful', t => {
  assert.equal(collect(t, { outcome: 'failure' }).result.status, 1);
});

test('rejects reported test failures even when the step claims success', t => {
  assert.equal(collect(t, { failures: 1 }).result.status, 1);
});

test('rejects missing coverage on the reference job', t => {
  assert.equal(collect(t, { coverage: true }).result.status, 1);
});

test('accepts complete coverage without imposing a percentage threshold', t => {
  const { result, metadata, summary } = collect(t, { coverage: true, coverageFiles: true });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(metadata.coverage.lines.pct, 50);
  assert.ok(summary.includes('| lines | 50 |'));
});
