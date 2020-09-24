const path = require('path');
const fs = require('fs-extra');
const log = require('fancy-log');

module.exports = async () => {
    const distPath = path.join(process.cwd(), 'dist');
    log(`Removing compilation path: ${distPath}`);
    fs.removeSync(distPath);
};