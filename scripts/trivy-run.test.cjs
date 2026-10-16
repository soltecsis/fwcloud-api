const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const { argumentsFor, commandFor, run, config } = require('./trivy-run.cjs');
const { main } = require('./trivy-local.cjs');

test('Docker and native scans use identical security arguments', () => {
  for (const mode of ['table', 'json', 'sbom', 'version', 'check']) {
    const native = commandFor(mode, '/tmp/trivy');
    const docker = commandFor(mode, '', '/tmp/repository with spaces');
    assert.deepEqual(docker.args.slice(docker.args.indexOf(config.image) + 1), native.args);
    assert.ok(
      docker.args.includes('type=bind,source=/tmp/repository with spaces,target=/project,readonly'),
    );
  }
  const args = argumentsFor('json');
  assert.ok(args.includes('--include-dev-deps'));
  assert.equal(args[args.indexOf('--ignorefile') + 1], '/dev/null');
  assert.equal(args[args.indexOf('--config') + 1], '/dev/null');
  assert.ok(!argumentsFor('sbom').includes('--scanners'));
  assert.match(config.image, /@sha256:[a-f0-9]{64}$/);
});

test('failed scans truncate old evidence and propagate the scanner exit status', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fwcloud-trivy-run-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const directory = path.join(root, 'reports', 'dependencies');
  fs.mkdirSync(directory, { recursive: true });
  const reportPath = path.join(directory, 'trivy.json');
  fs.writeFileSync(reportPath, 'stale report');
  const code = run('json', {
    root,
    binary: '',
    spawn: (command, args, options) => {
      assert.equal(command, 'docker');
      assert.equal(fs.readFileSync(reportPath, 'utf8'), '');
      assert.equal(options.cwd, root);
      assert.equal(typeof options.stdio[1], 'number');
      return { status: 2 };
    },
  });
  assert.equal(code, 2);
  assert.equal(fs.readFileSync(reportPath, 'utf8'), '');
});

test('writes container stdout using a host-owned file descriptor', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fwcloud-trivy-run-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const code = run('sbom', {
    root,
    binary: '',
    spawn: (command, args, options) => {
      fs.writeSync(options.stdio[1], '{"bomFormat":"CycloneDX"}\n');
      return { status: 0 };
    },
  });
  assert.equal(code, 0);
  assert.equal(
    JSON.parse(fs.readFileSync(path.join(root, 'reports/dependencies/sbom.cdx.json'), 'utf8'))
      .bomFormat,
    'CycloneDX',
  );
});

test('rejects invalid modes before invoking Docker', () => {
  assert.throws(() => argumentsFor('invalid'), /Unknown Trivy mode/);
});

test('local check collects evidence after a scanner error and propagates policy failure', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fwcloud-trivy-local-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const directory = path.join(root, 'reports', 'dependencies');
  fs.mkdirSync(directory, { recursive: true });
  const steps = [];
  const code = main('check', {
    root,
    run: (mode) => {
      steps.push(mode);
      if (mode === 'version') {
        fs.writeFileSync(
          path.join(directory, 'trivy-version.json'),
          JSON.stringify({ Version: config.version }),
        );
      }
      return mode === 'json' ? 2 : 0;
    },
    spawn: (command, args, options) => {
      assert.equal(options.env.TRIVY_EXIT_CODE, '2');
      assert.equal(options.env.TRIVY_SBOM_EXIT_CODE, '0');
      assert.equal(options.env.TRIVY_POLICY_EXIT_CODE, '0');
      assert.equal(options.env.TRIVY_VERSION, config.version);
      assert.equal(options.env.TRIVY_REPORT_PATH, path.join(directory, 'trivy.json'));
      return { status: 1 };
    },
  });
  assert.equal(code, 1);
  assert.deepEqual(steps, ['version', 'json', 'sbom', 'check', 'version']);
});

test(
  'native Trivy blocks HIGH/CRITICAL, preserves full reports and rejects malformed input',
  {
    skip: !process.env.TRIVY_BINARY && !process.env.TRIVY_TEST_DOCKER,
  },
  (t) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fwcloud-native-trivy-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    fs.mkdirSync(path.join(root, 'reports/dependencies'), { recursive: true });
    const reportPath = path.join(root, 'reports/dependencies/trivy.json');
    for (const severity of ['MEDIUM', 'HIGH', 'CRITICAL']) {
      const input = JSON.stringify({
        SchemaVersion: 2,
        ArtifactType: 'repository',
        Results: [
          {
            Target: 'package-lock.json',
            Class: 'lang-pkgs',
            Type: 'npm',
            Vulnerabilities: [
              {
                VulnerabilityID: 'CVE-2099-0001',
                PkgName: 'synthetic-package',
                InstalledVersion: '1.0.0',
                Severity: severity,
              },
            ],
          },
        ],
      });
      fs.writeFileSync(reportPath, input);
      assert.equal(run('check', { root }), severity === 'MEDIUM' ? 0 : config.findingsExitCode);
      assert.equal(fs.readFileSync(reportPath, 'utf8'), input);
    }
    fs.writeFileSync(reportPath, '{}broken');
    assert.equal(run('check', { root }), 1);
  },
);
