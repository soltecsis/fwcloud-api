/**
 * DATA Module to manage IPOBJ Data
 *
 * @module Ipobjs
 * 
 * @requires db
 */

/**
 * ## Class to manage IPOBJ DATA
 *
 * @class IpobjModel
 * 
 */
var ipobjModel = {};

//Export the object
module.exports = ipobjModel;

/**
 * Property to identify Data Object
 *
 * @property objModel
 * @type text
 */
var objModel = 'IPOBJ';

/**
 * Property  to manage Dabase Access
 *
 * @property db
 * @type db 
 */
var db = require('../../db.js');

/**
 * Property  to manage Ipobj in Rules
 *
 * @property Policy_r__ipobjModel
 * @type models.policy_r__ipobj
 */
var Policy_r__ipobjModel = require('../../models/policy/policy_r__ipobj');
/**
 * Property  to manage Interfaces in Rules
 *
 * @property Policy_r__interfaceModel
 * @type models.policy_r__interface
 */
var Policy_r__interfaceModel = require('../../models/policy/policy_r__interface');
/**
 * Property manage async process
 *
 * @property async
 * @type async
 */
var asyncMod = require('async');

/**
 * Property  to manage Interfaces Data
 *
 * @property InterfaceModel
 * @type models.interface
 */
var InterfaceModel = require('../../models/interface/interface');
/**
 * Property  to manage Ipobj host data
 *
 * @property host_Data
 * @type models.data_ipobj_host
 */
var host_Data = require('../../models/data/data_ipobj_host');
/**
 * Property  to manage Interface data
 *
 * @property interface_Data
 * @type models.data_interface
 */
var interface_Data = require('../../models/data/data_interface');
/**
 * Property  to manage Ipobj  data
 *
 * @property ipobj_Data
 * @type models.data_ipobj
 */
var ipobj_Data = require('../../models/data/data_ipobj');
/**
 * Property  to manage Ipobj in Groups
 *
 * @property Ipobj__ipobjgModel
 * @type models.ipobj__ipobjg
 */

/**
 * Property Model to manage API RESPONSE data
 *
 * @property api_resp
 * @type ../../models/api_response
 * 
 */
var api_resp = require('../../utils/api_response');

var Ipobj_gModel = require('../../models/ipobj/ipobj_g');

var Ipobj__ipobjgModel = require('../../models/ipobj/ipobj__ipobjg');

var data_policy_position_ipobjs = require('../../models/data/data_policy_position_ipobjs');

const isIp = require('is-ip');


/**
 * Property Table
 *
 * @property tableModel
 * @type "ipobj"
 * @private
 * 
 */
var tableModel = "ipobj";

/**
 * Property Logger to manage App logs
 *
 * @attribute logger
 * @type log4js/app
 * 
 */
var logger = require('log4js').getLogger("app");


/**
 * Get ipobj by Ipobj id
 * 
 * @method getIpobj
 * 
 * @param {Integer} fwcloud FwCloud identifier
 * @param {Integer} id Ipobj identifier
 * 
 * @return {ROW} Returns ROW Data from Ipobj and FWC_TREE
 * */
ipobjModel.getIpobj = function (fwcloud, id, callback) {
	db.get(function (error, connection) {
		if (error)
			callback(error, null);

		var sql = 'SELECT I.*, T.id id_node, T.id_parent id_parent_node  FROM ' + tableModel + ' I ' +
				' inner join fwc_tree T on T.id_obj=I.id and T.obj_type=I.type AND (T.fwcloud=' + connection.escape(fwcloud) + ' OR T.fwcloud IS NULL)' +
				' inner join fwc_tree P on P.id=T.id_parent  and P.obj_type<>20 and P.obj_type<>21' +
				' WHERE I.id = ' + connection.escape(id) + ' AND (I.fwcloud=' + connection.escape(fwcloud) + ' OR I.fwcloud IS NULL)';

		connection.query(sql, function (error, row) {
			if (error) {
				callback(error, null);
			} else {
				//CHECK IF IPOBJ IS a HOST
				if (row.length > 0) {
					if (row[0].type === 8) {
						ipobjModel.getIpobj_Host_Full(fwcloud, id, function (errorhost, datahost) {
							if (errorhost) {
								callback(errorhost, null);
							} else {
								callback(null, datahost);
							}
						});

					} else
						callback(null, row);
				} else
					callback(null, row);


			}
		});
	});
};

/**
 * Get ipobj by Ipobj id
 * 
 * @method getIpobjPro
 * 
 * @param {Integer} fwcloud FwCloud identifier
 * @param {Integer} id Ipobj identifier
 * 
 * @return {ROW} Returns ROW Data from Ipobj and FWC_TREE
 * */
ipobjModel.getIpobjPro = function (position_ipobj) {
	return new Promise((resolve, reject) => {
		db.get(function (error, connection) {
			if (error)
				reject(error);
			if (position_ipobj.negate === undefined)
				position_ipobj.negate = 0;

			//logger.debug("IPOBJ: ", position_ipobj);

			//SELECT IPOBJ DATA UNDER POSITION
			var sql = 'SELECT ' + position_ipobj.negate + ' as negate,  I.*, T.id id_node, T.id_parent id_parent_node ' +
					' FROM ' + tableModel + ' I ' +
					' inner join fwc_tree T on T.id_obj=I.id and T.obj_type=I.type AND (T.fwcloud=' + connection.escape(position_ipobj.fwcloud) + ' OR T.fwcloud IS NULL)' +
					' inner join fwc_tree P on P.id=T.id_parent ' + //  and P.obj_type<>20 and P.obj_type<>21' +
					' WHERE I.id = ' + connection.escape(position_ipobj.ipobj) + ' AND (I.fwcloud=' + connection.escape(position_ipobj.fwcloud) + ' OR I.fwcloud IS NULL)';

			logger.debug("getIpobjPro -> ", sql);
			connection.query(sql, function (error, row) {
				if (error) {
					reject(error);
				} else {
					if (row.length > 0) {
						//CHECK IF IPOBJ IS a HOST
						if (row[0].type === 8) {
							logger.debug("======== > ENCONTRADO HOST: " + position_ipobj.ipobj);
							//GET ALL HOST INTERFACES
							InterfaceModel.getInterfacesHost_Full_Pro(position_ipobj.ipobj, position_ipobj.fwcloud)
									.then(interfacesHost => {

										//RETURN IPOBJ HOST DATA                                                                            
										var hostdata = new data_policy_position_ipobjs(row[0], position_ipobj.position_order, position_ipobj.negate, 'O');
										hostdata.interfaces = interfacesHost;

										resolve(hostdata);
									})
									.catch(e => {
										resolve();
									});
						} else {
							//RETURN IPOBJ DATA
							var ipobj = new data_policy_position_ipobjs(row[0], position_ipobj.position_order, position_ipobj.negate, 'O');
							//logger.debug("------------------- > ENCONTRADO IPOBJ: " + position_ipobj.ipobj + "  EN POSITION: " + position_ipobj.position);
							resolve(ipobj);
						}
					} else if (position_ipobj.type === 'I') {
						//SEARCH INTERFACE DATA
						InterfaceModel.getInterfaceFullPro(position_ipobj.firewall, position_ipobj.fwcloud, position_ipobj.ipobj)
								.then(dataInt => {
									logger.debug("------- > ENCONTRADA INTERFACE: " + position_ipobj.ipobj + "  EN POSITION: " + position_ipobj.position);
									//var ipobj = new data_policy_position_ipobjs(dataInt[0], position_ipobj.position_order, position_ipobj.negate, 'I');
									//RETURN INTERFACE DATA
									resolve(dataInt);
								})
								.catch(() =>
									resolve({})
								);
					} else if (position_ipobj.type === 'O' && position_ipobj.ipobj_g > 0) {
						logger.debug("======== > ENCONTRADO GROUP: " + position_ipobj.ipobj_g);
						//GET ALL GROUP's IPOBJS
						Ipobj_gModel.getIpobj_g_Full_Pro(position_ipobj.fwcloud, position_ipobj.ipobj_g)
								.then(ipobjsGroup => {
									logger.debug("-------------------------> FINAL de GROUP : " + position_ipobj.ipobj_g + " ----");
									//RETURN IPOBJ GROUP DATA                                                                            
									var groupdata = new data_policy_position_ipobjs(position_ipobj, position_ipobj.position_order, position_ipobj.negate, 'G');
									groupdata.ipobjs = ipobjsGroup;
									resolve(groupdata);
								})
								.catch(e => {
									resolve({});
								});

					} else {
						resolve({});
					}


				}
			});
		});
	});
};


ipobjModel.getFinalIpobjPro = function (position_ipobj) {
	return new Promise((resolve, reject) => {
		db.get(function (error, connection) {
			if (error)
				reject(error);
			if (position_ipobj.negate === undefined)
				position_ipobj.negate = 0;

			//logger.debug("IPOBJ: ", position_ipobj);
			var sql = "";

			if (position_ipobj.type === "O") {
				//SELECT IPOBJ DATA UNDER POSITION
				sql = 'SELECT ' + position_ipobj.negate + ' as negate,  I.*' +
						' FROM ' + tableModel + ' I ' +
						' WHERE I.id = ' + connection.escape(position_ipobj.ipobj) + ' AND (I.fwcloud=' + connection.escape(position_ipobj.fwcloud) + ' OR I.fwcloud IS NULL)';
			} else {
				sql = 'SELECT ' + position_ipobj.negate + ' as negate,  I.*' +
						' FROM interface I ' +
						' WHERE I.id = ' + connection.escape(position_ipobj.interface);
			}
			//logger.debug("getIpobjPro -> ", sql);
			connection.query(sql, function (error, row) {
				if (error) {
					reject(error);
				} else {
					if (row.length > 0) {
						//RETURN IPOBJ DATA
						var ipobj = new data_policy_position_ipobjs(row[0], position_ipobj.position_order, position_ipobj.negate, position_ipobj.type);
						//logger.debug("------------------- > ENCONTRADO IPOBJ: " + position_ipobj.ipobj + "  EN POSITION: " + position_ipobj.position);
						resolve(ipobj);

					} else {
						resolve({});
					}


				}
			});
		});
	});
};

//Get ipobj HOST by  id and ALL IPOBjs
/**
 * Get ipobj HOST DATA and Interfaces and Ipobj bellow Interfaces
 * 
 * @method getIpobj_Host_Full
 * 
 * @param {Integer} fwcloud FwCloud identifier
 * @param {Integer} id Ipobj identifier
 * 
 * @return {ROW} Returns ROW Data from Ipobj_Host/Interfaces/Ipobjs
 * */
ipobjModel.getIpobj_Host_Full = function (fwcloud, id, AllDone) {

	var hosts = [];
	var host_cont = 0;
	var ipobjs_cont = 0;
	var interfaces_cont = 0;

	db.get(function (error, connection) {
		if (error)
			callback(error, null);

		var sqlId = '';
		if (id !== '')
			sqlId = ' AND G.id = ' + connection.escape(id);
		var sql = 'SELECT G.*,  T.id id_node, T.id_parent id_parent_node FROM ' + tableModel + ' G ' +
				'inner join fwc_tree T on T.id_obj=G.id and T.obj_type=G.type AND (T.fwcloud=' + connection.escape(fwcloud) + ' OR T.fwcloud IS NULL) ' +
				' WHERE  (G.fwcloud= ' + connection.escape(fwcloud) + ' OR G.fwcloud is null) ' + sqlId;
		logger.debug(sql);
		connection.query(sql, function (error, rows) {
			if (error)
				callback(error, null);
			else if (rows.length > 0) {
				host_cont = rows.length;
				var row = rows[0];
				asyncMod.map(rows, function (row, callback1) {

					var host_node = new host_Data(row);

					logger.debug(" ---> DENTRO de HOST: " + row.id + " NAME: " + row.name);
					var idhost = row.id;
					host_node.interfaces = new Array();

					//GET ALL HOST INTERFACES
					InterfaceModel.getInterfacesHost(idhost, fwcloud, function (error, data_interfaces) {
						if (data_interfaces.length > 0) {
							interfaces_cont = data_interfaces.length;

							asyncMod.map(data_interfaces, function (data_interface, callback2) {
								//GET INTERFACES
								logger.debug("--> DENTRO de INTERFACE id:" + data_interface.id + "  Name:" + data_interface.name + "  Type:" + data_interface.interface_type)

								var interface_node = new interface_Data(data_interface);
								var idinterface = data_interface.id;

								interface_node.ipobjs = new Array();

								//GET ALL INTERFACE OBJECTs
								ipobjModel.getAllIpobjsInterface(fwcloud, idinterface, function (error, data_ipobjs) {
									if (data_ipobjs.length > 0) {
										ipobjs_cont = data_ipobjs.length;

										asyncMod.map(data_ipobjs, function (data_ipobj, callback2) {
											//GET OBJECTS
											logger.debug("--> DENTRO de OBJECT id:" + data_ipobj.id + "  Name:" + data_ipobj.name + "  Type:" + data_ipobj.type);

											var ipobj_node = new ipobj_Data(data_ipobj);
											//Añadimos ipobj a array Interfaces
											interface_node.ipobjs.push(ipobj_node);
											callback2();
										}, //Fin de bucle de IPOBJS
												function (err) {

													if (interface_node.ipobjs.length >= ipobjs_cont) {
														host_node.interfaces.push(interface_node);
														if (host_node.interfaces.length >= interfaces_cont) {
															hosts.push(host_node);
															if (hosts.length >= host_cont) {
																AllDone(null, hosts);
															}
														}
													}
												}
										);
									} else {
										host_node.interfaces.push(interface_node);
										if (host_node.interfaces.length >= interfaces_cont) {
											hosts.push(host_node);
											if (hosts.length >= host_cont) {
												AllDone(null, hosts);
											}
										}
									}
								}
								);

								callback2();
							}, //Fin de bucle de INTERFACES
									function (err) {

//                                        if (host_node.interfaces.length >= interfaces_cont) {
//                                            hosts.push(host_node);
//                                            if (hosts.length >= host_cont) {
//                                                AllDone(null, hosts);
//                                            }
//                                        }
									}
							);
						} else {
							hosts.push(host_node);
							if (hosts.length >= host_cont) {
								AllDone(null, hosts);
							}
						}
					}
					);
					callback1();
				}, //Fin de bucle de GROUPS
						function (err) {
							if (hosts.length >= host_cont) {

								AllDone(null, hosts);
							}
						}
				);
			} else {
				AllDone("", null);
			}
		});
	});
};

/**
 * Get All ipobj by Group
 * 
 * @method getAllIpobjsGroup
 * 
 * @param {Integer} fwcloud FwCloud identifier
 * @param {Integer} idgroup Group identifier
 * 
 * @return {ROWS} Returns ROWS Data from Ipobj and FWC_TREE
 * */
ipobjModel.getAllIpobjsGroup = function (fwcloud, idgroup, callback) {

	db.get(function (error, connection) {
		if (error)
			callback(error, null);

		var innergroup = ' INNER JOIN ipobj__ipobjg G on G.ipobj=I.id ';
		//var sql = 'SELECT * FROM ' + tableModel + ' I ' + innergroup + ' WHERE  G.ipobj_g=' + connection.escape(idgroup) + ' AND (I.fwcloud=' + connection.escape(fwcloud) + ' OR I.fwcloud IS NULL) ORDER BY G.id_gi';

		var sql = 'SELECT I.*, T.id id_node, T.id_parent id_parent_node  FROM ' + tableModel + ' I ' + innergroup +
				' inner join fwc_tree T on T.id_obj=I.id and T.obj_type=I.type AND (T.fwcloud_tree=' + connection.escape(fwcloud) + ' )' +
				' inner join fwc_tree P on P.id=T.id_parent  and P.obj_type<>20 and P.obj_type<>21' +
				' WHERE G.ipobj_g=' + connection.escape(idgroup) + ' AND (I.fwcloud=' + connection.escape(fwcloud) + ' OR I.fwcloud IS NULL)' +
				' ORDER BY G.id_gi';
		logger.debug(sql);

		connection.query(sql, function (error, rows) {
			if (error)
				callback(error, null);
			else
				callback(null, rows);
		});
	});
};

/**
 * Get All ipobj by Interface
 * 
 * @method getAllIpobjsInterface
 * 
 * @param {Integer} fwcloud FwCloud identifier
 * @param {Integer} idinterface Interface identifier
 * 
 * @return {ROWS} Returns ROWS Data from Ipobj and FWC_TREE
 * */
ipobjModel.getAllIpobjsInterface = function (fwcloud, idinterface, callback) {

	db.get(function (error, connection) {
		if (error)
			callback(error, null);



		var sql = 'SELECT I.*, T.id id_node, T.id_parent id_parent_node  FROM ' + tableModel + ' I ' +
				' inner join fwc_tree T on T.id_obj=I.id and T.obj_type=I.type AND (T.fwcloud_tree=' + connection.escape(fwcloud) + ')' +
				' inner join fwc_tree P on P.id=T.id_parent  and P.obj_type<>20 and P.obj_type<>21' +
				' WHERE I.interface=' + connection.escape(idinterface) + ' AND (I.fwcloud=' + connection.escape(fwcloud) + ' OR I.fwcloud IS NULL)' +
				' ORDER BY I.id';
		logger.debug(sql);

		connection.query(sql, function (error, rows) {
			if (error)
				callback(error, null);
			else
				callback(null, rows);
		});
	});
};

/**
 * Get All ipobj by Interface PROMISE
 * 
 * @method getAllIpobjsInterface
 * 
 * @param {Integer} fwcloud FwCloud identifier
 * @param {Integer} idinterface Interface identifier
 * 
 * @return {ROWS} Returns ROWS Data from Ipobj and FWC_TREE
 * */
ipobjModel.getAllIpobjsInterfacePro = function (data) {
	var fwcloud = data.fwcloud;

	return new Promise((resolve, reject) => {
		db.get(function (error, connection) {
			if (error)
				reject(error);

			var sql = 'SELECT I.id as ipobj, I.*, T.id id_node, T.id_parent id_parent_node  FROM ' + tableModel + ' I ' +
					' inner join fwc_tree T on T.id_obj=I.id and T.obj_type=I.type AND (T.fwcloud_tree=' + connection.escape(fwcloud) + ' )' +
					' inner join fwc_tree P on P.id=T.id_parent  and P.obj_type<>20 and P.obj_type<>21' +
					' WHERE I.interface=' + connection.escape(data.id) + ' AND (I.fwcloud=' + connection.escape(fwcloud) + ' OR I.fwcloud IS NULL)' +
					' ORDER BY I.id';
			//logger.debug("getAllIpobjsInterfacePro -> ", sql);
			var interface = new interface_Data(data);
			connection.query(sql, function (error, rows) {
				if (error)
					reject(error);
				else {
					Promise.all(rows.map(getIpobjData))
							.then(ipobjs => {
								interface.ipobjs = ipobjs;
								resolve(interface);
							})
							.catch(e => {
								resolve(null);
							});

				}
			});
		});
	});
};

function getIpobjData(row) {
	return new Promise((resolve, reject) => {
		var ipobj = new ipobj_Data(row);
		resolve(ipobj);
	});
}

/**
 * Get ipobj by id and Group
 * 
 * @method getIpobjGroup
 * 
 * @param {Integer} fwcloud FwCloud identifier
 * @param {Integer} idgroup id Group identifier
 * @param {Integer} id id ipobj identifier
 * 
 * @return {ROW} Returns ROW Data from Ipobj
 * */
ipobjModel.getIpobjGroup = function (fwcloud, idgroup, id, callback) {
	db.get(function (error, connection) {
		if (error)
			callback(error, null);

		var innergroup = ' T INNER JOIN ipobj__ipobjg G on G.ipobj=T.id ';
		var sql = 'SELECT * FROM ' + tableModel + innergroup + ' WHERE id = ' + connection.escape(id) + ' AND G.ipobj_g=' + connection.escape(idgroup) + ' AND (T.fwcloud=' + connection.escape(fwcloud) + ' OR T.fwcloud IS NULL) ';

		connection.query(sql, function (error, rows) {
			if (error)
				callback(error, null);
			else
				callback(null, rows[0]);
		});
	});
};

/**
 * Get ipobj by name
 * 
 * @method getIpobjName
 * 
 * @param {Integer} fwcloud FwCloud identifier
 * @param {String} name name ipobj identifier
 * 
 * @return {ROW} Returns ROW Data from Ipobj
 * */
ipobjModel.getIpobjName = function (fwcloud, name, callback) {
	db.get(function (error, connection) {
		if (error)
			callback(error, null);
		var namesql = '%' + name + '%';

		var sql = 'SELECT I.*, T.id id_node, T.id_parent id_parent_node  FROM ' + tableModel + ' I ' +
				' inner join fwc_tree T on T.id_obj=I.id and T.obj_type=I.type AND (T.fwcloud_tree=' + connection.escape(fwcloud) + ' )' +
				' inner join fwc_tree P on P.id=T.id_parent  and P.obj_type<>20 and P.obj_type<>21' +
				' WHERE I.name like  = ' + connection.escape(namesql) + ' AND (I.fwcloud=' + connection.escape(fwcloud) + ' OR I.fwcloud IS NULL)';

		//var sql = 'SELECT * FROM ' + tableModel + ' WHERE name like  ' + connection.escape(namesql) + ' AND (T.fwcloud=' + connection.escape(fwcloud) + ' OR T.fwcloud IS NULL) ';

		connection.query(sql, function (error, row) {
			if (error)
				callback(error, null);
			else
				callback(null, row);
		});
	});
};



/**
 * Add ipobj
 * 
 * @method insertIpobj
 * 
 * @param {Object} ipobjData Ipobj Data
 * 
 * @return {JSON} Returns JSON result
 * @example 
 * #### JSON RESPONSE OK:
 *      {result: true, "insertId": result.insertId}
 * 
 * #### JSON RESPONSE ERROR:
 *      {result: false, "insertId": ''}
 * */
ipobjModel.insertIpobj = function (ipobjData, callback) {
	db.get((error, connection) => {
		if (error) return callback(error, null);
		// The IDs for the user defined IP Objects begin from the value 100000. 
		// IDs values from 0 to 99999 are reserved for standard IP Objects.
		connection.query('SELECT ID FROM ' + tableModel + ' ORDER BY ID DESC LIMIT 1', (error, result) => {
			if (error) return callback(error, null);
			ipobjData.id = ((result[0].ID >= 100000) ? (result[0].ID+1) : 100000);
			connection.query('INSERT INTO ' + tableModel + ' SET ?', ipobjData, function (error, result) {
				if (error) return callback(error, null);			
				if (result.affectedRows > 0) {
					//devolvemos la última id insertada
					callback(null, {result: true, "insertId": result.insertId});
				} else
					callback(null, {result: false, "insertId": ''});
			});
		});
	});
};

ipobjModel.cloneIpobj = function (ipobjDataclone) {
	return new Promise((resolve, reject) => {
		db.get((error, connection) => {
			if (error) return reject(error);

			var ipobjData = {
				id: null,
				fwcloud: ipobjDataclone.fwcloud,
				interface: ipobjDataclone.newinterface,
				name: ipobjDataclone.name,
				type: ipobjDataclone.type,
				protocol: ipobjDataclone.protocol,
				address: ipobjDataclone.address,
				netmask: ipobjDataclone.netmask,
				diff_serv: ipobjDataclone.diff_serv,
				ip_version: ipobjDataclone.ip_version,
				icmp_code: ipobjDataclone.icmp_code,
				icmp_type: ipobjDataclone.icmp_type,
				tcp_flags_mask: ipobjDataclone.tcp_flags_mask,
				tcp_flags_settings: ipobjDataclone.tcp_flags_settings,
				range_start: ipobjDataclone.range_start,
				range_end: ipobjDataclone.range_end,
				source_port_start: ipobjDataclone.source_port_start,
				source_port_end: ipobjDataclone.source_port_end,
				destination_port_start: ipobjDataclone.destination_port_start,
				destination_port_end: ipobjDataclone.destination_port_end,
				options: ipobjDataclone.options,
				comment: ipobjDataclone.comment
			};
			connection.query('INSERT INTO ' + tableModel + ' SET ?', ipobjData, (error, result) => {
				if (error) return reject(error);
				resolve({"id_org": ipobjDataclone.id, "id_clon": result.insertId});                        
			});
		});
	});
};

/**
 * Update ipobj
 * 
 * @method updateIpobj
 * 
 * @param {Object} ipobjData Ipobj Data
 * 
 * @return {JSON} Returns JSON result
 * @example 
 * #### JSON RESPONSE OK:
 *      {result: true}
 * 
 * #### JSON RESPONSE ERROR:
 *      {result: false}
 * */
ipobjModel.updateIpobj = function (ipobjData, callback) {

	db.get(function (error, connection) {
		if (error)
			callback(error, null);
		var sql = 'UPDATE ' + tableModel + ' SET ' +
				'fwcloud = ' + connection.escape(ipobjData.fwcloud) + ',' +
				'interface = ' + connection.escape(ipobjData.interface) + ',' +
				'name = ' + connection.escape(ipobjData.name) + ',' +
				'type = ' + connection.escape(ipobjData.type) + ',' +
				'protocol = ' + connection.escape(ipobjData.protocol) + ',' +
				'address = ' + connection.escape(ipobjData.address) + ',' +
				'netmask = ' + connection.escape(ipobjData.netmask) + ',' +
				'diff_serv = ' + connection.escape(ipobjData.diff_serv) + ',' +
				'ip_version = ' + connection.escape(ipobjData.ip_version) + ',' +
				'icmp_code = ' + connection.escape(ipobjData.icmp_code) + ',' +
				'icmp_type = ' + connection.escape(ipobjData.icmp_type) + ',' +
				'tcp_flags_mask = ' + connection.escape(ipobjData.tcp_flags_mask) + ',' +
				'tcp_flags_settings = ' + connection.escape(ipobjData.tcp_flags_settings) + ',' +
				'range_start = ' + connection.escape(ipobjData.range_start) + ',' +
				'range_end = ' + connection.escape(ipobjData.range_end) + ',' +
				'source_port_start = ' + connection.escape(ipobjData.source_port_start) + ',' +
				'source_port_end = ' + connection.escape(ipobjData.source_port_end) + ',' +
				'destination_port_start = ' + connection.escape(ipobjData.destination_port_start) + ',' +
				'destination_port_end = ' + connection.escape(ipobjData.destination_port_end) + ',' +
				'options = ' + connection.escape(ipobjData.options) + ',' +
				'comment = ' + connection.escape(ipobjData.comment) + ' ' +
				' WHERE id = ' + ipobjData.id + ' AND fwcloud=' + connection.escape(ipobjData.fwcloud);
		logger.debug(sql);
		connection.query(sql, function (error, result) {
			if (error) {
				callback(error, null);
			} else {
				if (result.affectedRows > 0) {
					ipobjModel.UpdateHOST(ipobjData.id)
							.then(ipobjModel.UpdateINTERFACE(ipobjData.id));
					callback(null, {"result": true});
				} else {
					callback(null, {"result": false});
				}
			}
		});
	});
};

/**
 * ### Delete ipobj
 * 
 * @method deleteIpobj
 * 
 * @param {Integer} id id ipobj identifier
 * @param {Integer} type ipobj type
 * @param {Integer} fwcloud FwCloud identifier
 * 
 * @return {JSON} Returns JSON result
 * @example 
 * #### JSON RESPONSE OK:
 * 
 *      {"result": true, "msg": "deleted"}
 * 
 * #### JSON RESPONSE ERROR NOT EXIST:
 * 
 *      {"result": false, "msg": "notExist"}
 *      
 * #### JSON RESPONSE RESTRICTED:
 * 
 *      {"result": false, "msg": "Restricted", "restrictions": data.search}
 * */
ipobjModel.deleteIpobj = function (id, type, fwcloud, callback) {

	db.get(function (error, connection) {
		if (error)
			callback(error, null);
		var sql = 'DELETE FROM ' + tableModel + ' WHERE id = ' + connection.escape(id) + ' AND fwcloud=' + connection.escape(fwcloud) + ' AND type=' + connection.escape(type);
		logger.debug(sql);
		connection.query(sql, function (error, result) {
			if (error) {
				logger.debug(error);
				callback(error, null);
			} else {
				if (result.affectedRows > 0) {
					logger.debug("OK DELETED IPOBJ: " + id + "  Type: " + type + "  Fwcloud: " + fwcloud);
					callback(null, {"result": true, "msg": "deleted"});
				} else {
					callback(null, {"result": false, "msg": "notExist"});
				}
			}
		});
	});
};

//DELETE ALL IPOBJ UNDER INTERFACE
ipobjModel.deleteIpobjInterface = function (data) {
	return new Promise((resolve, reject) => {
		db.get(function (error, connection) {
			if (error)
				reject(error);
			var sql = 'DELETE FROM ' + tableModel + ' WHERE interface = ' + connection.escape(data.id);

			connection.query(sql, function (error, result) {
				if (error) {
					logger.debug(error);
					reject(error);
				} else {
					if (result.affectedRows > 0) {
						resolve({"result": true, "msg": "deleted"});
					} else {
						resolve({"result": false, "msg": "notExist"});
					}
				}
			});
		});
	});

};

//UPDATE HOST IF IPOBJ IS UNDER 
ipobjModel.UpdateHOST = function (id) {
	return new Promise((resolve, reject) => {
		db.get(function (error, connection) {
			if (error)
				reject(error);
			var sql = 'UPDATE ipobj H  ' +
					'inner join interface__ipobj II on II.ipobj=H.id ' +
					'inner join interface I on I.id=II.interface ' +
					'inner join ipobj O on O.interface= I.id ' +
					'set H.updated_at= CURRENT_TIMESTAMP ' +
					' WHERE O.id = ' + connection.escape(id);
			logger.debug(sql);
			connection.query(sql, function (error, result) {
				if (error) {
					logger.debug(error);
					reject(error);
				} else {
					if (result.affectedRows > 0) {
						resolve({"result": true});
					} else {
						resolve({"result": false});
					}
				}
			});
		});
	});
};

//UPDATE INTEFACE IF IPOBJ IS UNDER 
ipobjModel.UpdateINTERFACE = function (id) {
	return new Promise((resolve, reject) => {
		db.get(function (error, connection) {
			if (error)
				reject(error);
			var sql = 'UPDATE interface I  ' +
					'inner join ipobj O on O.interface= I.id ' +
					'set I.updated_at= CURRENT_TIMESTAMP ' +
					' WHERE O.id = ' + connection.escape(id);
			logger.debug(sql);
			connection.query(sql, function (error, result) {
				if (error) {
					logger.debug(error);
					reject(error);
				} else {
					if (result.affectedRows > 0) {
						resolve({"result": true});
					} else {
						resolve({"result": false});
					}
				}
			});
		});
	});
};




/**
 * ### check if IPOBJ Exists in any Group
 * 
 * @method checkIpobjInGroup
 * 
 * @param {Integer} ipobj id ipobj identifier
 * @param {Integer} type ipobj type
 * @param {Integer} fwcloud FwCloud identifier
 * 
 * @return {JSON} Returns JSON result
 * @example 
 * #### JSON RESPONSE OK:
 * 
 *      {"result": true};
 * 
 * #### JSON RESPONSE ERROR NOT EXIST:
 * 
 *      {"result": false};
 *      
 * */
ipobjModel.checkIpobjInGroup = function (ipobj, type, fwcloud, callback) {

	logger.debug("CHECK DELETING FROM GROUP ipobj:" + ipobj + " Type:" + type + "  fwcloud:" + fwcloud);
	db.get(function (error, connection) {

		var sql = 'SELECT count(*) as n FROM ' + tableModel + ' I ' +
				' INNER JOIN ipobj__ipobjg G on G.ipobj=I.id ' +
				' WHERE I.id=' + connection.escape(ipobj) + ' AND I.type=' + connection.escape(type) + ' AND I.fwcloud=' + connection.escape(fwcloud);
		logger.debug(sql);
		connection.query(sql, function (error, rows) {
			if (!error) {
				if (rows.length > 0) {
					if (rows[0].n > 0) {
						logger.debug("ALERT DELETING ipobj IN GROUP:" + ipobj + " type: " + type + " fwcloud:" + fwcloud + " --> FOUND IN " + rows[0].n + " GROUPS");
						callback(null, {"result": true});
					} else {
						callback(null, {"result": false});
					}
				} else
					callback(null, {"result": false});
			} else {
				logger.error(error);
				callback(null, {"result": false});
			}
		});
	});

};

ipobjModel.checkRestrictions = function (req, res, next) {
	req.restricted = {"result": true, "msg": "", "restrictions": ""};

	ipobjModel.searchIpobjInRules(req.params.id, req.params.type, req.fwcloud)
			.then(data => {
				if (data.result) {
					logger.debug("RESTRICTED IPOBJ: " + req.params.id + "  Type: " + req.params.type + "  Fwcloud: " + req.fwcloud);
					req.restricted = {"result": false, "msg": "Restricted", "restrictions": data.search};
				}
				next();
			})
			.catch(e => next());
};

/**
 * ### searchIpobjInRules
 * Search where is used IPOBJ in RULES
 * 
 * @method searchIpobjInRules
 * 
 * @param {Integer} id id ipobj identifier
 * @param {Integer} type ipobj type
 * @param {Integer} fwcloud FwCloud identifier
 * 
 * @return {JSON} Returns JSON result
 * @example #### JSON RESPONSE OK
 * 
 *          {"result": true, "msg": "IPOBJ FOUND", 
 *              "search":
 *                  {   "IpobjInRules": data_ipobj, 
 *                      "GroupInRules": data_grouprule, 
 *                      "IpobjInGroup": data_group,
 *                      "InterfacesIpobjInRules": data_interfaces, 
 *                      "InterfacesFIpobjInRules": data_interfaces_f,
 *                      "InterfacesAboveIpobjInRules": data_interfaces_above,
 *                      "HostIpobjInterfacesIpobjInRules": data_ipobj_host, 
 *                      "IpobjInterfacesIpobjInRules": data_ipobj_ipobj
 *                  }
 *          }
 * 
 * #### JSON RESPONSE ERROR NOT EXIST:
 * 
 *      {"result": false, "msg": "IPOBJ NOT FOUND", 
 *          "search": {
 "IpobjInRules": "", 
 "GroupInRules": "",
 "IpobjInGroup": "", 
 "InterfacesIpobjInRules": "", 
 "InterfacesFIpobjInRules": "",
 "InterfacesAboveIpobjInRules": "",
 "HostIpobjInterfacesIpobjInRules": "", 
 "IpobjInterfacesIpobjInRules": ""
 }
 }
 *      
 * */
ipobjModel.searchIpobjInRules = function (id, type, fwcloud) {
	return new Promise((resolve, reject) => {
		//SEARCH IPOBJ IN RULES
		Policy_r__ipobjModel.searchIpobjInRule(id, type, fwcloud, function (error, data_ipobj) {
			if (error) {
				reject(error);
			} else {
				//SEARCH IPOBJ GROUP IN RULES
				Policy_r__ipobjModel.searchIpobjGroupInRule(id, type, fwcloud, function (error, data_grouprule) {
					if (error) {
						reject(error);
					} else {
						//SEARCH IPOBJ IN GROUPS
						Ipobj__ipobjgModel.searchIpobjGroup(id, type, fwcloud, function (error, data_group) {
							if (error) {
								reject(error);
							} else {
								//SEARCH INTERFACES UNDER IPOBJ HOST IN RULES  'O'  POSITIONS
								Policy_r__ipobjModel.searchInterfacesIpobjHostInRule(id, type, fwcloud, function (error, data_interfaces) {
									if (error) {
										reject(error);
									} else {
										//SEARCH INTERFACES ABOVE IPOBJ  IN RULES  'O'  POSITIONS
										Policy_r__ipobjModel.searchInterfacesAboveIpobjInRule(id, type, fwcloud, function (error, data_interfaces_above) {
											if (error) {
												reject(error);
											} else {
												//SEARCH INTERFACES WITH IPOBJ UNDER  IN RULES  'I'  POSITIONS
												Policy_r__interfaceModel.searchInterfacesInRule(id, fwcloud, function (error, data_interfaces_f) {
													if (error) {
														reject(error);
													} else {
														//SEARCH IF IPOBJ UNDER INTERFACES UNDER IPOBJ HOST Has HOST IN RULES 'O' POSITIONS                                            
														Policy_r__ipobjModel.searchIpobjInterfacesIpobjHostInRule(id, type, fwcloud, function (error, data_ipobj_host) {
															if (error) {
																reject(error);
															} else {
																//SEARCH IF IPOBJ UNDER INTERFACES UNDER IPOBJ HOST Has HOST IN RULES 'O' POSITIONS                                            
																Policy_r__ipobjModel.searchIpobjInterfacesIpobjInRule(id, type, fwcloud, function (error, data_ipobj_ipobj) {
																	if (error) {
																		reject(error);
																	} else {
																		if (data_ipobj.found !== "" || data_grouprule.found !== "" || data_group.found !== ""
																				|| data_interfaces.found !== "" 
																				/* CARLES - Ignoramos estos datos dado que cuando utilizamos un host en una posición, este resultado
																				no permite borrar interfaces o direcciones IP de dicho host.
																				Hay que revisar la consulta SQL de searchIpobjInterfacesIpobjHostInRule para corregir el error. */
																				//|| data_ipobj_host.found !== "" 
																				|| data_ipobj_ipobj.found !== ""
																				|| data_interfaces_f.found !== "") {
																			resolve({"result": true, "msg": "IPOBJ FOUND", "search":
																						{"IpobjInRules": data_ipobj, "GroupInRules": data_grouprule, "IpobjInGroup": data_group,
																							"InterfacesIpobjInRules": data_interfaces, "InterfacesFIpobjInRules": data_interfaces_f,
																							"InterfacesAboveIpobjInRules": data_interfaces_above,
																							"HostIpobjInterfacesIpobjInRules": data_ipobj_host, "IpobjInterfacesIpobjInRules": data_ipobj_ipobj
																						}});
																		} else {
																			resolve({"result": false, "msg": "IPOBJ NOT FOUND", "search": {
																					"IpobjInRules": "", "GroupInRules": "",
																					"IpobjInGroup": "", "InterfacesIpobjInRules": "", "InterfacesFIpobjInRules": "",
																					"InterfacesAboveIpobjInRules": "",
																					"HostIpobjInterfacesIpobjInRules": "", "IpobjInterfacesIpobjInRules": ""}});
																		}
																	}
																});
															}
														});
													}
												});
											}
										});
									}
								});
							}
						});
					}
				});
			}

		});
	});
};

/**
 * ### searchIpobj
 * Search where is used IPOBJ
 * 
 * @method searchIpobj
 * 
 * @param {Integer} id id ipobj identifier
 * @param {Integer} type ipobj type
 * @param {Integer} fwcloud FwCloud identifier
 * 
 * @return {JSON} Returns JSON result
 * @example #### JSON RESPONSE OK
 * 
 *          {"result": true, "msg": "IPOBJ FOUND", 
 *              "search": {
 *                  "IpobjInRules": data_ipobj, 
 *                  "IpobjInGroup": data_group, 
 *                  "IpobjInterfaces": data_ipobj_interfaces
 *                  }
 *          }
 * 
 * #### JSON RESPONSE ERROR NOT EXIST:
 * 
 *      {"result": false, "msg": "IPOBJ NOT FOUND", 
 *              "search": {
 *                  "IpobjInRules": "", 
 *                  "IpobjInGroup": "", 
 *                  "IpobjInterfaces": ""
 *               }
 *      }
 *      
 * */
ipobjModel.searchIpobj = function (id, type, fwcloud, callback) {
	//SEARCH IPOBJ IN RULES
	Policy_r__ipobjModel.searchIpobjInRule(id, type, fwcloud, function (error, data_ipobj) {
		if (error) {
			callback(error, null);
		} else {
			//SEARCH IPOBJ IN GROUPS
			Ipobj__ipobjgModel.searchIpobjGroup(id, type, fwcloud, function (error, data_group) {
				if (error) {
					callback(error, null);
				} else {
					//SEARCH IPOBJ UNDER INTERFACES UNDER IPOBJ HOST IN RULES 'O' POSITONS
					Policy_r__ipobjModel.searchIpobjInterfaces(id, type, fwcloud, function (error, data_ipobj_interfaces) {
						if (error) {
							callback(error, null);
						} else {

							//logger.debug(data_ipobj);
							if (data_ipobj.found !== "" || data_group.found !== "" || data_ipobj_interfaces.found !== "") {
								callback(null, {"result": true, "msg": "IPOBJ FOUND", "search": {
										"IpobjInRules": data_ipobj, "IpobjInGroup": data_group, "IpobjInterfaces": data_ipobj_interfaces}});
							} else {
								callback(null, {"result": false, "msg": "IPOBJ NOT FOUND", "search": {
										"IpobjInRules": "", "IpobjInGroup": "", "IpobjInterfaces": ""}});
							}

						}
					});
				}
			});
		}
	});
};

// Middleware for avoid ipobj duplicities.
ipobjModel.checkDuplicity = (req, res, next) => {
	// If the user wants to create de IPObj even if it is duplicated, create it.
	if (req.body.force===1) return next();

	// If we are creating an address for a network interface, then don check duplicity.
	if (req.body.interface!==null) return next();

	db.get((error, connection) => {
		var sql = 'SELECT id,name FROM ' + tableModel +
		' WHERE (fwcloud IS NULL OR fwcloud=' + connection.escape(req.body.fwcloud) + ")" + 
		' AND type' + ((req.body.type===undefined || req.body.type===null) ? " IS NULL" : ("="+connection.escape(req.body.type))) +
		' AND protocol' + ((req.body.protocol===undefined || req.body.protocol===null) ? " IS NULL" : ("="+connection.escape(req.body.protocol))) +
		' AND address' + ((req.body.address===undefined || req.body.address===null) ? " IS NULL" : ("="+connection.escape(req.body.address))) +
		' AND netmask' + ((req.body.netmask===undefined || req.body.netmask===null) ? " IS NULL" : ("="+connection.escape(req.body.netmask))) +
		' AND diff_serv' + ((req.body.diff_serv===undefined || req.body.diff_serv===null) ? " IS NULL" : ("="+connection.escape(req.body.diff_serv))) +
 		' AND ip_version' + ((req.body.ip_version===undefined || req.body.ip_version===null) ? " IS NULL" : ("="+connection.escape(req.body.ip_version))) +
		' AND icmp_type' + ((req.body.icmp_type===undefined || req.body.icmp_type===null) ? " IS NULL" : ("="+connection.escape(req.body.icmp_type))) +
		' AND icmp_code' + ((req.body.icmp_code===undefined || req.body.icmp_code===null) ? " IS NULL" : ("="+connection.escape(req.body.icmp_code))) +
		' AND tcp_flags_mask' + ((req.body.tcp_flags_mask===undefined || req.body.tcp_flags_mask===null) ? " IS NULL" : ("="+connection.escape(req.body.tcp_flags_mask))) +
		' AND tcp_flags_settings' + ((req.body.tcp_flags_settings===undefined || req.body.tcp_flags_settings===null) ? " IS NULL" : ("="+connection.escape(req.body.tcp_flags_settings))) +
		' AND range_start' + ((req.body.range_start===undefined || req.body.range_start===null) ? " IS NULL" : ("="+connection.escape(req.body.range_start))) +
		' AND range_end' + ((req.body.range_end===undefined || req.body.range_end===null) ? " IS NULL" : ("="+connection.escape(req.body.range_end))) +
		' AND source_port_start' + ((req.body.source_port_start===undefined || req.body.source_port_start===null) ? " IS NULL" : ("="+connection.escape(req.body.source_port_start))) +
		' AND source_port_end' + ((req.body.source_port_end===undefined || req.body.source_port_end===null) ? " IS NULL" : ("="+connection.escape(req.body.source_port_end))) +
		' AND destination_port_start' + ((req.body.destination_port_start===undefined || req.body.destination_port_start===null) ? " IS NULL" : ("="+connection.escape(req.body.destination_port_start))) +
		' AND destination_port_end' + ((req.body.destination_port_end===undefined || req.body.destination_port_end===null) ? " IS NULL" : ("="+connection.escape(req.body.destination_port_end))) +
		' AND options' + ((req.body.options===undefined || req.body.options===null) ? " IS NULL" : ("="+connection.escape(req.body.options))) +
		(req.body.id ? ' AND id!='+connection.escape(req.body.id) : '') +
		' AND interface IS NULL';
	
		connection.query(sql, (error, rows) => {
			if (!error) {
				if (rows.length>0)
					api_resp.getJson(rows, api_resp.ACR_ALREADY_EXISTS, 'Duplicated IP Object.', objModel, null, jsonResp => res.status(200).json(jsonResp));
				else
					next();
			} else {
				logger.error(error);
				next();
			}
		});
	});
};

// Middleware for veriy ipobj parameters.
ipobjModel.checkIPObjParameters = (req, res, next) => {
	if (req.body.fwcloud===undefined || req.body.fwcloud===null || (typeof req.body.fwcloud)!="number" || req.body.fwcloud<1)
		return api_resp.getJson({name: 'fwcloud'}, api_resp.ACR_PARAM_ERROR, null, objModel, null, jsonResp => res.status(200).json(jsonResp));

	if (req.body.interface===undefined) req.body.interface=null;
	if (req.body.interface!==null && (typeof req.body.interface)=="number" && req.body.interface<1)
		return api_resp.getJson({name: 'interface'}, api_resp.ACR_PARAM_ERROR, null, objModel, null, jsonResp => res.status(200).json(jsonResp));

	if (req.body.name===undefined || req.body.name===null || (typeof req.body.name)!="string" || req.body.name.length<1 || req.body.name.length>255)
		return api_resp.getJson({name: 'name'}, api_resp.ACR_PARAM_ERROR, null, objModel, null, jsonResp => res.status(200).json(jsonResp));

	if (req.body.type===undefined || req.body.type===null || (typeof req.body.type)!="number" || req.body.type<0 || req.body.type>255)
		return api_resp.getJson({name: 'type'}, api_resp.ACR_PARAM_ERROR, null, objModel, null, jsonResp => res.status(200).json(jsonResp));

	if (req.body.protocol===undefined) req.body.protocol=null;
	if (req.body.protocol!==null && ((typeof req.body.protocol)!="number" || req.body.protocol<0 || req.body.protocol>255))
		return api_resp.getJson({name: 'protocol'}, api_resp.ACR_PARAM_ERROR, null, objModel, null, jsonResp => res.status(200).json(jsonResp));

		
	if (req.body.ip_version===undefined) req.body.ip_version=null;
	if (req.body.ip_version!==null && ((typeof req.body.ip_version)!="number" || (req.body.ip_version!==4 && req.body.ip_version!==6)))
		return api_resp.getJson({name: 'ip_version'}, api_resp.ACR_PARAM_ERROR, null, objModel, null, jsonResp => res.status(200).json(jsonResp));
		
	if (req.body.address===undefined) req.body.address=null;
	if (req.body.address!==null && ((typeof req.body.address)!="string" 
			|| (req.body.ip_version===4 && !isIp.v4(req.body.address))
			|| (req.body.ip_version===6 && !isIp.v6(req.body.address))))
		return api_resp.getJson({name: 'address'}, api_resp.ACR_PARAM_ERROR, null, objModel, null, jsonResp => res.status(200).json(jsonResp));

	if (req.body.netmask===undefined) req.body.netmask=null;
	if (req.body.netmask!==null && ((typeof req.body.netmask)!="string"
			|| (req.body.ip_version===4 && !isIp.v4(req.body.netmask))
			|| (req.body.ip_version===6 && !isIp.v6(req.body.netmask))))
		return api_resp.getJson({name: 'netmask'}, api_resp.ACR_PARAM_ERROR, null, objModel, null, jsonResp => res.status(200).json(jsonResp));
	

	if (req.body.diff_serv===undefined) req.body.diff_serv=null;
	if (req.body.diff_serv!==null && ((typeof req.body.diff_serv)!="number" || req.body.diff_serv<0 || req.body.diff_serv>255))
		return api_resp.getJson({name: 'diff_serv'}, api_resp.ACR_PARAM_ERROR, null, objModel, null, jsonResp => res.status(200).json(jsonResp));

			
	if (req.body.icmp_code===undefined) req.body.icmp_code=null;
	if (req.body.icmp_code!==null && ((typeof req.body.icmp_code)!="number" || req.body.icmp_code<-1 || req.body.icmp_code>255))
		return api_resp.getJson({name: 'icmp_code'}, api_resp.ACR_PARAM_ERROR, null, objModel, null, jsonResp => res.status(200).json(jsonResp));
	
	if (req.body.icmp_type===undefined) req.body.icmp_type=null;
	if (req.body.icmp_type!==null && ((typeof req.body.icmp_type)!="number" || req.body.icmp_type<-1 || req.body.icmp_type>255))
		return api_resp.getJson({name: 'icmp_type'}, api_resp.ACR_PARAM_ERROR, null, objModel, null, jsonResp => res.status(200).json(jsonResp));


	if (req.body.tcp_flags_mask===undefined) req.body.tcp_flags_mask=null;
	if (req.body.tcp_flags_mask!==null && ((typeof req.body.tcp_flags_mask)!="number" || req.body.tcp_flags_mask<0 || req.body.tcp_flags_mask>255))
		return api_resp.getJson({name: 'tcp_flags_mask'}, api_resp.ACR_PARAM_ERROR, null, objModel, null, jsonResp => res.status(200).json(jsonResp));

	if (req.body.tcp_flags_settings===undefined) req.body.tcp_flags_settings=null;
	if (req.body.tcp_flags_settings!==null && ((typeof req.body.tcp_flags_settings)!="number" || req.body.tcp_flags_settings<0 || req.body.tcp_flags_settings>255))
		return api_resp.getJson({name: 'tcp_flags_settings'}, api_resp.ACR_PARAM_ERROR, null, objModel, null, jsonResp => res.status(200).json(jsonResp));


	if (req.body.range_start===undefined) req.body.range_start=null;
	if (req.body.range_start!==null && ((typeof req.body.range_start)!="string"
			|| (req.body.ip_version===4 && !isIp.v4(req.body.range_start))
			|| (req.body.ip_version===6 && !isIp.v6(req.body.range_start))))
		return api_resp.getJson({name: 'range_start'}, api_resp.ACR_PARAM_ERROR, null, objModel, null, jsonResp => res.status(200).json(jsonResp));

	if (req.body.range_end===undefined) req.body.range_end=null;
	if (req.body.range_end!==null && ((typeof req.body.range_end)!="string" 
			|| (req.body.ip_version===4 && !isIp.v4(req.body.range_end))
			|| (req.body.ip_version===6 && !isIp.v6(req.body.range_end))))
		return api_resp.getJson({name: 'range_end'}, api_resp.ACR_PARAM_ERROR, null, objModel, null, jsonResp => res.status(200).json(jsonResp));
		
	
	if (req.body.source_port_start===undefined || req.body.source_port_start===null || req.body.source_port_start==='') req.body.source_port_start=0;
	if ((typeof req.body.source_port_start)!="number" || req.body.source_port_start<0 || req.body.source_port_start>65535)
		return api_resp.getJson({name: 'source_port_start'}, api_resp.ACR_PARAM_ERROR, null, objModel, null, jsonResp => res.status(200).json(jsonResp));

	if (req.body.source_port_end===undefined || req.body.source_port_end===null || req.body.source_port_end==='') req.body.source_port_end=0;
	if ((typeof req.body.source_port_end)!="number" || req.body.source_port_end<0 || req.body.source_port_end>65535)
		return api_resp.getJson({name: 'source_port_end'}, api_resp.ACR_PARAM_ERROR, null, objModel, null, jsonResp => res.status(200).json(jsonResp));
	
	if (req.body.destination_port_start===undefined || req.body.destination_port_start===null || req.body.destination_port_start==='') req.body.destination_port_start=0;
	if ((typeof req.body.destination_port_start)!="number" || req.body.destination_port_start<0 || req.body.destination_port_start>65535)
		return api_resp.getJson({name: 'destination_port_start'}, api_resp.ACR_PARAM_ERROR, null, objModel, null, jsonResp => res.status(200).json(jsonResp));

	if (req.body.destination_port_end===undefined || req.body.destination_port_end===null || req.body.destination_port_end==='') req.body.destination_port_end=0;
	if ((typeof req.body.destination_port_end)!="number" || req.body.destination_port_end<0 || req.body.destination_port_end>65535)
		return api_resp.getJson({name: 'destination_port_end'}, api_resp.ACR_PARAM_ERROR, null, objModel, null, jsonResp => res.status(200).json(jsonResp));

		
	if (req.body.options===undefined) req.body.options=null;	
	if (req.body.options!==null)
		return api_resp.getJson({name: 'options'}, api_resp.ACR_PARAM_ERROR, null, objModel, null, jsonResp => res.status(200).json(jsonResp));

	if (req.body.comment===undefined) req.body.comment=null;	
	if (req.body.comment!==null && ((typeof req.body.comment)!="string" || req.body.comment.length<1 || req.body.comment.length>255))
		return api_resp.getJson({name: 'comment'}, api_resp.ACR_PARAM_ERROR, null, objModel, null, jsonResp => res.status(200).json(jsonResp));

	// If we arrive here, then all the parameters are right.
	next();
};
