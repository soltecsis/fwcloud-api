var db = require('../../db.js');


//create object
var policyPositionModel = {};
const IpobjModel = require('../../models/ipobj/ipobj');
const Ipobj_gModel = require('../../models/ipobj/group');
const InterfaceModel = require('../../models/interface/interface');
const openvpnModel = require('../../models/vpn/openvpn');
const pkiModel = require('../../models/vpn/pki');
var data_policy_positions = require('../../models/data/data_policy_positions');
var data_policy_position_ipobjs = require('../../models/data/data_policy_position_ipobjs');

var tableModel = "policy_position";


var logger = require('log4js').getLogger("app");

//Get All policy_position
policyPositionModel.getPolicy_positions = function (callback) {
	db.get(function (error, connection) {
		if (error)
			callback(error, null);
		connection.query('SELECT * FROM ' + tableModel + ' ORDER BY position_order', function (error, rows) {
			if (error)
				callback(error, null);
			else
				callback(null, rows);
		});
	});
};



//Get policy_position by  type
policyPositionModel.getPolicyPositionsByType = (dbCon,type) => {
	return new Promise((resolve, reject) => {
		dbCon.query(`SELECT * FROM ${tableModel} WHERE policy_type=${type} ORDER BY position_order`, (error, result) => {
			if (error) return reject(error);
			resolve(result);
		});
	});
};

function getNegateStatus(dbCon,rule, position) {
	return new Promise((resolve, reject) => {
		let sql = `SELECT count(negate) as neg FROM policy_r__ipobj
			WHERE rule=${rule} AND position=${position} AND negate=1`;
		dbCon.query(sql, (error, rows) => {
			if (error) return reject(error);
				resolve((rows[0].neg>0)?1:0);
		});
	});
};

//Get object information for the position. Grops, hosts, interfaces, etc. will be breakdown to leaf nodes information.
policyPositionModel.getRulePositionDataDetailed = position => {
	return new Promise((resolve, reject) => {
		db.get(function (error, dbCon) {
			if (error) return reject(error);
			//SELECT ALL IPOBJ UNDER a POSITION
			let sql = 'SELECT ' + position.fwcloud + ' as fwcloud, ' + position.firewall + ' as firewall,  P.rule, O.id as ipobj, P.ipobj_g, P.interface as interface, position, position_order, negate, "O" as type ' +
				' FROM policy_r__ipobj P ' +
				' inner join ipobj O on O.id=P.ipobj ' +
				' WHERE rule=' + dbCon.escape(position.rule) + ' AND position=' + dbCon.escape(position.id) +
				' AND O.type<>8 ' +
				' UNION ' + //SELECT IPOBJ UNDER HOST/INTERFACE
				' SELECT ' + position.fwcloud + ' as fwcloud, ' + position.firewall + ' as firewall,  rule, OF.id as ipobj, P.ipobj_g, P.interface as interface, position, position_order, negate, "O" as type ' +
				' FROM policy_r__ipobj P ' +
				' inner join ipobj O on O.id=P.ipobj ' +
				' inner join interface__ipobj II on II.ipobj=O.id ' +
				' inner join interface I on I.id=II.interface ' +
				' inner join ipobj OF on OF.interface=I.id ' +
				' WHERE rule=' + dbCon.escape(position.rule) + ' AND position=' + dbCon.escape(position.id) +
				' AND O.type=8 ' +
				' UNION ' + //SELECT IPOBJ UNDER GROUP (NOT HOSTS)
				' SELECT ' + position.fwcloud + ' as fwcloud, ' + position.firewall + ' as firewall,  rule, O.id as ipobj, P.ipobj_g, P.interface as interface, position, position_order, negate, "O" as type ' +
				' FROM policy_r__ipobj P ' +
				' inner join ipobj__ipobjg G on G.ipobj_g=P.ipobj_g ' +
				' inner join ipobj O on O.id=G.ipobj ' +
				' WHERE O.type<>8 AND rule=' + dbCon.escape(position.rule) + ' AND position=' + dbCon.escape(position.id) +
				' UNION ' + //SELECT IPOBJ UNDER HOST IN GROUP 
				' SELECT ' + position.fwcloud + ' as fwcloud, ' + position.firewall + ' as firewall,  rule, OF.id as ipobj, P.ipobj_g, P.interface as interface, position, position_order, negate, "O" as type ' +
				' FROM policy_r__ipobj P ' +
				' inner join ipobj__ipobjg G on G.ipobj_g=P.ipobj_g ' +
				' inner join ipobj O on O.id=G.ipobj ' +
				' inner join interface__ipobj II on II.ipobj=O.id ' +
				' inner join interface I on I.id=II.interface ' +
				' inner join ipobj OF on OF.interface=I.id ' +
				' WHERE O.type=8 AND rule=' + dbCon.escape(position.rule) + ' AND position=' + dbCon.escape(position.id) +
				' UNION ' + //SELECT INTERFACES in  POSITION I
				' SELECT ' + position.fwcloud + ' as fwcloud, ' + position.firewall + ' as firewall, rule, -1,-1,I.id as interface,position,position_order, negate, "I" as type ' +
				' FROM policy_r__interface P ' +
				' inner join interface I on I.id=P.interface ' +
				' WHERE rule=' + dbCon.escape(position.rule) + ' AND position=' + dbCon.escape(position.id) +
				' UNION ' + //SELECT IPOBJ UNDER INTERFACE POSITION O
				' SELECT ' + position.fwcloud + ' as fwcloud, ' + position.firewall + ' as firewall, rule, O.id as ipobj,-1,-1 as interface,position,position_order, negate, "O" as type ' +
				' FROM policy_r__ipobj P ' +
				' inner join interface I on I.id=P.interface ' +
				' inner join ipobj O on O.interface=I.id ' +
				' WHERE rule=' + dbCon.escape(position.rule) + ' AND position=' + dbCon.escape(position.id) +
				' ORDER BY position_order';

			//logger.debug("BUSCANDO OBJETOS EN POSITION: ", position.name, "  -> ", sql);
			dbCon.query(sql, async (error, rows) => {
				if (error) return reject(error);

				try {
					const negate =  await getNegateStatus(dbCon, position.rule, position.id);
					const dataI = position.ipobjs = await Promise.all(rows.map(IpobjModel.getFinalIpobjPro));
					resolve({"id": position.id, "name": position.name, "position_order": position.position_order, "negate": negate, "position_objs": dataI});
				}	catch(error) { reject(error) }
			});
		});
	});
};


policyPositionModel.getRulePositionData = position => {
	return new Promise((resolve, reject) => {
		db.get((error, dbCon) => {
			if (error) return reject(error);

			var position_node = new data_policy_positions(position);

			let sql = `SELECT rule, ipobj, ipobj_g, interface, position, position_order, negate, "O" as type 
				FROM policy_r__ipobj WHERE rule=${position.rule} AND position=${position.id}

				UNION SELECT rule, interface, 0, 0, position, position_order, negate, "I" as type 
				FROM policy_r__interface WHERE rule=${position.rule} AND position=${position.id}

				UNION SELECT rule, openvpn, 0, 0, position, position_order, negate, "VPN" as type 
				FROM policy_r__openvpn WHERE rule=${position.rule} AND position=${position.id}

				UNION SELECT rule, prefix, 0, 0, position, position_order, negate, "PRE" as type 
				FROM policy_r__prefix WHERE rule=${position.rule} AND position=${position.id}
				ORDER BY position_order`;
			
			dbCon.query(sql, async (error, items) => {
				if (error) return reject(error);

				try {
					//obtenemos IPOBJS o INTERFACES o GROUPS
					k = 0;
					//for (k = 0; k < data__rule_ipobjs.length; k++) {
					ipobj_cont = items.length;
					//creamos array de ipobj
					position_node.ipobjs = new Array();

					for (let item of items) {
						let data = {};
						if (item.ipobj>0 && item.type==='O') // IPOBJ
						  data = await IpobjModel.getIpobj(dbCon, position.fwcloud, item.ipobj);
						else if (item.ipobj_g>0 && item.type==='O') // IPOBJ GROUP
							data = await Ipobj_gModel.getIpobj_g(dbCon, position.fwcloud, item.ipobj_g)
						else if (item.interface>0 || item.type==='I') // Network interface.
							data = await InterfaceModel.getInterface(position.fwcloud, (item.type==='I')?item.ipobj:item.interface);
						else if (item.ipobj>0 && item.type==='VPN') // OPENVPN
							data = await openvpnModel.getOpenvpnInfo(dbCon, position.fwcloud, item.ipobj,1);
						else if (item.ipobj>0 && item.type==='PRE') // OPENVPN PREFIXES
							data = await pkiModel.getPrefixInfo(dbCon, position.fwcloud, item.ipobj,1);
						else data = null;

						if (data) {
							var ipobj_node = new data_policy_position_ipobjs(data[0], item.position_order, item.negate, item.type);
							// Add new object node to positions array.
							position_node.ipobjs.push(ipobj_node);
						}
					}
		
					resolve(position_node);
				} catch(error) { reject(error) }
			});
		});
	});
};

//Get policy_position by type
policyPositionModel.getRulePositions = rule => {
	return new Promise((resolve, reject) => {
		db.get((error, connection) => {
			if (error) return reject(error);
			
			let sql = `SELECT ${rule.fwcloud} as fwcloud,${rule.firewall} as firewall,${rule.id} as rule, P.* 
				FROM ${tableModel} P WHERE P.policy_type=${rule.type} ORDER BY P.position_order`;
			connection.query(sql, async (error, positions) => {
				if (error) return reject(error);
				resolve(positions);
			});
		});
	});
};



//Get policy_position by  id
policyPositionModel.getPolicy_position = function (id, callback) {
	db.get(function (error, connection) {
		if (error)
			callback(error, null);
		var sql = 'SELECT * FROM ' + tableModel + ' WHERE id = ' + connection.escape(id);
		connection.query(sql, function (error, row) {
			if (error)
				callback(error, null);
			else
				callback(null, row);
		});
	});
};


//Add new policy_position
policyPositionModel.insertPolicy_position = function (policy_positionData, callback) {
	db.get(function (error, connection) {
		if (error)
			callback(error, null);
		connection.query('INSERT INTO ' + tableModel + ' SET ?', policy_positionData, function (error, result) {
			if (error) {
				callback(error, null);
			} else {
				//devolvemos la última id insertada
				callback(null, {"insertId": result.insertId});
			}
		});
	});
};

//Update policy_position
policyPositionModel.updatePolicy_position = function (policy_positionData, callback) {

	db.get(function (error, connection) {
		if (error)
			callback(error, null);
		var sql = 'UPDATE ' + tableModel + ' SET name = ' + connection.escape(policy_positionData.name) + ', ' +
				'policy_type = ' + connection.escape(policy_positionData.poicy_type) + ', ' +
				'position_order = ' + connection.escape(policy_positionData.position_order) + ', ' +
				'content = ' + connection.escape(policy_positionData.content) + ' ' +
				' WHERE id = ' + policy_positionData.id;
		logger.debug(sql);
		connection.query(sql, function (error, result) {
			if (error) {
				callback(error, null);
			} else {
				callback(null, {"result": true});
			}
		});
	});
};

//Remove policy_position with id to remove
policyPositionModel.deletePolicy_position = function (id, callback) {
	db.get(function (error, connection) {
		if (error)
			callback(error, null);
		var sqlExists = 'SELECT * FROM ' + tableModel + ' WHERE id = ' + connection.escape(id);
		connection.query(sqlExists, function (error, row) {
			//If exists Id from policy_position to remove
			if (row) {
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
			} else {
				callback(null, {"result": false});
			}
		});
	});
};

//Export the object
module.exports = policyPositionModel;