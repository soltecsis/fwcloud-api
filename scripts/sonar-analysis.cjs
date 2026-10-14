// Same-run LCOV validation and aggregate evidence. The official scanner owns
// analysis, polling and the Quality Gate; no GitHub API or workflow chaining.
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const must = (condition, message) => { if (!condition) throw new Error(message); };
const sha256 = data => createHash('sha256').update(data).digest('hex');
const branch = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9/_.-]{0,199}$/.test(value);

function verifyCoverage(metadata, lcov, run) {
  must(metadata.repository === run.repository && metadata.commit === run.commit && metadata.event === run.event &&
    String(metadata.runId) === String(run.runId) && String(metadata.runAttempt) === String(run.runAttempt), 'Coverage does not belong to the selected CI revision/execution.');
  must(metadata.testOutcome === 'success' && metadata.coverageExpected === true && metadata.database === 'mysql8' &&
    /^v22\./.test(metadata.node) && metadata.tests?.tests > 0 && metadata.tests.failures === 0 &&
    Array.isArray(metadata.errors) && metadata.errors.length === 0, 'Reference test evidence is incomplete or failed.');
  must(lcov.length > 0 && lcov.length < 25 * 1024 * 1024 && metadata.coverageReportSha256 === sha256(lcov), 'Missing, oversized or altered LCOV.');
  const text = lcov.toString('utf8');
  const files = text.split('\n').filter(line => line.startsWith('SF:')).map(line => line.slice(3).trim());
  must(files.length > 0 && files.length === text.split('\n').filter(line => line.trim() === 'end_of_record').length && /^DA:\d+,\d+/m.test(text), 'LCOV has no complete source coverage records.');
  must(files.every(file => /^src\/.+\.(ts|js)$/.test(file) && !file.endsWith('.d.ts') &&
    !file.split('/').some(part => part === '..' || part === '.' || part === '') && !/[\x00-\x1f\\]/.test(file)), 'LCOV must reference relative original sources only.');
  return files;
}

function prepare(source, coverage, env = process.env) {
  const commit = execFileSync('git', ['-C', source, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  must(/^[a-f0-9]{40}$/.test(env.ANALYSIS_COMMIT || '') && commit === env.ANALYSIS_COMMIT, 'Checkout differs from the tested revision.');
  must(['push', 'pull_request', 'workflow_dispatch'].includes(env.GITHUB_EVENT_NAME), 'Unsupported CI event.');
  const run = { repository: env.GITHUB_REPOSITORY, commit, runId: env.GITHUB_RUN_ID,
    runAttempt: env.GITHUB_RUN_ATTEMPT, event: env.GITHUB_EVENT_NAME,
    branch: env.GITHUB_HEAD_REF || env.GITHUB_REF_NAME, base: null, pr: null };
  must(branch(run.branch), 'Invalid source branch.');
  const args = [`-Dsonar.scm.revision=${commit}`];
  if (run.event === 'pull_request') {
    must(/^[1-9]\d*$/.test(env.PR_NUMBER || '') && branch(env.GITHUB_BASE_REF), 'Invalid pull request context.');
    run.pr = Number(env.PR_NUMBER); run.base = env.GITHUB_BASE_REF;
    args.push(`-Dsonar.pullrequest.key=${run.pr}`, `-Dsonar.pullrequest.branch=${run.branch}`, `-Dsonar.pullrequest.base=${run.base}`);
  } else args.push(`-Dsonar.branch.name=${run.branch}`);
  const metadata = JSON.parse(fs.readFileSync(path.join(coverage, 'analysis.json'), 'utf8'));
  const lcov = fs.readFileSync(path.join(coverage, 'lcov.info'));
  const files = verifyCoverage(metadata, lcov, run);
  // No symlinks in analyzed trees: the scanner must not read outside PR sources.
  const walk = directory => {
    must(fs.lstatSync(directory).isDirectory(), 'Analyzed source directory must be a real directory.');
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      must(!entry.isSymbolicLink(), 'Symlinks are not allowed in analyzed source trees.');
      if (entry.isDirectory()) walk(path.join(directory, entry.name));
    }
  };
  walk(path.join(source, 'src')); walk(path.join(source, 'tests'));
  must(files.every(file => fs.lstatSync(path.join(source, file)).isFile()), 'LCOV references a missing original source.');
  fs.mkdirSync(path.join(source, 'reports/coverage'), { recursive: true });
  fs.writeFileSync(path.join(source, 'reports/coverage/lcov.info'), lcov);
  fs.mkdirSync(path.join(source, 'reports/sonar'), { recursive: true });
  return { metadata: { ...run, coverageReportSha256: sha256(lcov),
    scannerSettingsSha256: sha256(fs.readFileSync(path.join(source, 'sonar-project.properties'))) }, args: args.join(' ') };
}

function recordEvidence(run, outcome) {
  // Aggregate only. No scanner logs, issue snippets or .scannerwork are uploaded.
  const result = { ...run, analyzedAt: new Date().toISOString(), scanOutcome: outcome,
    qualityGate: outcome === 'success' ? 'PASSED' : 'FAILED_OR_INCOMPLETE',
    action: 'SonarSource/sonarqube-scan-action@d209202bc7d53ff1cc128f7f907dac145c9d6ae9',
    scannerVersion: '8.1.0.6389' };
  const taskFile = '.scannerwork/report-task.txt';
  if (fs.existsSync(taskFile)) {
    const task = Object.fromEntries(fs.readFileSync(taskFile, 'utf8').split('\n').filter(line => line.includes('='))
      .map(line => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1).trim()]));
    if (/^[A-Za-z0-9_-]{1,100}$/.test(task.ceTaskId || '')) result.ceTaskId = task.ceTaskId;
    try {
      const url = new URL(task.dashboardUrl);
      if (url.origin === 'https://sonarcloud.io' && url.pathname === '/dashboard' && !url.username && !url.password &&
          [...url.searchParams.keys()].every(key => ['id', 'branch', 'pullRequest'].includes(key))) result.dashboardUrl = url.href;
    } catch { /* Failed scans may not create native task metadata. */ }
  }
  fs.writeFileSync('reports/sonar/metadata.json', JSON.stringify(result, null, 2));
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,
    `## SonarQube analysis\n\nRevision: \`${run.commit}\`\n\nCI: ${run.runId}/${run.runAttempt}\n\nQuality Gate: **${result.qualityGate}**\n`);
}

module.exports = { verifyCoverage, prepare, recordEvidence };
