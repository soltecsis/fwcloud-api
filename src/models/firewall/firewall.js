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


import db from '../../database/DatabaseService'

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
var policy_rModel = require('../../models/policy/policy_r');
var policy_gModel = require('../../models/policy/policy_g');
var fwcTreemodel = require('../tree/tree');
const config = require('../../config/config');
var firewall_Data = require('../../models/data/data_firewall');
const fwcError = require('../../utils/error_table');

/**
 * Get Firewall by User and ID
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
firewallModel.getFirewall = req => {
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
			if (rows.length!==1) return reject(fwcError.NOT_FOUND);

			Promise.all(rows.map(utilsModel.decryptDataUserPass))
			.then(data => resolve(data[0]))
			.catch(error => reject(error));
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
firewallModel.getFirewallCloud = req => {
	return new Promise((resolve, reject) => {
		var sql = `SELECT T.*, I.name as interface_name, O.name as ip_name, O.address as ip
			FROM ${tableModel} T INNER JOIN user__fwcloud U ON T.fwcloud=U.fwcloud AND U.user=${req.session.user_id}
			LEFT join interface I on I.id=T.install_interface
			LEFT join ipobj O on O.id=T.install_ipobj and O.interface=I.id
			WHERE T.fwcloud=${req.body.fwcloud}`;

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
				host: data.ip,
				port: data.install_port,
				username: data.install_user,
				password: data.install_pass
			}

			// If we have ssh user and pass in the body of the request, then these data have preference over the data stored in database.
			if (req.body.sshuser && req.body.sshpass) {
				SSHconn.username = req.body.sshuser;
				SSHconn.password = req.body.sshpass;
			}  

			// If we have no user or password for the ssh connection, then error.
			if (!SSHconn.username || !SSHconn.password)
				throw(fwcError.other('User or password for the SSH connection not found'));

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
firewallModel.insertFirewall = firewallData => {
	return new Promise((resolve, reject) => {
		db.get(function (error, connection) {
			if (error) return reject(error);
			
			connection.query(`INSERT INTO ${tableModel} SET ?`, firewallData, (error, result) => {
				if (error) return reject(error);
				resolve(result.insertId);
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
firewallModel.updateFirewall = (dbCon, iduser, firewallData) => {
	return new Promise((resolve, reject) => {
		var sqlExists = `SELECT T.id FROM ${tableModel} T 
			INNER JOIN user__fwcloud U ON T.fwcloud=U.fwcloud AND U.user=${iduser}
			WHERE T.id=${firewallData.id}`;
		dbCon.query(sqlExists, (error, row) => {
			if (error) return reject(error);

			if (row && row.length > 0) {
				var sql = `UPDATE ${tableModel} SET name=${dbCon.escape(firewallData.name)},
					comment=${dbCon.escape(firewallData.comment)},
					install_user=${dbCon.escape(firewallData.install_user)},
					install_pass=${dbCon.escape(firewallData.install_pass)},
					save_user_pass=${firewallData.save_user_pass},
					install_interface=${firewallData.install_interface},
					install_ipobj=${firewallData.install_ipobj},
					install_port=${firewallData.install_port},
					by_user=${iduser},
					options=${firewallData.options}
					WHERE id=${firewallData.id}`;
				dbCon.query(sql, function (error, result) {
					if (error) return reject(error);
					resolve(true);
				});
			} else resolve(false);
		});
	});
};


// Get the ID of all firewalls who's status field is not zero.
firewallModel.getFirewallStatusNotZero = (fwcloud, data) => {
	return new Promise((resolve, reject) => {
		db.get((error, connection) => {
			if (error) return reject(error);

			var sql = `SELECT id,cluster,status FROM ${tableModel} WHERE status!=0 AND fwcloud=${fwcloud}`;
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


firewallModel.updateFirewallStatus = (fwcloud, firewall, status_action) => {
	return new Promise((resolve, reject) => {
		db.get((error, connection) => {
			if (error) return reject(error);
			let sql=`UPDATE ${tableModel} SET status=status${status_action} WHERE id=${firewall} AND fwcloud=${fwcloud}`;
			connection.query(sql, (error, result) => {
				if (error) return reject(error);
				resolve({"result": true});
			});
		});
	});
};

firewallModel.updateFirewallCompileDate = (fwcloud, firewall) => {
	return new Promise((resolve, reject) => {
		db.get((error, connection) => {
			if (error) return reject(error);
			let sql=`UPDATE ${tableModel} SET compiled_at=NOW() WHERE id=${firewall} AND fwcloud=${fwcloud}`;
			connection.query(sql, (error, result) => {
				if (error) return reject(error);
				resolve();
			});
		});
	});
};

firewallModel.updateFirewallInstallDate = (fwcloud, firewall) => {
	return new Promise((resolve, reject) => {
		db.get((error, connection) => {
			if (error) return reject(error);
			let sql=`UPDATE ${tableModel} SET installed_at=NOW() WHERE id=${firewall} AND fwcloud=${fwcloud}`;
			connection.query(sql, (error, result) => {
				if (error) return reject(error);
				resolve();
			});
		});
	});
};

firewallModel.promoteToMaster = (dbCon,firewall) => {
	return new Promise((resolve, reject) => {
		dbCon.query(`UPDATE ${tableModel} SET fwmaster=1 WHERE id=${firewall}`, (error, result) => {
			if (error) return reject(error);
			resolve();
		});
	});
};

firewallModel.updateFirewallStatusIPOBJ = (fwcloud, ipobj, ipobj_g, interface, type, status_action) => {
	return new Promise((resolve, reject) => {
		db.get((error, connection) => {
			if (error) return reject(error);
			var sql=`UPDATE ${tableModel} F
				INNER JOIN policy_r PR ON PR.firewall=F.id
				INNER JOIN ${(interface!=-1) ? `policy_r__interface` : `policy_r__ipobj`} PRI ON PRI.rule=PR.id
				SET F.status=F.status${status_action}
				WHERE F.fwcloud=${fwcloud} 
				${(ipobj!=-1 || ipobj_g!=-1) ? `AND PRI.ipobj=${ipobj} AND PRI.ipobj_g=${ipobj_g}` : ``} AND PRI.interface=${interface}`;
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
						resolve({"insertId": result.insertId});                                    
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
						await policy_rModel.deletePolicy_r_Firewall(firewall); //DELETE POLICY, Objects in Positions and firewall rule groups.
						await openvpnPrefixModel.deletePrefixAll(dbCon,fwcloud,firewall); // Remove all firewall openvpn prefixes.
						await openvpnModel.delCfgAll(dbCon,fwcloud,firewall); // Remove all OpenVPN configurations for this firewall.
						await interfaceModel.deleteInterfacesIpobjFirewall(firewall); // DELETE IPOBJS UNDER INTERFACES
						await interfaceModel.deleteInterfaceFirewall(firewall); //DELETE INTEFACES
						await fwcTreemodel.deleteFwc_TreeFullNode({id: row[0].id, fwcloud: fwcloud, iduser: user}); //DELETE TREE NODES From firewall
						await utilsModel.deleteFolder(config.get('policy').data_dir+'/'+fwcloud+'/'+firewall); // DELETE DATA DIRECTORY FOR THIS FIREWALL
						await firewallModel.deleteFirewallRow(dbCon,fwcloud,firewall);
						resolve();
					} catch(error) { return reject(error) }
				} else reject(fwcError.NOT_FOUND);
			});
		});
	});
}


firewallModel.deleteFirewallRow = (dbCon, fwcloud, firewall) => {
	return new Promise((resolve, reject) => {
		dbCon.query(`DELETE FROM ${tableModel} WHERE id=${firewall} AND fwcloud=${fwcloud}`, (error, result) => {
			if (error) return reject(error);
			resolve();
		});
	});
}


firewallModel.deleteFirewallFromCluster = req => {
	return new Promise((resolve, reject) => {
		var sqlExists = `SELECT T.*, A.id as idnode FROM ${tableModel} T 
			INNER JOIN user__fwcloud U ON T.fwcloud=U.fwcloud AND U.user=${req.session.user_id}
			INNER JOIN fwc_tree A ON A.id_obj=T.id AND A.node_type="FW"
			WHERE T.id=${req.body.firewall} AND T.cluster=${req.body.cluster}`;
		req.dbCon.query(sqlExists, async (error, row) => {
			if (error) return reject(error);
			if (row.length===0) return reject(fwcError.NOT_FOUND);

			var rowF = row[0];
			var idNodeFirewall = rowF.idnode;

			// Deleting FIREWAL MASTER
			if (rowF.fwmaster === 1) {
				// Transfer data to the new slave firewall.
				var sql = `SELECT T.id FROM ${tableModel} T
					WHERE fwmaster=0 AND  T.cluster=${req.body.cluster}	ORDER by T.id limit 1`;
				req.dbCon.query(sql, async (error, rowS) => {
					if (error) return reject(error);
					if (rowS.length===0) return reject(fwcError.NOT_FOUND);

					var idNewFM = rowS[0].id;
					try {
						// Rename data directory with the new firewall master id.
						await utilsModel.renameFirewallDataDir(req.body.fwcloud,req.body.firewall,idNewFM);

						// Move all related objects to the new firewall.
						await policy_rModel.moveToOtherFirewall(req.dbCon,req.body.firewall,idNewFM);
						await policy_gModel.moveToOtherFirewall(req.dbCon,req.body.firewall,idNewFM);
						await interfaceModel.moveToOtherFirewall(req.dbCon,req.body.firewall,idNewFM);
						await openvpnModel.moveToOtherFirewall(req.dbCon,req.body.firewall,idNewFM);

						// Promote the new master.
						await firewallModel.promoteToMaster(req.dbCon,idNewFM);

						// Delete the old firewall node.
						await firewallModel.deleteFirewallRow(req.dbCon,req.body.fwcloud,req.body.firewall);
					} catch(error) { return reject(error) }

					//UPDATE TREE RECURSIVE FROM IDNODE CLUSTER
					//GET NODE FROM CLUSTER
					sql = `SELECT ${req.body.firewall} as OLDFW, ${idNewFM} as NEWFW, T.* FROM fwc_tree T 
						WHERE node_type='CL' AND id_obj=${req.body.cluster} AND fwcloud=${req.body.fwcloud}`;
					req.dbCon.query(sql, async (error, rowT) => {
						if (error) return reject(error);

						if (rowT && rowT.length > 0) {
							try {
								await fwcTreemodel.updateIDOBJFwc_TreeFullNode(rowT[0]);

								//DELETE TREE NODES From firewall
								var dataNode = {id: idNodeFirewall, fwcloud: req.body.fwcloud, iduser: req.session.user_id};
								await fwcTreemodel.deleteFwc_TreeFullNode(dataNode);
							} catch(error) { return reject(error) }
						}
						resolve();
					});
				});
			} else { // Deleting FIREWALL SLAVE
				try {
					//DELETE TREE NODES From firewall
					await fwcTreemodel.deleteFwc_TreeFullNode({id: idNodeFirewall, fwcloud: req.body.fwcloud, iduser: req.session.user_id});
					await firewallModel.deleteFirewallRow(req.dbCon, req.body.fwcloud, req.body.firewall);
					resolve();
				} catch(error) { reject(error) }
			}
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
				if (rows.length !== 1) return reject(fwcError.NOT_FOUND);
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
				if (rows.length !== 1) return reject(fwcError.NOT_FOUND);
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

			let orgFirewallId = req.body.firewall;
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
			if (req.body.cluster) req.body.firewall = orgFirewallId;
			resolve(search);
		} catch(error) { reject(error) }
	});
};

