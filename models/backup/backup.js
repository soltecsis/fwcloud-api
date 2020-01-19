/*
    Copyright 2019 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
    https://soltecsis.com
    info@soltecsis.com


    This file is part of FWCloud (https://fwcloud.net).

    FWCloud is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    FWCloud is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with FWCloud.  If not, see <https://www.gnu.org/licenses/>.
*/


//create object
var backupModel = {};

const mysqldump = require('mysqldump');
const fs = require('fs')
const fse = require('fs-extra')

const config = require('../../config/config');
const utilsModel = require('../../utils/utils');
const fwcError = require('../../utils/error_table');


// Database dump to a file.
backupModel.databaseDump = backupId => {
	return new Promise(async (resolve, reject) => {
    try {
      const options = {
        connection: {
          host: config.get('db').host,
          user: config.get('db').user,
          password: config.get('db').pass,
          database: config.get('db').name,
        },
        dumpToFile: `./${config.get('backup').data_dir}/${backupId}/${config.get('db').name}.sql`
      };

      await mysqldump(options);
      resolve();
    } catch(error) { reject(error) }
  });
};

// Copy the data directories.
backupModel.copyDataDirs = backupId => {
	return new Promise(async (resolve, reject) => {
    var dst_dir;
    try {
      // Data directory for policy.
      dst_dir = `./${config.get('backup').data_dir}/${backupId}/${config.get('policy').data_dir}/`;
      await fse.mkdirp(dst_dir);
      await fse.copy(`./${config.get('policy').data_dir}/`, dst_dir);

      // Data directory for PKI.
      dst_dir = `./${config.get('backup').data_dir}/${backupId}/${config.get('pki').data_dir}/`;
      await fse.mkdirp(dst_dir);
      await fse.copy(`./${config.get('pki').data_dir}/`, dst_dir);

      resolve();
    } catch(error) { reject(error) }
  });
};

// List of available backups.
backupModel.getList = () => {
	return new Promise(async (resolve, reject) => {
    try {
      var dirs = [];
      const files = await fs.readdirSync(`./${config.get('backup').data_dir}/`);
      for (file of files) {
        if (await fs.statSync(`./${config.get('backup').data_dir}/${file}`).isDirectory()) {
          dirs.push(file);
        }
      }

      resolve(dirs);
    } catch(error) { reject(error) }
  });
};

// Delete backup.
backupModel.delete = req => {
	return new Promise(async (resolve, reject) => {
    try {
      const path = `./${config.get('backup').data_dir}/${req.body.backup}`;
      if (!fs.existsSync(path))
        throw(fwcError.NOT_FOUND);

      await utilsModel.deleteFolder(path);
      resolve();
    } catch(error) { reject(error) }
  });
};

//Export the object
module.exports = backupModel;

