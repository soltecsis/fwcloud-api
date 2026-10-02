const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');
const { test } = require('node:test');

const script = path.join(__dirname, 'trivy-report.cjs');
const gitDir = execFileSync('git', ['rev-parse', '--absolute-git-dir'], { encoding: 'utf8' }).trim();

function fixture(severity) {
  const vulnerability = severity
    ? {
        VulnerabilityID: 'CVE-2099-0001',
        PkgName: 'sensitive-package-name',
        InstalledVersion: '1.0.0',
        FixedVersion: '1.0.1',
        Severity: severity,
        Title: 'sensitive vulnerability context',
      }
    : null;
  return {
    report: {
      SchemaVersion: 2,
      Trivy: { Version: '0.74.0' },
      CreatedAt: '2026-09-29T00:00:00Z',
      ArtifactName: '.',
      ArtifactType: 'repository',
      Results: [
        {
          Target: 'package-lock.json',
          Class: 'lang-pkgs',
          Type: 'npm',
          Packages: [
            { Name: 'runtime-package', Version: '1.0.0', Relationship: 'direct' },
            { Name: 'dev-package', Version: '2.0.0', Relationship: 'indirect', Dev: true },
          ],
          Vulnerabilities: vulnerability ? [vulnerability] : null,
        },
      ],
    },
    sbom: {
      bomFormat: 'CycloneDX',
      specVersion: '1.7',
      metadata: { component: { type: 'application', name: '.', version: 'test' } },
      components: [
        {
          'bom-ref': 'pkg:npm/runtime-package@1.0.0',
          type: 'library',
          name: 'runtime-package',
          version: '1.0.0',
          purl: 'pkg:npm/runtime-package@1.0.0',
        },
        {
          'bom-ref': 'pkg:npm/dev-package@2.0.0',
          type: 'library',
          name: 'dev-package',
          version: '2.0.0',
          purl: 'pkg:npm/dev-package@2.0.0',
        },
      ],
      dependencies: [
        { ref: 'pkg:npm/runtime-package@1.0.0', dependsOn: ['pkg:npm/dev-package@2.0.0'] },
        { ref: 'pkg:npm/dev-package@2.0.0', dependsOn: [] },
      ],
    },
    version: {
      Version: '0.74.0',
      VulnerabilityDB: {
        Version: 2,
        UpdatedAt: '2026-09-29T00:00:00Z',
        NextUpdate: '2026-09-30T00:00:00Z',
      },
    },
  };
}

function collect(t, options = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'fwcloud-trivy-report-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const reportPath = path.join(directory, 'trivy.json');
  const sbomPath = path.join(directory, 'sbom.cdx.json');
  const versionPath = path.join(directory, 'trivy-version.json');
  const metadataPath = path.join(directory, 'metadata.json');
  const lockfilePath = path.join(directory, 'package-lock.json');
  const summaryPath = path.join(directory, 'summary.md');
  const data = fixture(options.severity);

  if (!options.missingReport) fs.writeFileSync(reportPath, JSON.stringify(options.report ?? data.report));
  if (!options.missingSbom) fs.writeFileSync(sbomPath, JSON.stringify(options.sbom ?? data.sbom));
  fs.writeFileSync(versionPath, JSON.stringify(options.version ?? data.version));
  fs.writeFileSync(lockfilePath, '{"lockfileVersion":3}\n');

  const result = spawnSync(process.execPath, [script], {
    cwd: directory,
    encoding: 'utf8',
    env: {
      ...process.env,
      GIT_DIR: gitDir,
      TRIVY_REPORT_PATH: reportPath,
      TRIVY_SBOM_PATH: sbomPath,
      TRIVY_VERSION_PATH: versionPath,
      TRIVY_METADATA_PATH: metadataPath,
      TRIVY_LOCKFILE_PATH: lockfilePath,
      TRIVY_EXIT_CODE: String(options.scanExitCode ?? 0),
      TRIVY_SBOM_EXIT_CODE: String(options.sbomExitCode ?? 0),
      TRIVY_VERSION: '0.74.0',
      GITHUB_STEP_SUMMARY: summaryPath,
    },
  });
  const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
  const summary = fs.readFileSync(summaryPath, 'utf8');
  return { result, metadata, summary };
}

test('accepts a complete clean scan and inventories both dependency scopes', t => {
  const { result, metadata } = collect(t);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(metadata.status, 'success');
  assert.equal(metadata.packageCount, 2);
  assert.deepEqual(metadata.scopeCounts, { runtime: 1, development: 1 });
  assert.match(metadata.lockfileSha256, /^[a-f0-9]{64}$/);
});

test('reports medium findings without blocking the build', t => {
  const { result, metadata } = collect(t, { severity: 'MEDIUM' });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(metadata.status, 'success');
  assert.equal(metadata.severityCounts.MEDIUM, 1);
  assert.equal(metadata.blockingFindingCount, 0);
});

test('blocks high findings without exposing vulnerability details', t => {
  const { result, metadata, summary } = collect(t, { severity: 'HIGH' });
  const evidence = `${JSON.stringify(metadata)}${summary}`;
  assert.equal(result.status, 1);
  assert.equal(metadata.status, 'findings');
  assert.equal(metadata.blockingFindingCount, 1);
  assert.ok(!evidence.includes('CVE-2099-0001'));
  assert.ok(!evidence.includes('sensitive-package-name'));
  assert.ok(!evidence.includes('sensitive vulnerability context'));
});

test('rejects missing vulnerability or SBOM evidence', t => {
  assert.equal(collect(t, { missingReport: true }).result.status, 1);
  assert.equal(collect(t, { missingSbom: true }).result.status, 1);
});

test('rejects scanner execution failures', t => {
  assert.equal(collect(t, { scanExitCode: 2 }).result.status, 1);
  assert.equal(collect(t, { sbomExitCode: 2 }).result.status, 1);
});

test('rejects an empty package inventory', t => {
  const data = fixture();
  data.report.Results[0].Packages = [];
  assert.equal(collect(t, { report: data.report }).result.status, 1);
});

test('rejects inconsistent report and SBOM component counts', t => {
  const data = fixture();
  data.sbom.components.pop();
  assert.equal(collect(t, { sbom: data.sbom }).result.status, 1);
});

test('rejects equal-sized inventories with different package identities', t => {
  const data = fixture();
  data.sbom.components[0].name = 'unrelated-package';
  data.sbom.components[0].purl = 'pkg:npm/unrelated-package@1.0.0';
  assert.equal(collect(t, { sbom: data.sbom }).result.status, 1);
});

test('rejects malformed vulnerability arrays and entries', t => {
  const data = fixture();
  data.report.Results[0].Vulnerabilities = {};
  assert.equal(collect(t, { report: data.report }).result.status, 1);

  const invalidSeverity = fixture('HIGH').report;
  delete invalidSeverity.Results[0].Vulnerabilities[0].Severity;
  assert.equal(collect(t, { report: invalidSeverity }).result.status, 1);
});

test('preserves error metadata for null report and SBOM entries', t => {
  const data = fixture();
  data.report.Results.push(null);
  data.report.Results[0].Packages.push(null);
  data.report.Results[0].Vulnerabilities = [null];
  data.sbom.components.push(null);
  const { result, metadata } = collect(t, { report: data.report, sbom: data.sbom });
  assert.equal(result.status, 1);
  assert.equal(metadata.status, 'error');
  assert.ok(metadata.errors.length >= 4);
});

test('rejects unexpected Trivy versions or missing database metadata', t => {
  assert.equal(collect(t, { version: { Version: '0.73.0', VulnerabilityDB: {} } }).result.status, 1);
});

test('rejects invalid CycloneDX versions and database timestamps', t => {
  const data = fixture();
  data.sbom.specVersion = 'invalid';
  assert.equal(collect(t, { sbom: data.sbom }).result.status, 1);
  assert.equal(
    collect(t, {
      version: { Version: '0.74.0', VulnerabilityDB: { Version: 2, UpdatedAt: 'invalid' } },
    }).result.status,
    1,
  );
});
