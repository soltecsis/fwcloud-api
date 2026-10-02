const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const config = require('./trivy-config.json');

const root = path.resolve(__dirname, '..');
const outputs = {
  json: 'trivy.json',
  sbom: 'sbom.cdx.json',
  version: 'trivy-version.json',
};

function argumentsFor(mode) {
  if (mode === 'version') return ['version', '--format', 'json'];
  if (!['table', 'json', 'sbom'].includes(mode)) throw new Error(`Unknown Trivy mode: ${mode}`);
  return [
    'fs',
    ...config.commonArgs,
    ...(mode === 'sbom' ? [] : config.vulnerabilityArgs),
    ...(mode === 'json' ? ['--list-all-pkgs'] : []),
    '--format',
    mode === 'sbom' ? 'cyclonedx' : mode,
    ...(mode === 'table' ? [] : ['--quiet']),
    '.',
  ];
}

function commandFor(mode, binary, repositoryRoot = root) {
  const args = argumentsFor(mode);
  if (binary) return { command: binary, args };
  return {
    command: 'docker',
    args: [
      'run', '--rm',
      '--mount', `type=bind,source=${repositoryRoot},target=/project,readonly`,
      '--mount', `type=volume,source=${config.cacheVolume},target=/cache`,
      '--env', 'TRIVY_CACHE_DIR=/cache',
      '--workdir', '/project',
      config.image,
      ...args,
    ],
  };
}

function run(mode, options = {}) {
  const repositoryRoot = options.root || root;
  const binary = options.binary ?? process.env.TRIVY_BINARY;
  const invocation = commandFor(mode, binary, repositoryRoot);
  let outputFd;
  try {
    if (outputs[mode]) {
      const directory = path.join(repositoryRoot, 'reports', 'dependencies');
      fs.mkdirSync(directory, { recursive: true });
      // Truncate old evidence before execution; Docker writes only to stdout.
      outputFd = fs.openSync(path.join(directory, outputs[mode]), 'w', 0o600);
    }
    const result = (options.spawn || spawnSync)(invocation.command, invocation.args, {
      cwd: repositoryRoot,
      stdio: ['ignore', outputFd ?? 'inherit', 'inherit'],
    });
    if (result.error) {
      console.error(`Unable to execute ${invocation.command}: ${result.error.message}`);
      if (!binary) console.error('Install/start Docker and check access with: docker info');
    }
    return result.status ?? 1;
  } finally {
    if (outputFd !== undefined) fs.closeSync(outputFd);
  }
}

if (require.main === module) {
  try {
    process.exitCode = run(process.argv[2]);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { argumentsFor, commandFor, run, root, config };
