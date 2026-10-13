// Trusted workflow utilities: validate GitHub context and LCOV; the official
// scanner owns analysis, polling and the Quality Gate. Never execute PR code.
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const must = (condition, message) => { if (!condition) throw new Error(message); };
const sha256 = data => createHash('sha256').update(data).digest('hex');
const branch = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9/_.-]{0,199}$/.test(value);

async function resolveContext({ github, context, core }) {
  const repo = context.repo;
  const event = context.payload.workflow_run;
  const { data: run } = await github.rest.actions.getWorkflowRun({ ...repo, run_id: event.id });
  const { data: workflow } = await github.rest.actions.getWorkflow({ ...repo, workflow_id: run.workflow_id });
  const repository = `${repo.owner}/${repo.repo}`;
  must(workflow.path === '.github/workflows/nodejs.yml' && workflow.name === 'FWCloud-API CI', 'Unexpected producer workflow.');
  must(run.repository.full_name === repository && run.status === 'completed' && run.conclusion === 'success', 'CI must have completed successfully in this repository.');
  must(run.run_attempt === event.run_attempt && run.head_sha === event.head_sha, 'Stale or mismatched CI execution.');
  must(/^[a-f0-9]{40}$/.test(run.head_sha), 'Invalid CI revision.');
  must(['pull_request', 'push', 'workflow_dispatch'].includes(run.event), 'Unsupported CI event.');
  const result = { repository, commit: run.head_sha, runId: run.id, runAttempt: run.run_attempt,
    event: run.event, branch: run.head_branch, pr: null, base: null };
  if (run.event === 'pull_request') {
    // workflow_run.pull_requests can be empty for forks: use GitHub's association,
    // then re-fetch the live PR rather than accepting artifact-supplied metadata.
    const associated = run.pull_requests.length ? run.pull_requests : await github.paginate(
      github.rest.repos.listPullRequestsAssociatedWithCommit, { ...repo, commit_sha: run.head_sha, per_page: 100 });
    const matches = [];
    for (const candidate of associated) {
      const { data: pr } = await github.rest.pulls.get({ ...repo, pull_number: candidate.number });
      if (pr.state === 'open' && pr.base.repo.full_name === repository && pr.head.sha === run.head_sha &&
          pr.head.repo?.id === run.head_repository?.id) matches.push(pr);
    }
    must(matches.length === 1, 'A unique current PR must match the tested revision and repository.');
    result.pr = matches[0].number;
    result.branch = matches[0].head.ref;
    result.base = matches[0].base.ref;
    must(branch(result.base), 'Invalid target branch.');
  } else {
    must(run.head_repository.full_name === repository, 'Branch analysis must originate in this repository.');
  }
  must(branch(result.branch), 'Invalid source branch.');
  const artifacts = await github.paginate(github.rest.actions.listWorkflowRunArtifacts,
    { ...repo, run_id: run.id, per_page: 100 });
  const name = `backend-coverage-node22-mysql8-${run.id}-${run.run_attempt}`;
  const selected = artifacts.filter(a => a.name === name && !a.expired);
  must(selected.length === 1 && selected[0].size_in_bytes > 0 && selected[0].size_in_bytes < 100 * 1024 * 1024,
    'Missing, ambiguous, expired or oversized reference coverage artifact.');
  result.artifactId = selected[0].id;
  const args = [`-Dsonar.scm.revision=${result.commit}`];
  if (result.pr) args.push(`-Dsonar.pullrequest.key=${result.pr}`, `-Dsonar.pullrequest.branch=${result.branch}`, `-Dsonar.pullrequest.base=${result.base}`);
  else args.push(`-Dsonar.branch.name=${result.branch}`);
  core.setOutput('commit', result.commit);
  core.setOutput('artifact_id', String(result.artifactId));
  core.setOutput('args', args.join(' '));
  fs.mkdirSync('reports/sonar', { recursive: true });
  fs.writeFileSync('reports/sonar/context.json', JSON.stringify(result, null, 2));
  return result;
}

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

function prepare(source, coverage, trusted, run) {
  const metadata = JSON.parse(fs.readFileSync(path.join(coverage, 'analysis.json'), 'utf8'));
  const lcov = fs.readFileSync(path.join(coverage, 'lcov.info'));
  const files = verifyCoverage(metadata, lcov, run);
  must(execFileSync('git', ['-C', source, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim() === run.commit, 'Checkout differs from the tested revision.');
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
  // Replace PR-supplied scanner settings; never read host URLs/args from artifacts.
  for (const file of ['sonar-project.properties', 'tsconfig.sonar.json', '.scannerwork', 'reports']) {
    fs.rmSync(path.join(source, file), { recursive: true, force: true });
  }
  for (const file of ['sonar-project.properties', 'tsconfig.sonar.json']) fs.copyFileSync(path.join(trusted, file), path.join(source, file));
  fs.mkdirSync(path.join(source, 'reports/coverage'), { recursive: true });
  fs.writeFileSync(path.join(source, 'reports/coverage/lcov.info'), lcov);
  return { ...run, coverageReportSha256: sha256(lcov),
    scannerSettingsSha256: sha256(fs.readFileSync(path.join(trusted, 'sonar-project.properties'))),
    trustedRevision: execFileSync('git', ['-C', trusted, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim() };
}

function recordEvidence(run, outcome) {
  // Aggregate only. No scanner logs, issue snippets or .scannerwork are uploaded.
  const result = { ...run, analyzedAt: new Date().toISOString(), scanOutcome: outcome,
    qualityGate: outcome === 'success' ? 'PASSED' : 'FAILED_OR_INCOMPLETE',
    action: 'SonarSource/sonarqube-scan-action@d209202bc7d53ff1cc128f7f907dac145c9d6ae9',
    scannerVersion: '8.1.0.6389' };
  const taskFile = 'source/.scannerwork/report-task.txt';
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

module.exports = { resolveContext, verifyCoverage, prepare, recordEvidence };
