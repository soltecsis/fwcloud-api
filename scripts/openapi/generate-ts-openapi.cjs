#!/usr/bin/env node

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const configFile = path.resolve(__dirname, '../../tsoa.json');
const tsoaBin = path.resolve(__dirname, '../../node_modules/.bin/tsoa');
const specFile = path.resolve(__dirname, '../../docs/openapi/openapi.json');
const introFile = path.resolve(__dirname, '../../docs/openapi/INTRODUCTION.md');
const packageFile = path.resolve(__dirname, '../../package.json');

const result = spawnSync(tsoaBin, ['spec', '--configuration', configFile], {
  stdio: 'inherit',
  shell: false,
});

if (result.error) {
  console.error(result.error);
  process.exit(1);
}

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

try {
  if (!fs.existsSync(specFile)) {
    console.error(`OpenAPI spec not found: ${specFile}`);
    process.exit(1);
  }

  const spec = JSON.parse(fs.readFileSync(specFile, 'utf8'));

  spec.info = spec.info || {};

  if (fs.existsSync(packageFile)) {
    const packageJson = JSON.parse(fs.readFileSync(packageFile, 'utf8'));
    if (packageJson.version) {
      spec.info.version = packageJson.version;
    }
  }

  if (fs.existsSync(introFile)) {
    const introMarkdown = fs.readFileSync(introFile, 'utf8').trim();
    spec.info.description = introMarkdown;
  }

  const clusterInstall = spec.paths?.['/fwclouds/{fwcloud}/clusters/{cluster}/policy/install']?.post;
  if (clusterInstall?.responses?.['200']?.content?.['application/json']) {
    clusterInstall.responses['200'].content['application/json'].schema = {
      type: 'object',
      required: ['status', 'response', 'message', 'data'],
      properties: {
        status: { type: 'integer' },
        response: { type: 'string' },
        message: { type: 'string' },
        data: {
          type: 'object',
          required: ['success', 'nodes'],
          properties: {
            success: { type: 'boolean' },
            nodes: {
              type: 'array',
              items: {
                type: 'object',
                required: ['firewallId', 'installation', 'recovery'],
                properties: {
                  firewallId: { type: 'integer' },
                  installation: { type: 'string', enum: ['pending', 'installed', 'failed', 'unknown'] },
                  recovery: { type: 'string', enum: ['not_needed', 'restored', 'failed', 'unavailable', 'unknown'] },
                },
              },
            },
          },
        },
      },
    };
  }

  fs.writeFileSync(specFile, JSON.stringify(spec, null, 2) + '\n');
} catch (error) {
  console.error(error);
  process.exit(1);
}
