// Trivy owns scanning, CycloneDX generation and severity policy. This adapter
// checks the expected inventory/evidence and publishes aggregates only.
const crypto = require('node:crypto');
const fs = require('node:fs');
const config = require('./trivy-config.json');
const { context, writeJson, summary, exitCode } = require('./ci-context.cjs');
const env = process.env;
const errors = [];
const counts = { UNKNOWN: 0, LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 };
const read = (name, fallback) => {
  try {
    return JSON.parse(fs.readFileSync(env[name] || fallback, 'utf8'));
  } catch {
    errors.push(`Missing or malformed ${name}.`);
    return null;
  }
};
const report = read('TRIVY_REPORT_PATH', 'reports/dependencies/trivy.json');
const sbom = read('TRIVY_SBOM_PATH', 'reports/dependencies/sbom.cdx.json');
const version = read('TRIVY_VERSION_PATH', 'reports/dependencies/trivy-version.json');
const scanExitCode = exitCode(env.TRIVY_EXIT_CODE);
const sbomExitCode = exitCode(env.TRIVY_SBOM_EXIT_CODE);
const policyExitCode = exitCode(env.TRIVY_POLICY_EXIT_CODE);
if (scanExitCode !== 0 || sbomExitCode !== 0) errors.push('Scanner or SBOM generation failed.');
if (![0, config.findingsExitCode].includes(policyExitCode))
  errors.push('Native Trivy policy check failed or did not run.');

const must = (condition, message) => {
  if (!condition) throw new Error(message);
};
let packages = [],
  vulnerabilities = [],
  npmComponents = [];
try {
  must(report?.SchemaVersion === 2 && Array.isArray(report.Results), 'Invalid Trivy report.');
  must(
    report.Results.every((result) => result && typeof result === 'object'),
    'Invalid Trivy result entry.',
  );
  const results = report.Results.filter((result) => result.Type === 'npm');
  must(
    results.some((result) => result.Target === 'package-lock.json'),
    'Root lockfile was not inventoried.',
  );
  for (const result of results) {
    must(
      Array.isArray(result.Packages) && result.Packages.every((pkg) => pkg?.Name && pkg.Version),
      'Invalid npm inventory.',
    );
    packages.push(...result.Packages);
    must(
      result.Vulnerabilities == null || Array.isArray(result.Vulnerabilities),
      'Invalid vulnerability array.',
    );
    for (const vulnerability of result.Vulnerabilities || []) {
      must(
        vulnerability?.VulnerabilityID &&
          vulnerability.PkgName &&
          vulnerability.InstalledVersion &&
          Object.hasOwn(counts, vulnerability.Severity),
        'Invalid vulnerability entry.',
      );
      counts[vulnerability.Severity]++;
      vulnerabilities.push(vulnerability);
    }
  }
  must(packages.length > 0, 'Empty npm inventory.');
  must(
    sbom?.bomFormat === 'CycloneDX' &&
      sbom.specVersion === config.cycloneDxVersion &&
      sbom.metadata?.component &&
      Array.isArray(sbom.components) &&
      sbom.components.every((component) => component && typeof component === 'object'),
    'Invalid CycloneDX inventory.',
  );
  npmComponents = sbom.components.filter((component) =>
    String(component.purl || '').startsWith('pkg:npm/'),
  );
  const ids = packages.map((pkg) => `${pkg.Name}@${pkg.Version}`).sort();
  const componentIds = npmComponents
    .map((component) => {
      must(component.name && component.version, 'Invalid npm component.');
      return `${component.group ? component.group + '/' : ''}${component.name}@${component.version}`;
    })
    .sort();
  must(
    new Set(ids).size === ids.length && JSON.stringify(ids) === JSON.stringify(componentIds),
    'Trivy and SBOM npm inventories differ.',
  );
  const refs = new Set(
    [sbom.metadata.component, ...sbom.components]
      .flatMap((component) => [component['bom-ref'], component.purl])
      .filter(Boolean),
  );
  must(
    Array.isArray(sbom.dependencies) &&
      sbom.dependencies.length > 0 &&
      sbom.dependencies.every(
        (dependency) =>
          dependency &&
          refs.has(dependency.ref) &&
          Array.isArray(dependency.dependsOn) &&
          dependency.dependsOn.every((ref) => refs.has(ref)),
      ),
    'Invalid SBOM dependency references.',
  );
} catch (error) {
  errors.push(error.message);
}

if (
  version?.Version !== config.version ||
  (env.TRIVY_VERSION && version.Version !== env.TRIVY_VERSION) ||
  Number.isNaN(Date.parse(version?.VulnerabilityDB?.UpdatedAt))
) {
  errors.push('Unexpected Trivy version or missing database timestamp.');
}
let lockfileSha256 = null;
try {
  lockfileSha256 = crypto
    .createHash('sha256')
    .update(fs.readFileSync(env.TRIVY_LOCKFILE_PATH || 'package-lock.json'))
    .digest('hex');
} catch {
  errors.push('Unable to hash the root lockfile.');
}
const blockingFindingCount = config.blockingSeverities.reduce(
  (sum, severity) => sum + counts[severity],
  0,
);
// Cross-check native output instead of implementing a second severity gate.
if ((policyExitCode === config.findingsExitCode) !== blockingFindingCount > 0) {
  errors.push('Native policy result and vulnerability counts disagree.');
}
const status = errors.length
  ? 'error'
  : policyExitCode === config.findingsExitCode
    ? 'findings'
    : 'success';
const metadata = {
  ...context(),
  trivyVersion: version?.Version || null,
  vulnerabilityDb: version?.VulnerabilityDB
    ? {
        version: version.VulnerabilityDB.Version || null,
        updatedAt: version.VulnerabilityDB.UpdatedAt || null,
        nextUpdate: version.VulnerabilityDB.NextUpdate || null,
      }
    : null,
  reportCreatedAt: report?.CreatedAt || null,
  lockfileSha256,
  scanExitCode,
  sbomExitCode,
  policyExitCode,
  status,
  packageCount: packages.length,
  componentCount: sbom?.components?.length || 0,
  npmComponentCount: npmComponents.length,
  relationshipCounts: {
    direct: packages.filter((pkg) => pkg.Relationship === 'direct').length,
    indirect: packages.filter((pkg) => pkg.Relationship !== 'direct').length,
  },
  scopeCounts: {
    runtime: packages.filter((pkg) => !pkg.Dev).length,
    development: packages.filter((pkg) => pkg.Dev).length,
  },
  vulnerabilityCount: vulnerabilities.length,
  severityCounts: counts,
  blockingSeverities: config.blockingSeverities,
  blockingFindingCount,
  fixAvailableCount: vulnerabilities.filter((vulnerability) => vulnerability.FixedVersion).length,
  errors,
};
writeJson(env.TRIVY_METADATA_PATH || 'reports/dependencies/metadata.json', metadata);
summary([
  '## Dependency security',
  '',
  `Commit: \`${metadata.commit}\``,
  `Trivy: \`${metadata.trivyVersion || 'unknown'}\``,
  `Status: **${status.toUpperCase()}**`,
  `Packages: **${metadata.packageCount}**`,
  `Vulnerabilities: **${metadata.vulnerabilityCount}**`,
  `Severities: critical ${counts.CRITICAL}, high ${counts.HIGH}, medium ${counts.MEDIUM}, low ${counts.LOW}, unknown ${counts.UNKNOWN}`,
  `Blocking findings: **${blockingFindingCount}**`,
  ...(errors.length ? ['The scan was incomplete or inconsistent; inspect the scanner steps.'] : []),
]);
if (status !== 'success') process.exitCode = 1;
