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
var FwcloudModel = require('../models/fwcloud/fwcloud');
var api_resp = require('./api_response');
var UserModel = require('../models/user/user');
var crypto = require('crypto');
var randomString = require('random-string');


utilsModel.checkParameters = function (obj, callback) {
	for (var propt in obj) {
		logger.debug(propt + ': ' + obj[propt]);
		if (obj[propt] === undefined) {
			//logger.debug("PARAMETRO UNDEFINED: " + propt);
			obj[propt] = null;
		}        
	}
	callback(obj);
};
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
//CHECK IF A USER HAS ACCCESS TO FWCLOUD AND IF FWCLOUD IS NOT LOCKED.
utilsModel.checkFwCloudAccess = function (iduser, fwcloud, update, request, response) {

	return new Promise((resolve, reject) => {
		if (iduser && fwcloud) {
			var fwcloudData = {fwcloud: fwcloud, iduser: iduser};
			//Checl FWCLOUD LOCK
			FwcloudModel.getFwcloudAccess(iduser, fwcloud)
					.then(resp => {
						//{"access": true, "locked": false, , "mylock" : true  "locked_at": "", "locked_by": ""}
						//logger.warn(resp);
						logger.debug("UPDATE: " + update);
						if (resp.access && !update) {
							logger.warn("OK --> FWCLOUD ACCESS ALLOWED TO READ ");
							request.fwc_access = true;
							request.iduser = iduser;
							request.fwcloud = fwcloud;
							//next();
							resolve(true);
						} else if (resp.access && resp.locked && resp.mylock) {  //Acces ok an locked by user
							logger.warn("OK --> FWCLOUD ACCESS ALLOWED and LOCKED ");
							request.fwc_access = true;
							request.iduser = iduser;
							request.fwcloud = fwcloud;
							//next();
							resolve(true);
						} else if (resp.access && !resp.locked) {   //Acces ok and No locked
							//GET FWCLOUD LOCK
							FwcloudModel.updateFwcloudLock(fwcloudData)
									.then(data => {
										if (data.result) {
											logger.info("FWCLOUD: " + fwcloudData.fwcloud + "  LOCKED BY USER: " + fwcloudData.iduser);
											logger.warn("OK --> FWCLOUD ACCESS ALLOWED and GET LOCKED ");
											request.fwc_access = true;
											request.iduser = iduser;
											request.fwcloud = fwcloud;
											//next();
											resolve(true);
										} else {
											logger.info("NOT ACCESS FOR LOCKING FWCLOUD: " + fwcloudData.fwcloud + "  BY USER: " + fwcloudData.iduser);
											api_resp.getJson(data, api_resp.ACR_ERROR, 'Error locking', '', null, function (jsonResp) {
												response.status(200).json(jsonResp);
											});
										}
									})
									.catch(r => {
										logger.info("ERROR LOCKING FWCLOUD: " + fwcloudData.fwcloud + "  BY USER: " + fwcloudData.iduser);
										api_resp.getJson(null, api_resp.ACR_ERROR, 'Error locking', '', r, function (jsonResp) {
											response.status(200).json(jsonResp);
										});
									});
						} else if (resp.access && resp.locked && !resp.mylock) {       //Acces ok an locked by other user
							logger.warn("KO --> FWCLOUD ACCESS LOCKED BY OTHER USER ");
							request.fwc_access = false;
							//next(new Error("KO --> FWCLOUD ACCESS NOT ALLOWED "));
							api_resp.getJson(null, api_resp.ACR_ACCESS_LOCKED, ' FWCLOUD ACCESS LOCK BY OTHER USER ', '', null, function (jsonResp) {
								response.status(200).json(jsonResp);
							});
						} else if (!resp.access) {       //Acces Error
							logger.warn("KO --> FWCLOUD ACCESS NOT ALLOWED");
							request.fwc_access = false;
							//next(new Error("KO --> FWCLOUD ACCESS NOT ALLOWED "));
							api_resp.getJson(null, api_resp.ACR_ACCESS_ERROR, ' FWCLOUD ACCESS NOT ALLOWED ', '', null, function (jsonResp) {
								response.status(200).json(jsonResp);
							});
						}
						logger.warn("--------------------------------------------------");
					})
					.catch(resp => {
						logger.warn(resp);
						logger.warn("ERROR --> FWCLOUD ACCESS NOT ALLOWED ");
						logger.warn("--------------------------------------------------");
						request.fwc_access = false;
						api_resp.getJson(null, api_resp.ACR_ACCESS_ERROR, ' ERROR. FWCLOUD ACCESS NOT ALLOWED ', '', null, function (jsonResp) {
							response.status(200).json(jsonResp);
						});
					});
		} else {
			logger.error("ERROR ---> IDUSER & FWCLOUD NOT FOUND IN URL");
			api_resp.getJson(null, api_resp.ACR_ACCESS_ERROR, 'PARAM ERROR. FWCLOUD ACCESS NOT ALLOWED ', '', null, function (jsonResp) {
				response.status(200).json(jsonResp);
			});
		}
	});
};

utilsModel.checkConfirmationToken = function (req, res, next) {
	var accessData = {iduser: req.iduser, fwcloud: req.fwcloud, confirm_token: req.confirm_token, sessionID: req.sessionID};
	logger.debug("checkConfirmationToken: ", accessData);
	logger.debug("Restricted: ", req.restricted);

	UserModel.checkConfirmationtoken(accessData)
			.then(resp => {
				if (resp.result) {
//                    //Confirmation ok
//                    if (req.restricted.result === false) {
//                        api_resp.getJson(req.restricted, api_resp.ACR_RESTRICTED, ' FIREWALL RESTRICTED', '', null, function (jsonResp) {
//                            res.status(200).json(jsonResp);
//                        });
//                    } else
//                        next();                        
						next();
				} else {
					//Need confirmation, send new token
					var objResp = {"fwc_confirm_token": resp.token};
					if (req.restricted.result === false) {
						//Add restricted search to response
						objResp = utilsModel.mergeObj(objResp, req.restricted);
					}
					api_resp.getJson(objResp, api_resp.ACR_CONFIRM_ASK, ' Need to confirm action', 'ACTION', null, function (jsonResp) {
						res.status(200).json(jsonResp);
					});
				}
			});
};

utilsModel.checkFirewallAccess = function (req, res, next) {
	var accessData = {iduser: req.iduser, fwcloud: req.fwcloud, idfirewall: req.params.idfirewall};
	//logger.debug(accessData);
	FirewallModel.getFirewallAccess(accessData)
			.then(resp => {
				next();
			})
			.catch(err => {
				api_resp.getJson(null, api_resp.ACR_ACCESS_ERROR, 'CHECK FIREWALL ACCESS NOT ALLOWED', 'FIREWALL', null, function (jsonResp) {
					res.status(200).json(jsonResp);
				});
			})
			;
};

// Disable compiled and installed status flags.
utilsModel.disableFirewallCompileStatus = function (req, res, next) {
	var firewall=0;
	if (req.body.firewall)
		firewall=req.body.firewall;
	else if (req.params.idfirewall)
		firewall=req.params.idfirewall;
	else if (req.body.rulesData)
		firewall=req.body.rulesData.firewall;
	FirewallModel.updateFirewallStatus(req.fwcloud,firewall,"|3")
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
}


