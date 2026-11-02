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

  // CrowdSec controller methods keep their TSOA body parameters optional so
  // existing direct controller calls in unit tests remain source-compatible.
  // Runtime validation still requires each mutation payload. Reflect that API
  // contract in the generated OpenAPI document without changing controller
  // invocation semantics.
  for (const [pathName, pathItem] of Object.entries(spec.paths || {})) {
    if (!pathName.includes('/system/crowdsec/')) {
      continue;
    }

    for (const operation of Object.values(pathItem)) {
      if (operation && typeof operation === 'object' && operation.requestBody) {
        operation.requestBody.required = true;
      }
    }
  }

  fs.writeFileSync(specFile, JSON.stringify(spec, null, 2) + '\n');
} catch (error) {
  console.error(error);
  process.exit(1);
}
