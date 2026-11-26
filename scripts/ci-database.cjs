const { execFileSync } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const { appendFileSync } = require('node:fs');
const { setTimeout: delay } = require('node:timers/promises');
const mysql = require('mysql2/promise');

async function waitForDatabase(config) {
  for (let attempt = 1; attempt <= 30; attempt++) {
    let connection;
    try {
      connection = await mysql.createConnection(config);
      await connection.query({ sql: 'SELECT 1', timeout: 3000 });
      return;
    } catch (error) {
      if (attempt === 30) throw error;
    } finally {
      connection?.destroy();
    }
    await delay(5000);
  }
}

async function main() {
  const { CI_DB_IMAGE, TYPEORM_PORT, TYPEORM_DATABASE, TYPEORM_USERNAME, GITHUB_ENV } = process.env;
  const password = randomBytes(32).toString('hex');
  console.log(`::add-mask::${password}`);

  execFileSync(
    'docker',
    [
      'run',
      '--detach',
      '--name',
      'fwcloud-ci-db',
      '--publish',
      `127.0.0.1:${TYPEORM_PORT}:3306`,
      '--env',
      'MYSQL_RANDOM_ROOT_PASSWORD=yes',
      '--env',
      'MYSQL_DATABASE',
      '--env',
      'MYSQL_USER',
      '--env',
      'MYSQL_PASSWORD',
      CI_DB_IMAGE,
    ],
    {
      stdio: ['ignore', 'ignore', 'inherit'],
      env: {
        ...process.env,
        MYSQL_DATABASE: TYPEORM_DATABASE,
        MYSQL_USER: TYPEORM_USERNAME,
        MYSQL_PASSWORD: password,
      },
    },
  );

  await waitForDatabase({
    host: '127.0.0.1',
    port: Number(TYPEORM_PORT),
    database: TYPEORM_DATABASE,
    user: TYPEORM_USERNAME,
    password,
    connectTimeout: 3000,
  });

  appendFileSync(GITHUB_ENV, `TYPEORM_PASSWORD=${password}\n`);
}

main().catch((error) => {
  console.error(`Could not start the CI database: ${error.message}`);
  process.exitCode = 1;
});
