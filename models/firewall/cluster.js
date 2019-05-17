var db = require('../../db.js');
//create object
var clusterModel = {};

//Export the object
module.exports = clusterModel;

var tableModel = "cluster";

var firewallModel = require('../../models/firewall/firewall');
var fwcTreemodel = require('../tree/tree');
var interfaceModel = require('../../models/interface/interface');

var logger = require('log4js').getLogger("app");

//Get All clusters
clusterModel.getClusterCloud = req => {
	return new Promise((resolve, reject) => {
		var sql = `SELECT T.* FROM ${tableModel} T 
			INNER JOIN user__fwcloud U ON T.fwcloud=U.fwcloud AND U.user=${req.session.user_id}
			WHERE T.fwcloud=${req.body.fwcloud}`;
		req.dbCon.query(sql, (error, rows) => {
			if (error) return reject(error);
			resolve(rows);
		});
	});
};

//Get FULL cluster by  id
clusterModel.getCluster = req => {
	return new Promise((resolve, reject) => {
		var sql = 'SELECT * FROM ' + tableModel + ' WHERE id = ' + req.dbCon.escape(req.body.cluster) + ' AND fwcloud=' + req.dbCon.escape(req.body.fwcloud);
		req.dbCon.query(sql, function (error, row) {
			if (error) return reject(error);
			if (row && row.length > 0) {
				var dataCluster = row[0];
				//SEARCH FIREWALL NODES
				firewallModel.getFirewallCluster(req.session.user_id, req.body.cluster, (error, dataFw) => {
					if (error) return reject(error);
					//get data
					if (dataFw && dataFw.length > 0)
					{
						dataCluster.nodes = dataFw;
						//SEARCH INTERFACES FW-MASTER
						firewallModel.getFirewallClusterMaster(req.session.user_id, req.body.cluster, (error, dataFwM) => {
							if (error) return reject(error);
							if (dataFwM && dataFwM.length > 0) {
								var idFwMaster = dataFwM[0].id;
								interfaceModel.getInterfacesFull(idFwMaster, req.body.fwcloud, (error, dataI) => {
									if (error) return reject(error);
									if (dataI && dataI.length > 0) {
										dataCluster.interfaces = dataI;
									} else
										dataCluster.interfaces = [];
									resolve(dataCluster);
								});
							} else
								resolve(dataCluster);
						});
					} else {
						dataCluster.nodes = [];
						resolve(dataCluster);
					}

				});
			} else resolve();
		});
	});
};

//Get clusters by name
clusterModel.getClusterName = function (name, callback) {
	db.get(function (error, connection) {
		if (error)
			callback(error, null);
		var sql = 'SELECT * FROM ' + tableModel + ' WHERE name like  "%' + connection.escape(name) + '%"';
		connection.query(sql, function (error, row) {
			if (error)
				callback(error, null);
			else
				callback(null, row);
		});
	});
};

//Add new cluster
clusterModel.insertCluster = function (clusterData, callback) {
	db.get(function (error, connection) {
		if (error)
			callback(error, null);
		logger.debug(clusterData);
		connection.query('INSERT INTO ' + tableModel + ' SET ?', clusterData, function (error, result) {
			if (error) {
				callback(error, null);
			} else {
				//devolvemos la última id insertada
				callback(null, {"insertId": result.insertId});
			}
		});
	});
};

//Update cluster
clusterModel.updateCluster = (dbCon, fwcloud, clusterData) => {
	return new Promise((resolve, reject) => {
		let sql = `UPDATE ${tableModel} SET name=${dbCon.escape(clusterData.name)}, comment=${dbCon.escape(clusterData.comment)}
			WHERE id=${clusterData.id} AND fwcloud=${fwcloud}`;
		dbCon.query(sql, (error, result) => {
			if (error) return reject(error);

			sql = `UPDATE firewall SET status=status|3, options=${clusterData.options}
				WHERE cluster=${clusterData.id} AND fwcloud=${fwcloud}`;
			dbCon.query(sql, (error, result) => {
				if (error) return reject(error);
				resolve();                
			});
		});
	});
};

//Remove cluster with id to remove
clusterModel.deleteCluster = (dbCon, cluster, iduser, fwcloud) => {
	return new Promise((resolve, reject) => {
		//BUCLE de FIREWALL en CLUSTER
		let sql = `SELECT ${iduser} as iduser, F.* FROM firewall F
			WHERE F.cluster=${cluster} AND F.fwcloud=${fwcloud} ORDER BY fwmaster desc`;
		dbCon.query(sql, async (error, fws) => {
			if (error) return reject(error);

			try {
				for (let fw of fws)
					await firewallModel.deleteFirewall(iduser, fwcloud, fw.id)
			} catch(error) { return reject(error) }

			sql = `SELECT T.* , A.id as idnode FROM ${tableModel} T
				INNER JOIN fwc_tree A ON A.id_obj=T.id AND A.obj_type=100
				WHERE T.id=${cluster}`;
			dbCon.query(sql, async (error, cluster) => {
				if (error) return reject(error);

				try {
					//If exists Id from cluster to remove
					if (cluster.length > 0)
						await fwcTreemodel.deleteFwc_TreeFullNode({id: cluster[0].idnode, fwcloud: fwcloud, iduser: iduser});
				} catch(error) { return reject(error) }

				dbCon.query(`DELETE FROM ${tableModel} WHERE id=${cluster[0].id}`, (error, result) => {
					if (error) return reject(error);
					resolve();
				});
			});
		});
	});
};

//Remove cluster with id to remove
clusterModel.deleteClusterSimple = function (id, iduser, fwcloud, callback) {

	db.get(function (error, connection) {
		if (error)
			callback(error, null);
		logger.debug("------>>>> DELETING CLUSTER: ", id);
		var sqlExists = 'SELECT T.* , A.id as idnode FROM ' + tableModel + ' T ' +
				' INNER JOIN fwc_tree A ON A.id_obj = T.id AND A.obj_type=100 ' +
				' WHERE T.id = ' + connection.escape(id);
		logger.debug("SQL DELETE CLUSTER: ", sqlExists);
		connection.query(sqlExists, function (error, row) {
			//If exists Id from cluster to remove
			if (row.length > 0) {
				var dataNode = {id: row[0].idnode, fwcloud: fwcloud, iduser: iduser};
				fwcTreemodel.deleteFwc_TreeFullNode(dataNode)
						.then(resp => {
							db.get(function (error, connection) {
								var sql = 'DELETE FROM ' + tableModel + ' WHERE id = ' + connection.escape(id);
								connection.query(sql, function (error, result) {
									if (error) {
										callback(error, null);
									} else {
										callback(null, {"result": true});
									}
								});
							});
						});
			} else {
				callback(null, {"result": false});
			}
		});

	});
};

