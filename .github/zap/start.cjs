// CI-only startup: actual HTTP middleware and a fresh database for the public scan.
require('reflect-metadata');
const path = require('node:path');
const fs = require('node:fs');
const { requireLab } = require('./environment.cjs');

async function start() {
  requireLab();
  process.env.SESSION_FILES_PATH = path.join(process.env.RUNNER_TEMP, 'zap-api-sessions');
  process.env.LOGS_DIRECTORY = path.join(process.env.RUNNER_TEMP, 'zap-api-logs');
  fs.mkdirSync(process.env.SESSION_FILES_PATH, { recursive: true, mode: 0o700 });
  fs.mkdirSync(process.env.LOGS_DIRECTORY, { recursive: true, mode: 0o700 });
  const { Application } = require('../../dist/src/Application');
  const { Server } = require('../../dist/src/Server');
  const { DatabaseService } = require('../../dist/src/database/database.service');
  const application = await Application.run();
  const database = await application.getService(DatabaseService.name);
  if (!(await database.isDatabaseEmpty())) throw new Error('ZAP database must be fresh and empty.');
  await database.runMigrations();
  // Accounts are created only after the public scan's detailed reports are finished.
  await new Server(application).start();
}

start().catch(() => {
  console.error('The temporary ZAP API could not start.');
  process.exit(1);
});
