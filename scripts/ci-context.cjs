// Small shared evidence helpers. The checked-out commit, never GITHUB_SHA's PR
// merge commit, identifies what the job actually analyzed.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

function context(cwd = '.', env = process.env) {
  const commit = execFileSync('git', ['-C', cwd, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  if (env.ANALYSIS_COMMIT && commit !== env.ANALYSIS_COMMIT) {
    throw new Error('Checkout differs from the tested revision.');
  }
  return {
    schemaVersion: 1,
    collectedAt: new Date().toISOString(),
    repository: env.GITHUB_REPOSITORY || null,
    commit,
    event: env.GITHUB_EVENT_NAME || null,
    ref: env.GITHUB_REF || null,
    runId: env.GITHUB_RUN_ID || null,
    runAttempt: env.GITHUB_RUN_ATTEMPT || null,
  };
}

function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
}

function summary(lines) {
  const text = `${Array.isArray(lines) ? lines.join('\n') : lines}\n`;
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, text);
  console.log(text.trimEnd());
}

function exitCode(value) {
  return /^(0|[1-9]\d*)$/.test(value ?? '') && Number.isSafeInteger(Number(value))
    ? Number(value)
    : null;
}

module.exports = { context, writeJson, summary, exitCode };
