const fs = require('node:fs');
const { execFileSync } = require('node:child_process');

const env = process.env;
const reportPath = env.GITLEAKS_REPORT_PATH || 'reports/secrets/gitleaks.json';
const metadataPath = env.GITLEAKS_METADATA_PATH || 'reports/secrets/metadata.json';
const errors = [];
let findings = [];

try {
  const parsed = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  if (!Array.isArray(parsed)) throw new Error('Gitleaks report is not a JSON array.');
  findings = parsed;
} catch (error) {
  errors.push(`Unable to read Gitleaks report: ${error.message}`);
}

const exitCode = Number(env.GITLEAKS_EXIT_CODE);
if (!Number.isInteger(exitCode)) errors.push('Gitleaks exit code is missing or invalid.');
if (exitCode === 0 && findings.length > 0) errors.push('Gitleaks reported success with findings.');
if (exitCode === 1 && findings.length === 0) errors.push('Gitleaks failed without reporting findings.');
if (Number.isInteger(exitCode) && ![0, 1].includes(exitCode)) {
  errors.push(`Gitleaks execution failed with exit code ${exitCode}.`);
}

const ruleIds = [...new Set(findings.map(finding => finding.RuleID).filter(Boolean))].sort();
const status = errors.length ? 'error' : findings.length ? 'findings' : 'success';
const metadata = {
  schemaVersion: 1,
  collectedAt: new Date().toISOString(),
  repository: env.GITHUB_REPOSITORY || null,
  commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  event: env.GITHUB_EVENT_NAME || null,
  ref: env.GITHUB_REF || null,
  runId: env.GITHUB_RUN_ID || null,
  runAttempt: env.GITHUB_RUN_ATTEMPT || null,
  gitleaksVersion: env.GITLEAKS_VERSION || null,
  scanScope: env.GITLEAKS_SCAN_SCOPE || null,
  logOptions: env.GITLEAKS_LOG_OPTS || null,
  exitCode: Number.isInteger(exitCode) ? exitCode : null,
  status,
  findingCount: findings.length,
  ruleIds,
  errors,
};

fs.mkdirSync(require('node:path').dirname(metadataPath), { recursive: true });
fs.writeFileSync(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`);

const summary = [
  '## Secret detection',
  '',
  `Commit: \`${metadata.commit}\``,
  `Scope: \`${metadata.scanScope || 'unknown'}\``,
  `Gitleaks: \`${metadata.gitleaksVersion || 'unknown'}\``,
  `Status: **${status.toUpperCase()}**`,
  `Findings: **${metadata.findingCount}**`,
];
if (ruleIds.length) summary.push(`Rules: ${ruleIds.map(rule => `\`${rule}\``).join(', ')}`);
if (errors.length) summary.push('', 'The scan was incomplete or inconsistent; inspect the scanner step.');
if (env.GITHUB_STEP_SUMMARY) fs.appendFileSync(env.GITHUB_STEP_SUMMARY, `${summary.join('\n')}\n`);
console.log(summary.join('\n'));

if (status !== 'success') process.exitCode = 1;
