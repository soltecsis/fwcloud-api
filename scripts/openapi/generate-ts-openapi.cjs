#!/usr/bin/env node

const { spawnSync } = require('child_process');
const path = require('path');

const configFile = path.resolve(__dirname, '../../tsoa.json');
const tsoaBin = path.resolve(__dirname, '../../node_modules/.bin/tsoa');

const result = spawnSync(tsoaBin, ['spec', '--configuration', configFile], {
  stdio: 'inherit',
  shell: false,
});

if (result.error) {
  console.error(result.error);
  process.exit(1);
}

process.exit(result.status ?? 1);
