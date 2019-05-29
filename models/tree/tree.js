var db = require('../../db.js');
const fwcError = require('../../utils/error_table');
var asyncMod = require('async');

//create object
var fwcTreeModel = {};

//Export the object
module.exports = fwcTreeModel;



var logger = require('log4js').getLogger("app");

var tableModel = "fwc_tree";
//var Node = require("tree-node");
var Tree = require('easy-tree');
var fwc_tree_node = require("./node.js");


//Get fwcloud root node bye type.
fwcTreeModel.getRootNodeByType = (req, type) => {
	return new Promise((resolve, reject) => {
		var sql = `SELECT T.*, P.order_mode FROM ${tableModel} T
			inner join fwcloud C on C.id=T.fwcloud
			LEFT JOIN fwc_tree_node_types P on T.node_type=P.node_type
			WHERE T.fwcloud=${req.body.fwcloud} AND T.node_type=${req.dbCon.escape(type)} AND T.id_parent is null`;

		req.dbCon.query(sql, (error, rows) => {
			if (error) return reject(error);
			if (rows.lenght === 0) return reject(fwcError.other(`Root node of type '${type}' not found`));
			if (rows.lenght > 1) return reject(fwcError.other(`Found more than one root nodes of type '${type}'`));
			resolve(rows[0]);
		});
	});
};


fwcTreeModel.hasChilds = (req, node_id) => {
	return new Promise((resolve, reject) => {
		req.dbCon.query(`SELECT count(*) AS n FROM ${tableModel} WHERE id_parent=${node_id}`, (error, result) => {
			if (error) return reject(error);
			resolve((result[0].n >0) ? true : false);
		});
	});
};

//Get COMPLETE TREE from idparent
fwcTreeModel.getTree = (req, idparent, tree, objStandard, objCloud, order_mode) => {
	return new Promise((resolve, reject) => {
		var sqlfwcloud = "";
		if (objStandard===1 && objCloud===0) // Only Standard objects
			sqlfwcloud = ` AND (T.fwcloud is null OR (T.id_obj is null AND T.fwcloud=${req.body.fwcloud})) `;
		else if (objStandard===0 && objCloud===1) // Only fwcloud objects
			sqlfwcloud = ` AND (T.fwcloud=${req.body.fwcloud} OR (T.id_obj is null AND T.fwcloud=${req.body.fwcloud})) `;
		else if (objStandard===1 && objCloud===1) // All objects
			sqlfwcloud = ` AND (T.fwcloud=${req.body.fwcloud} OR T.fwcloud is null OR (T.id_obj is null AND T.fwcloud=${req.body.fwcloud})) `;
		else // No objects.
			sqlfwcloud = ` AND (T.fwcloud is not null AND (T.id_obj is null AND T.fwcloud=${req.body.fwcloud})) `;
		
		const sqlorder = (order_mode===2) ? 'name' : 'id';

		//Get ALL CHILDREN NODES FROM idparent
		const sql = `SELECT T.*, P.order_mode FROM ${tableModel} T
			LEFT JOIN fwc_tree_node_types P on T.node_type=P.node_type
			WHERE T.id_parent=${idparent} ${sqlfwcloud} ORDER BY ${sqlorder}`;

		req.dbCon.query(sql, async (error, nodes) => {
			if (error) return reject(error);

			try {
				for (let node of nodes) {
					var tree_node = new fwc_tree_node(node);

					if (await fwcTreeModel.hasChilds(req,node.id)) {
						var subtree = new Tree(tree_node);
						tree.append([], subtree);
						await fwcTreeModel.getTree(req, node.id, subtree, objStandard, objCloud, node.order_mode);
					} else 
						tree.append([], tree_node);
				}
				resolve(tree);
			} catch(error) { reject(error) }
		});
	});
};

// Put STD folders first.
fwcTreeModel.stdFoldersFirst = root_node => {
	return new Promise((resolve, reject) => {
		// Put standard folders at the begining.
		for (let node1 of root_node.children) {
			for (let [index, node2] of node1.children.entries()) {
				if (node2.node_type==='STD') {
					if (index===0) break;
					node1.children.unshift(node2);
					node1.children.splice(index+1,1);
					break;
				}
			}
		}	
		resolve();				
	});
};


// Remove all tree nodes with the indicated id_obj.
fwcTreeModel.deleteObjFromTree = (fwcloud, id_obj, obj_type) => {
	return new Promise((resolve, reject) => {
		db.get((error, connection) => {
			if (error) return reject(error);

			//let sqlExists = 'SELECT fwcloud,id FROM ' + tableModel + ' WHERE node_type not like "F%" AND fwcloud=' + fwcloud + ' AND id_obj=' + id_obj;        
			let sql = 'SELECT fwcloud,id FROM ' + tableModel +
				' WHERE fwcloud=' + fwcloud + ' AND id_obj=' + id_obj + ' AND obj_type=' + obj_type;
			connection.query(sql, async (error, rows) => {
				if (error) return reject(error);

				try {
					for (let node of rows)
						await fwcTreeModel.deleteFwc_TreeFullNode(node);
					resolve();
				}	catch(error) { reject(error) }
			});
		});
	});
};

//REMOVE FULL TREE FROM PARENT NODE
fwcTreeModel.deleteFwc_TreeFullNode = data => {
	return new Promise((resolve, reject) => {
		db.get((error, connection) => {
			if (error) return reject(error);

			let sql = `SELECT * FROM ${tableModel} 
				WHERE (fwcloud=${data.fwcloud} OR fwcloud is null) AND id_parent=${data.id}`;
			connection.query(sql, async (error, rows) => {
				if (error) return reject(error);

				try {
					if (rows.length > 0) 
						await Promise.all(rows.map(fwcTreeModel.deleteFwc_TreeFullNode));
					await fwcTreeModel.deleteFwc_Tree_node(data.id);
					resolve();
				}	catch(err) { return reject(err) }
			});
		});
	});
};

//DELETE NODE
fwcTreeModel.deleteFwc_Tree_node = id => {
	return new Promise((resolve, reject) => {
		db.get((error, connection) => {
			if (error) return reject(error);
			
			connection.query(`DELETE FROM ${tableModel} WHERE id=${id}`, (error, result) => {
				if (error) return reject(error);
				resolve({"result": true, "msg": "deleted"});
			});
		});
	});
};

// Delete nodes under the indicated node.
fwcTreeModel.deleteNodesUnderMe = (dbCon,fwcloud,node_id) => {
	return new Promise((resolve, reject) => {
		let sql = `SELECT fwcloud,id FROM ${tableModel} 
			WHERE (fwcloud=${fwcloud} OR fwcloud is null) AND id_parent=${node_id}`;
		dbCon.query(sql, async (error, rows) => {
			if (error) return reject(error);

			try {
				if (rows.length > 0) 
					await Promise.all(rows.map(fwcTreeModel.deleteFwc_TreeFullNode));

				resolve();
			}	catch(err) { return reject(err) }
		});
	});
};

//Verify node info.
fwcTreeModel.verifyNodeInfo = (id, fwcloud, id_obj) => {
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

//Create new node.
fwcTreeModel.newNode = (dbCon,fwcloud,name,id_parent,node_type,id_obj,obj_type) => {
	return new Promise((resolve, reject) => {
		let sql = 'INSERT INTO ' + tableModel +
			' (name,id_parent,node_type,id_obj,obj_type,fwcloud)' +
			' VALUES ('+dbCon.escape(name.substring(0,45))+','+id_parent+','+dbCon.escape(node_type)+','+id_obj+','+obj_type+','+fwcloud+')'; 
		dbCon.query(sql, (error, result) => {
			if (error) return reject(error);
			resolve(result.insertId);
		});
	});
};


//UPDATE ID_OBJ FOR FIREWALL CLUSTER FULL TREE FROM PARENT NODE
fwcTreeModel.updateIDOBJFwc_TreeFullNode = function (data) {
	return new Promise((resolve, reject) => {
		db.get(function (error, connection) {
			if (error) return reject(error);

			var sql = 'SELECT ' + connection.escape(data.OLDFW) +' as OLDFW, ' + connection.escape(data.NEWFW) + ' as NEWFW, T.* ' + 
				' FROM ' + tableModel + ' T ' + 
				' WHERE fwcloud = ' + connection.escape(data.fwcloud) + ' AND id_parent=' + connection.escape(data.id) + 
				' AND id_obj=' + connection.escape(data.OLDFW);
			logger.debug(sql);
			connection.query(sql, function (error, rows) {
				if (error) return reject(error);
				if (rows.length > 0) {
					logger.debug("-----> UPDATING NODES UNDER PARENT: " + data.id);
					//Bucle por interfaces
					Promise.all(rows.map(fwcTreeModel.updateIDOBJFwc_TreeFullNode))
							.then(resp => {
								//logger.debug("----------- FIN PROMISES ALL NODE PADRE: ", data.id);
								fwcTreeModel.updateIDOBJFwc_Tree_node(data.fwcloud, data.id,data.NEWFW )
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
					fwcTreeModel.updateIDOBJFwc_Tree_node(data.fwcloud, data.id,data.NEWFW)
							.then(resp => {
								logger.debug("UPDATED NODE: ", data.id);
								resolve();
							})
							.catch(e => reject(e));
				}
			});
		});
	});
};


//UPDATE NODE
fwcTreeModel.updateIDOBJFwc_Tree_node = function (fwcloud, id, idNew) {
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


fwcTreeModel.createObjectsTree = req => {
	return new Promise(async (resolve, reject) => {
		try {
			let ids = {};
			let id;

			// OBJECTS
			ids.OBJECTS = await fwcTreeModel.newNode(req.dbCon,req.body.fwcloud,'OBJECTS',null,'FDO',null,null);

			// OBJECTS / Addresses
			ids.Addresses = await fwcTreeModel.newNode(req.dbCon,req.body.fwcloud,'Addresses',ids.OBJECTS,'OIA',null,5);
			id = await fwcTreeModel.newNode(req.dbCon,req.body.fwcloud,'Standard',ids.Addresses,'STD',null,null);
			await fwcTreeModel.createStdObjectsTree(req.dbCon,id,'OIA',5);

			// OBJECTS / Addresses Ranges
			ids.AddressesRanges = await fwcTreeModel.newNode(req.dbCon,req.body.fwcloud,'Address Ranges',ids.OBJECTS,'OIR',null,6);
			id = await fwcTreeModel.newNode(req.dbCon,req.body.fwcloud,'Standard',ids.AddressesRanges,'STD',null,null);
			await fwcTreeModel.createStdObjectsTree(req.dbCon,id,'OIR',6);

			// OBJECTS / Networks
			ids.Networks = await fwcTreeModel.newNode(req.dbCon,req.body.fwcloud,'Networks',ids.OBJECTS,'OIN',null,7);
			id = await fwcTreeModel.newNode(req.dbCon,req.body.fwcloud,'Standard',ids.Networks,'STD',null,null);
			await fwcTreeModel.createStdObjectsTree(req.dbCon,id,'OIN',7);

			// OBJECTS / DNS
			ids.DNS = await fwcTreeModel.newNode(req.dbCon,req.body.fwcloud,'DNS',ids.OBJECTS,'ONS',null,9);

			// OBJECTS / Hosts
			await fwcTreeModel.newNode(req.dbCon,req.body.fwcloud,'Hosts',ids.OBJECTS,'OIH',null,8);

			// OBJECTS / Marks
			ids.Marks = await fwcTreeModel.newNode(req.dbCon,req.body.fwcloud,'Iptables Marks',ids.OBJECTS,'MRK',null,30);

			// OBJECTS / Groups
			ids.Groups = await fwcTreeModel.newNode(req.dbCon,req.body.fwcloud,'Groups',ids.OBJECTS,'OIG',null,20);
			id = await fwcTreeModel.newNode(req.dbCon,req.body.fwcloud,'Standard',ids.Groups,'STD',null,null);
			await fwcTreeModel.createStdGroupsTree(req.dbCon,id,'OIG',20);

			resolve(ids);
		} catch(error) { return reject(error) }
	});
}

fwcTreeModel.createServicesTree = req => {
	return new Promise(async (resolve, reject) => {
		try {
			let ids = {};
			let id;

			// SERVICES
			ids.SERVICES = await fwcTreeModel.newNode(req.dbCon,req.body.fwcloud,'SERVICES',null,'FDS',null,null);

			// SERVICES / IP
			ids.IP = await fwcTreeModel.newNode(req.dbCon,req.body.fwcloud,'IP',ids.SERVICES,'SOI',null,1);
			id = await fwcTreeModel.newNode(req.dbCon,req.body.fwcloud,'Standard',ids.IP,'STD',null,null);
			await fwcTreeModel.createStdObjectsTree(req.dbCon,id,'SOI',1);
			
			// SERVICES / ICMP
			ids.ICMP = await fwcTreeModel.newNode(req.dbCon,req.body.fwcloud,'ICMP',ids.SERVICES,'SOM',null,3);
			id = await fwcTreeModel.newNode(req.dbCon,req.body.fwcloud,'Standard',ids.ICMP,'STD',null,null);
			await fwcTreeModel.createStdObjectsTree(req.dbCon,id,'SOM',3);

			// SERVICES / TCP
			ids.TCP = await fwcTreeModel.newNode(req.dbCon,req.body.fwcloud,'TCP',ids.SERVICES,'SOT',null,2);
			id = await fwcTreeModel.newNode(req.dbCon,req.body.fwcloud,'Standard',ids.TCP,'STD',null,null);
			await fwcTreeModel.createStdObjectsTree(req.dbCon,id,'SOT',2);

			// SERVICES / UDP
			ids.UDP = await fwcTreeModel.newNode(req.dbCon,req.body.fwcloud,'UDP',ids.SERVICES,'SOU',null,4);
			id = await fwcTreeModel.newNode(req.dbCon,req.body.fwcloud,'Standard',ids.UDP,'STD',null,null);
			await fwcTreeModel.createStdObjectsTree(req.dbCon,id,'SOU',4);

			// SERVICES / Groups
			ids.Groups = await fwcTreeModel.newNode(req.dbCon,req.body.fwcloud,'Groups',ids.SERVICES,'SOG',null,21);
			id = await fwcTreeModel.newNode(req.dbCon,req.body.fwcloud,'Standard',ids.Groups,'STD',null,null);
			await fwcTreeModel.createStdGroupsTree(req.dbCon,id,'SOG',21);

			resolve(ids);
		} catch(error) { return reject(error) }
	});
}

fwcTreeModel.createAllTreeCloud = req => {
	return new Promise(async (resolve, reject) => {
		try {
			// FIREWALLS
			await fwcTreeModel.newNode(req.dbCon,req.body.fwcloud,'FIREWALLS',null,'FDF',null,null);

			// OBJECTS
			await fwcTreeModel.createObjectsTree(req);

			// SERVICES
			await fwcTreeModel.createServicesTree(req);

			// Creating root node for CA (Certification Authorities).
			await fwcTreeModel.newNode(req.dbCon,req.body.fwcloud,'CA',null,'FCA',null,null);
			resolve();
		} catch(error) { return reject(error) }
	});
};

// Create tree with standard objects.
fwcTreeModel.createStdObjectsTree = (dbCon, node_id, node_type, ipobj_type) => {
	return new Promise((resolve, reject) => {
		let sql = 'SELECT id,name FROM ipobj WHERE fwcloud is null and type='+ipobj_type;
		dbCon.query(sql, async (error, result) => {
			if (error) return reject(error);

			try {
				for (let ipobj of result)
					await fwcTreeModel.newNode(dbCon,null,ipobj.name,node_id,node_type,ipobj.id,ipobj_type);
				resolve();
			} catch(error) { return reject(error) }
		});
	});
};

// Create nodes under group.
fwcTreeModel.createGroupNodes = (dbCon, fwcloud, node_id, group) => {
	return new Promise((resolve, reject) => {
		let sql = `SELECT O.id,O.name,O.type FROM ipobj__ipobjg G
			INNER JOIN ipobj O ON O.id=G.ipobj
			WHERE G.ipobj_g=${group}`;
		dbCon.query(sql, async (error, ipobjs) => {
			if (error) return reject(error);

			try {
				let node_type;
				for (let ipobj of ipobjs) {
					if (ipobj.type===1) node_type='SOI';
					else if (ipobj.type===2) node_type='SOT';
					else if (ipobj.type===3) node_type='SOM';
					else if (ipobj.type===2) node_type='SOT';
					else if (ipobj.type===4) node_type='SOU';
					else if (ipobj.type===5) node_type='OIA';
					else if (ipobj.type===6) node_type='OIR';
					else if (ipobj.type===7) node_type='OIN';
					else if (ipobj.type===8) node_type='OIN';
					else if (ipobj.type===9) node_type='ONS';
					await fwcTreeModel.newNode(dbCon,fwcloud,ipobj.name,node_id,node_type,ipobj.id,ipobj.type);
				}
			} catch(error) { return reject(error) }

			sql = `SELECT VPN.id,CRT.cn FROM openvpn__ipobj_g G
				INNER JOIN openvpn VPN ON VPN.id=G.openvpn
				INNER JOIN crt CRT ON CRT.id=VPN.crt
				WHERE G.ipobj_g=${group}`;
			dbCon.query(sql, async (error, openvpns) => {
				if (error) return reject(error);

				try {
					for (let openvpn of openvpns)
						await fwcTreeModel.newNode(dbCon,fwcloud,openvpn.cn,node_id,'OCL',openvpn.id,311);
				} catch(error) { return reject(error) }
 
				sql = `SELECT P.id,P.name FROM openvpn_prefix__ipobj_g G
					INNER JOIN openvpn_prefix P ON P.id=G.prefix
					WHERE G.ipobj_g=${group}`;
				dbCon.query(sql, async (error, prefixes) => {
					if (error) return reject(error);

					try {
						for (let prefix of prefixes)
							await fwcTreeModel.newNode(dbCon,fwcloud,prefix.name,node_id,'PRO',prefix.id,401);
					}	catch(error) { return reject(error) }
 					resolve();
				});
			});
		});
	});
};

// Create tree with standard groups.
fwcTreeModel.createStdGroupsTree = (dbCon, node_id, node_type, ipobj_type) => {
	return new Promise((resolve, reject) => {
		let sql = 'SELECT id,name FROM ipobj_g WHERE fwcloud is null and type='+ipobj_type;
		dbCon.query(sql, async (error, groups) => {
			if (error) return reject(error);

			try {
				let id;
				for (let group of groups) {
					id = await fwcTreeModel.newNode(dbCon,null,group.name,node_id,node_type,group.id,ipobj_type);
					await fwcTreeModel.createGroupNodes(dbCon,null,id,group.id)
				}
				resolve();
			} catch(error) { return reject(error) }
		});
	});
};


//Generate the IPs nodes for each interface.
fwcTreeModel.interfacesIpTree = (connection, fwcloud, nodeId, ifId) => {
	return new Promise((resolve, reject) => {
		// Get interface IPs.  
		let sql = 'SELECT O.id,O.name,O.type,O.address,T.node_type FROM ipobj O' +
			' INNER JOIN fwc_tree_node_types T on T.obj_type=O.type' +
			' WHERE O.interface=' + connection.escape(ifId);
		connection.query(sql, async (error, ips) => {
			if (error) return reject(error);
			if (ips.length===0) resolve();

			try {
				for(let ip of ips) {
					await fwcTreeModel.newNode(connection,fwcloud,`${ip.name} (${ip.address})`,nodeId,ip.node_type,ip.id,ip.type);
				}
			} catch(error) { return reject(error) }
			resolve();
		});
	});
};

//Generate the interfaces nodes.
fwcTreeModel.interfacesTree = (connection, fwcloud, nodeId, ownerId, ownerType) => {
	return new Promise((resolve, reject) => {
		// Get firewall interfaces.  
		let sql = '';
		let obj_type;
		
		if (ownerType==='FW') {
			sql = 'SELECT id,name,labelName FROM interface' +
				' WHERE firewall=' + connection.escape(ownerId) + ' AND interface_type=10';
			obj_type=10;
		}
		else if (ownerType==='HOST') {
			sql = 'SELECT I.id,I.name,I.labelName FROM interface I' +
				' INNER JOIN interface__ipobj IO on IO.interface=I.id ' +
				' WHERE IO.ipobj=' + connection.escape(ownerId) + ' AND I.interface_type=11';
			obj_type=11;
		}
		else return reject(fwcError.other('Invalid owner type'));

		connection.query(sql, async (error, interfaces) => {
			if (error) return reject(error);
			if (interfaces.length===0) resolve();

			try {
				for(let interface of interfaces) {
					let id = await fwcTreeModel.newNode(connection,fwcloud,interface.name+(interface.labelName ? ' ['+interface.labelName+']' : ''),nodeId,(ownerType==='FW') ? 'IFF' : 'IFH',interface.id,obj_type);
					await fwcTreeModel.interfacesIpTree(connection,fwcloud,id,interface.id);
				}
			} catch(error) { return reject(error )}
			resolve();
		});
	});
};

//Generate the OpenVPN client nodes.
fwcTreeModel.openvpnClientTree = (connection, fwcloud, firewall, server_vpn, node) => {
	return new Promise((resolve, reject) => {
		// Get client OpenVPN configurations.
		const sql = `SELECT VPN.id,CRT.cn FROM openvpn VPN
			INNER JOIN crt CRT on CRT.id=VPN.crt
			WHERE VPN.firewall=${firewall} and VPN.openvpn=${server_vpn}`
		connection.query(sql, async (error, vpns) => {
			if (error) return reject(error);
			if (vpns.length===0) resolve();

			try {
				for(let vpn of vpns) {
					await fwcTreeModel.newNode(connection,fwcloud,vpn.cn,node,'OCL',vpn.id,311);
				}
			} catch(error) { return reject(error )}
			resolve();
		});
	});
};

//Generate the OpenVPN server nodes.
fwcTreeModel.openvpnServerTree = (connection, fwcloud, firewall, node) => {
	return new Promise((resolve, reject) => {
		// Get server OpenVPN configurations.
		const sql = `SELECT VPN.id,CRT.cn FROM openvpn VPN
			INNER JOIN crt CRT on CRT.id=VPN.crt
			WHERE VPN.firewall=${firewall} and VPN.openvpn is null`
		connection.query(sql, async (error, vpns) => {
			if (error) return reject(error);
			if (vpns.length===0) resolve();

			try {
				for(let vpn of vpns) {
					let newNodeId = await fwcTreeModel.newNode(connection,fwcloud,vpn.cn,node,'OSR',vpn.id,312);
					await fwcTreeModel.openvpnClientTree(connection,fwcloud,firewall,vpn.id,newNodeId);
				}
			} catch(error) { return reject(error )}
			resolve();
		});
	});
};

//Add new TREE FIREWALL for a New Firewall
fwcTreeModel.insertFwc_Tree_New_firewall = (fwcloud, nodeId, firewallId) => {
	return new Promise((resolve, reject) => {
		db.get((error, connection) => {
			if (error) return reject(error);

			// Obtain cluster data required for tree nodes creation.
			let sql = 'SELECT name FROM firewall WHERE id='+firewallId+' AND fwcloud='+fwcloud;
			connection.query(sql, async (error, firewalls) => {
				if (error) return reject(error);
				if (firewalls.length!==1) return reject(fwcError.other('Firewall with id '+firewallId+' not found'));

				try {
					// Create root firewall node
					let id1 = await fwcTreeModel.newNode(connection,fwcloud,firewalls[0].name,nodeId,'FW',firewallId,0);
					
					let id2 = await fwcTreeModel.newNode(connection,fwcloud,'IPv4 POLICY',id1,'FP',firewallId,null);
					await fwcTreeModel.newNode(connection,fwcloud,'INPUT',id2,'PI',firewallId,null);
					await fwcTreeModel.newNode(connection,fwcloud,'OUTPUT',id2,'PO',firewallId,null);
					await fwcTreeModel.newNode(connection,fwcloud,'FORWARD',id2,'PF',firewallId,null);
					await fwcTreeModel.newNode(connection,fwcloud,'SNAT',id2,'NTS',firewallId,null);
					await fwcTreeModel.newNode(connection,fwcloud,'DNAT',id2,'NTD',firewallId,null);

					id2 = await fwcTreeModel.newNode(connection,fwcloud,'IPv6 POLICY',id1,'FP6',firewallId,null);
					await fwcTreeModel.newNode(connection,fwcloud,'INPUT',id2,'PI6',firewallId,null);
					await fwcTreeModel.newNode(connection,fwcloud,'OUTPUT',id2,'PO6',firewallId,null);
					await fwcTreeModel.newNode(connection,fwcloud,'FORWARD',id2,'PF6',firewallId,null);
					await fwcTreeModel.newNode(connection,fwcloud,'SNAT',id2,'NS6',firewallId,null);
					await fwcTreeModel.newNode(connection,fwcloud,'DNAT',id2,'ND6',firewallId,null);

					id2 = await fwcTreeModel.newNode(connection,fwcloud,'Interfaces',id1,'FDI',firewallId,10);
					await fwcTreeModel.interfacesTree(connection,fwcloud,id2,firewallId,'FW');

					id2 = await fwcTreeModel.newNode(connection,fwcloud,'OpenVPN',id1,'OPN',firewallId,0);	
					await fwcTreeModel.openvpnServerTree(connection,fwcloud,firewallId,id2);

					//await fwcTreeModel.newNode(connection,fwcloud,'Routing',id1,'RR',firewallId,6);					
				} catch(error) { return reject(error) }
				resolve();
			});
		});
	});
};

// Create a new node for the new firewall into the NODES node of the cluster tree.
fwcTreeModel.insertFwc_Tree_New_cluster_firewall = (fwcloud, clusterId, firewallId, firewallName) => {
	return new Promise((resolve, reject) => {
		db.get((error, connection) => {
			if (error) return reject(error);

			sql ='SELECT id FROM fwc_tree WHERE id_obj=' +
				'(select id from firewall where cluster=' + connection.escape(clusterId) + ' and fwmaster=1)' +
				' AND fwcloud=' + connection.escape(fwcloud) + ' AND node_type="FCF"';
			connection.query(sql, async (error, nodes) => {
				if (error) return reject(error);
				if (nodes.length!==1) return reject(fwcError.other('Node NODES not found'));

				await fwcTreeModel.newNode(connection,fwcloud,firewallName,nodes[0].id,'FW',firewallId,0);
				resolve();
			});
		});
	});
};

//Add new TREE CLUSTER for a New CLuster
fwcTreeModel.insertFwc_Tree_New_cluster = (fwcloud, nodeId, clusterId) => {
	return new Promise((resolve, reject) => {
		db.get((error, connection) => {
			if (error) return reject(error);

			// Obtain cluster data required for tree nodes creation.
			let sql = 'SELECT C.id,C.name,F.id as fwmaster_id FROM cluster C' +
				' INNER JOIN firewall F on F.cluster=C.id ' +
				' WHERE C.id=' + clusterId + ' AND C.fwcloud=' + fwcloud + ' AND F.fwmaster=1';
			connection.query(sql, async (error, clusters) => {
				if (error) return reject(error);
				if (clusters.length!==1) return reject(fwcError.other('Cluster with id '+clusterId+' not found'));

				try {
					// Create root cluster node
					let id1 = await fwcTreeModel.newNode(connection,fwcloud,clusters[0].name,nodeId,'CL',clusters[0].id,100);
					
					let id2 = await fwcTreeModel.newNode(connection,fwcloud,'IPv4 POLICY',id1,'FP',clusters[0].fwmaster_id,null);
					await fwcTreeModel.newNode(connection,fwcloud,'INPUT',id2,'PI',clusters[0].fwmaster_id,null);
					await fwcTreeModel.newNode(connection,fwcloud,'OUTPUT',id2,'PO',clusters[0].fwmaster_id,null);
					await fwcTreeModel.newNode(connection,fwcloud,'FORWARD',id2,'PF',clusters[0].fwmaster_id,null);
					await fwcTreeModel.newNode(connection,fwcloud,'SNAT',id2,'NTS',clusters[0].fwmaster_id,null);
					await fwcTreeModel.newNode(connection,fwcloud,'DNAT',id2,'NTD',clusters[0].fwmaster_id,null);

					id2 = await fwcTreeModel.newNode(connection,fwcloud,'IPv6 POLICY',id1,'FP6',clusters[0].fwmaster_id,null);
					await fwcTreeModel.newNode(connection,fwcloud,'INPUT',id2,'PI6',clusters[0].fwmaster_id,null);
					await fwcTreeModel.newNode(connection,fwcloud,'OUTPUT',id2,'PO6',clusters[0].fwmaster_id,null);
					await fwcTreeModel.newNode(connection,fwcloud,'FORWARD',id2,'PF6',clusters[0].fwmaster_id,null);
					await fwcTreeModel.newNode(connection,fwcloud,'SNAT',id2,'NS6',clusters[0].fwmaster_id,null);
					await fwcTreeModel.newNode(connection,fwcloud,'DNAT',id2,'ND6',clusters[0].fwmaster_id,null);

					id2 = await fwcTreeModel.newNode(connection,fwcloud,'Interfaces',id1,'FDI',clusters[0].fwmaster_id,10);
					await fwcTreeModel.interfacesTree(connection,fwcloud,id2,clusters[0].fwmaster_id,'FW');

					id2 = await fwcTreeModel.newNode(connection,fwcloud,'OpenVPN',id1,'OPN',clusters[0].fwmaster_id,0);
					await fwcTreeModel.openvpnServerTree(connection,fwcloud,clusters[0].fwmaster_id,id2);

					//await fwcTreeModel.newNode(connection,fwcloud,'Routing',id1,'RR',clusters[0].fwmaster_id,6);					

					id2 = await fwcTreeModel.newNode(connection,fwcloud,'NODES',id1,'FCF',clusters[0].fwmaster_id,null);

					// Create the nodes for the cluster firewalls.
					sql ='SELECT id,name FROM firewall WHERE cluster=' + clusterId + ' AND fwcloud=' + fwcloud;
					connection.query(sql, async (error, firewalls) => {
						if (error) return reject(error);
						if (firewalls.length===0) return reject(fwcError.other('No firewalls found for cluster with id '+clusters[0].id));

						for(let firewall of firewalls) 
							await fwcTreeModel.newNode(connection,fwcloud,firewall.name,id2,'FW',firewall.id,0);

						resolve();
					});
				} catch(error) { return reject(error)}
			});
		});
	});
};

//CONVERT TREE FIREWALL TO CLUSTER for a New CLuster
fwcTreeModel.updateFwc_Tree_convert_firewall_cluster = (fwcloud, node_id, idcluster, idfirewall, AllDone) => {
	db.get(function (error, connection) {
		if (error) return	callback(error, null);

		getFirewallNodeId(idfirewall, function (datafw) {
			var firewallNode = datafw;

			//Select Parent Node by id   
			sql = 'SELECT T1.* FROM ' + tableModel + ' T1  where T1.id=' + connection.escape(node_id) + ' AND T1.fwcloud=' + connection.escape(fwcloud) + ' order by T1.node_order';
			logger.debug(sql);
			connection.query(sql, function (error, rows) {
				if (error) return AllDone(error, null);

				if (rows[0].node_type!='FDF' && rows[0].node_type!='FD') 
					return AllDone(fwcError.other('Bad folder type'), null);

				//For each node Select Objects by  type
				if (rows) {
					asyncMod.forEachSeries(rows, function (row, callback) {
						//logger.debug(row);
						//logger.debug("---> DENTRO de NODO: " + row.name + " - " + row.node_type);
						var tree_node = new fwc_tree_node(row);
						//Añadimos nodos CLUSTER del CLOUD
						sqlnodes = 'SELECT id,name,fwcloud FROM cluster WHERE id=' + connection.escape(idcluster);
						//logger.debug(sqlnodes);
						connection.query(sqlnodes, function (error, rowsnodes) {
							if (error)
								callback(error, null);
							else {
								var i = 0;
								if (rowsnodes) {
									asyncMod.forEachSeries(rowsnodes, function (rnode, callback2) {
										i++;
										//Insertamos nodos Cluster
										sqlinsert = 'INSERT INTO ' + tableModel +
												' (name, id_parent, node_type, id_obj, obj_type, fwcloud) ' +
												' VALUES (' + connection.escape(rnode.name) + ',' +
												connection.escape(row.id) + ',"CL",' +
												connection.escape(rnode.id) + ',100,' +
												connection.escape(fwcloud)  + ")";
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
											sqlinsert = 'INSERT INTO ' + tableModel + '(name, id_parent, node_type, id_obj, obj_type, fwcloud) ' +
												' VALUES (' + '"NODES",' + parent_cluster + ',"FCF",' + connection.escape(idfirewall) + ',null,' + connection.escape(rnode.fwcloud) + ")";
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
			});

		});
	});

};

//CONVERT TREE CLUSTER TO FIREWALL for a New Firewall
fwcTreeModel.updateFwc_Tree_convert_cluster_firewall = (fwcloud, node_id, idcluster, idfirewall, AllDone) => {
	db.get(function (error, connection) {
		if (error) return callback(error, null);

		getFirewallNodeId(idfirewall, datafw => {
			var firewallNode = datafw;
			//Select Parent Node CLUSTERS 
			sql = 'SELECT T1.* FROM ' + tableModel + ' T1  where T1.id=' + connection.escape(node_id) + ' AND T1.fwcloud=' + connection.escape(fwcloud) + ' order by T1.node_order';

			connection.query(sql, (error, rows) => {
				if (error) return AllDone(error, null);

				if (rows[0].node_type!='FDF' && rows[0].node_type!='FD') 
					return AllDone(fwcError.other('Bad folder type'), null);

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
									sql = 'SELECT T1.* FROM ' + tableModel + ' T1  where T1.node_type="FDF" and T1.id_parent is null AND T1.fwcloud=' + connection.escape(fwcloud);
									logger.debug(sql);
									connection.query(sql, function (error, rowsF) {
										var firewallsNode = rowsF[0].id;
										//update  FIREWALL under NODES to FIREWALLS NODE
										sqlinsert = 'UPDATE ' + tableModel + ' SET id_parent=' + node_id +
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
			});
		});
	});
};


//Add new NODE from IPOBJ or Interface
fwcTreeModel.insertFwc_TreeOBJ = (req, node_parent, node_order, node_type, node_Data) => {
	return new Promise((resolve, reject) => {
		var fwc_treeData = {
			id: null,
			name: node_Data.name,
			id_parent: node_parent,
			node_type: node_type,
			obj_type: node_Data.type,
			id_obj: node_Data.id,
			fwcloud: req.body.fwcloud
		};

		// Firewall and host interfaces.
		if ((node_Data.type===10 || node_Data.type===11) && node_Data.labelName) fwc_treeData.name+=" ["+node_Data.labelName+"]";
		// Interface address.
		if (node_Data.type===5 && node_Data.interface) fwc_treeData.name+=" ("+node_Data.address+")";

		req.dbCon.query(`INSERT INTO ${tableModel} SET ?`, fwc_treeData, (error, result) => {
			if (error) return reject(error);
			OrderList(node_order, req.body.fwcloud, node_parent, 999999, result.insertId);
			//devolvemos la última id insertada
			resolve(result.insertId);
		});
	});
};

//Update NODE from user
fwcTreeModel.updateFwc_Tree = function (nodeTreeData, callback) {

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
fwcTreeModel.updateFwc_Tree_Firewall = (dbCon, fwcloud, FwData) => {
	return new Promise((resolve, reject) => {
		var sql = `UPDATE ${tableModel} SET name=${dbCon.escape(FwData.name)}
			WHERE id_obj=${FwData.id} AND fwcloud=${fwcloud} AND node_type='FW'`;
		dbCon.query(sql, (error, result) => {
			if (error) return reject(error);
			resolve();
		});
	});
};

//Update NODE from CLUSTER UPDATE
fwcTreeModel.updateFwc_Tree_Cluster = (dbCon, fwcloud, Data) => {
	return new Promise((resolve, reject) => {
		var sql = `UPDATE ${tableModel} SET name=${dbCon.escape(Data.name)}
			WHERE id_obj=${Data.id} AND fwcloud=${fwcloud} AND node_type='CL'`;
		dbCon.query(sql, (error, result) => {
			if (error) return reject(error);
			resolve();
		});
	});
};

//Update NODE from IPOBJ or INTERFACE UPDATE
fwcTreeModel.updateFwc_Tree_OBJ = (req, ipobjData) => {
	return new Promise((resolve, reject) => {
		let name = ipobjData.name;
		// Firewall and host interfaces.
		if ((ipobjData.type===10 ||ipobjData.type===11) && ipobjData.labelName) name+=" ["+ipobjData.labelName+"]";
		// Interface address.
		if (ipobjData.type===5 && ipobjData.interface) name+=" ("+ipobjData.address+")";

		let sql = `UPDATE ${tableModel} SET name=${req.dbCon.escape(name)}
			WHERE node_type NOT LIKE "F%" AND id_obj=${ipobjData.id} AND obj_type=${ipobjData.type} AND fwcloud=${req.body.fwcloud}`;
		req.dbCon.query(sql, (error, result) => {
			if (error) return reject(error);

			if (result.affectedRows > 0)
				resolve({"result": true});
			else
				resolve({"result": false});
		});
	});
};



//Remove NODE FROM GROUP with id_obj to remove
fwcTreeModel.deleteFwc_TreeGroupChild = (dbCon, fwcloud, id_group, id_obj) => {
	return new Promise((resolve, reject) => {
		let sql = `DELETE T.* FROM ${tableModel} T INNER JOIN ${tableModel} T2 ON T.id_parent=T2.id 
			WHERE T.fwcloud=${fwcloud} AND T.id_obj=${id_obj} AND T2.id_obj=${id_group}`;
		dbCon.query(sql, (error, result) => {
			if (error) return reject(error);
			resolve();
		});
	});
};

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
fwcTreeModel.orderTreeNodeDeleted = (dbCon, fwcloud, id_obj_deleted) => {
	return new Promise((resolve, reject) => {
		let sqlParent = 'SELECT DISTINCT id_parent FROM ' + tableModel +
			' WHERE (fwcloud=' + fwcloud + ' OR fwcloud is null) AND id_obj=' + id_obj_deleted + ' order by id_parent';
		dbCon.query(sqlParent, (error, rows) => {
			if (error) return reject(error);

			if (rows.length > 0) {
				asyncMod.map(rows, (row, callback1) => {
					var id_parent = row.id_parent;
					var sqlNodes = 'SELECT * FROM ' + tableModel +
						' WHERE (fwcloud=' + fwcloud + ' OR fwcloud is null) AND id_parent=' + id_parent +
						' AND id_obj<>' + id_obj_deleted + ' order by id_parent, node_order';
					dbCon.query(sqlNodes, (error, rowsnodes) => {
						if (error) return reject(error);
						
						if (rowsnodes.length > 0) {
							var order = 0;
							asyncMod.map(rowsnodes, (rowNode, callback2) => {
								order++;
								sql = 'UPDATE ' + tableModel + ' SET node_order=' + order +
										' WHERE id_parent = ' + id_parent + ' AND id=' + rowNode.id;
								dbCon.query(sql, (error, result) => {
									if (error) {
										callback2();
									} else {
										callback2();
									}
								});
							}, //Fin de bucle
									function (err) {
										return resolve({"result": true});
									}
							);
						} else callback1();
					});
				}, //Fin de bucle
						function (err) {
							return resolve({"result": true});
						}

				);
			} else return resolve({"result": false});
		});
	});
};
//Order Tree Node by IPOBJ
fwcTreeModel.orderTreeNode = function (fwcloud, id_parent, callback) {
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


//Get ipobjects node info.
fwcTreeModel.getNodeInfo = (dbCon,fwcloud,node_type,id_obj) => {
	return new Promise((resolve, reject) => {
		let sql = `SELECT * FROM ${tableModel}
			WHERE fwcloud=${fwcloud} AND node_type=${dbCon.escape(node_type)}
			AND id_obj${(!id_obj ? " IS NULL" : ("="+id_obj))}`;
		dbCon.query(sql, (error, result) => {
			if (error) return reject(error);
			resolve(result);
		});
	});
};

//Get node info under firewall
fwcTreeModel.getNodeUnderFirewall = (dbCon,fwcloud,firewall,node_type) => {
	return new Promise((resolve, reject) => {
		let sql = `SELECT T2.* FROM ${tableModel} T1
			INNER JOIN ${tableModel} T2 ON T2.id_parent=T1.id
			WHERE T1.fwcloud=${fwcloud} AND (T1.node_type='FW' OR T1.node_type='CL')  
			AND T2.id_obj=${firewall} AND T2.node_type=${dbCon.escape(node_type)}`;
		dbCon.query(sql, (error, result) => {
			if (error) return reject(error);
			resolve(result.length>0 ? result[0] : null);
		});
	});
};

