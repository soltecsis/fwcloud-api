const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const env = process.env;
const reportPath = env.TRIVY_REPORT_PATH || 'reports/dependencies/trivy.json';
const sbomPath = env.TRIVY_SBOM_PATH || 'reports/dependencies/sbom.cdx.json';
const versionPath = env.TRIVY_VERSION_PATH || 'reports/dependencies/trivy-version.json';
const metadataPath = env.TRIVY_METADATA_PATH || 'reports/dependencies/metadata.json';
const lockfilePath = env.TRIVY_LOCKFILE_PATH || 'package-lock.json';
const blockingSeverities = new Set(['HIGH', 'CRITICAL']);
const severityCounts = { UNKNOWN: 0, LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 };
const errors = [];

function readJson(file, label) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    errors.push(`Unable to read ${label}: ${error.message}`);
    return null;
  }
}

function readExitCode(name) {
  const value = Number(env[name]);
  if (!Number.isInteger(value)) errors.push(`${name} is missing or invalid.`);
  else if (value !== 0) errors.push(`${name} indicates an execution failure (${value}).`);
  return Number.isInteger(value) ? value : null;
}

const report = readJson(reportPath, 'Trivy vulnerability report');
const sbom = readJson(sbomPath, 'CycloneDX SBOM');
const versionInfo = readJson(versionPath, 'Trivy version information');
const scanExitCode = readExitCode('TRIVY_EXIT_CODE');
const sbomExitCode = readExitCode('TRIVY_SBOM_EXIT_CODE');

let results = [];
let packages = [];
let vulnerabilities = [];
if (report) {
  if (report.SchemaVersion !== 2) errors.push('Unsupported Trivy report schema.');
  if (!Array.isArray(report.Results)) errors.push('Trivy report has no results array.');
  else {
    results = report.Results;
    const npmResults = [];
    for (const result of results) {
      if (!result || typeof result !== 'object') {
        errors.push('Trivy result entry is invalid.');
      } else if (result.Type === 'npm') {
        npmResults.push(result);
      }
    }
    if (!npmResults.some(result => result.Target === 'package-lock.json')) {
      errors.push('Trivy did not report the root package-lock.json.');
    }
    for (const result of npmResults) {
      if (!Array.isArray(result.Packages)) errors.push('Trivy npm result has no packages array.');
      else {
        for (const pkg of result.Packages) {
          if (!pkg || typeof pkg !== 'object' || !pkg.Name || !pkg.Version) {
            errors.push('Trivy package entry is invalid.');
          } else {
            packages.push(pkg);
          }
        }
      }
      if (result.Vulnerabilities != null && !Array.isArray(result.Vulnerabilities)) {
        errors.push('Trivy npm vulnerabilities must be an array.');
      } else if (Array.isArray(result.Vulnerabilities)) {
        vulnerabilities.push(...result.Vulnerabilities);
      }
    }
    if (packages.length === 0) errors.push('Trivy did not inventory npm packages.');
  }
}

const validVulnerabilities = [];
for (const vulnerability of vulnerabilities) {
  if (!vulnerability || typeof vulnerability !== 'object') {
    errors.push('Trivy vulnerability entry is invalid.');
    continue;
  }
  const severity = String(vulnerability.Severity || '').toUpperCase();
  if (!(severity in severityCounts)) errors.push('Trivy vulnerability has an invalid severity.');
  else severityCounts[severity] += 1;
  for (const field of ['VulnerabilityID', 'PkgName', 'InstalledVersion']) {
    if (!vulnerability[field]) errors.push(`Trivy vulnerability has no ${field}.`);
  }
  validVulnerabilities.push(vulnerability);
}
vulnerabilities = validVulnerabilities;

let componentCount = 0;
let npmComponentCount = 0;
let npmComponents = [];
if (sbom) {
  if (sbom.bomFormat !== 'CycloneDX') errors.push('SBOM is not in CycloneDX format.');
  if (sbom.specVersion !== '1.7') errors.push('SBOM does not use CycloneDX 1.7.');
  if (!sbom.metadata?.component) errors.push('SBOM has no root component metadata.');
  if (!Array.isArray(sbom.components)) errors.push('SBOM has no components array.');
  else {
    componentCount = sbom.components.length;
    const validComponents = [];
    for (const component of sbom.components) {
      if (!component || typeof component !== 'object') {
        errors.push('SBOM component entry is invalid.');
      } else {
        validComponents.push(component);
      }
    }
    npmComponents = validComponents.filter(component =>
      String(component.purl || '').startsWith('pkg:npm/'),
    );
    npmComponentCount = npmComponents.length;
    if (componentCount === 0 || npmComponentCount === 0) {
      errors.push('SBOM does not contain npm components.');
    }
  }
  if (!Array.isArray(sbom.dependencies) || sbom.dependencies.length === 0) {
    errors.push('SBOM has no dependency relationships.');
  }
}

if (packages.length > 0 && npmComponentCount > 0) {
  const packageIds = packages.map(pkg => `${pkg.Name}@${pkg.Version}`);
  const componentIds = npmComponents.map(component => {
    const name = component.group ? `${component.group}/${component.name}` : component.name;
    return `${name}@${component.version}`;
  });
  if (npmComponents.some(component => !component.name || !component.version)) {
    errors.push('SBOM npm component entry is invalid.');
  }
  const packageSet = new Set(packageIds);
  const componentSet = new Set(componentIds);
  if (
    packageIds.length !== packageSet.size ||
    componentIds.length !== componentSet.size ||
    packageSet.size !== componentSet.size ||
    [...packageSet].some(id => !componentSet.has(id))
  ) {
    errors.push('Trivy report and SBOM npm components are inconsistent.');
  }
}

if (Array.isArray(sbom?.dependencies) && Array.isArray(sbom?.components)) {
  const knownRefs = new Set(
    sbom.components
      .filter(component => component && typeof component === 'object')
      .flatMap(component => [component['bom-ref'], component.purl])
      .filter(Boolean),
  );
  for (const rootRef of [sbom.metadata?.component?.['bom-ref'], sbom.metadata?.component?.purl]) {
    if (rootRef) knownRefs.add(rootRef);
  }
  let invalidReferences = false;
  for (const dependency of sbom.dependencies) {
    if (!dependency || typeof dependency !== 'object' || !knownRefs.has(dependency.ref)) {
      invalidReferences = true;
      continue;
    }
    if (
      !Array.isArray(dependency.dependsOn) ||
      dependency.dependsOn.some(reference => !knownRefs.has(reference))
    ) {
      invalidReferences = true;
    }
  }
  if (invalidReferences) errors.push('SBOM contains invalid dependency references.');
}

if (versionInfo) {
  if (!versionInfo.Version) errors.push('Trivy version information has no version.');
  if (Number.isNaN(Date.parse(versionInfo.VulnerabilityDB?.UpdatedAt))) {
    errors.push('Trivy version information has no vulnerability database timestamp.');
  }
  if (env.TRIVY_VERSION && versionInfo.Version !== env.TRIVY_VERSION) {
    errors.push('Executed Trivy version does not match the configured version.');
  }
}

let lockfileSha256 = null;
try {
  lockfileSha256 = crypto.createHash('sha256').update(fs.readFileSync(lockfilePath)).digest('hex');
} catch (error) {
  errors.push(`Unable to hash package-lock.json: ${error.message}`);
}

const blockingFindingCount = vulnerabilities.filter(vulnerability =>
  blockingSeverities.has(String(vulnerability.Severity || '').toUpperCase()),
).length;
const status = errors.length ? 'error' : blockingFindingCount ? 'findings' : 'success';
const relationshipCounts = packages.reduce(
  (counts, pkg) => {
    const relationship = pkg.Relationship === 'direct' ? 'direct' : 'indirect';
    counts[relationship] += 1;
    return counts;
  },
  { direct: 0, indirect: 0 },
);
const scopeCounts = packages.reduce(
  (counts, pkg) => {
    counts[pkg.Dev ? 'development' : 'runtime'] += 1;
    return counts;
  },
  { runtime: 0, development: 0 },
);
const metadata = {
  schemaVersion: 1,
  collectedAt: new Date().toISOString(),
  repository: env.GITHUB_REPOSITORY || null,
  commit: env.GITHUB_SHA || execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  event: env.GITHUB_EVENT_NAME || null,
  ref: env.GITHUB_REF || null,
  runId: env.GITHUB_RUN_ID || null,
  runAttempt: env.GITHUB_RUN_ATTEMPT || null,
  trivyVersion: versionInfo?.Version || null,
  vulnerabilityDb: versionInfo?.VulnerabilityDB
    ? {
        version: versionInfo.VulnerabilityDB.Version || null,
        updatedAt: versionInfo.VulnerabilityDB.UpdatedAt || null,
        nextUpdate: versionInfo.VulnerabilityDB.NextUpdate || null,
      }
    : null,
  reportCreatedAt: report?.CreatedAt || null,
  lockfileSha256,
  scanExitCode,
  sbomExitCode,
  status,
  packageCount: packages.length,
  componentCount,
  npmComponentCount,
  relationshipCounts,
  scopeCounts,
  vulnerabilityCount: vulnerabilities.length,
  severityCounts,
  blockingSeverities: [...blockingSeverities],
  blockingFindingCount,
  fixAvailableCount: vulnerabilities.filter(vulnerability => Boolean(vulnerability.FixedVersion)).length,
  errors,
};

fs.mkdirSync(path.dirname(metadataPath), { recursive: true });
fs.writeFileSync(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`);

const summary = [
  '## Dependency security',
  '',
  `Commit: \`${metadata.commit}\``,
  `Trivy: \`${metadata.trivyVersion || 'unknown'}\``,
  `Status: **${status.toUpperCase()}**`,
  `Packages: **${metadata.packageCount}**`,
  `Vulnerabilities: **${metadata.vulnerabilityCount}**`,
  `Severities: critical ${severityCounts.CRITICAL}, high ${severityCounts.HIGH}, medium ${severityCounts.MEDIUM}, low ${severityCounts.LOW}, unknown ${severityCounts.UNKNOWN}`,
  `Blocking findings: **${blockingFindingCount}**`,
];
if (errors.length) summary.push('', 'The scan was incomplete or inconsistent; inspect the scanner steps.');
if (env.GITHUB_STEP_SUMMARY) fs.appendFileSync(env.GITHUB_STEP_SUMMARY, `${summary.join('\n')}\n`);
console.log(summary.join('\n'));

if (status !== 'success') process.exitCode = 1;
