const path = require('node:path');

function requireLab() {
  if (
    process.env.CI !== 'true' ||
    process.env.NODE_ENV !== 'prod' ||
    process.env.TYPEORM_DATABASE !== 'fwcloud_zap' ||
    process.env.TYPEORM_HOST !== '127.0.0.1' ||
    !process.env.RUNNER_TEMP
  )
    throw new Error('The dedicated disposable CI environment is required.');
}

module.exports = {
  requireLab,
  privateFile: (name) => path.join(process.env.RUNNER_TEMP, `zap-${name}.json`),
};
