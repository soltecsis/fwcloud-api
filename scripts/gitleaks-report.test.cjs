const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');
const { test } = require('node:test');

const script = path.join(__dirname, 'gitleaks-report.cjs');
const gitDir = execFileSync('git', ['rev-parse', '--absolute-git-dir'], { encoding: 'utf8' }).trim();

function collect(t, report, exitCode) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'fwcloud-gitleaks-report-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const reportPath = path.join(directory, 'gitleaks.json');
  const metadataPath = path.join(directory, 'metadata.json');
  const summaryPath = path.join(directory, 'summary.md');
  if (report !== undefined) fs.writeFileSync(reportPath, JSON.stringify(report));
  const result = spawnSync(process.execPath, [script], {
    cwd: directory,
    encoding: 'utf8',
    env: {
      ...process.env,
      GIT_DIR: gitDir,
      GITLEAKS_REPORT_PATH: reportPath,
      GITLEAKS_METADATA_PATH: metadataPath,
      GITLEAKS_EXIT_CODE: String(exitCode),
      GITLEAKS_VERSION: '8.30.1',
      GITLEAKS_SCAN_SCOPE: 'test-range',
      GITHUB_STEP_SUMMARY: summaryPath,
    },
  });
  const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
  const summary = fs.readFileSync(summaryPath, 'utf8');
  return { result, metadata, summary };
}

test('accepts a complete scan without findings', t => {
  const { result, metadata } = collect(t, [], 0);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(metadata.status, 'success');
});

test('rejects findings without exposing secret values in metadata or summary', t => {
  const secret = 'DO_NOT_EXPOSE_THIS_VALUE';
  const { result, metadata, summary } = collect(t, [{ RuleID: 'generic-api-key', Secret: secret }], 1);
  assert.equal(result.status, 1);
  assert.equal(metadata.status, 'findings');
  assert.equal(metadata.findingCount, 1);
  assert.ok(!JSON.stringify(metadata).includes(secret));
  assert.ok(!summary.includes(secret));
});

test('rejects a missing report as an incomplete scan', t => {
  const { result, metadata } = collect(t, undefined, 1);
  assert.equal(result.status, 1);
  assert.equal(metadata.status, 'error');
});

test('rejects inconsistent scanner results', t => {
  assert.equal(collect(t, [], 1).result.status, 1);
  assert.equal(collect(t, [{ RuleID: 'test' }], 0).result.status, 1);
});
