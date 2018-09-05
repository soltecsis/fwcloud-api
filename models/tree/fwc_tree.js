var db = require('../../db.js');
var asyncMod = require('async');


//create object
var fwc_treeModel = {};

//Export the object
module.exports = fwc_treeModel;



var logger = require('log4js').getLogger("app");

var tableModel = "fwc_tree";
//var Node = require("tree-node");
var Tree = require('easy-tree');
var fwc_tree_node = require("./fwc_tree_node.js");
var utilsModel = require("../../utils/utils.js");


//Get FLAT TREE by user
fwc_treeModel.getFwc_TreeUser = function (iduser, callback) {

	db.get(function (error, connection) {
		if (error)
			callback(error, null);

		var sql = 'SELECT * FROM ' + tableModel + ' WHERE  id_user=' + connection.escape(iduser) + ' ORDER BY id_parent,node_order';

		connection.query(sql, function (error, rows) {
			if (error)
				callback(error, null);
			else
				callback(null, rows);
		});
	});
};

//Get firewall node by folder
fwc_treeModel.getFwc_TreeUserFolder = function (iduser, fwcloud, foldertype, callback) {

	db.get(function (error, connection) {
		if (error)
			callback(error, null);


		var sql = 'SELECT T.*, P.order_mode FROM ' + tableModel + ' T' +
				' inner join fwcloud C on C.id=T.fwcloud ' +
				' INNER JOIN user__cloud U ON C.id=U.fwcloud ' +   
				' LEFT JOIN fwc_tree_node_types P on T.node_type=P.node_type' +
				' WHERE  T.fwcloud=' + connection.escape(fwcloud) + '  AND T.node_type=' + connection.escape(foldertype) + ' AND T.id_parent=0 ' +
				' AND U.id_user=' + connection.escape(iduser) + ' AND U.allow_access=1 ' +
				' ORDER BY T.id limit 1';
		logger.debug(sql);

		connection.query(sql, function (error, rows) {
			if (error) {
				logger.error(error);
				callback(error, null);
			} else
				callback(null, rows);
		});
	});
};

//Get firewall node ID
fwc_treeModel.getFwc_TreeId = function (iduser, fwcloud, id, callback) {

	db.get(function (error, connection) {
		if (error)
			callback(error, null);

		var sql = 'SELECT * FROM ' + tableModel + ' WHERE  fwcloud=' + connection.escape(fwcloud) + '  AND id=' + connection.escape(id);
		logger.debug(sql);
		connection.query(sql, function (error, rows) {
			if (error)
				callback(error, null);
			else
				callback(null, rows);
		});
	});
};


//Get COMPLETE TREE by user
fwc_treeModel.getFwc_TreeUserFull = function (iduser, fwcloud, idparent, tree, objStandard, objCloud, node_type,order_mode, filter_idfirewall, AllDone) {

	db.get(function (error, connection) {
		if (error)
			callback(error, null);

		//FALTA CONTROLAR EN QUE FWCLOUD ESTA EL USUARIO
		var sqlfwcloud = "";
		if (objStandard === '1' && objCloud === '0')
			sqlfwcloud = " AND (T.fwcloud is null OR (T.id_obj is null AND T.fwcloud=" + fwcloud + ")) ";   //Only Standard objects
		else if (objStandard === '0' && objCloud === '1')
			sqlfwcloud = " AND (T.fwcloud=" + fwcloud + " OR (T.id_obj is null AND T.fwcloud=" + fwcloud + ")) ";   //Only fwcloud objects
		else
			sqlfwcloud = " AND (T.fwcloud=" + fwcloud + " OR T.fwcloud is null OR (T.id_obj is null AND T.fwcloud=" + fwcloud + ")) ";   //ALL  objects


		//logger.debug("---> DENTRO de PADRE: " + idparent + "  NODE TYPE: " + node_type + "  ORDER_MODE: " + order_mode +  "  ID_OBJ: " + tree.id + "  NAME: " + tree.text);
		
		var sqlorder= " id";
		if (order_mode===2)
				sqlorder="name";
		
		

		//Get ALL CHILDREN NODES FROM idparent
		var sql = 'SELECT T.*, P.order_mode FROM ' + tableModel + ' T ' +
				' LEFT JOIN fwc_tree_node_types P on T.node_type=P.node_type' +
				' WHERE T.id_parent=' + connection.escape(idparent) + sqlfwcloud + ' ORDER BY ' + sqlorder;
		//logger.debug(sql);
		connection.query(sql, function (error, rows) {
			if (error)
				callback(error, null);
			else {

				if (rows) {

					asyncMod.forEachSeries(rows,
							function (row, callback) {
								hasLines(row.id, function (t) {
									//logger.debug(row);
									var tree_node = new fwc_tree_node(row);
									var add_node = true;
									if (!t) {
										//Añadimos nodo hijo

										//logger.debug("--->  AÑADIENDO NODO FINAL " + row.id + " con PADRE: " + idparent);

										tree.append([], tree_node);

										callback();
									} else {
										//dig(row.tree_id, treeArray, callback);
										//FIREWALL CONTROL ACCESS
										if (row.node_type === 'FW') {
											var idfirewall = row.id_obj;
											logger.debug("DETECTED FIREWALL NODE: " + row.id + "   FIREWALL: " + idfirewall + " - " + row.name);
											utilsModel.checkFirewallAccessTree(iduser, fwcloud, idfirewall).
													then(resp => {
														add_node = resp;
														//CHECK FILTER FIREWALL
														if (filter_idfirewall != '' && filter_idfirewall != idfirewall)
															add_node = false;

														if (add_node) {
															var treeP = new Tree(tree_node);
															tree.append([], treeP);
															fwc_treeModel.getFwc_TreeUserFull(iduser, fwcloud, row.id, treeP, objStandard, objCloud, row.node_type,row.order_mode, filter_idfirewall, callback);
														} else {
															logger.debug("---> <<<<DESCARTING FIREWALL NODE>>>" + row.id);
															callback();
														}
													});

										} else {
											//logger.debug("--->  AÑADIENDO NODO PADRE " + row.id + " con PADRE: " + idparent);
											//logger.debug("-------> LLAMANDO A HIJO: " + row.id + "   Node Type: " + row.node_type);

											var treeP = new Tree(tree_node);
											tree.append([], treeP);
											fwc_treeModel.getFwc_TreeUserFull(iduser, fwcloud, row.id, treeP, objStandard, objCloud, row.node_type,row.order_mode, filter_idfirewall, callback);
										}
									}
								});
							},
							function (err) {
								if (err)
									AllDone(err, tree);
								else
									AllDone(null, tree);
							});
				} else
					AllDone(null, tree);
			}
		});

	});
};


//REMOVE FULL TREE FROM PARENT NODE
fwc_treeModel.deleteFwc_TreeFullNode = function (data) {
	return new Promise((resolve, reject) => {
		db.get(function (error, connection) {
			if (error)
				reject(error);

			var sql = 'SELECT * FROM ' + tableModel + ' WHERE fwcloud = ' + connection.escape(data.fwcloud) + ' AND id_parent=' + connection.escape(data.id);
			logger.debug(sql);
			connection.query(sql, function (error, rows) {
				if (error)
					reject(error);
				else {
					if (rows.length > 0) {
						logger.debug("-----> DELETING NODES UNDER PARENT: " + data.id);
						//Bucle por interfaces
						Promise.all(rows.map(fwc_treeModel.deleteFwc_TreeFullNode))
								.then(resp => {
									//logger.debug("----------- FIN PROMISES ALL NODE PADRE: ", data.id);
									fwc_treeModel.deleteFwc_Tree_node(data.fwcloud, data.id)
											.then(resp => {
												//logger.debug("DELETED NODE: ", data.id);
												resolve();
											})
											.catch(e => reject(e));
								})
								.catch(e => {
									reject(e);
								});
					} else {
						logger.debug("NODE FINAL: TO DELETE NODE: ", data.id);
						resolve();
						//Node whithout children, delete node
						fwc_treeModel.deleteFwc_Tree_node(data.fwcloud, data.id)
								.then(resp => {
									logger.debug("DELETED NODE: ", data.id);
									resolve();
								})
								.catch(e => reject(e));
					}

				}
			});
		});
	});
};

//DELETE NODE
fwc_treeModel.deleteFwc_Tree_node = function (fwcloud, id) {
	return new Promise((resolve, reject) => {
		db.get(function (error, connection) {
			if (error)
				reject(error);
			var sql = 'DELETE FROM ' + tableModel + ' WHERE fwcloud = ' + connection.escape(fwcloud) + ' AND id = ' + connection.escape(id);
			connection.query(sql, function (error, result) {
				if (error) {
					logger.debug(sql);
					logger.debug(error);
					reject(error);
				} else {
					resolve({"result": true, "msg": "deleted"});
				}
			});
		});
	});
};

//Verify node info.
fwc_treeModel.verifyNodeInfo = (id, fwcloud, id_obj) => {
	return new Promise((resolve, reject) => {
		db.get((error, connection) => {
			if (error) return reject(error);
			var sql = 'select fwcloud,id_obj FROM '+tableModel+' WHERE id='+connection.escape(id);
			connection.query(sql, (error, result) => {
				if (error) return reject(error);

				(result.length===1 && fwcloud===result[0].fwcloud && id_obj===result[0].id_obj) ? resolve(true) : resolve(false);
			});
		});
	});
};

//UPDATE ID_OBJ FOR FIREWALL CLUSTER FULL TREE FROM PARENT NODE
fwc_treeModel.updateIDOBJFwc_TreeFullNode = function (data) {
	return new Promise((resolve, reject) => {
		db.get(function (error, connection) {
			if (error)
				reject(error);

			var sql = 'SELECT ' + connection.escape(data.OLDFW) +' as OLDFW, ' + connection.escape(data.NEWFW) + ' as NEWFW, T.* ' + 
					' FROM ' + tableModel + ' T ' + 
					' WHERE fwcloud = ' + connection.escape(data.fwcloud) + ' AND id_parent=' + connection.escape(data.id) + 
					' AND id_obj=' + connection.escape(data.OLDFW);
			logger.debug(sql);
			connection.query(sql, function (error, rows) {
				if (error)
					reject(error);
				else {
					if (rows.length > 0) {
						logger.debug("-----> UPDATING NODES UNDER PARENT: " + data.id);
						//Bucle por interfaces
						Promise.all(rows.map(fwc_treeModel.updateIDOBJFwc_TreeFullNode))
								.then(resp => {
									//logger.debug("----------- FIN PROMISES ALL NODE PADRE: ", data.id);
									fwc_treeModel.updateIDOBJFwc_Tree_node(data.fwcloud, data.id,data.NEWFW )
											.then(resp => {
												//logger.debug("UPDATED NODE: ", data.id);
												resolve();
											})
											.catch(e => reject(e));
								})
								.catch(e => {
									reject(e);
								});
					} else {
						logger.debug("NODE FINAL: TO UPDATE NODE: ", data.id);
						resolve();
						//Node whithout children, delete node
						fwc_treeModel.updateIDOBJFwc_Tree_node(data.fwcloud, data.id,data.NEWFW)
								.then(resp => {
									logger.debug("UPDATED NODE: ", data.id);
									resolve();
								})
								.catch(e => reject(e));
					}

				}
			});
		});
	});
};


//UPDATE NODE
fwc_treeModel.updateIDOBJFwc_Tree_node = function (fwcloud, id, idNew) {
	return new Promise((resolve, reject) => {
		db.get(function (error, connection) {
			if (error)
				reject(error);
			var sql = 'UPDATE ' + tableModel + ' SET id_obj= ' + connection.escape(idNew)  + ' WHERE node_type<>"CL" AND node_type<>"FW"  AND fwcloud = ' + connection.escape(fwcloud) + ' AND id = ' + connection.escape(id);
			logger.debug("SQL UPDATE NODE: ", sql);
			connection.query(sql, function (error, result) {
				if (error) {
					logger.debug(sql);
					logger.debug(error);
					reject(error);
				} else {
					resolve({"result": true});
				}
			});
		});
	});
};

//Get TREE by User and Parent
fwc_treeModel.getFwc_TreeUserParent = function (fwcloud, idparent, callback) {
	db.get(function (error, connection) {
		if (error)
			callback(error, null);

		var sql = 'SELECT * FROM ' + tableModel + ' WHERE fwcloud = ' + connection.escape(fwcloud) + ' AND id_parent=' + connection.escape(idparent);
		connection.query(sql, function (error, row) {
			if (error)
				callback(error, null);
			else
				callback(null, row);
		});
	});
};

//Get NODES by name 
fwc_treeModel.getFwc_TreeName = function (fwcloud, name, callback) {
	db.get(function (error, connection) {
		if (error)
			callback(error, null);
		var namesql = '%' + name + '%';

		var sql = 'SELECT * FROM ' + tableModel + ' WHERE fwcloud = ' + connection.escape(fwcloud) + " AND name like " + connection.escape(namesql);

		connection.query(sql, function (error, row) {
			if (error)
				callback(error, null);
			else
				callback(null, row);
		});
	});
};

fwc_treeModel.createAllTreeCloud= function(iduser, fwcloud, AllDone){
   logger.debug("------------- CREATING FWCTREE INIT");
	fwc_treeModel.insertFwc_Tree_init(fwcloud, function (error, data)
	{
		//If saved fwc-tree Get data
		if (data && data.result)
		{
			logger.debug("------------- CREATING FWCTREE FIREWALLS");
			fwc_treeModel.insertFwc_Tree_firewalls(fwcloud, "FDF", '', function (error, data)
			{
				//If saved fwc-tree Get data
				if (data && data.result)
				{
					logger.debug("------------- CREATING FWCTREE OBJECTS");
					fwc_treeModel.insertFwc_Tree_objects(fwcloud, "FDO", function (error, data)
					{
						//If saved fwc-tree Get data
						if (data && data.result)
						{
							logger.debug("------------- CREATING FWCTREE SERVICES");
							fwc_treeModel.insertFwc_Tree_objects(fwcloud, "FDS", function (error, data)
							{
								//If saved fwc-tree Get data
								if (data && data.result)
								{
								   
									 AllDone(null, {"result": true});
								} else
								{
									AllDone(null, {"result": false});
								}
							});
						} else
						{
							AllDone(null, {"result": false});
						}
					});
				} else
				{
					AllDone(null, {"result": false});
				}
			});
		}
		else{
			AllDone(null, {"result": false});
		}
	});
	
};


//Init TREE  from cloud
fwc_treeModel.insertFwc_Tree_init = function (fwcloud, AllDone) {
	db.get(function (error, connection) {
		if (error)
			callback(error, null);

		//QUITAR PARA MERMITIR VARIOS CLOUD
		//DELETE PREVIUS DATA
		sqldelete = "delete from fwc_tree where fwcloud=" +  connection.escape(fwcloud) ;
		//sqldelete = "truncate table fwc_tree ";
		connection.query(sqldelete, function (error, result) {
			if (error) {
				AllDone(error, null);
			} else {
				//INSERT NODE FIREWALLS
				sqlinsert = "INSERT INTO " + tableModel + "( name, comment, id_parent, node_order,node_level, node_type, expanded, subfolders, id_obj,obj_type,fwcloud,fwcloud_tree) " +
						" VALUES (" + "'FIREWALLS','',0,1,1,'FDF',0,0,null,null," + connection.escape(fwcloud) + "," + connection.escape(fwcloud) + ")";
				logger.debug(sqlinsert);
				connection.query(sqlinsert, function (error, result) {
					if (error)
						logger.debug("ERROR FDF : " + error);
				});
				//INSERT NODE OBJECTS
				sqlinsert = "INSERT INTO " + tableModel + "( name, comment, id_parent, node_order,node_level, node_type, expanded, subfolders, id_obj,obj_type,fwcloud,fwcloud_tree) " +
						" VALUES (" + "'OBJECTS','',0,2,1,'FDO',0,0,null,null," + connection.escape(fwcloud) + "," + connection.escape(fwcloud) + ")";
				connection.query(sqlinsert, function (error, result) {
					if (error)
						logger.debug("ERROR FDO : " + error);
					else {
						var parent_id = result.insertId;
						sqlinsert = "INSERT INTO " + tableModel + "( name, comment, id_parent, node_order,node_level, node_type, expanded, subfolders, id_obj,obj_type,fwcloud,fwcloud_tree) " +
								" VALUES (" + "'Addresses',''," + parent_id + ",1,2,'OIA',0,0,null,5," + connection.escape(fwcloud) + "," + connection.escape(fwcloud) + ")";
						connection.query(sqlinsert, function (error, result) {
							if (error)
								logger.debug("ERROR OIA : " + error);
						});
						sqlinsert = "INSERT INTO " + tableModel + "( name, comment, id_parent, node_order,node_level, node_type, expanded, subfolders, id_obj,obj_type,fwcloud,fwcloud_tree) " +
								" VALUES (" + "'Address Ranges',''," + parent_id + ",2,2,'OIR',0,0,null,6," + connection.escape(fwcloud) + "," + connection.escape(fwcloud) + ")";
						connection.query(sqlinsert, function (error, result) {
							if (error)
								logger.debug("ERROR OIR : " + error);
						});
						sqlinsert = "INSERT INTO " + tableModel + "( name, comment, id_parent, node_order,node_level, node_type, expanded, subfolders, id_obj,obj_type,fwcloud,fwcloud_tree) " +
								" VALUES (" + "'Networks',''," + parent_id + ",3,2,'OIN',0,0,null,7," + connection.escape(fwcloud) + "," + connection.escape(fwcloud) + ")";
						connection.query(sqlinsert, function (error, result) {
							if (error)
								logger.debug("ERROR OIN : " + error);
						});
						sqlinsert = "INSERT INTO " + tableModel + "( name, comment, id_parent, node_order,node_level, node_type, expanded, subfolders, id_obj,obj_type,fwcloud,fwcloud_tree) " +
								" VALUES (" + "'Hosts',''," + parent_id + ",4,2,'OIH',0,0,null,8," + connection.escape(fwcloud) + "," + connection.escape(fwcloud) + ")";
						connection.query(sqlinsert, function (error, result) {
							if (error)
								logger.debug("ERROR OIH : " + error);
						});
						sqlinsert = "INSERT INTO " + tableModel + "( name, comment, id_parent, node_order,node_level, node_type, expanded, subfolders, id_obj,obj_type,fwcloud,fwcloud_tree) " +
								" VALUES (" + "'Groups',''," + parent_id + ",5,2,'OIG',0,0,null,20," + connection.escape(fwcloud) + "," + connection.escape(fwcloud) + ")";
						connection.query(sqlinsert, function (error, result) {
							if (error)
								logger.debug("ERROR OIG : " + error);
						});
					}
				});
				//INSERT NODE SERVICES
				sqlinsert = "INSERT INTO " + tableModel + "( name, comment, id_parent, node_order,node_level, node_type, expanded, subfolders, id_obj,obj_type,fwcloud,fwcloud_tree) " +
						" VALUES (" + "'SERVICES','',0,3,1,'FDS',0,0,null,null," + connection.escape(fwcloud) + "," + connection.escape(fwcloud) + ")";
				connection.query(sqlinsert, function (error, result) {
					if (error)
						logger.debug("ERROR FDS : " + error);
					else {
						var parent_id = result.insertId;
						sqlinsert = "INSERT INTO " + tableModel + "( name, comment, id_parent, node_order,node_level, node_type, expanded, subfolders, id_obj,obj_type,fwcloud,fwcloud_tree) " +
								" VALUES (" + "'IP',''," + parent_id + ",1,2,'SOI',0,0,null,1," + connection.escape(fwcloud) + "," + connection.escape(fwcloud) + ")";
						connection.query(sqlinsert, function (error, result) {
							if (error)
								logger.debug("ERROR SOI : " + error);
						});
						sqlinsert = "INSERT INTO " + tableModel + "( name, comment, id_parent, node_order,node_level, node_type, expanded, subfolders, id_obj,obj_type,fwcloud,fwcloud_tree) " +
								" VALUES (" + "'TCP',''," + parent_id + ",2,2,'SOT',0,0,null,2," + connection.escape(fwcloud) + "," + connection.escape(fwcloud) + ")";
						connection.query(sqlinsert, function (error, result) {
							if (error)
								logger.debug("ERROR SOT : " + error);
						});
						sqlinsert = "INSERT INTO " + tableModel + "( name, comment, id_parent, node_order,node_level, node_type, expanded, subfolders, id_obj,obj_type,fwcloud,fwcloud_tree) " +
								" VALUES (" + "'ICMP',''," + parent_id + ",3,2,'SOM',0,0,null,3," + connection.escape(fwcloud) + "," + connection.escape(fwcloud) + ")";
						connection.query(sqlinsert, function (error, result) {
							if (error)
								logger.debug("ERROR SOM : " + error);
						});
						sqlinsert = "INSERT INTO " + tableModel + "( name, comment, id_parent, node_order,node_level, node_type, expanded, subfolders, id_obj,obj_type,fwcloud,fwcloud_tree) " +
								" VALUES (" + "'UDP',''," + parent_id + ",4,2,'SOU',0,0,null,4," + connection.escape(fwcloud) + "," + connection.escape(fwcloud) + ")";
						connection.query(sqlinsert, function (error, result) {
							if (error)
								logger.debug("ERROR SOU : " + error);
						});
						sqlinsert = "INSERT INTO " + tableModel + "( name, comment, id_parent, node_order,node_level, node_type, expanded, subfolders, id_obj,obj_type,fwcloud,fwcloud_tree) " +
								" VALUES (" + "'Groups',''," + parent_id + ",5,2,'SOG',0,0,null,21," + connection.escape(fwcloud) + "," + connection.escape(fwcloud) + ")";
						connection.query(sqlinsert, function (error, result) {
							if (error)
								logger.debug("ERROR SOG : " + error);
						});
					}
				});
				//INSERT NODE TIME
				sqlinsert = "INSERT INTO " + tableModel + "( name, comment, id_parent, node_order,node_level, node_type, expanded, subfolders, id_obj,obj_type,fwcloud,fwcloud_tree) " +
						" VALUES (" + "'TIME','',0,4,1,'FDT',0,0,null,null," + connection.escape(fwcloud) + "," + connection.escape(fwcloud) + ")";
				connection.query(sqlinsert, function (error, result) {
					if (error)
						logger.debug("ERROR FDT : " + error);
				});
				AllDone(null, {"result": true});
			}
		});

	});
};


//Add new TREE FIREWALLS from cloud
fwc_treeModel.insertFwc_Tree_firewalls = function (fwcloud, folder, idfirewall,AllDone) {
	db.get(function (error, connection) {
		if (error)
			callback(error, null);

		//Select Parent Node by type   
		sql = 'SELECT T1.* FROM ' + tableModel + ' T1  where T1.node_type=' + connection.escape(folder) + ' and T1.id_parent=0 AND T1.fwcloud_tree=' + connection.escape(fwcloud) + ' order by T1.node_order';
		//logger.debug(sql);
		connection.query(sql, function (error, rows) {
			if (error) {
				AllDone(error, null);
			} else {
				//For each node Select Objects by  type
				if (rows) {
					asyncMod.forEachSeries(rows, function (row, callback) {
						//logger.debug(row);
						//logger.debug("---> DENTRO de NODO: " + row.name + " - " + row.node_type);
						var tree_node = new fwc_tree_node(row);
						//Añadimos nodos FIREWALL del CLOUD
						var sqlFirewall="";
						if (idfirewall!=='')
								sqlFirewall=" AND F.id= " +  connection.escape(idfirewall)  ;
						sqlnodes = 'SELECT  F.id,F.name,F.fwcloud, F.comment FROM firewall F inner join fwcloud C on C.id=F.fwcloud WHERE C.id=' + connection.escape(fwcloud) + sqlFirewall;
						logger.debug(sqlnodes);
						connection.query(sqlnodes, function (error, rowsnodes) {
							if (error)
								callback(error, null);
							else {
								var i = 0;
								if (rowsnodes) {
									asyncMod.forEachSeries(rowsnodes, function (rnode, callback2) {
										var idfirewall = rnode.id;
										i++;
										//Insertamos nodos Firewall
										sqlinsert = 'INSERT INTO ' + tableModel +
												'( name, comment, id_parent, node_order,node_level, node_type, expanded, `subfolders`, id_obj,obj_type,fwcloud, fwcloud_tree) ' +
												' VALUES (' +
												connection.escape(rnode.name) + ',' +
												connection.escape(rnode.comment) + ',' + connection.escape(row.id) + ',' +
												i + ',' + (row.node_level + 1) + ',"FW",' +
												'0,0,' + connection.escape(rnode.id) + ',0,' +
												connection.escape(rnode.fwcloud) + "," + connection.escape(rnode.fwcloud)  + ")";
										//logger.debug(sqlinsert);
										var parent_firewall;

										connection.query(sqlinsert, function (error, result) {
											if (error) {
												logger.debug("ERROR FIREWALL INSERT : " + rnode.id + " - " + rnode.name + " -> " + error);
											} else {
												logger.debug("INSERT FIREWALL OK NODE: " + rnode.id + " - " + rnode.name + "  --> FWCTREE: " + result.insertId);
												parent_firewall = result.insertId;

												var parent_FP = 0;

												//Insertamos nodo PADRE FILTER POLICIES
												sqlinsert = 'INSERT INTO ' + tableModel + '( name, comment, id_parent, node_order,node_level, node_type, expanded, subfolders, id_obj,obj_type,fwcloud, fwcloud_tree) ' +
														' VALUES (' + '"FILTER POLICIES","",' + parent_firewall + ',1,' + (row.node_level + 2) + ',"FP",0,0,' + connection.escape(idfirewall) + ',null,' + connection.escape(rnode.fwcloud) + "," + connection.escape(rnode.fwcloud)  + ")";
												logger.debug(sqlinsert);
												connection.query(sqlinsert, function (error2, result2) {
													if (error2) {
														logger.debug("ERROR FP : " + error2);
													} else {
														parent_FP = result2.insertId;
														logger.debug("INSERT FILTER POLICIES OK NODE: " + result2.insertId);
														//Insertamos nodo POLICY IN
														sqlinsert = 'INSERT INTO ' + tableModel + '( name, comment, id_parent, node_order,node_level, node_type, expanded, subfolders, id_obj,obj_type,fwcloud,fwcloud_tree, show_action) ' +
																' VALUES (' + '"INPUT","",' + parent_FP + ',1,' + (row.node_level + 3) + ',"PI",0,0,' + connection.escape(idfirewall) + ',1,' + connection.escape(rnode.fwcloud) + "," + connection.escape(rnode.fwcloud)  + ",1)";
														logger.debug(sqlinsert);
														connection.query(sqlinsert, function (error, result) {
															if (error)
																logger.debug("ERROR PI : " + error);
														});
														//Insertamos nodo POLICY OUT
														sqlinsert = 'INSERT INTO ' + tableModel + '( name, comment, id_parent, node_order,node_level, node_type, expanded, subfolders, id_obj,obj_type,fwcloud,fwcloud_tree, show_action) ' +
																' VALUES (' + '"OUTPUT","",' + parent_FP + ',2,' + (row.node_level + 3) + ',"PO",0,0,' + connection.escape(idfirewall) + ',2,' + connection.escape(rnode.fwcloud) + "," + connection.escape(rnode.fwcloud)  + ",1)";
														logger.debug(sqlinsert);
														connection.query(sqlinsert, function (error, result) {
															if (error)
																logger.debug("ERROR PO : " + error);
														});
														//Insertamos nodo POLICY FORWARD
														sqlinsert = 'INSERT INTO ' + tableModel + '( name, comment, id_parent, node_order,node_level, node_type, expanded, subfolders, id_obj,obj_type,fwcloud,fwcloud_tree, show_action) ' +
																' VALUES (' + '"FORWARD","",' + parent_FP + ',3,' + (row.node_level + 3) + ',"PF",0,0,' + connection.escape(idfirewall) + ',3,' + connection.escape(rnode.fwcloud) + "," + connection.escape(rnode.fwcloud)  + ",1)";
														logger.debug(sqlinsert);
														connection.query(sqlinsert, function (error, result) {
															if (error)
																logger.debug("ERROR PF: " + error);
														});

													}
												});

												var parent_NAT;

												//Insertamos nodo PADRE NAT
												sqlinsert = 'INSERT INTO ' + tableModel + '( name, comment, id_parent, node_order,node_level, node_type, expanded, subfolders, id_obj,obj_type,fwcloud, fwcloud_tree) ' +
														' VALUES (' + '"NAT","",' + parent_firewall + ',2,' + (row.node_level + 2) + ',"NT",0,0,' + connection.escape(idfirewall) + ',null,' + connection.escape(rnode.fwcloud) + "," + connection.escape(rnode.fwcloud)  + ")";
												logger.debug(sqlinsert);
												connection.query(sqlinsert, function (error, result) {
													if (error)
														logger.debug("ERROR NAT : " + error);
													else {
														parent_NAT = result.insertId;
														//Insertamos nodo SNAT
														sqlinsert = 'INSERT INTO ' + tableModel + '( name, comment, id_parent, node_order,node_level, node_type, expanded, subfolders, id_obj,obj_type,fwcloud,fwcloud_tree, show_action) ' +
																' VALUES (' + '"SNAT","",' + parent_NAT + ',1,' + (row.node_level + 3) + ',"NTS",0,0,' + connection.escape(idfirewall) + ',4,' + connection.escape(rnode.fwcloud) + "," + connection.escape(rnode.fwcloud)  + ",0)";
														logger.debug(sqlinsert);
														connection.query(sqlinsert, function (error, result) {
															if (error)
																logger.debug("ERROR SNAT: " + error);
														});
														//Insertamos nodo DNAT
														sqlinsert = 'INSERT INTO ' + tableModel + '( name, comment, id_parent, node_order,node_level, node_type, expanded, subfolders, id_obj,obj_type,fwcloud,fwcloud_tree, show_action) ' +
																' VALUES (' + '"DNAT","",' + parent_NAT + ',2,' + (row.node_level + 3) + ',"NTD",0,0,' + connection.escape(idfirewall) + ',5,' + connection.escape(rnode.fwcloud) + "," + connection.escape(rnode.fwcloud)  + ",0)";
														logger.debug(sqlinsert);
														connection.query(sqlinsert, function (error, result) {
															if (error)
																logger.debug("ERROR DNAT: " + error);
														});
													}
												});

												//Insertamos nodo ROUTING
												sqlinsert = 'INSERT INTO ' + tableModel + '( name, comment, id_parent, node_order,node_level, node_type, expanded, subfolders, id_obj,obj_type,fwcloud,fwcloud_tree, show_action) ' +
														' VALUES (' + '"Routing","",' + parent_firewall + ',3,' + (row.node_level + 2) + ',"RR",0,0,' + connection.escape(idfirewall) + ',6,' + connection.escape(rnode.fwcloud) + "," + connection.escape(rnode.fwcloud)  + ",1)";
												connection.query(sqlinsert, function (error, result) {
													if (error)
														logger.debug("ERROR RR : " + error);
												});

												var nodeInterfaces;
												//Insertamos nodo INTERFACES FIREWALL
												sqlinsert = 'INSERT INTO ' + tableModel + '( name, comment, id_parent, node_order,node_level, node_type, expanded, subfolders, id_obj,obj_type,fwcloud, fwcloud_tree) ' +
														' VALUES (' + '"Interfaces","",' + parent_firewall + ',4,' + (row.node_level + 2) + ',"FDI",0,0,' + connection.escape(idfirewall) + ',10,' + connection.escape(rnode.fwcloud) + "," + connection.escape(rnode.fwcloud)  + ")";
												connection.query(sqlinsert, function (error, result) {
													if (error)
														logger.debug("ERROR FDI: " + error);
													else
														nodeInterfaces = result.insertId;
												});


												//Insertamos nodos hijos Interface
												sqlInt = 'SELECT  id,name,labelName FROM interface where interface_type=10 AND  firewall=' + connection.escape(idfirewall);
												connection.query(sqlInt, function (error, rowsnodesInt) {
													if (error) {
														logger.debug("Error Select interface");
														callback2(error, null);
													} else {
														var j = 0;
														if (rowsnodesInt) {
															//logger.debug("INTERFACES: " + rowsnodesInt.length);
															asyncMod.forEachSeries(rowsnodesInt, function (rnodeInt, callback3) {
																j++;
																//Insertamos nodos Interfaces
																sqlinsert = 'INSERT INTO ' + tableModel +
																		'( name, comment, id_parent, node_order,node_level, node_type, expanded, `subfolders`, id_obj,obj_type,fwcloud, fwcloud_tree) ' +
																		' VALUES (' +
																		connection.escape(rnodeInt.name) + ',' +
																		connection.escape(rnodeInt.comment) + ',' + connection.escape(nodeInterfaces) + ',' +
																		j + ',' + (row.node_level + 3) + ',"IFF",' +
																		'0,0,' + connection.escape(rnodeInt.id) + ',10,' +
																		connection.escape(rnode.fwcloud) + "," + connection.escape(rnode.fwcloud)  + ")";

																connection.query(sqlinsert, function (error, result) {
																	var idinterface;
																	if (error) {
																		logger.debug("ERROR INTERFACE INSERT : " + rnodeInt.id + " - " + rnodeInt.name + " -> " + error);
																	} else {
																		//logger.debug("INSERT INTERFACE OK NODE: " + rnodeInt.id + " - " + rnodeInt.name);
																		idinterface = result.insertId;
																	}
																	//Insertamos objetos IP de Interface
																	//Insertamos nodos Interface
																	sqlnodesIP = 'SELECT  O.id,O.name,O.type,O.fwcloud, O.comment, T.node_type FROM ipobj O inner join fwc_tree_node_types T on  T.obj_type=O.type where O.interface=' + connection.escape(rnodeInt.id);
																	//logger.debug(sqlnodesIP);
																	connection.query(sqlnodesIP, function (error, rowsnodesIP) {
																		if (error) {
																			logger.debug(error);
																		} else {
																			var k = 0;
																			if (rowsnodesIP) {
																				//logger.debug("OBJS IP: " + rowsnodesIP.length);
																				asyncMod.forEachSeries(rowsnodesIP, function (rnodeIP, callback4) {
																					k++;
																					//Insertamos nodos IP
																					sqlinsert = 'INSERT INTO ' + tableModel +
																							'( name, comment, id_parent, node_order,node_level, node_type, expanded, `subfolders`, id_obj,obj_type,fwcloud, fwcloud_tree) ' +
																							' VALUES (' +
																							connection.escape(rnodeIP.name) + ',' +
																							connection.escape(rnodeIP.comment) + ',' + connection.escape(idinterface) + ',' +
																							k + ',' + (row.node_level + 4) + ',' + connection.escape(rnodeIP.node_type) + ',' +
																							'0,0,' + connection.escape(rnodeIP.id) + ',5,' +
																							connection.escape(rnode.fwcloud) + "," + connection.escape(rnode.fwcloud)  + ")";
																					connection.query(sqlinsert, function (error, result) {
																						if (error) {
																							logger.debug("ERROR IP OBJECT INSERT : " + rnodeIP.id + " - " + rnodeIP.name + " -> " + error);
																						} else {
																							//logger.debug("INSERT IPOBJ OK NODE: " + rnodeIP.id + " - " + rnodeIP.name);
																						}
																					});
																					callback4();
																				}
																				);
																			}

																		}
																	});
																});
																callback3();
															}
															);
														}

													}
													
												});



											}

										});
										callback2();
									}
									);
								}
							}
						});
						callback();
					},
							function (err) {
								if (err)
									AllDone(err, null);
								else
									AllDone(null, {"result": true});
							});
				} else
					AllDone(null, {"result": true});
			}
		});

	});

};

function update_cluster_structure(fwcloud,cluster,firewall,connection) {
	var idfwcloud = connection.escape(fwcloud);
	var idcluster = connection.escape(cluster);
	var idfirewall = connection.escape(firewall);
	
	//Update Cluster policy folders with Master id firewall                                                    
	var sql1 = 'UPDATE fwc_tree T ' +
		'INNER JOIN fwc_tree P ON P.id = T.id_parent ' +
		'AND P.node_type = "CL" AND P.id_obj=' + idcluster + ' ' +
		'SET T.id_obj=' + idfirewall;
	connection.query(sql1, (error, result) => {
		if (error) logger.debug("ERROR: "+error+" ("+sql1+")");
	});

	sql1 = 'UPDATE fwc_tree T ' +
		' inner join fwc_tree P1 on P1.id=T.id_parent ' +
		' inner join fwc_tree P2 on P2.id=P1.id_parent and P2.node_type="CL" ' +
		' AND P2.id_obj=' + idcluster +
		' SET T.id_obj=' + idfirewall +
		' WHERE T.node_type<>"FW"';
	connection.query(sql1, (error, result) => {
		if (error) {
			logger.debug("ERROR: "+error+" ("+sql1+")");
			return;
		}

		// Next we have to create the nodes into the interfaces node of the tree.
		sql1 = 'select id,node_level from fwc_tree where id_obj='+idfirewall+' and node_type="FDI" and fwcloud='+idfwcloud;
		connection.query(sql1, (error, result) => {
			if (result.length != 1) return;

			var nodeInterfaces = connection.escape(result[0].id);
			var node_level = connection.escape(result[0].node_level);
																
			//Insertamos nodos hijos Interface
			sqlInt = 'SELECT id,name,labelName FROM interface where interface_type=10 AND firewall='+idfirewall;
			connection.query(sqlInt, function (error, rowsnodesInt) {
				if (error) {
					logger.debug("Error Select interface");
					callback(error, null);
				} else {
					var j = 0;
					if (rowsnodesInt) {
						//logger.debug("INTERFACES: " + rowsnodesInt.length);
						asyncMod.forEachSeries(rowsnodesInt, function (rnodeInt, callback3) {
							j++;
							//Insertamos nodos Interfaces
							sqlinsert = 'INSERT INTO ' + tableModel +
									'( name, comment, id_parent, node_order,node_level, node_type, expanded, `subfolders`, id_obj,obj_type,fwcloud, fwcloud_tree) ' +
									' VALUES (' +
									connection.escape(rnodeInt.name) + ',' +
									connection.escape(rnodeInt.comment) + ',' + nodeInterfaces + ',' +
									j + ',' + (node_level + 1) + ',"IFF",' +
									'0,0,' + connection.escape(rnodeInt.id) + ',10,' +
									idfwcloud + "," + idfwcloud + ")";

							connection.query(sqlinsert, function (error, result) {
								var idinterface;
								if (error) {
									logger.debug("ERROR INTERFACE INSERT : " + rnodeInt.id + " - " + rnodeInt.name + " -> " + error);
								} else {
									//logger.debug("INSERT INTERFACE OK NODE: " + rnodeInt.id + " - " + rnodeInt.name);
									idinterface = result.insertId;
								}
								//Insertamos objetos IP de Interface
								//Insertamos nodos Interface
								sqlnodesIP = 'SELECT O.id,O.name,O.type,O.fwcloud,O.comment,T.node_type ' +
									'FROM ipobj O inner join fwc_tree_node_types T on  T.obj_type=O.type ' +
									'where O.interface=' + connection.escape(rnodeInt.id);
								//logger.debug(sqlnodesIP);
								connection.query(sqlnodesIP, function (error, rowsnodesIP) {
									if (error) {
										logger.debug(error);
									} else {
										var k = 0;
										if (rowsnodesIP) {
											//logger.debug("OBJS IP: " + rowsnodesIP.length);
											asyncMod.forEachSeries(rowsnodesIP, function (rnodeIP, callback4) {
												k++;
												//Insertamos nodos IP
												sqlinsert = 'INSERT INTO ' + tableModel +
														'( name, comment, id_parent, node_order,node_level, node_type, expanded, `subfolders`, id_obj,obj_type,fwcloud, fwcloud_tree) ' +
														' VALUES (' +
														connection.escape(rnodeIP.name) + ',' +
														connection.escape(rnodeIP.comment) + ',' + connection.escape(idinterface) + ',' +
														k + ',' + (node_level + 2) + ',' + connection.escape(rnodeIP.node_type) + ',' +
														'0,0,' + connection.escape(rnodeIP.id) + ',5,' +
														idfwcloud + "," + idfwcloud + ")";
												connection.query(sqlinsert, function (error, result) {
													if (error) {
														logger.debug("ERROR IP OBJECT INSERT : " + rnodeIP.id + " - " + rnodeIP.name + " -> " + error);
													} else {
														//logger.debug("INSERT IPOBJ OK NODE: " + rnodeIP.id + " - " + rnodeIP.name);
													}
												});
												callback4();
											}
											);
										}
									}	
								});
							});
							callback3();
						});
					}
				}
			});
		});
	});
}


//Add new TREE FIREWALL for a New Firewall
fwc_treeModel.insertFwc_Tree_New_firewall = function (fwcloud, idfirewall, idcluster, fwmaster, AllDone) {
	db.get(function (error, connection) {
		if (error)
			AllDone(error, null);

		var folder = "FDF";
		if (idcluster !== null) {
			//Select node NODES root for firewalls cluster
			folder = "FCF";
			sql = 'SELECT T1.* FROM ' + tableModel + ' T1  where T1.node_type=' + connection.escape(folder) + 
					' AND (T1.id_obj=(select id from firewall where cluster=' + connection.escape(idcluster) + ' and fwmaster=1 and fwcloud=' + connection.escape(fwcloud) + ') OR T1.id_obj=' + connection.escape(idcluster) + ')  ' + 
					' AND T1.fwcloud=' + connection.escape(fwcloud) + ' order by T1.node_order';
		} else {
			//Select Parent Node by type   
			sql = 'SELECT T1.* FROM ' + tableModel + ' T1  where T1.node_type=' + connection.escape(folder) + ' and T1.id_parent=0 AND T1.fwcloud=' + connection.escape(fwcloud) + ' order by T1.node_order';
			fwmaster = 0;
		}


		logger.debug(sql);
		connection.query(sql, function (error, rows) {
			if (error) {
				AllDone(error, null);
			} else {
				//For each node Select Objects by  type
				if (rows) {
					asyncMod.forEachSeries(rows, function (row, callback) {
						//logger.debug(row);
						//logger.debug("---> DENTRO de NODO: " + row.name + " - " + row.node_type);
						var tree_node = new fwc_tree_node(row);
						var id_parent = row.id;
						//Añadimos nodos FIREWALL del CLOUD
						sqlnodes = 'SELECT  F.id,F.name,F.fwcloud, F.comment FROM firewall F inner join fwcloud C on C.id=F.fwcloud WHERE C.id=' + connection.escape(fwcloud) + ' AND F.id=' + connection.escape(idfirewall);
						logger.debug(sqlnodes);
						connection.query(sqlnodes, function (error, rowsnodes) {
							if (error)
								callback(error, null);
							else {
								var i = 0;
								if (rowsnodes) {
									asyncMod.forEachSeries(rowsnodes, function (rnode, callback2) {
										var idfirewall = rnode.id;
										i++;
										//Insertamos nodos Firewall
										sqlinsert = 'INSERT INTO ' + tableModel +
												'( name, comment, id_parent, node_order,node_level, node_type, expanded, `subfolders`, id_obj,obj_type,fwcloud, fwcloud_tree) ' +
												' VALUES (' +
												connection.escape(rnode.name) + ',' +
												connection.escape(rnode.comment) + ',' + connection.escape(id_parent) + ',' +
												i + ',' + (row.node_level + 1) + ',"FW",' +
												'0,0,' + connection.escape(idfirewall) + ',0,' +
												connection.escape(rnode.fwcloud) + "," + connection.escape(rnode.fwcloud)  + ")";
										logger.debug(sqlinsert);
										var parent_firewall;

										connection.query(sqlinsert, function (error, result) {
											if (error) {
												logger.debug("ERROR FIREWALL INSERT : " + rnode.id + " - " + rnode.name + " -> " + error);
											} else {
												logger.debug("INSERT FIREWALL OK NODE: " + rnode.id + " - " + rnode.name + "  --> FWCTREE: " + result.insertId);
												parent_firewall = result.insertId;

												////////////////////////////////////////////////////////
												//ONLY CREATE NODE STRUCTURE FOR FIREWALL not in cluster and 
												if (idcluster===null)
												{
													logger.debug("CREATING FIREWALL STRUCTURE: " + rnode.id + " - " + rnode.name);
													var parent_FP = 0;
													//Insertamos nodo PADRE FILTER POLICIES
													sqlinsert = 'INSERT INTO ' + tableModel + '( name, comment, id_parent, node_order,node_level, node_type, expanded, subfolders, id_obj,obj_type,fwcloud, fwcloud_tree) ' +
															' VALUES (' + '"FILTER POLICIES","",' + parent_firewall + ',1,' + (row.node_level + 2) + ',"FP",0,0,' + connection.escape(idfirewall) + ',null,' + connection.escape(rnode.fwcloud) + "," + connection.escape(rnode.fwcloud)  + ")";
													logger.debug(sqlinsert);
													connection.query(sqlinsert, function (error2, result2) {
														if (error2) {
															logger.debug("ERROR FP : " + error2);
														} else {
															parent_FP = result2.insertId;
															logger.debug("INSERT FILTER POLICIES OK NODE: " + result2.insertId);
															//Insertamos nodo POLICY IN
															sqlinsert = 'INSERT INTO ' + tableModel + '( name, comment, id_parent, node_order,node_level, node_type, expanded, subfolders, id_obj,obj_type,fwcloud,fwcloud_tree, show_action) ' +
																	' VALUES (' + '"INPUT","",' + parent_FP + ',1,' + (row.node_level + 3) + ',"PI",0,0,' + connection.escape(idfirewall) + ',1,' + connection.escape(rnode.fwcloud) + "," + connection.escape(rnode.fwcloud)  + ",1)";
															logger.debug(sqlinsert);
															connection.query(sqlinsert, function (error, result) {
																if (error)
																	logger.debug("ERROR PI : " + error);
															});
															//Insertamos nodo POLICY OUT
															sqlinsert = 'INSERT INTO ' + tableModel + '( name, comment, id_parent, node_order,node_level, node_type, expanded, subfolders, id_obj,obj_type,fwcloud,fwcloud_tree, show_action) ' +
																	' VALUES (' + '"OUTPUT","",' + parent_FP + ',2,' + (row.node_level + 3) + ',"PO",0,0,' + connection.escape(idfirewall) + ',2,' + connection.escape(rnode.fwcloud) + "," + connection.escape(rnode.fwcloud)  + ",1)";
															logger.debug(sqlinsert);
															connection.query(sqlinsert, function (error, result) {
																if (error)
																	logger.debug("ERROR PO : " + error);
															});
															//Insertamos nodo POLICY FORWARD
															sqlinsert = 'INSERT INTO ' + tableModel + '( name, comment, id_parent, node_order,node_level, node_type, expanded, subfolders, id_obj,obj_type,fwcloud,fwcloud_tree, show_action) ' +
																	' VALUES (' + '"FORWARD","",' + parent_FP + ',3,' + (row.node_level + 3) + ',"PF",0,0,' + connection.escape(idfirewall) + ',3,' + connection.escape(rnode.fwcloud) + "," + connection.escape(rnode.fwcloud)  + ",1)";
															logger.debug(sqlinsert);
															connection.query(sqlinsert, function (error, result) {
																if (error)
																	logger.debug("ERROR PF: " + error);
															});

														}
													});

													var parent_NAT;

													//Insertamos nodo PADRE NAT
													sqlinsert = 'INSERT INTO ' + tableModel + '( name, comment, id_parent, node_order,node_level, node_type, expanded, subfolders, id_obj,obj_type,fwcloud, fwcloud_tree) ' +
															' VALUES (' + '"NAT","",' + parent_firewall + ',2,' + (row.node_level + 2) + ',"NT",0,0,' + connection.escape(idfirewall) + ',null,' + connection.escape(rnode.fwcloud) + "," + connection.escape(rnode.fwcloud)  + ")";
													logger.debug(sqlinsert);
													connection.query(sqlinsert, function (error, result) {
														if (error)
															logger.debug("ERROR NAT : " + error);
														else {
															parent_NAT = result.insertId;
															//Insertamos nodo SNAT
															sqlinsert = 'INSERT INTO ' + tableModel + '( name, comment, id_parent, node_order,node_level, node_type, expanded, subfolders, id_obj,obj_type,fwcloud,fwcloud_tree, show_action) ' +
																	' VALUES (' + '"SNAT","",' + parent_NAT + ',1,' + (row.node_level + 3) + ',"NTS",0,0,' + connection.escape(idfirewall) + ',4,' + connection.escape(rnode.fwcloud) + "," + connection.escape(rnode.fwcloud)  + ",0)";
															logger.debug(sqlinsert);
															connection.query(sqlinsert, function (error, result) {
																if (error)
																	logger.debug("ERROR SNAT: " + error);
															});
															//Insertamos nodo DNAT
															sqlinsert = 'INSERT INTO ' + tableModel + '( name, comment, id_parent, node_order,node_level, node_type, expanded, subfolders, id_obj,obj_type,fwcloud,fwcloud_tree, show_action) ' +
																	' VALUES (' + '"DNAT","",' + parent_NAT + ',2,' + (row.node_level + 3) + ',"NTD",0,0,' + connection.escape(idfirewall) + ',5,' + connection.escape(rnode.fwcloud) + "," + connection.escape(rnode.fwcloud)  + ",0)";
															logger.debug(sqlinsert);
															connection.query(sqlinsert, function (error, result) {
																if (error)
																	logger.debug("ERROR DNAT: " + error);
															});
														}
													});

													//Insertamos nodo ROUTING
													sqlinsert = 'INSERT INTO ' + tableModel + '( name, comment, id_parent, node_order,node_level, node_type, expanded, subfolders, id_obj,obj_type,fwcloud,fwcloud_tree, show_action) ' +
															' VALUES (' + '"Routing","",' + parent_firewall + ',3,' + (row.node_level + 2) + ',"RR",0,0,' + connection.escape(idfirewall) + ',6,' + connection.escape(rnode.fwcloud) + "," + connection.escape(rnode.fwcloud)  + ",1)";
													connection.query(sqlinsert, function (error, result) {
														if (error)
															logger.debug("ERROR RR : " + error);
													});

													var nodeInterfaces;
													//Insertamos nodo INTERFACES FIREWALL
													sqlinsert = 'INSERT INTO ' + tableModel + '( name, comment, id_parent, node_order,node_level, node_type, expanded, subfolders, id_obj,obj_type,fwcloud, fwcloud_tree) ' +
															' VALUES (' + '"Interfaces","",' + parent_firewall + ',4,' + (row.node_level + 2) + ',"FDI",0,0,' + connection.escape(idfirewall) + ',10,' + connection.escape(rnode.fwcloud) + "," + connection.escape(rnode.fwcloud)  + ")";
													connection.query(sqlinsert, function (error, result) {
														if (error)
															logger.debug("ERROR FDI: " + error);
														else {
															nodeInterfaces = result.insertId;
															
															//Insertamos nodos hijos Interface
															sqlInt = 'SELECT  id,name,labelName FROM interface where interface_type=10 AND  firewall=' + connection.escape(idfirewall);
															connection.query(sqlInt, function (error, rowsnodesInt) {
																if (error) {
																	logger.debug("Error Select interface");
																	callback(error, null);
																} else {
																	var j = 0;
																	if (rowsnodesInt) {
																		//logger.debug("INTERFACES: " + rowsnodesInt.length);
																		asyncMod.forEachSeries(rowsnodesInt, function (rnodeInt, callback3) {
																			j++;
																			//Insertamos nodos Interfaces
																			sqlinsert = 'INSERT INTO ' + tableModel +
																					'( name, comment, id_parent, node_order,node_level, node_type, expanded, `subfolders`, id_obj,obj_type,fwcloud, fwcloud_tree) ' +
																					' VALUES (' +
																					connection.escape(rnodeInt.name) + ',' +
																					connection.escape(rnodeInt.comment) + ',' + connection.escape(nodeInterfaces) + ',' +
																					j + ',' + (row.node_level + 3) + ',"IFF",' +
																					'0,0,' + connection.escape(rnodeInt.id) + ',10,' +
																					connection.escape(rnode.fwcloud) + "," + connection.escape(rnode.fwcloud)  + ")";

																			connection.query(sqlinsert, function (error, result) {
																				var idinterface;
																				if (error) {
																					logger.debug("ERROR INTERFACE INSERT : " + rnodeInt.id + " - " + rnodeInt.name + " -> " + error);
																				} else {
																					//logger.debug("INSERT INTERFACE OK NODE: " + rnodeInt.id + " - " + rnodeInt.name);
																					idinterface = result.insertId;
																				}
																				//Insertamos objetos IP de Interface
																				//Insertamos nodos Interface
																				sqlnodesIP = 'SELECT  O.id,O.name,O.type,O.fwcloud, O.comment, T.node_type FROM ipobj O inner join fwc_tree_node_types T on  T.obj_type=O.type where O.interface=' + connection.escape(rnodeInt.id);
																				//logger.debug(sqlnodesIP);
																				connection.query(sqlnodesIP, function (error, rowsnodesIP) {
																					if (error) {
																						logger.debug(error);
																					} else {
																						var k = 0;
																						if (rowsnodesIP) {
																							//logger.debug("OBJS IP: " + rowsnodesIP.length);
																							asyncMod.forEachSeries(rowsnodesIP, function (rnodeIP, callback4) {
																								k++;
																								//Insertamos nodos IP
																								sqlinsert = 'INSERT INTO ' + tableModel +
																										'( name, comment, id_parent, node_order,node_level, node_type, expanded, `subfolders`, id_obj,obj_type,fwcloud, fwcloud_tree) ' +
																										' VALUES (' +
																										connection.escape(rnodeIP.name) + ',' +
																										connection.escape(rnodeIP.comment) + ',' + connection.escape(idinterface) + ',' +
																										k + ',' + (row.node_level + 4) + ',' + connection.escape(rnodeIP.node_type) + ',' +
																										'0,0,' + connection.escape(rnodeIP.id) + ',5,' +
																										connection.escape(rnode.fwcloud) + "," + connection.escape(rnode.fwcloud)  + ")";
																								connection.query(sqlinsert, function (error, result) {
																									if (error) {
																										logger.debug("ERROR IP OBJECT INSERT : " + rnodeIP.id + " - " + rnodeIP.name + " -> " + error);
																									} else {
																										//logger.debug("INSERT IPOBJ OK NODE: " + rnodeIP.id + " - " + rnodeIP.name);
																									}
																								});
																								callback4();
																							}
																							);
																						}
																					}	
																				});
																			});
																			callback3();
																		});
																	}
																}
															});
														}
													});
												}
												
												//UPDATE CLUSTER STRUCTURE WITH FIREWALL MASTER
												if (idcluster !== null && fwmaster == 1) {
													logger.debug("UPDATING CLUSTER STRUCTURE: " + rnode.id + " - " + rnode.name + "  CLUSTER: ", idcluster, "  IDFIREWAL: ", idfirewall, "  FWMASTER: ", fwmaster);
													update_cluster_structure(fwcloud,idcluster,idfirewall,connection);
												}
											}
										});
										callback2();
									}
									);
								}
							}
						});
						callback();
					},
							function (err) {
								if (err)
									AllDone(err, null);
								else
									AllDone(null, {"result": true});
							});
				} else
					AllDone(null, {"result": true});
			}
		});

	});

};


//Add new TREE CLUSTER for a New CLuster
fwc_treeModel.insertFwc_Tree_New_cluster = function (fwcloud, folder, idcluster, AllDone) {
	db.get(function (error, connection) {
		if (error)
			callback(error, null);

		//Select Parent Node by type   
		sql = 'SELECT T1.* FROM ' + tableModel + ' T1  where T1.node_type=' + connection.escape(folder) + ' and T1.id_parent=0 AND T1.fwcloud=' + connection.escape(fwcloud) + ' order by T1.node_order';
		logger.debug(sql);
		connection.query(sql, function (error, rows) {
			if (error) {
				AllDone(error, null);
			} else {
				//For each node Select Objects by  type
				if (rows) {
					asyncMod.forEachSeries(rows, function (row, callback) {
						//logger.debug(row);
						//logger.debug("---> DENTRO de NODO: " + row.name + " - " + row.node_type);
						var tree_node = new fwc_tree_node(row);
						//Añadimos nodos CLUSTER del CLOUD
						sqlnodes = 'SELECT  C.id, C.name, C.comment, C.fwcloud FROM cluster C  WHERE C.id=' + connection.escape(idcluster);
						//logger.debug(sqlnodes);
						connection.query(sqlnodes, function (error, rowsnodes) {
							if (error)
								callback(error, null);
							else {
								var i = 0;
								if (rowsnodes) {
									asyncMod.forEachSeries(rowsnodes, function (rnode, callback2) {
										var idfirewall = rnode.id;
										i++;
										//Insertamos nodos Cluster
										sqlinsert = 'INSERT INTO ' + tableModel +
												'( name, comment, id_parent, node_order,node_level, node_type, expanded, `subfolders`, id_obj,obj_type,fwcloud, fwcloud_tree) ' +
												' VALUES (' +
												connection.escape(rnode.name) + ',' +
												connection.escape(rnode.comment) + ',' + connection.escape(row.id) + ',' +
												i + ',' + (row.node_level + 1) + ',"CL",' +
												'0,0,' + connection.escape(rnode.id) + ',100,' +
												connection.escape(fwcloud) + "," + connection.escape(fwcloud)  + ")";
										//logger.debug(sqlinsert);
										var parent_cluster;

										connection.query(sqlinsert, function (error, result) {
											if (error) {
												logger.debug("ERROR CLUSTER INSERT : " + rnode.id + " - " + rnode.name + " -> " + error);
											} else {
												logger.debug("INSERT CLUSTER OK NODE: " + rnode.id + " - " + rnode.name + "  --> FWCTREE: " + result.insertId);
												parent_cluster = result.insertId;

												var parent_FP = 0;

												//Insertamos nodo PADRE FILTER POLICIES
												sqlinsert = 'INSERT INTO ' + tableModel + '( name, comment, id_parent, node_order,node_level, node_type, expanded, subfolders, id_obj,obj_type,fwcloud,fwcloud_tree) ' +
														' VALUES (' + '"FILTER POLICIES","",' + parent_cluster + ',1,' + (row.node_level + 2) + ',"FP",0,0,' + connection.escape(idcluster) + ',null,' + connection.escape(rnode.fwcloud) + "," + connection.escape(rnode.fwcloud)  + ")";
												logger.debug(sqlinsert);
												connection.query(sqlinsert, function (error2, result2) {
													if (error2) {
														logger.debug("ERROR FP : " + error2);
													} else {
														parent_FP = result2.insertId;
														logger.debug("INSERT FILTER POLICIES OK NODE: " + result2.insertId);
														//Insertamos nodo POLICY IN
														sqlinsert = 'INSERT INTO ' + tableModel + '( name, comment, id_parent, node_order,node_level, node_type, expanded, subfolders, id_obj,obj_type,fwcloud, fwcloud_tree, show_action) ' +
																' VALUES (' + '"INPUT","",' + parent_FP + ',1,' + (row.node_level + 3) + ',"PI",0,0,' + connection.escape(idcluster) + ',1,' + connection.escape(rnode.fwcloud) + "," + connection.escape(rnode.fwcloud)  + ",1)";
														logger.debug(sqlinsert);
														connection.query(sqlinsert, function (error, result) {
															if (error)
																logger.debug("ERROR PI : " + error);
														});
														//Insertamos nodo POLICY OUT
														sqlinsert = 'INSERT INTO ' + tableModel + '( name, comment, id_parent, node_order,node_level, node_type, expanded, subfolders, id_obj,obj_type,fwcloud,fwcloud_tree, show_action) ' +
																' VALUES (' + '"OUTPUT","",' + parent_FP + ',2,' + (row.node_level + 3) + ',"PO",0,0,' + connection.escape(idcluster) + ',2,' + connection.escape(rnode.fwcloud) + "," + connection.escape(rnode.fwcloud)  + ",1)";
														logger.debug(sqlinsert);
														connection.query(sqlinsert, function (error, result) {
															if (error)
																logger.debug("ERROR PO : " + error);
														});
														//Insertamos nodo POLICY FORWARD
														sqlinsert = 'INSERT INTO ' + tableModel + '( name, comment, id_parent, node_order,node_level, node_type, expanded, subfolders, id_obj,obj_type,fwcloud,fwcloud_tree, show_action) ' +
																' VALUES (' + '"FORWARD","",' + parent_FP + ',3,' + (row.node_level + 3) + ',"PF",0,0,' + connection.escape(idcluster) + ',3,' + connection.escape(rnode.fwcloud) + "," + connection.escape(rnode.fwcloud)  + ",1)";
														logger.debug(sqlinsert);
														connection.query(sqlinsert, function (error, result) {
															if (error)
																logger.debug("ERROR PF: " + error);
														});

													}
												});

												var parent_NAT;

												//Insertamos nodo PADRE NAT
												sqlinsert = 'INSERT INTO ' + tableModel + '( name, comment, id_parent, node_order,node_level, node_type, expanded, subfolders, id_obj,obj_type,fwcloud, fwcloud_tree) ' +
														' VALUES (' + '"NAT","",' + parent_cluster + ',2,' + (row.node_level + 2) + ',"NT",0,0,' + connection.escape(idcluster) + ',null,' + connection.escape(rnode.fwcloud) + "," + connection.escape(rnode.fwcloud)  + ")";
												logger.debug(sqlinsert);
												connection.query(sqlinsert, function (error, result) {
													if (error)
														logger.debug("ERROR FP : " + error);
													else {
														parent_NAT = result.insertId;
														//Insertamos nodo SNAT
														sqlinsert = 'INSERT INTO ' + tableModel + '( name, comment, id_parent, node_order,node_level, node_type, expanded, subfolders, id_obj,obj_type,fwcloud, fwcloud_tree, show_action) ' +
																' VALUES (' + '"SNAT","",' + parent_NAT + ',1,' + (row.node_level + 3) + ',"NTS",0,0,' + connection.escape(idcluster) + ',4,' + connection.escape(rnode.fwcloud) + "," + connection.escape(rnode.fwcloud)  + ",0)";
														logger.debug(sqlinsert);
														connection.query(sqlinsert, function (error, result) {
															if (error)
																logger.debug("ERROR SNAT: " + error);
														});
														//Insertamos nodo DNAT
														sqlinsert = 'INSERT INTO ' + tableModel + '( name, comment, id_parent, node_order,node_level, node_type, expanded, subfolders, id_obj,obj_type,fwcloud,fwcloud_tree, show_action) ' +
																' VALUES (' + '"DNAT","",' + parent_NAT + ',2,' + (row.node_level + 3) + ',"NTD",0,0,' + connection.escape(idcluster) + ',5,' + connection.escape(rnode.fwcloud) + "," + connection.escape(rnode.fwcloud)  + ",0)";
														logger.debug(sqlinsert);
														connection.query(sqlinsert, function (error, result) {
															if (error)
																logger.debug("ERROR DNAT: " + error);
														});
													}
												});

												//Insertamos nodo ROUTING
												sqlinsert = 'INSERT INTO ' + tableModel + '( name, comment, id_parent, node_order,node_level, node_type, expanded, subfolders, id_obj,obj_type,fwcloud,fwcloud_tree, show_action) ' +
														' VALUES (' + '"Routing","",' + parent_cluster + ',3,' + (row.node_level + 2) + ',"RR",0,0,' + connection.escape(idcluster) + ',6,' + connection.escape(rnode.fwcloud) + "," + connection.escape(rnode.fwcloud)  + ",1)";
												connection.query(sqlinsert, function (error, result) {
													if (error)
														logger.debug("ERROR RR : " + error);
												});

												var nodeInterfaces;
												//Insertamos nodo INTERFACES FIREWALL
												sqlinsert = 'INSERT INTO ' + tableModel + '( name, comment, id_parent, node_order,node_level, node_type, expanded, subfolders, id_obj,obj_type,fwcloud, fwcloud_tree) ' +
														' VALUES (' + '"Interfaces","",' + parent_cluster + ',4,' + (row.node_level + 2) + ',"FDI",0,0,' + connection.escape(idcluster) + ',10,' + connection.escape(rnode.fwcloud) + "," + connection.escape(rnode.fwcloud)  + ")";
												connection.query(sqlinsert, function (error, result) {
													if (error)
														logger.debug("ERROR FDI: " + error);
													else
														nodeInterfaces = result.insertId;
												});

												//Insertamos nodo NODE FIREWALLS
												sqlinsert = 'INSERT INTO ' + tableModel + '( name, comment, id_parent, node_order,node_level, node_type, expanded, subfolders, id_obj,obj_type,fwcloud, fwcloud_tree, show_action) ' +
														' VALUES (' + '"NODES","",' + parent_cluster + ',5,' + (row.node_level + 2) + ',"FCF",0,0,' + connection.escape(idcluster) + ',null,' + connection.escape(rnode.fwcloud) + "," + connection.escape(rnode.fwcloud)  + ",1)";
												connection.query(sqlinsert, function (error, result) {
													if (error)
														logger.debug("ERROR RR : " + error);
												});
											}
										});
										callback2();
									}
									);
								}
							}
						});
						callback();
					},
							function (err) {
								if (err)
									AllDone(err, null);
								else
									AllDone(null, {"result": true});
							});
				} else
					AllDone(null, {"result": true});
			}
		});
	});
};

//CONVERT TREE FIREWALL TO  CLUSTER for a New CLuster
fwc_treeModel.updateFwc_Tree_convert_firewall_cluster = function (fwcloud, folder, idcluster, idfirewall, AllDone) {
	db.get(function (error, connection) {
		if (error)
			callback(error, null);

		getFirewallNodeId(idfirewall, function (datafw) {
			var firewallNode = datafw;

			//Select Parent Node by type   
			sql = 'SELECT T1.* FROM ' + tableModel + ' T1  where T1.node_type=' + connection.escape(folder) + ' and T1.id_parent=0 AND T1.fwcloud=' + connection.escape(fwcloud) + ' order by T1.node_order';
			logger.debug(sql);
			connection.query(sql, function (error, rows) {
				if (error) {
					AllDone(error, null);
				} else {
					//For each node Select Objects by  type
					if (rows) {
						asyncMod.forEachSeries(rows, function (row, callback) {
							//logger.debug(row);
							//logger.debug("---> DENTRO de NODO: " + row.name + " - " + row.node_type);
							var tree_node = new fwc_tree_node(row);
							//Añadimos nodos CLUSTER del CLOUD
							sqlnodes = 'SELECT  C.id, C.name, C.comment, C.fwcloud FROM cluster C  WHERE C.id=' + connection.escape(idcluster);
							//logger.debug(sqlnodes);
							connection.query(sqlnodes, function (error, rowsnodes) {
								if (error)
									callback(error, null);
								else {
									var i = 0;
									if (rowsnodes) {
										asyncMod.forEachSeries(rowsnodes, function (rnode, callback2) {
											var idfirewall = rnode.id;
											i++;
											//Insertamos nodos Cluster
											sqlinsert = 'INSERT INTO ' + tableModel +
													'( name, comment, id_parent, node_order,node_level, node_type, expanded, `subfolders`, id_obj,obj_type,fwcloud, fwcloud_tree) ' +
													' VALUES (' +
													connection.escape(rnode.name) + ',' +
													connection.escape(rnode.comment) + ',' + connection.escape(row.id) + ',' +
													i + ',' + (row.node_level + 1) + ',"CL",' +
													'0,0,' + connection.escape(rnode.id) + ',100,' +
													connection.escape(fwcloud) + "," + connection.escape(fwcloud)  + ")";
											//logger.debug(sqlinsert);
											var parent_cluster;

											connection.query(sqlinsert, function (error, result) {
												if (error) {
													logger.debug("ERROR CLUSTER INSERT : " + rnode.id + " - " + rnode.name + " -> " + error);
												} else {
													logger.debug("INSERT CLUSTER OK NODE: " + rnode.id + " - " + rnode.name + "  --> FWCTREE: " + result.insertId);
													parent_cluster = result.insertId;

													var parent_FP = 0;

													//update ALL FIREWALL NODES
													sqlinsert = 'UPDATE ' + tableModel + ' SET id_parent=' + parent_cluster +
															' WHERE id_parent=' + firewallNode;
													logger.debug(sqlinsert);
													connection.query(sqlinsert, function (error, result) {
														if (error)
															logger.debug("ERROR ALL NODES : " + error);
													});

												}



												//Insertamos nodo NODE FIREWALLS
												sqlinsert = 'INSERT INTO ' + tableModel + '( name, comment, id_parent, node_order,node_level, node_type, expanded, subfolders, id_obj,obj_type,fwcloud,fwcloud_tree, show_action) ' +
														' VALUES (' + '"NODES","",' + parent_cluster + ',5,' + (row.node_level + 2) + ',"FCF",0,0,' + connection.escape(idcluster) + ',null,' + connection.escape(rnode.fwcloud) + "," + connection.escape(rnode.fwcloud)  + ",1)";
												connection.query(sqlinsert, function (error, result) {
													if (error)
														logger.debug("ERROR RR : " + error);
													else {
														var nodes_cluster = result.insertId;
														//update  FIREWALL NODE
														sqlinsert = 'UPDATE ' + tableModel + ' SET id_parent=' + nodes_cluster +
																' WHERE id=' + firewallNode;
														logger.debug(sqlinsert);
														connection.query(sqlinsert, function (error, result) {
															if (error)
																logger.debug("ERROR FIREWALL NODE : " + error);
														});
													}
												});


											});
											callback2();
										}
										);
									}
								}
							});
							callback();
						},
								function (err) {
									if (err)
										AllDone(err, null);
									else
										AllDone(null, {"result": true});
								});
					} else
						AllDone(null, {"result": true});
				}
			});

		});
	});

};

//CONVERT TREE CLUSTER TO FIREWALL for a New Firewall
fwc_treeModel.updateFwc_Tree_convert_cluster_firewall = function (fwcloud, folder, idcluster, idfirewall, AllDone) {
	db.get(function (error, connection) {
		if (error)
			callback(error, null);
		getFirewallNodeId(idfirewall, function (datafw) {
			var firewallNode = datafw;
			//Select Parent Node CLUSTERS 
			sql = 'SELECT T1.* FROM ' + tableModel + ' T1  where T1.node_type=' + connection.escape(folder) + ' and T1.id_parent=0 AND T1.fwcloud=' + connection.escape(fwcloud) + ' order by T1.node_order';
			logger.debug(sql);
			connection.query(sql, function (error, rows) {
				if (error) {
					AllDone(error, null);
				} else {
					//For each node Select Objects by  type
					if (rows && rows.length > 0) {
						var row = rows[0];
						//logger.debug(row);
						//logger.debug("---> DENTRO de NODO: " + row.name + " - " + row.node_type);

						//SEARCH IDNODE for CLUSTER
						sql = 'SELECT T1.* FROM ' + tableModel + ' T1  where T1.node_type="CL" and T1.id_parent=' + row.id + ' AND T1.fwcloud=' + connection.escape(fwcloud) + ' AND id_obj=' + idcluster;
						connection.query(sql, function (error, rowsCL) {
							if (error) {
								AllDone(error, null);
							} else if (rowsCL && rowsCL.length > 0) {

								var clusterNode = rowsCL[0].id;

								//update ALL NODES UNDER CLUSTER to FIREWALL
								sqlinsert = 'UPDATE ' + tableModel + ' SET id_parent=' + firewallNode +
										' WHERE id_parent=' + clusterNode + ' AND node_type<>"FCF"';
								logger.debug(sqlinsert);
								connection.query(sqlinsert, function (error, result) {
									if (error)
										logger.debug("ERROR ALL NODES : " + error);
								});

								//SEARCH node NODES
								sql = 'SELECT T1.* FROM ' + tableModel + ' T1  where T1.node_type="FCF" and T1.id_parent=' + clusterNode + ' AND T1.fwcloud=' + connection.escape(fwcloud);
								logger.debug(sql);
								connection.query(sql, function (error, rowsN) {
									if (error) {
										AllDone(error, null);
									} else if (rowsN && rowsN.length > 0) {
										var idNodes = rowsN[0].id;
										//Remove nodo NODES
										sqldel = 'DELETE FROM  ' + tableModel + ' ' +
												' WHERE node_type= "FCF" and id_parent=' + clusterNode;
										logger.debug(sqldel);
										connection.query(sqldel, function (error, result) {
											if (error)
												logger.debug("ERROR FCF : " + error);
										});
										//SEARCH IDNODE for FIREWALLS NODE
										sql = 'SELECT T1.* FROM ' + tableModel + ' T1  where T1.node_type="FDF" and T1.id_parent=0 AND T1.fwcloud=' + connection.escape(fwcloud);
										logger.debug(sql);
										connection.query(sql, function (error, rowsF) {
											var firewallsNode = rowsF[0].id;
											//update  FIREWALL under NODES to FIREWALLS NODE
											sqlinsert = 'UPDATE ' + tableModel + ' SET id_parent=' + firewallsNode +
													' WHERE id=' + firewallNode;
											logger.debug(sqlinsert);
											connection.query(sqlinsert, function (error, result) {
												if (error)
													logger.debug("ERROR FIREWALL NODE : " + error);
												else {
													//Remove nodo Firewalls Slaves
													sqldel = 'DELETE FROM  ' + tableModel + ' ' +
															' WHERE node_type= "FW"  and id_parent=' + idNodes;
													logger.debug(sqldel);
													connection.query(sqldel, function (error, result) {
														if (error)
															logger.debug("ERROR FW - FCF : " + error);
														else {
															AllDone(null, {"result": true});
														}
													});
												}
											});
										});

									}
								});


							} else
								AllDone(error, null);
						});
					} else
						AllDone(null, {"result": true});
				}
			});
		});
	});
};
//Add new TREE OBJECTS from user
fwc_treeModel.insertFwc_Tree_objects = function (fwcloud, folder, AllDone) {
	db.get(function (error, connection) {
		if (error)
			callback(error, null);
		//Select Parent Node by type   
		sql = 'SELECT T1.* FROM ' + tableModel + ' T1 inner join fwc_tree T2 on T1.id_parent=T2.id where T2.node_type=' + connection.escape(folder) + ' and T2.id_parent=0 AND (T1.fwcloud=' + connection.escape(fwcloud) + ' OR T1.fwcloud is null) order by T1.node_order';
		logger.debug(sql);
		connection.query(sql,
				function (error, rows) {
					if (error) {
						callback(error, null);
					} else {
						//For each node Select Objects by  type
						if (rows) {
							asyncMod.forEachSeries(rows,
									function (row, callback) {
										//logger.debug(row);
										logger.debug("---> DENTRO de NODO: " + row.name + " - Node_Type:" + row.node_type + "  Obj_type:" + row.obj_type);
										var tree_node = new fwc_tree_node(row);
										//Añadimos nodos hijos del tipo
										if (row.node_type === "OIG" || row.node_type === "SOG") {
											sqlnodes = 'SELECT  id,name,type,fwcloud, comment FROM ipobj_g  where type=' + row.obj_type + ' AND (fwcloud=' + fwcloud + ' OR fwcloud is null) ';
										} else
											sqlnodes = 'SELECT  id,name,type,fwcloud, comment FROM ipobj  where type=' + row.obj_type + ' AND interface is null' + ' AND (fwcloud=' + fwcloud + ' OR fwcloud is null) ';
										logger.debug(sqlnodes);
										connection.query(sqlnodes, function (error, rowsnodes) {
											if (error)
												callback(error, null);
											else {
												var i = 0;
												if (rowsnodes) {
													asyncMod.forEachSeries(rowsnodes,
															function (rnode, callback) {
																i++;
																//Insertamos nodo
																sqlinsert = 'INSERT INTO ' + tableModel +
																		'( name, comment, id_parent, node_order,node_level, node_type, expanded, `subfolders`, id_obj,obj_type,fwcloud, fwcloud_tree) ' +
																		' VALUES (' +
																		connection.escape(rnode.name) + ',' +
																		connection.escape(rnode.comment) + ',' + connection.escape(row.id) + ',' +
																		i + ',' + (row.node_level + 1) + ',' + connection.escape(row.node_type) + ',' +
																		'0,0,' + connection.escape(rnode.id) + ',' + connection.escape(rnode.type) + ',' +
																		connection.escape(rnode.fwcloud) + "," + connection.escape(fwcloud)  + ")";
																//logger.debug(sqlinsert);
																connection.query(sqlinsert, function (error, result) {
																	if (error) {
																		logger.debug("ERROR INSERT : " + rnode.id + " - " + rnode.name + " Type: " + rnode.type + " --> " + error);
																	} else {
																		var NodeId = result.insertId;
																		logger.debug("INSERT OK NODE : " + rnode.id + " - " + rnode.name + "  Type: " + rnode.type + "  fwcloud:" + rnode.fwcloud);
																		//INSERT OBJECTS FROM GROUPS
																		if (row.node_type === "OIG" || row.node_type === "SOG") {
																			sqlinsert = 'INSERT INTO ' + tableModel +
																					'( name, comment, id_parent, node_order,node_level, node_type, expanded, `subfolders`, id_obj,obj_type,fwcloud, fwcloud_tree) ' +
																					' SELECT O.name, O.comment,' + connection.escape(NodeId) + ',1,' + (row.node_level + 2) + ',' +
																					' T.node_type,0,0,O.id, O.type, O.fwcloud ' + "," + connection.escape(fwcloud)  +
																					' FROM fwcloud_db.ipobj O ' +
																					' INNER JOIN ipobj__ipobjg G on O.id=G.ipobj ' +
																					' inner join fwc_tree_node_types T on T.obj_type=O.type ' +
																					' WHERE G.ipobj_g=' + rnode.id +
																					' ORDER BY G.id_gi';
																			//logger.debug(sqlinsert);
																			connection.query(sqlinsert, function (error, result) {
																				if (error) {
																					logger.debug("ERROR INSERT GROUP OBJECTS: " + rnode.id + " - " + rnode.name + " Type: " + rnode.type + " --> " + error);
																				} else {
																					//logger.debug("INSERT OK GROUP CHILD NODE Objects: " + result.affectedRows);
																				}
																			});
																		}
																		//INSERT INTERFACES FROM  HOST
																		else if (row.node_type === "OIH") {
																			sqlnodes = 'SELECT  O.id,O.name,O.interface_type, O.comment, T.node_type FROM interface O ' +
																					' inner join interface__ipobj F on F.interface=O.id ' +
																					' inner join fwc_tree_node_types T on T.obj_type=O.interface_type ' +
																					' WHERE F.ipobj=' + rnode.id;
																			connection.query(sqlnodes, function (error, rowsnodesObj) {
																				if (error)
																					logger.debug(error);
																				else {
																					var j = 0;
																					asyncMod.forEachSeries(rowsnodesObj,
																							function (rnodeObj, callback2) {
																								j++;
																								sqlinsert = 'INSERT INTO ' + tableModel +
																										'( name, comment, id_parent, node_order,node_level, node_type, expanded, `subfolders`, id_obj,obj_type,fwcloud, fwcloud_tree) ' +
																										' SELECT O.name, O.comment,' + connection.escape(NodeId) + ',1,' + (row.node_level + 2) + ',' +
																										' T.node_type,0,0,O.id, O.interface_type, ' + rnode.fwcloud + "," + connection.escape(fwcloud)  +
																										' FROM fwcloud_db.interface O ' +
																										' inner join interface__ipobj F on F.interface=O.id ' +
																										' inner join fwc_tree_node_types T on T.obj_type=O.interface_type ' +
																										' WHERE F.ipobj=' + rnode.id + ' AND O.id=' + rnodeObj.id;
																								//logger.debug(sqlinsert);
																								connection.query(sqlinsert, function (error, result) {
																									if (error) {
																										logger.debug("ERROR INSERT HOST INTERFACES: " + rnode.id + " - " + rnode.name + " Type: " + rnode.type + " --> " + error);
																									} else {
																										idNodeinterface = result.insertId;
																										//logger.debug("INSERT OK CHILD NODE HOST: " + rnode.id + " - " + rnode.name + "  INTERFACE:" + rnodeObj.id + " - " + rnodeObj.name);
																										sqlinsertObj = 'INSERT INTO ' + tableModel +
																												'(name, comment, id_parent, node_order,node_level, node_type, expanded, `subfolders`, id_obj,obj_type,fwcloud, fwcloud_tree) ' +
																												' SELECT O.name, O.comment,' + connection.escape(idNodeinterface) + ',1,' + (row.node_level + 3) + ',' +
																												' T.node_type,0,0,O.id, O.type,O.fwcloud ' + "," + connection.escape(fwcloud)  +
																												' FROM fwcloud_db.ipobj O ' +
																												' inner join fwc_tree_node_types T on T.obj_type=O.type ' +
																												' WHERE  O.interface=' + rnodeObj.id;
																										//logger.debug(sqlinsertObj);
																										connection.query(sqlinsertObj, function (error, result) {
																											if (error) {
																												logger.debug("ERROR INSERT HOST INTERFACES: " + rnode.id + " - " + rnode.name + " Type: " + rnode.type + " --> " + error);
																											} else {
																												//logger.debug("INSERT OK CHILD  OBJ NODE HOST INTERFACE:" + rnodeObj.id + " - " + rnodeObj.name);

																											}
																										});
																									}
																								});
																								callback2();
																							});
																				}
																			});
																		}

																	}
																});
																callback();
															}

													);
												}
											}
										});
										callback();
									},
									function (err) {
										if (err)
											AllDone(err, null);
										else
											AllDone(null, {"result": true});
									});
						} else
							AllDone(null, {"result": true});
					}
				});
	});
};


//Add new NODE from IPOBJ or Interface
fwc_treeModel.insertFwc_TreeOBJ = function (id_user, fwcloud, node_parent, node_order, node_type, node_Data, callback) {
	getParentLevelChild(node_parent, function (level) {
		var fwc_treeData = {
			id: null,
			name: node_Data.name,
			id_parent: node_parent,
			node_order: node_order,
			node_icon: null,
			expanded: 0,
			node_type: node_type,
			api_call: null,
			obj_type: node_Data.type,
			id_obj: node_Data.id,
			node_level: level,
			fwcloud: fwcloud,
			comment: node_Data.comment,
			fwcloud_tree: fwcloud
		};
		db.get(function (error, connection) {
			if (error)
				callback(error, null);
			connection.query('INSERT INTO ' + tableModel + ' SET ?', fwc_treeData, function (error, result) {
				if (error) {
					callback(error, null);
				} else {
					if (result.affectedRows > 0) {
						OrderList(node_order, fwcloud, node_parent, 999999, result.insertId);
						//devolvemos la última id insertada
						callback(null, {"insertId": result.insertId});
					} else
						callback(null, {"insertId": 0});
				}
			});
		});
	});
};

//Update NODE from user
fwc_treeModel.updateFwc_Tree = function (nodeTreeData, callback) {

	db.get(function (error, connection) {
		if (error)
			callback(error, null);
		var sql = 'UPDATE ' + tableModel + ' SET ' +
				' name = ' + connection.escape(nodeTreeData.name) + ' ' +
				' WHERE id = ' + nodeTreeData.id;
		connection.query(sql, function (error, result) {
			if (error) {
				callback(error, null);
			} else {
				callback(null, {"result": true});
			}
		});
	});
};

//Update NODE from FIREWALL UPDATE
fwc_treeModel.updateFwc_Tree_Firewall = function (iduser, fwcloud, FwData, callback) {
	db.get(function (error, connection) {
		if (error)
			callback(error, null);
		var sql = 'UPDATE ' + tableModel + ' SET ' +
				' name = ' + connection.escape(FwData.name) + ' , comment= ' + connection.escape(FwData.comment) +
				' WHERE id_obj = ' + connection.escape(FwData.id) + ' AND fwcloud_tree=' + connection.escape(fwcloud) + ' AND node_type="FW"';
		connection.query(sql, function (error, result) {
			if (error) {
				logger.debug(sql);
				logger.debug(error);
				callback(error, null);
			} else {
				if (result.affectedRows > 0)
					callback(null, {"result": true});
				else
					callback(null, {"result": false});
			}
		});
	});
};

//Update NODE from CLUSTER UPDATE
fwc_treeModel.updateFwc_Tree_Cluster = function (iduser, fwcloud, Data, callback) {
	db.get(function (error, connection) {
		if (error)
			callback(error, null);
		var sql = 'UPDATE ' + tableModel + ' SET ' +
				' name = ' + connection.escape(Data.name) + ' , comment= ' + connection.escape(Data.comment) +
				' WHERE id_obj = ' + connection.escape(Data.id) + ' AND fwcloud_tree=' + connection.escape(fwcloud) + ' AND node_type="CL"';
		connection.query(sql, function (error, result) {
			if (error) {
				logger.debug(sql);
				logger.debug(error);
				callback(error, null);
			} else {
				if (result.affectedRows > 0)
					callback(null, {"result": true});
				else
					callback(null, {"result": false});
			}
		});
	});
};

//Update NODE from IPOBJ or INTERFACE UPDATE
fwc_treeModel.updateFwc_Tree_OBJ = function (iduser, fwcloud, ipobjData, callback) {
	db.get(function (error, connection) {
		if (error)
			callback(error, null);
		var sql = 'UPDATE ' + tableModel + ' SET' +
				' name = ' + connection.escape(ipobjData.name) + ' , comment= ' + connection.escape(ipobjData.comment) +
				' WHERE node_type NOT LIKE "F%" AND' +
				' id_obj = ' + connection.escape(ipobjData.id) + ' AND obj_type=' + connection.escape(ipobjData.type) + ' AND fwcloud_tree=' + connection.escape(fwcloud);
		connection.query(sql, function (error, result) {
			if (error) {
				logger.debug(sql);
				logger.debug(error);
				callback(error, null);
			} else {
				if (result.affectedRows > 0)
					callback(null, {"result": true});
				else
					callback(null, {"result": false});
			}
		});
	});
};

//Remove ALL NODES with id_obj to remove
fwc_treeModel.deleteFwc_Tree = function (iduser, fwcloud, id_obj, type, callback) {
	db.get(function (error, connection) {
		if (error)
			callback(error, null);
		var sqlExists = 'SELECT * FROM ' + tableModel + '  WHERE node_type not like "F%" AND  fwcloud_tree = ' + connection.escape(fwcloud) + ' AND id_obj = ' + connection.escape(id_obj) + ' AND obj_type=' + connection.escape(type);        
		connection.query(sqlExists, function (error, row) {
			//If exists Id from ipobj to remove
			if (row) {
				var id_parent = row[0].id;
				db.get(function (error, connection) {
					var sql = 'DELETE FROM ' + tableModel + ' WHERE node_type not like "F%" AND fwcloud_tree = ' + connection.escape(fwcloud) + ' AND id_obj = ' + connection.escape(id_obj) + ' AND obj_type=' + connection.escape(type);
					logger.debug("DELETE PARENT: ", sql);
					connection.query(sql, function (error, result) {
						if (error) {
							logger.debug(sql);
							callback(error, null);
						} else {
							if (result.affectedRows > 0) {
								//CASCADE DELETE
								var sql = 'DELETE FROM ' + tableModel + ' WHERE node_type not like "F%" AND fwcloud_tree = ' + connection.escape(fwcloud) + ' AND id_parent = ' + connection.escape(id_parent);
								logger.debug(" DELETE FROM PARENT: ",sql);
								connection.query(sql, function (error, result) {
									if (error) {
										logger.debug(sql);
										logger.debug(error);
										callback(error, null);
									} else {
										callback(null, {"result": true, "msg": "deleted"});
									}
								});
							} else
								callback(null, {"result": false});
						}
					});
				});
			} else {
				callback(null, {"result": false});
			}
		});
	});
};
//Remove NODE FROM GROUP with id_obj to remove
fwc_treeModel.deleteFwc_TreeGroupChild = function (iduser, fwcloud, id_parent, id_group, id_obj, callback) {
	db.get(function (error, connection) {
		if (error)
			callback(error, null);
		var sqlExists = 'SELECT * FROM ' + tableModel + ' T INNER JOIN ' + tableModel + ' T2 ON  T.id_parent=T2.id WHERE T.fwcloud = ' + connection.escape(fwcloud) + ' AND T.id_obj = ' + connection.escape(id_obj) + ' AND T2.id_obj = ' + connection.escape(id_group);
		connection.query(sqlExists, function (error, row) {
			//If exists Id from ipobj to remove
			if (row) {
				db.get(function (error, connection) {
					var sql = 'DELETE T.* FROM ' + tableModel + ' T INNER JOIN ' + tableModel + ' T2 ON  T.id_parent=T2.id WHERE T.fwcloud = ' + connection.escape(fwcloud) + ' AND T.id_obj = ' + connection.escape(id_obj) + ' AND T2.id_obj = ' + connection.escape(id_group);
					//logger.debug(sql);
					connection.query(sql, function (error, result) {
						if (error) {
							logger.debug(sql);
							callback(error, null);
						} else {
							callback(null, {"result": true, "msg": "deleted"});
						}
					});
				});
			} else {
				callback(null, {"result": false});
			}
		});
	});
};
function hasLines(id, callback) {
	var ret;
	db.get(function (error, connection) {
		if (error)
			callback(error, null);
		var sql = 'SELECT * FROM  ' + tableModel + '  where id_parent = ' + id;
		connection.query(sql, function (error, rows) {
			if (rows.length > 0) {
				ret = true;
			} else {
				ret = false;
			}
			callback(ret);
		});
	});
}

function getFirewallNodeId(idfirewall, callback) {
	var ret;
	db.get(function (error, connection) {
		if (error)
			callback(error, null);
		var sql = 'SELECT id FROM  ' + tableModel + '  where node_type="FW" AND id_obj = ' + idfirewall;
		connection.query(sql, function (error, rows) {
			if (rows.length > 0) {
				ret = rows[0].id;
			} else {
				ret = 0;
			}
			callback(ret);
		});
	});
}

function getParentLevelChild(id, callback) {
	var ret;
	db.get(function (error, connection) {
		if (error)
			callback(error, null);
		var sql = 'SELECT node_level FROM  ' + tableModel + '  where id = ' + id;
		connection.query(sql, function (error, rows) {
			if (rows.length > 0) {
				ret = rows[0].node_level + 1;
			} else {
				ret = 0;
			}
			callback(ret);
		});
	});
}

function OrderList(new_order, fwcloud, id_parent, old_order, id) {
	var increment = '+1';
	var order1 = new_order;
	var order2 = old_order;
	if (new_order > old_order) {
		increment = '-1';
		order1 = old_order;
		order2 = new_order;
	}

	db.get(function (error, connection) {
		if (error)
			callback(error, null);
		var sql = 'UPDATE ' + tableModel + ' SET ' +
				'node_order = node_order' + increment +
				' WHERE (fwcloud = ' + connection.escape(fwcloud) + ' OR fwcloud is null) ' +
				' AND id_parent=' + connection.escape(id_parent) +
				' AND node_order>=' + order1 + ' AND node_order<=' + order2 +
				' AND id<>' + connection.escape(id);
		connection.query(sql);
		//logger.debug(sql);
	});
}
//Busca todos los padres donde aparece el IPOBJ a borrar
//Ordena todos los nodos padres sin contar el nodo del IPOBJ
//Order Tree Node by IPOBJ
fwc_treeModel.orderTreeNodeDeleted = function (fwcloud, id_obj_deleted, callback) {
	db.get(function (error, connection) {
		if (error)
			callback(error, null);
		var sqlParent = 'SELECT DISTINCT id_parent FROM ' + tableModel + ' WHERE (fwcloud=' + connection.escape(fwcloud) + ' OR fwcloud is null) AND id_obj=' + connection.escape(id_obj_deleted) + ' order by id_parent';
		logger.debug(sqlParent);
		connection.query(sqlParent, function (error, rows) {
			if (rows.length > 0) {
				var order = 0;
				asyncMod.map(rows, function (row, callback1) {
					var id_parent = row.id_parent;
					var sqlNodes = 'SELECT * FROM ' + tableModel + ' WHERE (fwcloud=' + connection.escape(fwcloud) + ' OR fwcloud is null) AND id_parent=' + connection.escape(id_parent) + ' AND id_obj<>' + connection.escape(id_obj_deleted) + ' order by id_parent, node_order';
					logger.debug(sqlNodes);
					connection.query(sqlNodes, function (error, rowsnodes) {
						if (rowsnodes.length > 0) {
							var order = 0;
							asyncMod.map(rowsnodes, function (rowNode, callback2) {
								order++;
								sql = 'UPDATE ' + tableModel + ' SET node_order=' + order +
										' WHERE id_parent = ' + connection.escape(id_parent) + ' AND id=' + connection.escape(rowNode.id);
								connection.query(sql, function (error, result) {
									if (error) {
										callback2();
									} else {
										callback2();
									}
								});
							}, //Fin de bucle
									function (err) {
										callback(null, {"result": true});
									}
							);
						} else callback1();
					});
				}, //Fin de bucle
						function (err) {
							callback(null, {"result": true});
						}

				);
			} else {
				callback(null, {"result": false});
			}
		});
	});
};
//Order Tree Node by IPOBJ
fwc_treeModel.orderTreeNode = function (fwcloud, id_parent, callback) {
	db.get(function (error, connection) {
		if (error)
			callback(error, null);
		var sqlNodes = 'SELECT * FROM ' + tableModel + ' WHERE (fwcloud=' + connection.escape(fwcloud) + ' OR fwcloud is null) AND id_parent=' + connection.escape(id_parent) + '  order by node_order';
		logger.debug(sqlNodes);
		connection.query(sqlNodes, function (error, rowsnodes) {
			if (rowsnodes.length > 0) {
				var order = 0;
				asyncMod.map(rowsnodes, function (rowNode, callback2) {
					order++;
					sql = 'UPDATE ' + tableModel + ' SET node_order=' + order +
							' WHERE id_parent = ' + connection.escape(id_parent) + ' AND id=' + connection.escape(rowNode.id);
					logger.debug(sql);
					connection.query(sql, function (error, result) {
						if (error) {
							callback2();
						} else {
							callback2();
						}
					});
				}, //Fin de bucle
						function (err) {
							callback(null, {"result": true});
						}
				);
			} else
				callback(null, {"result": true});
		});
	});
};

//Add new folder node
fwc_treeModel.createFolderNode = nodeData => {
	return new Promise((resolve, reject) => {
		db.get((error, connection) => {
			if (error) return reject(error);
			// Verify that parent node exists and is a node that can contain folders.
			let sql =  'SELECT node_type FROM ' + tableModel +
				' WHERE fwcloud=' + connection.escape(nodeData.fwcloud) + ' AND id=' + connection.escape(nodeData.id_parent); 
			connection.query(sql, (error, result) => {
				if (error) return reject(error);
				if (result.length !== 1) return reject(new Error('Parent node tree not found'));
				if (result[0].node_type!=='FDF' && result[0].node_type!=='FD') 
					return reject(new Error('Can not create folders under this node type'));

				connection.query('INSERT INTO ' + tableModel + ' SET ?', nodeData, (error, result) => {
					if (error) return reject(error);
					// Return the las inserted id.
					(result.insertId) ?	resolve({"insertId": result.insertId}) : reject(new Error('Node tree not created'));
				});
			});
		});
	});
};

//Remove folder node from tree
fwc_treeModel.deleteFolderNode = (fwcloud,id) => {
	return new Promise((resolve, reject) => {
		db.get((error, connection) => {
			if (error) return reject(error);
			// Verify that node exists. has no childs and the type of it is 'FD' (folder).
			let sql =  'SELECT node_type,(select count(*) from '+tableModel+' where id_parent=' +  connection.escape(id) + ') as childs' +
				' FROM ' + tableModel + ' WHERE fwcloud=' + connection.escape(fwcloud) + ' AND id=' + connection.escape(id); 
			connection.query(sql, (error, result) => {
				if (error) return reject(error);
				if (result.length!==1) return reject(new Error('Node tree not found'));
				if (result[0].node_type!=='FD') return reject(new Error('This node is not a folder'));
				if (result[0].childs!==0) return reject(new Error('This folder node is not empty')); 

				sql = 'DELETE FROM ' + tableModel +
					' WHERE fwcloud=' + connection.escape(fwcloud) + ' AND id=' + connection.escape(id);
				connection.query(sql, (error, result) => {
					if (error) return reject(error);
					resolve();
				});
			});
		});
	});
};

//Move node into folder
fwc_treeModel.moveToFolder = (fwcloud,src,dst) => {
	return new Promise((resolve, reject) => {
		db.get((error, connection) => {
			if (error) return reject(error);
			// Verify that folder node exists and that the node that is being droped into can be moved.
			let sql =  'SELECT T1.node_type as src_type,T2.node_type as dst_type' +
				' FROM ' + tableModel + ' as T1, ' + tableModel + ' as T2 ' +
				' WHERE T1.fwcloud=' + connection.escape(fwcloud) + ' AND T1.id=' + connection.escape(src) +
				' AND T2.fwcloud=' + connection.escape(fwcloud) + ' AND T2.id=' + connection.escape(dst); 
			connection.query(sql, (error, result) => {
				if (error) return reject(error);
				if (result.length!==1) return reject(new Error('Node not found'));
				if (result[0].src_type!=='FD' && result[0].src_type!=='FW' && result[0].src_type!=='CL') return reject(new Error('Source node type is not valid'));
				if (result[0].dst_type!=='FD') return reject(new Error('Destination node is not a folder'));

				sql = 'UPDATE ' + tableModel +
					' SET id_parent=' + connection.escape(dst) +
					' WHERE fwcloud=' + connection.escape(fwcloud) + ' AND id=' + connection.escape(src);
				connection.query(sql, (error, result) => {
					if (error) return reject(error);
					resolve();
				});
			});
		});
	});
};
