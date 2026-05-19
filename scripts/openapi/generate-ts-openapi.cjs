#!/usr/bin/env node

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const configFile = path.resolve(__dirname, '../../tsoa.json');
const tsoaBin = path.resolve(__dirname, '../../node_modules/.bin/tsoa');
const specFile = path.resolve(__dirname, '../../docs/openapi/openapi.json');
const introFile = path.resolve(__dirname, '../../docs/openapi/INTRODUCTION.md');

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

  if (!fs.existsSync(introFile)) {
    process.exit(0);
  }

  const spec = JSON.parse(fs.readFileSync(specFile, 'utf8'));
  const introMarkdown = fs.readFileSync(introFile, 'utf8').trim();

  spec.info = spec.info || {};
  spec.info.description = introMarkdown;

  fs.writeFileSync(specFile, JSON.stringify(spec, null, 2) + '\n');
} catch (error) {
  console.error(error);
  process.exit(1);
}
