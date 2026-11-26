const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { test } = require('node:test');
const { context, exitCode } = require('./ci-context.cjs');

test('all evidence uses the real checkout, not the synthetic PR merge SHA', () => {
  const commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const env = {
    GITHUB_SHA: 'f'.repeat(40),
    GITHUB_EVENT_NAME: 'pull_request',
    GITHUB_REPOSITORY: 'org/api',
    GITHUB_RUN_ID: '12',
    GITHUB_RUN_ATTEMPT: '2',
  };
  assert.equal(context('.', env).commit, commit);
  assert.equal(context('.', { ...env, ANALYSIS_COMMIT: commit }).runAttempt, '2');
  assert.throws(
    () => context('.', { ...env, ANALYSIS_COMMIT: 'a'.repeat(40) }),
    /Checkout differs/,
  );
});

test('missing and malformed exit codes are never treated as success', () => {
  for (const value of [undefined, null, '', ' ', '-1', '1.5', '01', '1e0'])
    assert.equal(exitCode(value), null);
  assert.equal(exitCode('0'), 0);
  assert.equal(exitCode('5'), 5);
});
