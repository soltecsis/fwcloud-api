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
var FwcloudModel = require('../../models/fwcloud/fwcloud');
var utilsModel = require("../../utils/utils.js");
var InterfaceModel = require('../../models/interface/interface');
var User__firewallModel = require('../../models/user/user__firewall');
var Policy_rModel = require('../../models/policy/policy_r');
var fwcTreemodel = require('../../models/tree/fwc_tree');

var firewall_Data = require('../../models/data/data_firewall');

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
 *           id_fwb	varchar(45)
 */
firewallModel.getFirewalls = function (iduser, callback) {

	db.get(function (error, connection) {
		if (error)
			callback(error, null);
		var sql = 'SELECT T.* ' +
				' , I.name as interface_name, O.name as ip_name, O.address as ip ' +
				' FROM ' + tableModel +
				' T INNER JOIN user__firewall U ON T.id=U.id_firewall AND U.id_user=' + connection.escape(iduser) + ' AND U.allow_access=1 ' +
				' LEFT join interface I on I.id=T.install_interface ' +
				' LEFT join ipobj O on O.id=T.install_ipobj and O.interface=I.id ' +
				' ORDER BY T.id';
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
 *           id_fwb	varchar(45)
 */
firewallModel.getFirewall = function (iduser, fwcloud, id, callback) {
	db.get(function (error, connection) {
		if (error)
			callback(error, null);
		var sql = 'SELECT T.* ' +
				' , I.name as interface_name, O.name as ip_name, O.address as ip ' +
				' , M.id as id_fwmaster ' +
				' FROM ' + tableModel + ' T INNER JOIN user__firewall U ON T.id=U.id_firewall AND U.id_user=' + connection.escape(iduser) +
				' LEFT join interface I on I.id=T.install_interface ' +
				' LEFT join ipobj O on O.id=T.install_ipobj and O.interface=I.id ' +
				' LEFT JOIN firewall M on M.cluster=T.cluster and M.fwmaster=1 ' +
				' WHERE T.id = ' + connection.escape(id) + ' AND T.fwcloud=' + connection.escape(fwcloud) + '  AND U.allow_access=1';
		//logger.debug(sql);
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
firewallModel.getFirewallAccess = function (accessData) {
	return new Promise((resolve, reject) => {
		db.get(function (error, connection) {
			if (error)
				reject(false);
			//CHECK FIREWALL PERIMSSIONS
			var sql = 'SELECT T.* FROM ' + tableModel + ' T ' +
					' INNER JOIN user__firewall U ON T.id=U.id_firewall AND U.id_user=' + connection.escape(accessData.iduser) +
					' WHERE T.id = ' + connection.escape(accessData.idfirewall) +
					' AND T.fwcloud=' + connection.escape(accessData.fwcloud) + '  AND U.allow_access=1 AND U.allow_edit=1 ';
			connection.query(sql, function (error, row) {
				if (error)
					reject(false);
				else if (row && row.length > 0) {
					resolve(true);
				} else {
					reject(false);
				}
			});
		});
	});
};
/**
 * Get Firewalls by User and Name
 *  
 * @method getFirewallName
 * 
 * @param {Integer} iduser User identifier
 * @param {String} Name Firewall Name
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
 *           id_fwb	varchar(45)
 */
firewallModel.getFirewallName = function (iduser, name, callback) {
	db.get(function (error, connection) {
		if (error)
			callback(error, null);
		var namesql = '%' + name + '%';
		var sql = 'SELECT T.* ' +
				' , I.name as interface_name, O.name as ip_name, O.address as ip ' +
				' FROM ' + tableModel + ' T INNER JOIN user__firewall U ON T.id=U.id_firewall AND U.id_user=' + connection.escape(iduser) +
				' LEFT join interface I on I.id=T.install_interface ' +
				' LEFT join ipobj O on O.id=T.install_ipobj and O.interface=I.id ' +
				' WHERE name like  ' + connection.escape(namesql) + ' AND U.allow_access=1 ';
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
 *           id_fwb	varchar(45)
 */
firewallModel.getFirewallCluster = function (iduser, idcluster, callback) {
	db.get(function (error, connection) {
		if (error)
			callback(error, null);
		var sql = 'SELECT T.* ' +
				' , I.name as interface_name, O.name as ip_name, O.address as ip ' +
				' FROM ' + tableModel + ' T INNER JOIN user__firewall U ON T.id=U.id_firewall AND U.id_user=' + connection.escape(iduser) +
				' LEFT join interface I on I.id=T.install_interface ' +
				' LEFT join ipobj O on O.id=T.install_ipobj and O.interface=I.id ' +
				' WHERE cluster =  ' + connection.escape(idcluster) + '  AND U.allow_access=1 ' +
				' ORDER BY T.fwmaster desc, T.id';
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
        var sql = 'SELECT T.* ' +
                ' , I.name as interface_name, O.name as ip_name, O.address as ip ' +
                ' FROM ' + tableModel + ' T INNER JOIN user__firewall U ON T.id=U.id_firewall AND U.id_user=' + connection.escape(iduser) +
                ' LEFT join interface I on I.id=T.install_interface ' +
                ' LEFT join ipobj O on O.id=T.install_ipobj and O.interface=I.id ' +
                ' WHERE cluster =  ' + connection.escape(idcluster) + '  AND U.allow_access=1 AND fwmaster=1';
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
 *           id_fwb	varchar(45)
 */
firewallModel.getFirewallCloud = function (iduser, fwcloud, callback) {
	db.get(function (error, connection) {
		if (error)
			callback(error, null);
		var sql = 'SELECT T.* ' +
				' , I.name as interface_name, O.name as ip_name, O.address as ip ' +
				' FROM ' + tableModel + ' T INNER JOIN user__firewall U ON T.id=U.id_firewall AND U.id_user=' + connection.escape(iduser) +
				' LEFT join interface I on I.id=T.install_interface ' +
				' LEFT join ipobj O on O.id=T.install_ipobj and O.interface=I.id ' +
				' WHERE T.fwcloud =  ' + connection.escape(fwcloud) + '  AND U.allow_access=1 ';
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
firewallModel.insertFirewall = function (iduser, firewallData) {
	return new Promise((resolve, reject) => {
		db.get(function (error, connection) {
			if (error)
				reject(error);
			connection.query('INSERT INTO ' + tableModel + ' SET ?', firewallData, function (error, result) {
				if (error) {
					logger.debug("SQL ERROR INSERT: ", error);
					logger.debug("SQL ERROR Data: ", firewallData);
					reject(error);
				} else {
					var fwid = result.insertId;
					connection.query('INSERT INTO  user__firewall  SET id_firewall=' + connection.escape(fwid) + ' , id_user=' + connection.escape(iduser) + ' , allow_access=1, allow_edit=1', function (error, result) {
						if (error) {
							logger.debug("SQL ERROR USER INSERT: ", error);
							reject(error);
						} else {
							//devolvemos la última id insertada
							//callback(null, {"insertId": fwid});
							resolve({"insertId": fwid});
						}
					});
				}
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
firewallModel.updateFirewall = function (iduser, firewallData, callback) {
	db.get(function (error, connection) {
		if (error)
			callback(error, null);
		var sqlExists = 'SELECT T.id FROM ' + tableModel + ' T INNER JOIN user__firewall U ON T.id=U.id_firewall ' +
				' AND U.id_user=' + connection.escape(iduser) +
				' WHERE T.id = ' + connection.escape(firewallData.id) + ' AND U.allow_access=1 AND U.allow_edit=1 ';
		logger.debug(sqlExists);
		connection.query(sqlExists, function (error, row) {
			if (row && row.length > 0) {
				var sql = 'UPDATE ' + tableModel + ' SET name = ' + connection.escape(firewallData.name) + ',' +
						'comment = ' + connection.escape(firewallData.comment) + ', ' +
						'install_user = ' + connection.escape(firewallData.install_user) + ', ' +
						'install_pass = ' + connection.escape(firewallData.install_pass) + ', ' +
						'save_user_pass = ' + connection.escape(firewallData.save_user_pass) + ', ' +
						'install_interface = ' + connection.escape(firewallData.install_interface) + ', ' +
						'install_ipobj = ' + connection.escape(firewallData.install_ipobj) + ', ' +
						'install_port = ' + connection.escape(firewallData.install_port) + ', ' +
						'by_user = ' + connection.escape(iduser) +
						' WHERE id = ' + firewallData.id;
				logger.debug(sql);
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


// Get the ID of all firewalls who's status field is not zero.
firewallModel.getFirewallStatusNotZero = function (fwcloud, cluster, data) {
	return new Promise((resolve, reject) => {
		db.get((error, connection) => {
			if (error) reject(error);

			var sql_cond = "";
			if (cluster===1) 
				sql_cond = " AND cluster IS NOT NULL"
			else if (cluster===0) 
			  sql_cond = " AND cluster IS NULL";
			var sql = 'SELECT id,cluster,status FROM '+tableModel+' WHERE status!=0 AND fwcloud='+connection.escape(fwcloud)+sql_cond;
			connection.query(sql, (error, rows) => {
				if (error) reject(error);
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
			var sqlExists = 'SELECT T.id FROM ' + tableModel + ' T INNER JOIN user__firewall U ON T.id=U.id_firewall ' +
			' AND U.id_user=' + connection.escape(iduser) +
			' WHERE T.id = ' + connection.escape(firewallData.id) + ' AND U.allow_access=1 AND U.allow_edit=1 ';
			logger.debug(sqlExists);
			connection.query(sqlExists, function (error, row) {
				//NEW FIREWALL
				if (row && row.length > 0) {
					var sql = 'insert into firewall(cluster,fwcloud,name,comment,by_user,status,install_user,install_pass,save_user_pass,install_interface,install_ipobj,fwmaster,install_port) ' +
					' select cluster,fwcloud,' + connection.escape(firewallData.name) + ',' + connection.escape(firewallData.comment) + ',' + connection.escape(iduser) + ' , 3, install_user, install_pass, save_user_pass, install_interface, install_ipobj, fwmaster, install_port ' +
					' from firewall where id= ' + firewallData.id + ' and fwcloud=' + firewallData.fwcloud;
					logger.debug(sql);
					connection.query(sql, function (error, result) {
						if (error) {
							reject(error);
						} else {
							var fwid = result.insertId;
							connection.query('INSERT INTO  user__firewall  SET id_firewall=' + connection.escape(fwid) + ' , id_user=' + connection.escape(iduser) + ' , allow_access=1, allow_edit=1', function (error, result) {
								if (error) {
									logger.debug("SQL ERROR USER INSERT: ", error);
									reject(error);
								} else {
									resolve({"result": true, "insertId": fwid});                                    
								}
							});
						}
					});
				} else {
					resolve({"result": false});
				}
			});
		});
	});
};

firewallModel.updateFWMaster = function (iduser, fwcloud, cluster, idfirewall, fwmaster, callback) {
	db.get(function (error, connection) {
		if (error)
			callback(error, null);
		var sqlExists = 'SELECT T.id FROM ' + tableModel + ' T INNER JOIN user__firewall U ON T.id=U.id_firewall ' +
				' AND U.id_user=' + connection.escape(iduser) +
				' WHERE T.id = ' + connection.escape(idfirewall) + ' AND U.allow_access=1 AND U.allow_edit=1 ';
		connection.query(sqlExists, function (error, row) {
			if (row && row.length > 0) {
				var sql = 'UPDATE ' + tableModel + ' SET ' +
						'fwmaster = ' + fwmaster + ', ' +
						'by_user = ' + connection.escape(iduser) +
						' WHERE id = ' + idfirewall + ' AND fwcloud=' + fwcloud + ' AND cluster=' + cluster;
				logger.debug(sql);
				connection.query(sql, function (error, result) {
					if (error) {
						callback(error, null);
					} else {
						if (fwmaster == 1) {
							var sql = 'UPDATE ' + tableModel + ' SET ' +
									'fwmaster = 0, ' +
									'by_user = ' + connection.escape(iduser) +
									' WHERE id <> ' + idfirewall + ' AND fwcloud=' + fwcloud + ' AND cluster=' + cluster;
							logger.debug(sql);
							connection.query(sql, function (error, result) {
								if (error) {
									callback(error, null);
								}
							});
						}
						callback(null, {"result": true});
					}
				});
			} else {
				callback(null, {"result": false});
			}
		});
	});
};
firewallModel.updateFirewallCluster = function (firewallData, callback) {

	db.get(function (error, connection) {
		if (error)
			callback(error, null);
		var sqlExists = 'SELECT T.id FROM ' + tableModel + ' T INNER JOIN user__firewall U ON T.id=U.id_firewall ' +
				' AND U.id_user=' + connection.escape(firewallData.by_user) +
				' WHERE T.id = ' + connection.escape(firewallData.id) + ' AND U.allow_access=1 AND U.allow_edit=1 ';
		logger.debug(sqlExists);
		connection.query(sqlExists, function (error, row) {

			if (row && row.length > 0) {
				var sql = 'UPDATE ' + tableModel + ' SET cluster = ' + connection.escape(firewallData.cluster) + ',' +
						'by_user = ' + connection.escape(firewallData.by_user) + ' ' +
						' WHERE id = ' + firewallData.id;
				logger.debug("updateFirewallCluster: ", sql);
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
		var sqlExists = 'SELECT T.id FROM ' + tableModel + ' T INNER JOIN user__firewall U ON T.id=U.id_firewall ' +
				' AND U.id_user=' + connection.escape(firewallData.iduser) +
				' WHERE T.id = ' + connection.escape(firewallData.id) + ' AND U.allow_access=1 AND U.allow_edit=1 ' +
				' AND (locked=0 OR (locked=1 AND locked_by=' + connection.escape(firewallData.iduser) + ')) ';
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
		var sqlExists = 'SELECT T.id FROM ' + tableModel + ' T INNER JOIN user__firewall U ON T.id=U.id_firewall ' +
				' AND U.id_user=' + connection.escape(firewallData.iduser) +
				' WHERE T.id = ' + connection.escape(firewallData.id) + ' AND U.allow_access=1 AND U.allow_edit=1 ' +
				' AND (locked=1 AND locked_by=' + connection.escape(firewallData.iduser) + ') ';
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
firewallModel.deleteFirewallPro = function (fwdata) {
	return new Promise((resolve, reject) => {

		InterfaceModel.searchInterfaceInrulesOtherFirewall(fwdata.fwcloud, fwdata.id)
				.then(found_resp => {
					if (found_resp.found) {
						logger.debug("RESTRICTED FIREWALL: " + fwdata.id + "  Fwcloud: " + fwdata.fwcloud);
						resolve({"result": false, "msg": "Restricted", "restrictions": found_resp});
					} else {
						firewallModel.deleteFirewall(fwdata.iduser, fwdata.fwcloud, fwdata.id)
								.then(data => {
									logger.debug("DELETED FIREWALL: " + fwdata.id + " - " + fwdata.name);
									resolve({"result": true, "msg": "Deleted", "restrictions": ""});
								})
								.catch(e => {
									resolve({"result": false, "msg": "Error", "restrictions": ""});
								});
					}
				})
				.catch(e => {
					resolve({"result": false, "msg": "Error", "restrictions": ""});
				});
	});
};
/**
 * DELETE Firewall
 *  
 * @method deleteFirewall
 * 
 * @param iduser {Integer}  User identifier
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
//ONLY DELETE FIREWALLS NOT IN CLUSTER
firewallModel.deleteFirewall = function (iduser, fwcloud, idfirewall) {
	return new Promise((resolve, reject) => {
		db.get(function (error, connection) {
			if (error)
				reject(error);
			var sqlExists = 'SELECT T.id, A.id as idnode FROM ' + tableModel + ' T INNER JOIN user__firewall U ON T.id=U.id_firewall ' +
					' AND U.id_user=' + connection.escape(iduser) +
					' INNER JOIN fwc_tree A ON A.id_obj = T.id ' +
					' WHERE T.id = ' + connection.escape(idfirewall) + ' AND U.allow_access=1 AND U.allow_edit=1';
			connection.query(sqlExists, function (error, row) {
				//If exists Id from firewall to remove
				if (row && row.length > 0) {
					connection.query("SET FOREIGN_KEY_CHECKS = 0", function (error, result) {
						var idnode = row[0].idnode;
						//DELETE POLICY AND Objects in Positions
						Policy_rModel.deletePolicy_r_Firewall(idfirewall)
								.then(resp => {
									// DELETE IPOBJS UNDER INTERFACES
									InterfaceModel.deleteInterfacesIpobjFirewall(fwcloud, idfirewall)
											.then(resp1 => {
												//DELETE INTEFACES
												InterfaceModel.deleteInterfaceFirewall(fwcloud, idfirewall)
														.then(resp2 => {
															//DELETE USERS_FIREWALL
															User__firewallModel.deleteAllUser__firewall(idfirewall)
																	.then(resp3 => {
																		//DELETE TREE NODES From firewall
																		var dataNode = {id: idnode, fwcloud: fwcloud, iduser: iduser};
																		fwcTreemodel.deleteFwc_TreeFullNode(dataNode)
																				.then(resp4 => {
																					//DELETE FIREWALL
																					var sql = 'DELETE FROM ' + tableModel + ' WHERE id = ' + connection.escape(idfirewall);
																					connection.query(sql, function (error, result) {
																						if (error) {
																							connection.query("SET FOREIGN_KEY_CHECKS = 1", function (error, result) {
																							});
																							resolve({"result": false, "msg": "Error DELETE FIREWALL: " + error});
																						} else {
																							connection.query("SET FOREIGN_KEY_CHECKS = 1", function (error, result) {
																							});
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
														})
														.catch(e => {
															resolve({"result": false, "msg": "Error DELETE INTERFACES: " + e});
														});
											})
											.catch(e => {
												resolve({"result": false, "msg": "Error DELETE IPOBJ UNDER INTERFACES: " + e});
											});
								})
								.catch(e => {
									resolve({"result": false, "msg": "Error DELETE Policy: " + e});
								});
					});
				} else {
					resolve({"result": false, "msg": "Not Exist"});
				}
			});
		});
	});
};

firewallModel.deleteFirewallFromCluster = function (iduser, fwcloud, idfirewall, cluster) {
	return new Promise((resolve, reject) => {
		db.get(function (error, connection) {
			if (error)
				reject(error);

			var sqlExists = 'SELECT T.*, A.id as idnode FROM ' + tableModel + ' T INNER JOIN user__firewall U ON T.id=U.id_firewall ' +
					' AND U.id_user=' + connection.escape(iduser) +
					' INNER JOIN fwc_tree A ON A.id_obj = T.id AND A.node_type="FW" ' +
					' WHERE T.id = ' + connection.escape(idfirewall) + ' AND U.allow_access=1 AND U.allow_edit=1 AND T.cluster=' + connection.escape(cluster);
			logger.debug(sqlExists);
			connection.query(sqlExists, function (error, row) {
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
						connection.query(sql, function (error, rowS) {
							if (rowS && rowS.length > 0) {
								var idNewFM = rowS[0].id;
								logger.debug("NEW FWMASTER: " + idNewFM);
								//UPDATE POLICY_R
								sql = "UPDATE policy_r SET firewall=" + connection.escape(idNewFM) + " WHERE firewall=" + connection.escape(idfirewall);
								logger.debug("UPDATE POLICY: ", sql);
								connection.query(sql, function (error, result) {
									if (error)
										resolve({"result": false, "msg": "Error DELETE POLICY"});
									else {
										//UPDATE INTERFACES
										sql = "UPDATE interface SET firewall=" + connection.escape(idNewFM) + " WHERE firewall=" + connection.escape(idfirewall);
										logger.debug("UPDATE INTERFACES: ", sql);
										connection.query(sql, function (error, result) {
											if (error)
												resolve({"result": false, "msg": "Error DELETE POLICY"});
											else {
												//UPDATE NEW FWMASTER
												sql = "UPDATE firewall SET fwmaster=1 WHERE id=" + connection.escape(idNewFM);
												logger.debug("UPDATE NEW FWMASTER: ", sql);
												connection.query(sql, function (error, result) {
													if (error)
														resolve({"result": false, "msg": "Error UPDATE NEW FWMASTER"});
													else {
														//UPDATE TREE RECURSIVE FROM IDNODE CLUSTER
														//GET NODE FROM CLUSTER
														sql = "SELECT " + connection.escape(idfirewall) + " as OLDFW, " + connection.escape(idNewFM) + " as NEWFW, T.* FROM fwc_tree T WHERE node_type='CL' AND  id_obj =" + connection.escape(cluster) + ' AND fwcloud=' + connection.escape(fwcloud);
														logger.debug("FIRST SQL: ", sql);
														connection.query(sql, function (error, rowT) {
															if (rowT && rowT.length > 0) {
																var iNodeCluster = rowT[0].id;
																fwcTreemodel.updateIDOBJFwc_TreeFullNode(rowT[0])
																		.then(resp => {
																			//DELETE USERS_FIREWALL
																			User__firewallModel.deleteAllUser__firewall(idfirewall)
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

																		})
																		.catch(e => {
																			resolve({"result": false, "msg": "ERROR: " + e});
																		});
															} else {
																resolve({"result": false, "msg": "NOT FOUND NODE CLUSTER"});
															}

														});

													}/////
												});
											}
										});
									}
								});



								//TRAPASO de NODOS

							} else {
								//NO HAY FIREWALL SLAVES
								resolve({"result": false, "msg": "Not Exist SLAVE"});
							}
						});

					} else {
						logger.debug("DELETING FW SLAVE: " + idfirewall);
						//DELETE USERS_FIREWALL
						User__firewallModel.deleteAllUser__firewall(idfirewall)
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
					}
				}
			});///
		});

	});
};

firewallModel.checkRestrictionsFirewallApplyTo = function (req, res, next) {
	req.restricted = {"result": true, "msg": "", "restrictions": ""};
	db.get(function (error, connection) {

		var sqlR = 'SELECT count(*) as cont FROM fwcloud_db.policy_r  R inner join firewall F on R.firewall=F.id ' +
				' where fw_apply_to=' + connection.escape(req.params.idfirewall) +
				' AND F.cluster=' + connection.escape(req.params.idcluster) +
				' AND F.fwcloud=' + connection.escape(req.fwcloud);
		logger.debug(sqlR);
		connection.query(sqlR, function (error, row) {
			if (row && row.length > 0) {
				if (row[0].cont > 0) {
					logger.debug("RESTRICTED FIREWALL: " + req.params.idfirewall + " CLUSTER:" + req.params.idcluster + "  Fwcloud: " + req.fwcloud);
					req.restricted = {"result": false, "msg": "Restricted", "restrictions": "FIREWALL WITH RESTRICTIONS APPLY_TO ON RULES"};
					next();
				} else
					next();
			} else
				next();
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
