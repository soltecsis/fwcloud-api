const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { run, root, config } = require('./trivy-run.cjs');

function main(mode, options = {}) {
  const repositoryRoot = options.root || root;
  if (!['scan', 'check', 'sbom'].includes(mode)) {
    console.error('Usage: npm run security:scan | security:check | security:sbom');
    return 1;
  }
  const execute = options.run || ((step) => run(step, { binary: '' }));
  const versionCode = execute('version');
  if (versionCode !== 0) return versionCode;
  const reportDirectory = path.join(repositoryRoot, 'reports', 'dependencies');
  const versionPath = path.join(reportDirectory, 'trivy-version.json');
  const version = JSON.parse(fs.readFileSync(versionPath, 'utf8'));
  if (version.Version !== config.version) throw new Error('Unexpected Trivy version.');

  if (mode === 'scan') return execute('table');
  if (mode === 'sbom') {
    const code = execute('sbom');
    if (code === 0) {
      // The pinned CLI owns CycloneDX serialization; check/CI verifies inventory.
      console.log('SBOM: reports/dependencies/sbom.cdx.json');
    }
    return code;
  }

  const scanCode = execute('json');
  const sbomCode = execute('sbom');
  const policyCode = execute('check');
  // Record database timestamps after the vulnerability scan has updated the cache.
  execute('version');
  const result = (options.spawn || spawnSync)(
    process.execPath,
    [path.join(__dirname, 'trivy-report.cjs')],
    {
      cwd: repositoryRoot,
      stdio: 'inherit',
      env: {
        ...process.env,
        TRIVY_VERSION: config.version,
        TRIVY_EXIT_CODE: String(scanCode),
        TRIVY_SBOM_EXIT_CODE: String(sbomCode),
        TRIVY_POLICY_EXIT_CODE: String(policyCode),
        TRIVY_REPORT_PATH: path.join(reportDirectory, 'trivy.json'),
        TRIVY_SBOM_PATH: path.join(reportDirectory, 'sbom.cdx.json'),
        TRIVY_VERSION_PATH: versionPath,
        TRIVY_METADATA_PATH: path.join(reportDirectory, 'metadata.json'),
        TRIVY_LOCKFILE_PATH: path.join(repositoryRoot, 'package-lock.json'),
      },
    },
  );
  if (result.error) console.error(result.error.message);
  console.log(
    'Local reports: reports/dependencies/ (use npm run security:scan for vulnerability details).',
  );
  return policyCode !== 0 ? 1 : (result.status ?? 1);
}

if (require.main === module) {
  try {
    process.exitCode = main(process.argv[2]);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { main };
