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

import { logger } from "../../fonaments/abstract-application";

const dateFormat = require('dateformat');
const mysqldump = require('mysqldump');
const fs = require('fs');
const fse = require('fs-extra');
const mysql_import = require('mysql-import');
const cronJob = require('cron').CronJob;

const config = require('../../config/config');
const utilsModel = require('../../utils/utils');
const fwcError = require('../../utils/error_table');


// Database dump to a file.
backupModel.databaseDump = backup => {
	return new Promise(async (resolve, reject) => {
    try {
      const options = {
        connection: {
          host: config.get('db').host,
          user: config.get('db').user,
          password: config.get('db').pass,
          database: config.get('db').name,
        },
        dumpToFile: `./${config.get('backup').data_dir}/${backup}/${config.get('db').name}.sql`
      };

      await mysqldump(options);
      resolve();
    } catch(error) { reject(error) }
  });
};

// Copy the data directories.
backupModel.copyDataDirs = backup => {
	return new Promise(async (resolve, reject) => {
    let dst_dir;
    try {
      // Backup data folders.
      let item_list = ['pki', 'policy'];
      for (let item of item_list) {
        dst_dir = `./${config.get('backup').data_dir}/${backup}/${config.get(item).data_dir}/`;
        await fse.mkdirp(dst_dir);
        await fse.copy(`./${config.get(item).data_dir}/`, dst_dir);
      }

      resolve();
    } catch(error) { reject(error) }
  });
};

// Copy the data directories.
backupModel.applyRetentionPolicy = () => {
	return new Promise(async (resolve, reject) => {
    try {
      const backupConfig = await backupModel.readConfig();
      let backupList = await backupModel.getList();

      // First apply the retention policy for the maximum number of copies.
      while (backupList.length > backupConfig.max_copies) {
        backupList.shift();
      }

      // Then apply the retention policy for the maximum retention days.
      const ms = 1000 * 24 * 3600 * backupConfig.max_days;
      let retdate = new Date();
      retdate.setDate(retdate.getDate()-backupConfig.max_days);

      for (backup of backupList) {
        let mydate = new Date(backup.replace("_"," "));
        let diff = retdate - mydate; // Difference in milliseconds.
        if (diff > ms) // Remove backup.
          await backupModel.delete(backup);
        else
          break;
      }

      resolve();
    } catch(error) { reject(error) }
  });
};

// Make a full system backup.
backupModel.fullBackup = () => {
	return new Promise(async (resolve, reject) => {
    try {
      // Generate the id for the new backup.
	    const backup=dateFormat(new Date(), "yyyy-mm-dd_HH:MM:ss");

	    // Create the backup directory.
	    await utilsModel.createBackupDataDir(backup);

	    // Database dump to a file.
	    await backupModel.databaseDump(backup);

	    // Copy of the data directories.
	    await backupModel.copyDataDirs(backup);
      
      // Apply retention policy.
      await backupModel.applyRetentionPolicy();

      resolve(backup);
    } catch(error) { reject(error) }
  });
};

// Read config file.
backupModel.readConfig = () => {
	return new Promise(async (resolve, reject) => {
    try {
      const backupConfigFile = `./${config.get('backup').data_dir}/${config.get('backup').config_file}`;
      if (!fs.existsSync(backupConfigFile)) {
        return resolve({ schedule: config.get('backup').default_schedule,
          max_copies: config.get('backup').default_max_copies,
          max_days: config.get('backup').default_max_days
        }); // Default config.
      }
      
      const backupConfig = JSON.parse(fs.readFileSync(backupConfigFile,'utf8'));
      resolve(backupConfig);
    } catch(error) { reject(error) }
  });
};

// Write config in json to file.
backupModel.writeConfig = backupConfig => {
	return new Promise(async (resolve, reject) => {
    try {
      if (!fs.existsSync(`./${config.get('backup').data_dir}/`)) 
        await fse.mkdirp(`./${config.get('backup').data_dir}/`);

      const backupConfigFile = `./${config.get('backup').data_dir}/${config.get('backup').config_file}`;
      fs.writeFileSync(backupConfigFile, JSON.stringify(backupConfig), 'utf8'); 
      resolve();
    } catch(error) { reject(error) }
  });
};

// Get backup cron schedule.
backupModel.getSchedule = () => {
	return new Promise(async (resolve, reject) => {
    try {
      const backupConfig = await backupModel.readConfig();
      resolve(backupConfig.schedule);
    } catch(error) { reject(error) }
  });
};

// Set new backup cron schedule.
backupModel.setSchedule = req => {
	return new Promise(async (resolve, reject) => {
    try {
      let backupCron = req.app.get('backupCron');

      var CronTime = require('cron').CronTime;
      const time = new CronTime(req.body.schedule);
      backupCron.setTime(time);
      backupCron.start();

      logger().info(`New backup cron task schedule: ${req.body.schedule}`);

      resolve();
    } catch(error) { reject(error) }
  });
};

backupModel.cronJob = async () => {
  try {
	  logger().info("Starting BACKUP job.");
	  const backup = await backupModel.fullBackup();
    logger().info(`BACKUP job completed: ${backup}`);
  } catch(error) { logger().error("BACKUP job ERROR: ", error.message) }
}

backupModel.initCron = async app => {
  try {
    const moment = require('moment-timezone');
    const schedule = await backupModel.getSchedule();
    logger().info(`Starting backup cron task with the schedule: ${schedule}`);
    let backupCron = new cronJob(schedule, backupModel.cronJob, null, true, moment.tz.guess());
    backupCron.start();
    app.set('backupCron',backupCron);
  } catch(error) { logger().error("Backup cron init ERROR: ", error.message) }
}


// List of available backups.
backupModel.getList = () => {
	return new Promise(async (resolve, reject) => {
    try {
      var dirs = [];

      // If backup folder don't exists return empty array.
      if (!fs.existsSync(`./${config.get('backup').data_dir}/`)) 
        return resolve(dirs);

      const files = await fs.readdirSync(`./${config.get('backup').data_dir}/`);
      for (file of files) {
        if (await fs.statSync(`./${config.get('backup').data_dir}/${file}`).isDirectory()) {
          dirs.push(file);
        }
      }

      // Before returning the result short array by directory name.
      dirs.sort();

      resolve(dirs);
    } catch(error) { reject(error) }
  });
};

// Delete backup.
backupModel.delete = backup => {
	return new Promise(async (resolve, reject) => {
    try {
      const path = `./${config.get('backup').data_dir}/${backup}`;
      if (!fs.existsSync(path))
        throw(fwcError.NOT_FOUND);

      // Delete backup folder.
      await utilsModel.deleteFolder(path);
      resolve();
    } catch(error) { reject(error) }
  });
};


backupModel.dropTable = (dbCon,table) => {
	return new Promise((resolve, reject) => {
		dbCon.query(`DROP TABLE IF EXISTS ${table}`, (error, result) => {
      if (error) return reject(error);
      resolve();
		});
	});
};

backupModel.emptyDataBase = (dbCon) => {
	return new Promise((resolve, reject) => {
		dbCon.query("SET FOREIGN_KEY_CHECKS = 0", (error, result) => {
      if (error) return reject(error);
      
      dbCon.query(`SELECT table_name FROM information_schema.tables WHERE table_schema='${config.get('db').name}'`, async (error, result) => {
        if (error) return reject(error);

        try {
          for(let row of result) {
            await backupModel.dropTable(dbCon,row.table_name);
          }  
        } catch(error) { return reject(error) }

        dbCon.query("SET FOREIGN_KEY_CHECKS = 1", (error, result) => {
          if (error) return reject(error);
          resolve();
        });
      });
		});
	});
};

// Check backup directory.
backupModel.check = backup => {
	return new Promise(async (resolve, reject) => {
    try {
      // First check that the backup directory exists.
      if (!fs.existsSync(`./${config.get('backup').data_dir}/${backup}`))
        throw(fwcError.NOT_FOUND);
 
		  // Next check that the SQL dump file exists.
      if (!fs.existsSync(`./${config.get('backup').data_dir}/${backup}/${config.get('db').name}.sql`))
        throw(fwcError.NOT_FOUND);

      resolve();
    } catch(error) { reject(error) }
  });
};

// Restore backup.
backupModel.restore = req => {
	return new Promise(async (resolve, reject) => {
    let src_dir, dst_dir;
    try {
      // Empty database.
      await backupModel.emptyDataBase(req.dbCon);

      // Full database restore.
      const mydb_importer = mysql_import.config({
        host: config.get('db').host,
        user: config.get('db').user,
        password: config.get('db').pass,
        database: config.get('db').name,
        onerror: err=>{throw(err)}
      });
      await mydb_importer.import(`./${config.get('backup').data_dir}/${req.body.backup}/${config.get('db').name}.sql`);

      // Apply migration patchs depending on the database API version.

      // Restore data folders.
      let item_list = ['pki', 'policy'];
      for (let item of item_list) {
        src_dir = `./${config.get('backup').data_dir}/${req.body.backup}/${config.get(item).data_dir}/`;
        dst_dir = `./${config.get(item).data_dir}/`;
        await utilsModel.deleteFolder(dst_dir); // Empty destination dir
        await fse.mkdirp(dst_dir);
        await fse.copy(src_dir, dst_dir);
      }

      // Make all firewalls pending of compile and install.

      // Make all VPNs pending of install.

      // Clean all polici compilation cache.


      resolve();
    } catch(error) { reject(error) }
  });
};

//Export the object
module.exports = backupModel;

