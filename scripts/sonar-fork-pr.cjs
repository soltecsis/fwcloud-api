// Runs only from the trusted workflow revision. Fork sources and coverage are data.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { prepare, recordEvidence } = require('./sonar-analysis.cjs');
const { summary, writeJson } = require('./ci-context.cjs');

const repository = 'soltecsis/fwcloud-api';
const base = 'fixes';
const workflow = '.github/workflows/nodejs.yml';
const sha = /^[a-f0-9]{40}$/;
const branch = /^[A-Za-z0-9][A-Za-z0-9/_.-]{0,199}$/;
const owner = /^[A-Za-z0-9][A-Za-z0-9-]{0,38}$/;
const id = (value) => Number.isSafeInteger(value) && value > 0;
const must = (condition, message) => {
  if (!condition) throw new Error(message);
};

function matchesPullRequest(pr, run, baseRepository) {
  return (
    id(pr.number) &&
    pr.state === 'open' &&
    pr.user?.login &&
    pr.user.login !== 'dependabot[bot]' &&
    pr.base?.repo?.id === baseRepository.id &&
    pr.base.ref === base &&
    sha.test(pr.base.sha) &&
    pr.head?.repo?.id === run.head_repository.id &&
    pr.head.repo.full_name === run.head_repository.full_name &&
    pr.head.ref === run.head_branch &&
    pr.head.sha === run.head_sha
  );
}

async function resolve(event, request) {
  const run = event.workflow_run;
  const official = event.repository;
  const fork = run?.head_repository;
  must(
    official?.full_name === repository &&
      id(official.id) &&
      run?.repository?.id === official.id &&
      run.path === workflow &&
      run.event === 'pull_request' &&
      run.conclusion === 'success' &&
      id(run.id) &&
      id(run.run_attempt) &&
      sha.test(run.head_sha) &&
      typeof run.head_branch === 'string' &&
      branch.test(run.head_branch) &&
      fork?.fork === true &&
      id(fork.id) &&
      fork.id !== official.id &&
      owner.test(fork.owner?.login || '') &&
      typeof fork.full_name === 'string' &&
      fork.full_name.startsWith(`${fork.owner.login}/`) &&
      run.actor?.login &&
      run.actor.login !== 'dependabot[bot]',
    'Unexpected workflow run context.',
  );

  // GitHub's workflow_run.pull_requests is normally empty for a fork PR.
  const query = new URLSearchParams({
    state: 'open',
    base,
    head: `${fork.owner.login}:${run.head_branch}`,
    per_page: '2',
  });
  const candidates = await request(`/pulls?${query}`);
  must(Array.isArray(candidates) && candidates.length < 2, 'Ambiguous pull request lookup.');
  const pr = candidates.find((item) => matchesPullRequest(item, run, official));
  if (!pr) return null;

  const artifactName = `backend-coverage-node22-mysql8-${run.id}`;
  const artifacts = await request(
    `/actions/runs/${run.id}/artifacts?name=${artifactName}&per_page=2`,
  );
  const artifact = artifacts.artifacts?.[0];
  must(
    artifacts.total_count === 1 &&
      Array.isArray(artifacts.artifacts) &&
      artifacts.artifacts.length === 1 &&
      artifact.name === artifactName &&
      artifact.workflow_run?.id === run.id &&
      id(artifact.id) &&
      artifact.expired === false &&
      id(artifact.size_in_bytes) &&
      artifact.size_in_bytes <= 32 * 1024 * 1024 &&
      /^sha256:[a-f0-9]{64}$/.test(artifact.digest),
    'Expected one bounded, unexpired coverage artifact with a digest from the CI run.',
  );
  return {
    pr: pr.number,
    branch: pr.head.ref,
    base,
    baseCommit: pr.base.sha,
    commit: pr.head.sha,
    sourceRepository: fork.full_name,
    runId: run.id,
    runAttempt: run.run_attempt,
    artifactId: artifact.id,
    digest: artifact.digest.slice('sha256:'.length),
  };
}

function prepareFork(source, coverage, trusted, selected) {
  // Non-cone sparse checkout must not materialize root-level fork configuration.
  must(
    fs
      .readdirSync(source, { withFileTypes: true })
      .every((item) => ['.git', 'src', 'tests'].includes(item.name) && item.isDirectory()),
    'Unexpected paths in the sparse source checkout.',
  );
  const checkedOutBase = execFileSync(
    'git',
    ['-C', source, 'rev-parse', '--verify', `refs/remotes/origin/${base}`],
    { encoding: 'utf8' },
  ).trim();
  must(checkedOutBase === selected.baseCommit, 'PR base changed after discovery. Run CI again.');
  const metadata = JSON.parse(fs.readFileSync(path.join(coverage, 'analysis.json'), 'utf8'));
  must(
    metadata.pullRequestNumber === String(selected.pr) &&
      metadata.sourceRepository === selected.sourceRepository &&
      metadata.pullRequestBaseRef === base,
    'Coverage artifact is not for this pull request, explicit base or source repository.',
  );
  for (const file of ['sonar-project.properties', 'tsconfig.sonar.json']) {
    fs.copyFileSync(path.join(trusted, file), path.join(source, file), fs.constants.COPYFILE_EXCL);
  }
  const analysis = prepare(source, coverage, {
    GITHUB_REPOSITORY: repository,
    GITHUB_RUN_ID: String(selected.runId),
    GITHUB_RUN_ATTEMPT: String(selected.runAttempt),
    GITHUB_EVENT_NAME: 'pull_request',
    GITHUB_REF: `refs/pull/${selected.pr}/head`,
    GITHUB_HEAD_REF: selected.branch,
    GITHUB_BASE_REF: base,
    ANALYSIS_COMMIT: selected.commit,
    PR_NUMBER: String(selected.pr),
  });
  return {
    metadata: {
      ...analysis.metadata,
      baseCommit: selected.baseCommit,
      sourceRepository: selected.sourceRepository,
      coverageArtifactId: selected.artifactId,
    },
    args: `${analysis.args} -Dsonar.pullrequest.provider=github -Dsonar.pullrequest.github.repository=${repository}`,
  };
}

async function githubRequest(endpoint) {
  const response = await fetch(`https://api.github.com/repos/${repository}${endpoint}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${process.env.GH_TOKEN}`,
      'X-GitHub-Api-Version': '2022-11-28',
    },
    redirect: 'error',
    signal: AbortSignal.timeout(20000),
  });
  must(response.ok, `GitHub API request failed (HTTP ${response.status}).`);
  return response.json();
}

async function main(mode) {
  const candidate = path.resolve('candidate');
  const trusted = path.resolve(__dirname, '..');
  const temp = path.join(process.env.RUNNER_TEMP, 'fwcloud-fork-sonar');
  const selectedFile = path.join(temp, 'context.json');
  const output = (key, value) => fs.appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`);
  if (mode === 'resolve') {
    const event = JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
    const selected = await resolve(event, githubRequest);
    if (!selected) {
      summary(
        'SonarQube omitted: no current, eligible fork PR into fixes matches this CI revision.',
      );
      return;
    }
    writeJson(selectedFile, selected);
    output('pr', selected.pr);
    output('head_sha', selected.commit);
    output('artifact_id', selected.artifactId);
    output('artifact_digest', selected.digest);
  } else if (mode === 'prepare') {
    const selected = JSON.parse(fs.readFileSync(selectedFile, 'utf8'));
    const event = JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
    const pr = await githubRequest(`/pulls/${selected.pr}`);
    must(
      matchesPullRequest(pr, event.workflow_run, event.repository) &&
        pr.number === selected.pr &&
        pr.base.sha === selected.baseCommit,
      'PR head or base changed after discovery. Run CI again.',
    );
    const analysis = prepareFork(candidate, path.join(temp, 'coverage'), trusted, selected);
    writeJson(path.join(temp, 'analysis.json'), analysis.metadata);
    output('args', analysis.args);
  } else if (mode === 'record') {
    const metadata = JSON.parse(fs.readFileSync(path.join(temp, 'analysis.json'), 'utf8'));
    process.chdir(candidate);
    recordEvidence(
      {
        ...metadata,
        sonarRunId: process.env.GITHUB_RUN_ID,
        sonarRunAttempt: process.env.GITHUB_RUN_ATTEMPT,
      },
      process.env.SCAN_OUTCOME,
    );
  } else throw new Error('Unsupported fork analysis operation.');
}

if (require.main === module) {
  main(process.argv[2]).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = { resolve, prepareFork };
