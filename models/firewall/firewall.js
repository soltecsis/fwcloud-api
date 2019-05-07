var db = require('../../db.js');
/**
 * Module to manage Firewalls data
 *
 * @module Firewall
 * 
 * @requires db
 * 
 */

/**
 * Class to manage firewalls data
 *
 * @class FirewallModel
 * @uses db
 * 
 */
var firewallModel = {};
//Export the object
module.exports = firewallModel;
/**
 * Property Table
 *
 * @property tableModel
 * @type "firewall"
 * @private
 * 
 */
var tableModel = "firewall";
var logger = require('log4js').getLogger("app");
var utilsModel = require("../../utils/utils.js");
var interfaceModel = require('../../models/interface/interface');
const openvpnModel = require('../../models/vpn/openvpn/openvpn');
const openvpnPrefixModel = require('../../models/vpn/openvpn/prefix');
var Policy_rModel = require('../../models/policy/policy_r');
var fwcTreemodel = require('../tree/tree');
const config = require('../../config/config');
var firewall_Data = require('../../models/data/data_firewall');
const fwcError = require('../../utils/error_table');

/**
 * Get Firewalls by User
 *  
 * @method getFirewalls
 * 
 * @param {Integer} iduser User identifier
 * @param {Function} callback    Function callback response
 * 
 *       callback(error, Rows)
 * 
 * @return {ARRAY of Firewall objects} Returns `ARRAY OBJECT FIREWALL DATA` 
 * 
 * Table: __firewall__
 * 
 *           id	int(11) AI PK
 *           cluster	int(11)
 *           fwcloud	int(11)
 *           name	varchar(255)
 *           comment	longtext
 *           created_at	datetime
 *           updated_at	datetime
 *           by_user	int(11)
 */
firewallModel.getFirewalls = (iduser, callback) => {
	db.get(function (error, connection) {
		if (error)
			callback(error, null);
		var sql = `SELECT T.*, I.name as interface_name, O.name as ip_name, O.address as ip 
			FROM {tableModel} T 
			INNER JOIN user__fwcloud U ON T.fwcloud=U.fwcloud AND U.user=${iduser}
			LEFT join interface I on I.id=T.install_interface
			LEFT join ipobj O on O.id=T.install_ipobj and O.interface=I.id
			ORDER BY T.id`;
		logger.debug(sql);
		connection.query(sql, function (error, rows) {
			if (error)
				callback(error, null);
			else {
				Promise.all(rows.map(utilsModel.decryptDataUserPass))
						.then(data => {
							callback(null, data);
						})
						.catch(e => {
							callback(e, null);
						});
			}
		});
	});
};

/**
 * Get Firewalls by User and ID
 *  
 * @method getFirewall
 * 
 * @param {Integer} iduser User identifier
 * @param {Integer} id firewall identifier
 * @param {Function} callback    Function callback response
 * 
 *       callback(error, Rows)
 * 
 * @return {Firewall object} Returns `OBJECT FIREWALL DATA` 
 * 
 * Table: __firewall__
 * 
 *           id	int(11) AI PK
 *           cluster	int(11)
 *           fwcloud	int(11)
 *           name	varchar(255)
 *           comment	longtext
 *           created_at	datetime
 *           updated_at	datetime
 *           by_user	int(11)
 */
firewallModel.getFirewall = function (req) {
	return new Promise((resolve, reject) => {
		var sql = `SELECT T.*, I.name as interface_name, O.name as ip_name, O.address as ip, M.id as id_fwmaster
			FROM ${tableModel} T
			INNER JOIN user__fwcloud U ON T.fwcloud=U.fwcloud AND U.user=${req.session.user_id}
			LEFT join interface I on I.id=T.install_interface
			LEFT join ipobj O on O.id=T.install_ipobj and O.interface=I.id
			LEFT JOIN firewall M on M.cluster=T.cluster and M.fwmaster=1
			WHERE T.id=${req.body.firewall} AND T.fwcloud=${req.body.fwcloud}`;
		//logger.debug(sql);
		req.dbCon.query(sql, (error, rows) => {
			if (error) return reject(error);

			Promise.all(rows.map(utilsModel.decryptDataUserPass))
			.then(data => resolve(data))
			.catch(error => reject(error));
		});
	});
};

/**
 * Get Firewall SSH connection data
 *  
 * @method getFirewallSSH
 * 
 * @param {Integer} iduser User identifier
 * @param {Integer} id firewall identifier
 * @param {Function} callback    Function callback response
 * 
 *       callback(error, Rows)
 * 
 * @return {Firewall object} Returns `OBJECT FIREWALL DATA` 
 * 
 * Table: __firewall__
 * 
 *           id	int(11) AI PK
 *           cluster	int(11)
 *           fwcloud	int(11)
 *           name	varchar(255)
 *           comment	longtext
 *           created_at	datetime
 *           updated_at	datetime
 *           by_user	int(11)
 */
firewallModel.getFirewallSSH = function (req) {
	return new Promise(async (resolve, reject) => {
		try {
			var data = await firewallModel.getFirewall(req);

			// Obtain SSH connSettings for the firewall to which we want install the policy.
			var SSHconn = {
				host: data[0].ip,
				port: data[0].install_port,
				username: data[0].install_user,
				password: data[0].install_pass
			}

			// If we have ssh user and pass in the body of the request, then these data have preference over the data stored in database.
			if (req.body.sshuser && req.body.sshpass) {
				SSHconn.username = req.body.sshuser;
				SSHconn.password = req.body.sshpass;
			}  

			// If we have no user or password for the ssh connection, then error.
			if (!SSHconn.username || !SSHconn.password)
				throw(new Error('User or password for the SSH connection not found'));

			data.SSHconn = SSHconn;
			resolve(data);
		} catch(error) { reject(error) }
	});
};

/**
 * Get Firewall Access by Locked 
 *  
 * @method getFirewallLockedAccess
 * 
 * @param {Integer} iduser User identifier
 * @param {Integer} idfirewall firewall identifier
 * @param {Integer} fwcloud fwcloud identifier 
 * @param {Function} callback    Function callback response
 * 
 *       callback(error, Rows)
 * 
 * @return {Boolean} Returns `LOCKED STATUS` 
 * 
 */
firewallModel.getFirewallAccess = accessData => {
	return new Promise((resolve, reject) => {
		db.get(function (error, connection) {
			if (error) return reject(error);
			
			//CHECK FIREWALL PERIMSSIONS
			var sql = `SELECT T.* FROM ${tableModel} T
				INNER JOIN user__fwcloud U ON T.fwcloud=U.fwcloud AND U.user=${accessData.iduser}
				WHERE T.id=${accessData.firewall}	AND T.fwcloud=${accessData.fwcloud}`;
			connection.query(sql, function (error, row) {
				if (error) return reject(error);
				
				resolve((row && row.length>0) ? true : false);
			});
		});
	});
};

/**
 * Get Firewalls by User and Cluster
 *  
 * @method getFirewallCluster
 * 
 * @param {Integer} iduser User identifier
 * @param {Integer} idcluster Cluster identifier
 * @param {Function} callback    Function callback response
 * 
 *       callback(error, Rows)
 * 
 * @return {ARRAY of Firewall objects} Returns `ARRAY OBJECT FIREWALL DATA` 
 * 
 * Table: __firewall__
 * 
 *           id	int(11) AI PK
 *           cluster	int(11)
 *           fwcloud	int(11)
 *           name	varchar(255)
 *           comment	longtext
 *           created_at	datetime
 *           updated_at	datetime
 *           by_user	int(11)
 */
firewallModel.getFirewallCluster = function (iduser, idcluster, callback) {
	db.get(function (error, connection) {
		if (error) return callback(error, null);
		var sql = `SELECT T.*, I.name as interface_name, O.name as ip_name, O.address as ip
			FROM ${tableModel} T 
			INNER JOIN user__fwcloud U ON T.fwcloud=U.fwcloud AND U.user=${iduser}
			LEFT join interface I on I.id=T.install_interface
			LEFT join ipobj O on O.id=T.install_ipobj and O.interface=I.id
			WHERE cluster=${idcluster} ORDER BY T.fwmaster desc, T.id`;
		connection.query(sql, function (error, rows) {
			if (error)
				callback(error, null);
			else {
				Promise.all(rows.map(utilsModel.decryptDataUserPass))
						.then(data => {
							Promise.all(data.map(getfirewallData))
									.then(dataF => {
										callback(null, dataF);
									});
						})
						.catch(e => {
							callback(e, null);
						});
			}
		});
	});
};


function getfirewallData(row) {
	return new Promise((resolve, reject) => {
		var firewall = new firewall_Data(row);
		resolve(firewall);
	});
}

firewallModel.getFirewallClusterMaster = function (iduser, idcluster, callback) {
	db.get(function (error, connection) {
			if (error)
					callback(error, null);
			var sql = `SELECT T.*, I.name as interface_name, O.name as ip_name, O.address as ip
				FROM ${tableModel} T 
				INNER JOIN user__fwcloud U ON T.fwcloud=U.fwcloud AND U.user=${iduser}
				LEFT join interface I on I.id=T.install_interface
				LEFT join ipobj O on O.id=T.install_ipobj and O.interface=I.id
				WHERE cluster=${idcluster} AND fwmaster=1`;
			connection.query(sql, function (error, rows) {
					if (error)
							callback(error, null);
					else {
							Promise.all(rows.map(utilsModel.decryptDataUserPass))
											.then(data => {
													callback(null, data);
											})
											.catch(e => {
													callback(e, null);
											});
					}
			});
	});
};

/**
 * Get Firewalls by User and Cloud
 *  
 * @method getFirewallCloud
 * 
 * @param {Integer} iduser User identifier
 * @param {Integer} idCloud Cloud identifier
 * @param {Function} callback    Function callback response
 * 
 *       callback(error, Rows)
 * 
 * @return {ARRAY of Firewall objects} Returns `ARRAY OBJECT FIREWALL DATA` 
 * 
 * Table: __firewall__
 * 
 *           id	int(11) AI PK
 *           cluster	int(11)
 *           fwcloud	int(11)
 *           name	varchar(255)
 *           comment	longtext
 *           created_at	datetime
 *           updated_at	datetime
 *           by_user	int(11)
 */
firewallModel.getFirewallCloud = function (iduser, fwcloud, callback) {
	db.get(function (error, connection) {
		if (error)
			callback(error, null);
		var sql = `SELECT T.*, I.name as interface_name, O.name as ip_name, O.address as ip
			FROM ${tableModel} T INNER JOIN user__fwcloud U ON T.fwcloud=U.fwcloud AND U.user=${iduser}
			LEFT join interface I on I.id=T.install_interface
			LEFT join ipobj O on O.id=T.install_ipobj and O.interface=I.id
			WHERE T.fwcloud=${fwcloud}`;
		logger.debug(sql);
		connection.query(sql, function (error, rows) {
			if (error)
				callback(error, null);
			else {
				Promise.all(rows.map(utilsModel.decryptDataUserPass))
						.then(data => {
							callback(null, data);
						})
						.catch(e => {
							callback(e, null);
						});
			}
		});
	});
};
/**
 * ADD New Firewall
 *  
 * @method insertFirewall
 * 
 * @param iduser {Integer}  User identifier
 * @param firewallData {Firewall Object}  Firewall Object data
 *       @param firewallData.id {NULL} 
 *       @param firewallData.cluster {Integer} Cluster ID
 *       @param firewallData.fwcloud {Integer} FWcloud ID
 *       @param firewallData.name {string} Firewall Name
 *       @param [firewallData.comment] {String}  comment text 
 * @param {Function} callback    Function callback response
 * 
 *       callback(error, Rows)
 * 
 * @return {CALLBACK RESPONSE}
 * 
 * @example
 * #### RESPONSE OK:
 *    
 *       callback(null, {"insertId": fwid});
 *       
 * #### RESPONSE ERROR:
 *    
 *       callback(error, null);
 *       
 */
firewallModel.insertFirewall = (iduser, firewallData) => {
	return new Promise((resolve, reject) => {
		db.get(function (error, connection) {
			if (error) return reject(error);
			
			connection.query(`INSERT INTO ${tableModel} SET ?`, firewallData, (error, result) => {
				if (error) return reject(error);
				resolve({"insertId": result.insertId});
			});
		});
	});
};


/**
 * UPDATE Firewall
 *  
 * @method updateFirewall
 * 
 * @param iduser {Integer}  User identifier
 * @param firewallData {Firewall Object}  Firewall Object data
 *       @param firewallData.id {NULL} 
 *       @param firewallData.cluster {Integer} Cluster ID
 *       @param firewallData.fwcloud {Integer} FWcloud ID
 *       @param firewallData.name {string} Firewall Name
 *       @param [firewallData.comment] {String}  comment text 
 * @param {Function} callback    Function callback response
 * 
 *       callback(error, Rows)
 * 
 * @return {CALLBACK RESPONSE}
 * 
 * @example
 * #### RESPONSE OK:
 *    
 *       callback(null, {"result": true});
 *       
 * #### RESPONSE ERROR:
 *    
 *       callback(error, null);
 *       
 */
firewallModel.updateFirewall = function (dbCon, iduser, firewallData) {
	return new Promise((resolve, reject) => {
		var sqlExists = `SELECT T.id FROM ${tableModel} T 
			INNER JOIN user__fwcloud U ON T.fwcloud=U.fwcloud AND U.user=${iduser}
			WHERE T.id=${firewallData.id}`;
		dbCon.query(sqlExists, (error, row) => {
			if (error) return reject(error);

			if (row && row.length > 0) {
				var sql = 'UPDATE ' + tableModel + ' SET name=' + dbCon.escape(firewallData.name) + ', ' +
						'comment=' + dbCon.escape(firewallData.comment) + ', ' +
						'install_user=' + dbCon.escape(firewallData.install_user) + ', ' +
						'install_pass=' + dbCon.escape(firewallData.install_pass) + ', ' +
						'save_user_pass=' + dbCon.escape(firewallData.save_user_pass) + ', ' +
						'install_interface=' + dbCon.escape(firewallData.install_interface) + ', ' +
						'install_ipobj=' + dbCon.escape(firewallData.install_ipobj) + ', ' +
						'install_port=' + dbCon.escape(firewallData.install_port) + ', ' +
						'by_user=' + dbCon.escape(iduser) + ', ' +
						'options=' + dbCon.escape(firewallData.options) +
						' WHERE id=' + firewallData.id;
				dbCon.query(sql, function (error, result) {
					if (error) return reject(error);
					resolve(true);
				});
			} else resolve(false);
		});
	});
};


// Get the ID of all firewalls who's status field is not zero.
firewallModel.getFirewallStatusNotZero = function (fwcloud, data) {
	return new Promise((resolve, reject) => {
		db.get((error, connection) => {
			if (error) return reject(error);

			var sql = 'SELECT id,cluster,status FROM '+tableModel+' WHERE status!=0 AND fwcloud='+connection.escape(fwcloud);
			connection.query(sql, (error, rows) => {
				if (error) return reject(error);
				if (data) {
					data.fw_status = rows;
					resolve(data);
				} else
					resolve(rows);
			});
		});
	});
};


firewallModel.updateFirewallStatus = function (fwcloud, firewall, status_action) {
	return new Promise((resolve, reject) => {
		db.get((error, connection) => {
			if (error) return reject(error);
			var sql='UPDATE '+tableModel+' SET status=status'+status_action+
			' WHERE id='+connection.escape(firewall)+' AND fwcloud='+connection.escape(fwcloud);
			//logger.debug(sql);
			connection.query(sql, (error, result) => {
				if (error) return reject(error);
				resolve({"result": true});
			});
		});
	});
};

firewallModel.updateFirewallStatusIPOBJ = function (fwcloud, ipobj, ipobj_g, interface, type, status_action) {
	return new Promise((resolve, reject) => {
		db.get((error, connection) => {
			if (error) return reject(error);
			var sql='UPDATE '+tableModel+' F'+
			' INNER JOIN policy_r PR ON PR.firewall=F.id'+
			' INNER JOIN policy_r__ipobj PRI ON PRI.rule=PR.id'+
			' SET F.status=F.status'+status_action+
			' WHERE F.fwcloud='+connection.escape(fwcloud)+' AND PRI.ipobj='+connection.escape(ipobj)+
			' AND PRI.ipobj_g='+connection.escape(ipobj_g)+' AND PRI.interface='+connection.escape(interface);
			connection.query(sql, (error, result) => {
				if (error) return reject(error);

				// If ipobj!=-1 we must see if it is part of a group and then update the status of the firewalls that use that group.
				if (ipobj != -1) {
					sql='UPDATE '+tableModel+' F'+
					' INNER JOIN policy_r PR ON PR.firewall=F.id'+
					' INNER JOIN policy_r__ipobj PRI ON PRI.rule=PR.id'+
					' INNER JOIN ipobj__ipobjg IG ON IG.ipobj_g=PRI.ipobj_g'+
					' SET F.status=F.status'+status_action+
					' WHERE F.fwcloud='+connection.escape(fwcloud)+' AND IG.ipobj='+connection.escape(ipobj);					
					connection.query(sql, (error, result) => {
						if (error) return reject(error);

						if (type===5 || type==="5") { // ADDRESS
							// We must see if the ADDRESS is part of a network interface and then update the status of the firewalls that use that network interface.
							sql='UPDATE '+tableModel+' F'+
							' INNER JOIN policy_r PR ON PR.firewall=F.id'+
							' INNER JOIN policy_r__ipobj PRI ON PRI.rule=PR.id'+
							' INNER JOIN ipobj IPO ON IPO.interface=PRI.interface'+
							' SET F.status=F.status'+status_action+
							' WHERE F.fwcloud='+connection.escape(fwcloud)+' AND IPO.id='+connection.escape(ipobj);	
							connection.query(sql, (error, result) => {				
								if (error) return reject(error);

								// We must see too if the ADDRESS is part of a network interface that belogns to a host
								// and then update the status of the firewalls that use that host in any of its positions.
								sql='UPDATE '+tableModel+' F'+
								' INNER JOIN policy_r PR ON PR.firewall=F.id'+
								' INNER JOIN policy_r__ipobj PRI ON PRI.rule=PR.id'+
								' INNER JOIN interface__ipobj IO ON IO.ipobj=PRI.ipobj'+
								' INNER JOIN ipobj IPO ON IPO.interface=IO.interface'+
								' SET F.status=F.status'+status_action+
								' WHERE F.fwcloud='+connection.escape(fwcloud)+' AND IPO.id='+connection.escape(ipobj);	
								connection.query(sql, (error, result) => {				
									if (error) return reject(error);
									resolve({"result": true});
								});
							});
						} else
							resolve({"result": true});
					});
				} else
					resolve({"result": true});
			});
		});
	});
};

firewallModel.cloneFirewall = function (iduser, firewallData) {
	return new Promise((resolve, reject) => {
		db.get(function (error, connection) {
			if (error) return reject(error);
			var sqlExists = `SELECT T.id FROM ${tableModel} T 
				INNER JOIN user__fwcloud U ON T.fwcloud=U.fwcloud AND U.user=${iduser}
				WHERE T.id=${firewallData.id}`;
			connection.query(sqlExists, function (error, row) {
				//NEW FIREWALL
				if (row && row.length > 0) {
					var sql = 'insert into firewall(cluster,fwcloud,name,comment,by_user,status,fwmaster,install_port,options) ' +
					' select cluster,fwcloud,' + connection.escape(firewallData.name) + ',' + connection.escape(firewallData.comment) + ',' + connection.escape(iduser) + ' , 3, fwmaster, install_port, options ' +
					' from firewall where id= ' + firewallData.id + ' and fwcloud=' + firewallData.fwcloud;
					connection.query(sql, function (error, result) {
						if (error) return reject(error);
						resolve({"result": true, "insertId": result.insertId});                                    
					});
				} else reject(fwcError.NOT_FOUND);
			});
		});
	});
};

firewallModel.updateFWMaster = function (iduser, fwcloud, cluster, idfirewall, fwmaster) {
	return new Promise((resolve, reject) => {
		db.get(function (error, connection) {
			if (error) return reject(error);
			var sqlExists = `SELECT T.id FROM ${tableModel} T 
				INNER JOIN user__fwcloud U ON T.fwcloud=U.fwcloud AND U.user=${iduser}
				WHERE T.id=${idfirewall}`;
			connection.query(sqlExists, (error, row) => {
				if (error) return reject(error);
				if (row && row.length > 0) {
					var sql = 'UPDATE ' + tableModel + ' SET ' +
						'fwmaster = ' + fwmaster + ', ' +
						'by_user = ' + connection.escape(iduser) +
						' WHERE id = ' + idfirewall + ' AND fwcloud=' + fwcloud + ' AND cluster=' + cluster;
					connection.query(sql, function (error, result) {
						if (error) return reject(error);
						if (fwmaster == 1) {
							var sql = 'UPDATE ' + tableModel + ' SET ' +
								'fwmaster = 0, ' +
								'by_user = ' + connection.escape(iduser) +
								' WHERE id <> ' + idfirewall + ' AND fwcloud=' + fwcloud + ' AND cluster=' + cluster;
							connection.query(sql, function (error, result) {
								if (error) return reject(error);
								resolve({"result": true});
							});
						} else resolve({"result": true});
					});
				} else reject(fwcError.NOT_FOUND);
			});
		});
	});
};

firewallModel.updateFirewallCluster = function (firewallData) {
	return new Promise((resolve, reject) => {
		db.get(function (error, connection) {
			if (error) return reject(error);
			var sqlExists = `SELECT T.id FROM ${tableModel} T 
				INNER JOIN user__fwcloud U ON T.fwcloud=U.fwcloud	AND U.user=${firewallData.by_user}
				WHERE T.id=${firewallData.id}`;
			connection.query(sqlExists, (error, row) => {
				if (error) return reject(error);
				if (row && row.length > 0) {
					var sql = 'UPDATE ' + tableModel + ' SET cluster = ' + connection.escape(firewallData.cluster) + ',' +
							'by_user = ' + connection.escape(firewallData.by_user) + ' ' +
							' WHERE id = ' + firewallData.id;
					connection.query(sql, (error, result) => {
						if (error) return reject(error);
						resolve({"result": true});
					});
				} else 
					resolve({"result": false});
			});
		});
	});
};

firewallModel.removeFirewallClusterSlaves = function (cluster, fwcloud, callback) {

	db.get(function (error, connection) {
		if (error)
			callback(error, null);

		var sql = 'DELETE FROM ' + tableModel +
				' WHERE cluster = ' + connection.escape(cluster) + ' AND fwcloud=' + connection.escape(fwcloud) + ' AND fwmaster=0';
		connection.query(sql, function (error, result) {
			if (error) {
				callback(error, null);
			} else {
				callback(null, {"result": true});
			}
		});
	});
};
/**
 * UPDATE Firewall lock status
 *  
 * @method updateFirewallLock
 * 
 * @param iduser {Integer}  User identifier
 * @param firewallData {Firewall Object}  Firewall Object data
 *       @param firewallData.id {NULL} 
 *       @param firewallData.fwcloud {Integer} FWcloud ID
 *       @param firewallData.locked {Integer} Locked status
 * @param {Function} callback    Function callback response
 * 
 *       callback(error, Rows)
 * 
 * @return {CALLBACK RESPONSE}
 * 
 * @example
 * #### RESPONSE OK:
 *    
 *       callback(null, {"result": true});
 *       
 * #### RESPONSE ERROR:
 *    
 *       callback(error, null);
 *       
 */
firewallModel.updateFirewallLock = function (firewallData, callback) {

	var locked = 1;
	db.get(function (error, connection) {
		if (error)
			callback(error, null);
		var sqlExists = `SELECT T.id FROM ${tableModel} T 
			INNER JOIN user__fwcloud U ON T.fwcloud=U.fwcloud AND U.user=${firewallData.iduser}
			WHERE T.id=${firewallData.id}	AND (locked=0 OR (locked=1 AND locked_by=${firewallData.iduser}))`;
		connection.query(sqlExists, function (error, row) {

			if (row && row.length > 0) {
				var sql = 'UPDATE ' + tableModel + ' SET locked = ' + connection.escape(locked) + ',' +
						'locked_at = CURRENT_TIMESTAMP ,' +
						'locked_by = ' + connection.escape(firewallData.iduser) + ' ' +
						' WHERE id = ' + firewallData.id;
				connection.query(sql, function (error, result) {
					if (error) {
						callback(error, null);
					} else {
						callback(null, {"result": true});
					}
				});
			} else {
				callback(null, {"result": false});
			}
		});
	});
};
/**
 * UNLOCK Firewall status
 *  
 * @method updateFirewallUnlock
 * 
 * @param iduser {Integer}  User identifier
 * @param firewallData {Firewall Object}  Firewall Object data
 *       @param firewallData.id {NULL} 
 *       @param firewallData.fwcloud {Integer} FWcloud ID
 *       @param firewallData.locked {Integer} Locked status
 * @param {Function} callback    Function callback response
 * 
 *       callback(error, Rows)
 * 
 * @return {CALLBACK RESPONSE}
 * 
 * @example
 * #### RESPONSE OK:
 *    
 *       callback(null, {"result": true});
 *       
 * #### RESPONSE ERROR:
 *    
 *       callback(error, null);
 *       
 */
firewallModel.updateFirewallUnlock = function (firewallData, callback) {

	var locked = 0;
	db.get(function (error, connection) {
		if (error)
			callback(error, null);
		var sqlExists = `SELECT T.id FROM ${tableModel} T 
			INNER JOIN user__fwcloud U ON T.fwcloud=U.fwcloud AND U.user=${firewallData.iduser}
			WHERE T.id=${firewallData.id} AND (locked=1 AND locked_by=${firewallData.iduser})`;
		connection.query(sqlExists, function (error, row) {

			if (row && row.length > 0) {
				var sql = 'UPDATE ' + tableModel + ' SET locked = ' + connection.escape(locked) + ',' +
						'locked_at = CURRENT_TIMESTAMP ,' +
						'locked_by = ' + connection.escape(firewallData.iduser) + ' ' +
						' WHERE id = ' + firewallData.id;
				connection.query(sql, function (error, result) {
					if (error) {
						callback(error, null);
					} else {
						callback(null, {"result": true});
					}
				});
			} else {
				callback(null, {"result": false});
			}
		});
	});
};


/**
 * DELETE Firewall
 *  
 * @method deleteFirewall
 * 
 * @param user {Integer}  User identifier
 * @param id {Integer}  Firewall identifier
 * @param {Function} callback    Function callback response
 * 
 *       callback(error, Rows)
 * 
 * @return {CALLBACK RESPONSE}
 * 
 * @example
 * #### RESPONSE OK:
 *    
 *       callback(null, {"result": true, "msg": "deleted"});
 *       
 * #### RESPONSE ERROR:
 *    
 *       callback(null, {"result": false});
 *       
 */
firewallModel.deleteFirewall = (user, fwcloud, firewall) => {
	return new Promise((resolve, reject) => {
		db.get((error, dbCon) => {
			if (error) return reject(error);

			var sql = 'select id from fwc_tree where node_type="FW" and id_obj='+firewall+' and fwcloud='+fwcloud;
			dbCon.query(sql, async (error, row) => {
				if (error) return reject(error);

				//If exists Id from firewall to remove
				if (row && row.length > 0) {
					try {
						await Policy_rModel.deletePolicy_r_Firewall(firewall); //DELETE POLICY, Objects in Positions and firewall rule groups.
						await openvpnPrefixModel.deletePrefixAll(dbCon,fwcloud,firewall); // Remove all firewall openvpn prefixes.
						await openvpnModel.delCfgAll(dbCon,fwcloud,firewall); // Remove all OpenVPN configurations for this firewall.
						await interfaceModel.deleteInterfacesIpobjFirewall(firewall); // DELETE IPOBJS UNDER INTERFACES
						await interfaceModel.deleteInterfaceFirewall(firewall); //DELETE INTEFACES
						await fwcTreemodel.deleteFwc_TreeFullNode({id: row[0].id, fwcloud: fwcloud, iduser: user}); //DELETE TREE NODES From firewall
						await utilsModel.deleteFolder(config.get('policy').data_dir+'/'+fwcloud+'/'+firewall); // DELETE DATA DIRECTORY FOR THIS FIREWALL

						//DELETE FIREWALL from the database.
						dbCon.query(`DELETE FROM ${tableModel} WHERE id=${firewall}`, (error, result) => {
							if (error) return reject(error);
							resolve();
						});
					} catch(error) { return reject(error) }
				} else reject(fwcError.NOT_FOUND);
			});
		});
	});
}

firewallModel.deleteFirewallFromCluster = (iduser, fwcloud, idfirewall, cluster) => {
	return new Promise((resolve, reject) => {
		db.get(function (error, connection) {
			if (error) return reject(error);

			var sqlExists = `SELECT T.*, A.id as idnode FROM ${tableModel} T 
				INNER JOIN user__fwcloud U ON T.fwcloud=U.fwcloud AND U.user=${iduser}
				INNER JOIN fwc_tree A ON A.id_obj=T.id AND A.node_type="FW"
				WHERE T.id=${idfirewall} AND T.cluster=${cluster}`;
			connection.query(sqlExists, (error, row) => {
				if (error) return reject(error);

				//If exists Id from firewall to remove
				if (row && row.length > 0) {
					var rowF = row[0];
					var idNodeFirewall = rowF.idnode;

					//FIREWAL MASTER
					if (rowF.fwmaster === 1) {
						logger.debug("DELETING FWMASTER: " + idfirewall);

						//TRASPASO de DATOS a PRIMER FIREWALL SLAVE
						var sql = 'SELECT T.id FROM ' + tableModel + ' T ' +
							' WHERE fwmaster=0 AND  T.cluster=' + connection.escape(cluster) +
							' ORDER by T.id limit 1';
						logger.debug("SELECT NEXT FIREWALL SLAVE: ", sql);
						connection.query(sql, async (error, rowS) => {
							if (rowS && rowS.length > 0) {
								var idNewFM = rowS[0].id;

								// Rename data directory with the new firewall master id.
								try {
									await utilsModel.renameFirewallDataDir(fwcloud,idfirewall,idNewFM);
								} catch(error) { return reject(error) }

								//UPDATE POLICY_R
								sql = "UPDATE policy_r SET firewall=" + connection.escape(idNewFM) + " WHERE firewall=" + connection.escape(idfirewall);
								connection.query(sql, (error, result) => {
									if (error) return resolve({"result": false, "msg": "Error UPDATE POLICY"});

									//UPDATE POLICY_G
									sql = "UPDATE policy_g SET firewall=" + connection.escape(idNewFM) + " WHERE firewall=" + connection.escape(idfirewall);
									connection.query(sql, (error, result) => {
										if (error) return resolve({"result": false, "msg": "Error UPDATE POLICY GROUPS"});

										//UPDATE INTERFACES
										sql = "UPDATE interface SET firewall=" + connection.escape(idNewFM) + " WHERE firewall=" + connection.escape(idfirewall);
										connection.query(sql, (error, result) => {
											if (error) return resolve({"result": false, "msg": "Error UPDATE INTERFACES"});
											
											//UPDATE NEW FWMASTER
											sql = "UPDATE firewall SET fwmaster=1 WHERE id=" + connection.escape(idNewFM);
											connection.query(sql, function (error, result) {
												if (error) return resolve({"result": false, "msg": "Error UPDATE NEW FWMASTER"});

												//UPDATE TREE RECURSIVE FROM IDNODE CLUSTER
												//GET NODE FROM CLUSTER
												sql = "SELECT " + connection.escape(idfirewall) + " as OLDFW, " + connection.escape(idNewFM) + " as NEWFW, T.* FROM fwc_tree T WHERE node_type='CL' AND  id_obj =" + connection.escape(cluster) + ' AND fwcloud=' + connection.escape(fwcloud);
												logger.debug("FIRST SQL: ", sql);
												connection.query(sql, function (error, rowT) {
													if (rowT && rowT.length > 0) {
														var iNodeCluster = rowT[0].id;
														fwcTreemodel.updateIDOBJFwc_TreeFullNode(rowT[0])
														.then(resp3 => {
															//DELETE TREE NODES From firewall
															var dataNode = {id: idNodeFirewall, fwcloud: fwcloud, iduser: iduser};
															logger.debug("----> DELETING TREE FOR NODE:", dataNode);
															fwcTreemodel.deleteFwc_TreeFullNode(dataNode)
																	.then(resp4 => {
																		//DELETE FIREWALL
																		var sql = 'DELETE FROM ' + tableModel + ' WHERE id = ' + connection.escape(idfirewall);
																		connection.query(sql, function (error, result) {
																			if (error) {
																				resolve({"result": false, "msg": "Error DELETE FIREWALL: " + error});
																			} else {

																				resolve({"result": true, "msg": "deleted"});
																			}

																		});
																	})
																	.catch(e => {
																		resolve({"result": false, "msg": "Error DELETE TREE NODES: " + e});
																	});
														})
														.catch(e => {
															resolve({"result": false, "msg": "Error DELETE USERS: " + e});
														});
													} else {
														resolve({"result": false, "msg": "NOT FOUND NODE CLUSTER"});
													}

												});
											});
										});

									});
								});

							//TRAPASO de NODOS
							} else {
								//NO HAY FIREWALL SLAVES
								resolve({"result": false, "msg": "Not Exist SLAVE"});
							}
						});

					} else {
						logger.debug("DELETING FW SLAVE: " + idfirewall);
						//DELETE TREE NODES From firewall
						var dataNode = {id: idNodeFirewall, fwcloud: fwcloud, iduser: iduser};
						logger.debug("----> DELETING TREE FOR NODE:", dataNode);
						fwcTreemodel.deleteFwc_TreeFullNode(dataNode)
						.then(resp4 => {
							//DELETE FIREWALL
							var sql = 'DELETE FROM ' + tableModel + ' WHERE id=' + connection.escape(idfirewall);
							connection.query(sql, function (error, result) {
								if (error) {
									resolve({"result": false, "msg": "Error DELETE FIREWALL: " + error});
								} else {

									resolve({"result": true, "msg": "deleted"});
								}

							});
						})
						.catch(e => {
							resolve({"result": false, "msg": "Error DELETE TREE NODES: " + e});
						});
					}
				}
			});///
		});
	});
};

firewallModel.checkBodyFirewall = function (body, isNew) {
	try {
		return new Promise((resolve, reject) => {
			var param = "";
			if (!isNew) {
				param = body.id;
				if (param === undefined || param === '' || isNaN(param) || param == null) {
					reject("Firewall ID not valid");
				}
			}
			param = body.cluster;
			if (param === undefined || param === '' || isNaN(param) || param == null) {
				body.cluster = null;
			}

			param = body.name;
			if (param === undefined || param === '' || param == null) {
				reject("Firewall name not valid");
			}


			param = body.save_user_pass;
			if (param === undefined || param === '' || param == null || param == 0) {
				body.save_user_pass = false;
			} else
				body.save_user_pass = true;
			param = body.install_user;
			if (param === undefined || param === '' || param == null) {
				body.install_user = '';
			}
			param = body.install_pass;
			if (param === undefined || param === '' || param == null) {
				body.install_pass = '';
			}
			param = body.install_interface;
			if (param === undefined || param === '' || isNaN(param) || param == null) {
				body.install_interface = null;
			}
			param = body.install_ipobj;
			if (param === undefined || param === '' || isNaN(param) || param == null) {
				body.install_ipobj = null;
			}
			param = body.install_port;
			if (param === undefined || param === '' || isNaN(param) || param == null) {
				body.install_port = 22;
			}
			param = body.fwmaster;
			if (param === undefined || param === '' || isNaN(param) || param == null) {
				body.fwmaster = 0;
			}
			resolve(body);
		});
	} catch (e) {
		reject("Carch Error: ", e);
	}
};


firewallModel.getFirewallOptions = function (fwcloud, fw) {
	return new Promise((resolve, reject) => {
		db.get(function (error, connection) {
			if (error) return reject(error);

			let sql = 'SELECT options FROM ' + tableModel +
			' WHERE fwcloud=' + connection.escape(fwcloud) + ' AND id=' + connection.escape(fw);
			connection.query(sql, (error, rows) => {
				if (error) return reject(error);
				if (rows.length !== 1) return reject(new Error('Firewall not found'));
				resolve(rows[0].options);
			});
		});
	});
}

firewallModel.getMasterFirewallId = (fwcloud, cluster) => {
	return new Promise((resolve, reject) => {
		db.get((error, connection) => {
			if (error) return reject(error);

			let sql = 'SELECT id FROM ' + tableModel +
			' WHERE fwcloud=' + connection.escape(fwcloud) + ' AND cluster=' + connection.escape(cluster) + ' AND fwmaster=1';
			connection.query(sql, (error, rows) => {
				if (error) return reject(error);
				if (rows.length !== 1) return reject(new Error('Firewall not found'));
				resolve(rows[0].id);
			});
		});
	});
}

firewallModel.searchFirewallRestrictions = req => {
	return new Promise(async (resolve, reject) => {
		try {
			let search = {};
			search.result = false;
			search.restrictions = {};

			if (req.body.cluster)
				req.body.firewall = await firewallModel.getMasterFirewallId(req.body.fwcloud, req.body.cluster);

      /* Verify that the nex firewall/cluster objets are not been used in any rule of other firewall:
          - Interfaces and address of interface.
          - OpenVPN configuration.
					- OpenVPN prefix configuration.
					
				Verify too that these objects are not being used in any group.
      */
			const r1 = await interfaceModel.searchInterfaceUsageOutOfThisFirewall(req);
			const r2 = await openvpnModel.searchOpenvpnUsageOutOfThisFirewall(req);
			const r3 = await openvpnPrefixModel.searchPrefixUsageOutOfThisFirewall(req);

			if (r1) search.restrictions = utilsModel.mergeObj(search.restrictions, r1.restrictions);
			if (r2) search.restrictions = utilsModel.mergeObj(search.restrictions, r2.restrictions);
			if (r3) search.restrictions = utilsModel.mergeObj(search.restrictions, r3.restrictions);

			for (let key in search.restrictions) {
				if (search.restrictions[key].length > 0) {
					search.result = true;
					break;
				}
			}
			resolve(search);
		} catch(error) { reject(error) }
	});
};

