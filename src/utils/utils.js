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
var utilsModel = {};
//Export the object
module.exports = utilsModel;
import db from '../database/database-manager';
import { Firewall } from '../models/firewall/Firewall';
import { logger } from '../fonaments/abstract-application';
const config = require('../config/config');
var crypto = require('crypto');
const fs = require('fs');
var path = require('path');


utilsModel.isEmptyObject = (obj) => {
	return !Object.keys(obj).length;
};

utilsModel.startsWith = (str, word) => {
	return str.lastIndexOf(word, 0) === 0;
};

//TODO: Use arrow function expression
utilsModel.mergeObj = function() {
	console.log('utils.mergeObj() is deprectaded. Use ObjectHelers.merge() instead');
	var destination = {},
			sources = [].slice.call(arguments, 0);
	sources.forEach((source) => {
		var prop;
		for (prop in source) {
			if (prop in destination && Array.isArray(destination[ prop ])) {

				// Concat Arrays
				destination[ prop ] = destination[ prop ].concat(source[ prop ]);
			} else if (prop in destination && typeof destination[ prop ] === "object") {

				// Merge Objects
				destination[ prop ] = utilsModel.mergeObj(destination[ prop ], source[ prop ]);
			} else {

				// Set new values
				destination[ prop ] = source[ prop ];
			}
		}
	});
	return destination;
};


// Disable compiled and installed status flags.
utilsModel.disableFirewallCompileStatus = (req, res, next) => {
	var firewall=0;
	if (req.body.firewall)
		firewall=req.body.firewall;
	else if (req.body.rulesData)
		firewall=req.body.rulesData.firewall;
	Firewall.updateFirewallStatus(req.body.fwcloud,firewall,"|3")
	.then(() => next())
	.catch(error => {
		logger().error('Error disabling firewall compile status: ' + JSON.stringify(error));
		res.status(400).json(error)
	});
};

utilsModel.checkFirewallAccessTree = (iduser, fwcloud, firewall) => {
	return new Promise((resolve, reject) => {
		var accessData = {iduser: iduser, fwcloud: fwcloud, firewall: firewall};
		//logger().debug(accessData);
		Firewall.getFirewallAccess(accessData)
				.then(resp => {
					resolve(true);
				})
				.catch(err => {
					resolve(false);
				})
				;
	});
};

utilsModel.encrypt = (text) =>  {
	return new Promise((resolve, reject) => {
		try {
			var cipher = crypto.createCipher(config.get('crypt').algorithm, config.get('crypt').secret);
			var crypted = cipher.update(text, 'utf8', 'hex');
			crypted += cipher.final('hex');
			resolve(crypted);
		} catch (e) {
			resolve(text);
		}
	});
};
utilsModel.decrypt = (text) => {
	return new Promise((resolve, reject) => {
		try {
			var decipher = crypto.createDecipheriv(config.get('crypt').algorithm, config.get('crypt').secret);
			var dec = decipher.update(text, 'hex', 'utf8');
			dec += decipher.final('utf8');
			resolve(dec);
		} catch (e) {
			resolve(text);
		}
	});
};

utilsModel.decryptDataUserPass = (data) => {
	return new Promise((resolve, reject) => {
		try {
			logger().debug("DENTRO de decryptDataUserPass");
			if (data.install_user !== null) {
				logger().debug("DECRYPT USER: ", data.install_user);
				var decipher = crypto.createDecipheriv(config.get('crypt').algorithm, config.get('crypt').secret);
				var decUser = decipher.update(data.install_user, 'hex', 'utf8');
				decUser += decipher.final('utf8');
				data.install_user = decUser;
			}
			if (data.install_pass !== null) {
				logger().debug("DECRYPT PASS: ", data.install_pass);
				var decipherPass = crypto.createDecipheriv(config.get('crypt').algorithm, config.get('crypt').secret);
				var decPass = decipherPass.update(data.install_pass, 'hex', 'utf8');
				decPass += decipherPass.final('utf8');
				data.install_pass = decPass;
			}

			resolve(data);
		} catch (e) {
			reject(e);
		}
	});
};


utilsModel.getDbConnection = () => {
	return new Promise((resolve, reject) => {
		db.get((error, connection) => {
			if (error) return reject(error);
			
      resolve(connection);
    });
  });
};

utilsModel.createBackupDataDir = backupId => {
	return new Promise(async (resolve, reject) => {
		var path='';
		try {
			path = config.get('backup').data_dir;
			if (!fs.existsSync(path))
				fs.mkdirSync(path);

			path += "/" + backupId;
			await utilsModel.deleteFolder(path); // Make sure that folder doesn't already exists.
			fs.mkdirSync(path);

			resolve();
		} catch(error) { reject(error) }
  });
};

utilsModel.removeFwcloudDataDir = fwcloud => {
	return new Promise(async (resolve, reject) => {
		try {
			await utilsModel.deleteFolder(config.get('policy').data_dir+'/'+fwcloud);
			await utilsModel.deleteFolder(config.get('pki').data_dir+'/'+fwcloud);
			await utilsModel.deleteFolder(config.get('snapshot').data_dir+'/'+fwcloud);
			resolve();
		} catch(error) { reject(error) }
  });
};

utilsModel.createFirewallDataDir = (fwcloud, fwId) => {
	return new Promise(async (resolve, reject) => {
		var path='';
		try {
			path = config.get('policy').data_dir;
			if (!fs.existsSync(path))
				fs.mkdirSync(path);
			path += "/" + fwcloud;
			if (!fs.existsSync(path))
				fs.mkdirSync(path);
			path += "/" + fwId;
			await utilsModel.deleteFolder(path); // Make sure that folder doesn't already exists.
			fs.mkdirSync(path);

			resolve();
		} catch(error) { reject(error) }
  });
};

utilsModel.renameFirewallDataDir = (fwcloud, fwIdOld, fwIdNew) => {
	return new Promise((resolve, reject) => {
		const dir_old=config.get('policy').data_dir+'/'+fwcloud+'/'+fwIdOld;
		const dir_new=config.get('policy').data_dir+'/'+fwcloud+'/'+fwIdNew;
		try {
			fs.renameSync(dir_old,dir_new);
			resolve();
		} catch(error) { reject(error) }
  });
};


utilsModel.deleteFile = (dir, file) => {
	return new Promise((resolve, reject) => {
		var filePath = path.join(dir, file);
		fs.lstat(filePath, (err, stats) => {
			if (err) {
				if (err.code==="ENOENT") return resolve();
				return reject(err);
			}
			if (stats.isDirectory())
				resolve(utilsModel.deleteFolder(filePath));
			else {
				fs.unlink(filePath, err => {
					if (err) return reject(err);
					resolve();
				});
			}
		});
	});
};

utilsModel.deleteFolder = dir => {
	return new Promise((resolve, reject) => {
		fs.access(dir, err => {
			if (err) {
				if (err.code==="ENOENT") return resolve();
				return reject(err);
			}
			fs.readdir(dir, (err, files) => {
				if (err) return reject(err);
				Promise.all(files.map(file => { return utilsModel.deleteFile(dir, file) }))
				.then(() => {
					fs.rmdir(dir, err => {
						if (err) return reject(err);
						resolve();
					});
				})
				.catch(err => reject(err));
			});
		});
	});
};

