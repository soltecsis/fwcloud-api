//create object
var utilsModel = {};
//Export the object
module.exports = utilsModel;
/**
 * Property Logger to manage App logs
 *
 * @property logger
 * @type log4js/app
 * 
 */
var logger = require('log4js').getLogger("app");
var FirewallModel = require('../models/firewall/firewall');
const config = require('../config/config');
var api_resp = require('./api_response');
var crypto = require('crypto');
var randomString = require('random-string');
const db = require('../db');
const fs = require('fs');
var path = require('path');


utilsModel.checkEmptyRow = function (obj, callback) {
	var resp = true;
	logger.debug(obj);
	if (obj === null)
		resp = false;
	else if (obj === undefined)
		resp = false;
	else if (obj.length === 0)
		resp = false;
	//logger.debug(resp);
	callback(resp);
};
utilsModel.isEmptyObject = function (obj) {
	return !Object.keys(obj).length;
};
utilsModel.getRandomString = function (size) {
	var x = randomString({length: size});
	return x;
};

utilsModel.startsWith = function(str, word) {
	return str.lastIndexOf(word, 0) === 0;
};

utilsModel.mergeObj = function () {
	var destination = {},
			sources = [].slice.call(arguments, 0);
	sources.forEach(function (source) {
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
utilsModel.disableFirewallCompileStatus = function (req, res, next) {
	var firewall=0;
	if (req.body.firewall)
		firewall=req.body.firewall;
	else if (req.body.idfirewall)
		firewall=req.body.idfirewall;
	else if (req.body.rulesData)
		firewall=req.body.rulesData.firewall;
	FirewallModel.updateFirewallStatus(req.body.fwcloud,firewall,"|3")
	.then(data => next())
	.catch(error => api_resp.getJson(null, api_resp.ACR_DATA_ERROR, 'Error updating firewall status', 'POLICY', error, jsonResp => res.status(200).json(jsonResp)));
};

utilsModel.checkFirewallAccessTree = function (iduser, fwcloud, idfirewall) {
	return new Promise((resolve, reject) => {
		var accessData = {iduser: iduser, fwcloud: fwcloud, idfirewall: idfirewall};
		//logger.debug(accessData);
		FirewallModel.getFirewallAccess(accessData)
				.then(resp => {
					resolve(true);
				})
				.catch(err => {
					resolve(false);
				})
				;
	});
};
var algorithm = 'aes-256-ctr';
var password = 'RJ23edrf9)8JsjseE%6m,35HsjS84MK';
utilsModel.encrypt = function (text) {
	return new Promise((resolve, reject) => {
		try {
			var cipher = crypto.createCipher(algorithm, password);
			var crypted = cipher.update(text, 'utf8', 'hex');
			crypted += cipher.final('hex');
			resolve(crypted);
		} catch (e) {
			resolve(text);
		}
	});
};
utilsModel.decrypt = function (text) {
	return new Promise((resolve, reject) => {
		try {
			var decipher = crypto.createDecipher(algorithm, password);
			var dec = decipher.update(text, 'hex', 'utf8');
			dec += decipher.final('utf8');
			resolve(dec);
		} catch (e) {
			resolve(text);
		}
	});
};

utilsModel.decryptDataUserPass = function (data) {

	return new Promise((resolve, reject) => {
		try {
			logger.debug("DENTRO de decryptDataUserPass");
			if (data.install_user !== null) {
				logger.debug("DECRYPT USER: ", data.install_user);
				var decipher = crypto.createDecipher(algorithm, password);
				var decUser = decipher.update(data.install_user, 'hex', 'utf8');
				decUser += decipher.final('utf8');
				data.install_user = decUser;
			}
			if (data.install_pass !== null) {
				logger.debug("DECRYPT PASS: ", data.install_pass);
				var decipherPass = crypto.createDecipher(algorithm, password);
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

async function fetchRepoInfos() {
	// load repository details for this array of repo URLs
	const repos = [
		{
			url: 'https://api.github.com/repos/fs-opensource/futureflix-starter-kit'
		},
		{
			url: 'https://api.github.com/repos/fs-opensource/android-tutorials-glide'
		}
	];
	// map through the repo list
	const promises = repos.map(async repo => {
		// request details from GitHub’s API with Axios
		const response = await Axios({
			method: 'GET',
			url: repo.url,
			headers: {
				Accept: 'application/vnd.github.v3+json'
			}
		});
		return {
			name: response.data.full_name,
			description: response.data.description
		};
	});
	// wait until all promises resolve
	const results = await Promise.all(promises);
	// use the results
};


utilsModel.getDbConnection = () => {
	return new Promise((resolve, reject) => {
		db.get((error, connection) => {
			if (error) return reject(error);
			
      resolve(connection);
    });
  });
};

utilsModel.createFwcloudDataDir = fwcloud => {
	return new Promise((resolve, reject) => {
		var path='';
		try {
			path = config.get('policy').data_dir;
			if (!fs.existsSync(path))
				fs.mkdirSync(path);
			path += "/" + fwcloud;
			if (!fs.existsSync(path))
				fs.mkdirSync(path);
			
			resolve();
		} catch(error) { reject(error) }
  });
};

utilsModel.removeFwcloudDataDir = fwcloud => {
	return new Promise((resolve, reject) => {
		var dir_path=config.get('policy').data_dir+'/'+fwcloud;
		try {
			if (fs.existsSync(dir_path)) {
        fs.readdirSync(dir_path).forEach(function(entry) {
            var entry_path = path.join(dir_path, entry);
            if (!fs.lstatSync(entry_path).isDirectory()) 
              fs.unlinkSync(entry_path);
        });
        fs.rmdirSync(dir_path);
   		}
			resolve();
		} catch(error) { reject(error) }
  });
};


utilsModel.createFirewallDataDir = (fwcloud, fwId) => {
	return new Promise((resolve, reject) => {
		var path='';
		try {
			path = config.get('policy').data_dir;
			if (!fs.existsSync(path))
				fs.mkdirSync(path);
			path += "/" + fwcloud;
			if (!fs.existsSync(path))
				fs.mkdirSync(path);
			path += "/" + fwId;
			if (!fs.existsSync(path))
				fs.mkdirSync(path);
			
			resolve();
		} catch(error) { reject(error) }
  });
};

utilsModel.removeFirewallDataDir = (fwcloud, fwId) => {
	return new Promise((resolve, reject) => {
		var dir_path=config.get('policy').data_dir+'/'+fwcloud+'/'+fwId;
		try {
			if (fs.existsSync(dir_path)) {
        fs.readdirSync(dir_path).forEach(function(entry) {
            var entry_path = path.join(dir_path, entry);
            if (!fs.lstatSync(entry_path).isDirectory()) 
              fs.unlinkSync(entry_path);
        });
        fs.rmdirSync(dir_path);
   		}
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


