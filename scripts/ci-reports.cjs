// Summarize only aggregate results; test names, errors and source stay in artifacts.
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');

const env = process.env;
const expectedCoverage = env.COVERAGE_EXPECTED === 'true';
const testOutcome = env.TEST_OUTCOME || 'unknown';
const errors = [];
const metadata = {
  schemaVersion: 1,
  collectedAt: new Date().toISOString(),
  repository: env.GITHUB_REPOSITORY || null,
  commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  event: env.GITHUB_EVENT_NAME || null,
  ref: env.GITHUB_REF || null,
  runId: env.GITHUB_RUN_ID || null,
  runAttempt: env.GITHUB_RUN_ATTEMPT || null,
  node: process.version,
  npm: execFileSync('npm', ['--version'], { encoding: 'utf8' }).trim(),
  database: env.TEST_DATABASE || null,
  databaseImage: env.TEST_DATABASE_IMAGE || null,
  testOutcome,
  coverageExpected: expectedCoverage,
  tests: null,
  coverage: null,
  errors,
};

function requireFile(file) {
  if (!fs.existsSync(file) || fs.statSync(file).size === 0) {
    throw new Error(`Missing or empty report: ${file}`);
  }
}

try {
  requireFile('reports/tests/junit.xml');
  requireFile('reports/tests/results.json');
  const { stats } = JSON.parse(fs.readFileSync('reports/tests/results.json', 'utf8'));
  for (const key of ['tests', 'passes', 'failures', 'pending', 'duration']) {
    if (!Number.isFinite(stats?.[key]) || stats[key] < 0) {
      throw new Error(`Invalid test statistic: ${key}`);
    }
  }
  metadata.tests = Object.fromEntries(
    ['tests', 'passes', 'failures', 'pending', 'duration'].map(key => [key, stats[key]]),
  );
  if (stats.tests === 0) errors.push('No tests executed.');
  if (stats.failures > 0) errors.push('Test failures reported.');
} catch (error) {
  errors.push(error.message);
}

if (expectedCoverage) {
  try {
    for (const file of ['lcov.info', 'coverage-summary.json', 'index.html']) {
      requireFile(`reports/coverage/${file}`);
    }
    const { total } = JSON.parse(fs.readFileSync('reports/coverage/coverage-summary.json', 'utf8'));
    for (const key of ['lines', 'statements', 'functions', 'branches']) {
      if (!Number.isFinite(total?.[key]?.pct) || total[key].pct < 0 || total[key].pct > 100) {
        throw new Error(`Invalid coverage metric: ${key}`);
      }
    }
    if (!(total.lines.total > 0)) throw new Error('Coverage contains no source lines.');
    metadata.coverage = total;
  } catch (error) {
    errors.push(error.message);
  }
}

if (testOutcome !== 'success') errors.push(`Test step outcome: ${testOutcome}`);
fs.mkdirSync('reports', { recursive: true });
fs.writeFileSync('reports/metadata.json', `${JSON.stringify(metadata, null, 2)}\n`);

const summary = [
  '## Backend test evidence',
  '',
  `Commit: \`${metadata.commit}\``,
  '',
  `Reports: **${errors.length ? 'FAILED / INCOMPLETE' : 'COMPLETE'}**`,
];
if (metadata.tests) {
  summary.push('', '| Tests | Passed | Failed | Pending | Duration (ms) |', '| --- | --- | --- | --- | --- |',
    `| ${metadata.tests.tests} | ${metadata.tests.passes} | ${metadata.tests.failures} | ${metadata.tests.pending} | ${metadata.tests.duration} |`);
}
if (metadata.coverage) {
  summary.push('', '| Coverage | % |', '| --- | --- |');
  for (const key of ['lines', 'statements', 'functions', 'branches']) {
    summary.push(`| ${key} | ${metadata.coverage[key].pct} |`);
  }
}
if (errors.length) summary.push('', 'See the test step and metadata artifact for failure details.');
if (env.GITHUB_STEP_SUMMARY) fs.appendFileSync(env.GITHUB_STEP_SUMMARY, `${summary.join('\n')}\n`);
console.log(summary.join('\n'));
if (errors.length) process.exitCode = 1;
