//create object
var policy_rModel = {};

//Export the object
module.exports = policy_rModel;

var db = require('../../db.js');

var Policy_r__interfaceModel = require('../../models/policy/policy_r__interface');
var Policy_typeModel = require('../../models/policy/policy_type');

var tableModel = "policy_r";
var policyPositionModel = require('./position');
var Policy_r__ipobjModel = require('../../models/policy/policy_r__ipobj');
var RuleCompileModel = require('../../models/policy/rule_compile');
var Policy_cModel = require('../../models/policy/policy_c');
var Policy_gModel = require('../../models/policy/policy_g');
var policyOpenvpnModel = require('../../models/policy/openvpn');
var policyPrefixModel = require('../../models/policy/prefix');

var logger = require('log4js').getLogger("app");


//Get All policy_r by firewall and group
policy_rModel.getPolicy_rs = function(idfirewall, idgroup, callback) {

	db.get(function(error, connection) {
		if (error)
			callback(error, null);
		var whereGroup = '';
		if (idgroup !== '') {
			whereGroup = ' AND idgroup=' + connection.escape(idgroup);
		}
		var sql = 'SELECT * FROM ' + tableModel + ' WHERE firewall=' + connection.escape(idfirewall) + whereGroup + ' ORDER BY rule_order';
		connection.query(sql, function(error, rows) {
			if (error)
				callback(error, null);
			else
				callback(null, rows);
		});
	});
};


//Get All policy_r by firewall and type
policy_rModel.getPolicyData = req => {
	return new Promise((resolve, reject) => {
		let sql = `SELECT ${req.body.fwcloud} as fwcloud, P.*, G.name as group_name, G.groupstyle as group_style, C.updated_at as c_updated_at,
			IF((P.updated_at > C.updated_at) OR C.updated_at IS NULL, 0, IFNULL(C.status_compiled,0) ) as rule_compiled
			FROM ${tableModel} P
			LEFT JOIN policy_g G ON G.id=P.idgroup
			LEFT JOIN policy_c C ON C.rule=P.id
			WHERE P.firewall=${req.body.firewall} AND P.type=${req.body.type}
			${(req.body.rule)?` AND P.id=${req.body.rule}`:``} ORDER BY P.rule_order`;

		req.dbCon.query(sql, async (error, rules) => {
			if (error) return reject(error);
			if (rules.length === 0) return resolve(null);

			try {
				for(let rule of rules) {
					const positions = await policyPositionModel.getRulePositions(rule);
					rule.positions = await Promise.all(positions.map(policyPositionModel.getRulePositionData));
				}
				resolve(rules);
			} catch(error) { reject(error) }
		});
	});
};

//Get All policy_r by firewall and type
policy_rModel.getPolicyDataDetailed = (fwcloud, firewall, type, rule) => {
	return new Promise((resolve, reject) => {
		db.get((error, dbCon) => {
			if (error) return reject(error);

			let sql = `SELECT ${fwcloud} as fwcloud, P.*, G.name as group_name, G.groupstyle as group_style,
				F.name as firewall_name,
				F.options as firewall_options,
				C.updated_at as c_updated_at,
				IF((P.updated_at > C.updated_at) OR C.updated_at IS NULL, 0, IFNULL(C.status_compiled,0) ) as rule_compiled
				FROM ${tableModel} P 
				LEFT JOIN policy_g G ON G.id=P.idgroup 
				LEFT JOIN policy_c C ON C.rule=P.id
				LEFT JOIN firewall F ON F.id=(IF((P.fw_apply_to is NULL),${firewall},P.fw_apply_to))
				WHERE P.firewall=${firewall} AND P.type=${type}
				${(rule)?` AND P.id=${rule}`:``} ORDER BY P.rule_order`;

			dbCon.query(sql, async (error, rules) => {
				if (error) return reject(error);

				try {
					if (rules.length > 0) {
						for(let rule of rules) {
							const positions = await policyPositionModel.getRulePositions(rule);
							rule.positions = await Promise.all(positions.map(policyPositionModel.getRulePositionDataDetailed));
						}		
						resolve(rules);
					} else resolve(null); // NO existes reglas
				}	catch(error) { reject(error )}
			});
		});
	});
};


//Get policy_r by  id  and firewall
policy_rModel.getPolicy_r = function(idfirewall, id, callback) {
	db.get(function(error, connection) {
		if (error)
			callback(error, null);

		var sql = 'SELECT P.*, F.fwcloud, (select MAX(rule_order) from ' + tableModel + ' where firewall=P.firewall and type=P.type) as max_order, ' +
			' (select MIN(rule_order) from ' + tableModel + ' where firewall=P.firewall and type=P.type) as min_order ' +
			' FROM ' + tableModel + ' P  INNER JOIN firewall F on F.id=P.firewall WHERE P.id = ' + connection.escape(id) + ' AND P.firewall=' + connection.escape(idfirewall);

		connection.query(sql, function(error, row) {
			if (error) {
				logger.debug(error);
				callback(error, null);
			} else
				callback(null, row);
		});
	});
};

//Get policy_r by  id  
policy_rModel.getPolicy_r_id = function(id, callback) {
	db.get(function(error, connection) {
		if (error)
			callback(error, null);

		var sql = 'SELECT P.*, F.fwcloud ' +
			' FROM ' + tableModel + ' P INNER JOIN firewall F on F.id=P.firewall  WHERE P.id = ' + connection.escape(id);

		connection.query(sql, function(error, row) {
			if (error) {
				logger.debug(error);
				callback(error, null);
			} else
				callback(null, row);
		});
	});
};

//Get rule type for a rule
policy_rModel.getPolicyRuleType = (dbCon, fwcloud, firewall, rule) => {
	return new Promise((resolve, reject) => {
			let sql = `SELECT R.type FROM ${tableModel} R
				inner join firewall F on F.id=R.firewall
				WHERE F.fwcloud=${fwcloud} and R.firewall=${firewall} AND R.id=${rule}`;

			dbCon.query(sql, async (error, result) => {
				if (error) return reject(error);
				resolve(result[0].type)
			});
		});
};


//Get policy_r  GROUP by  NEXT or Previous RULE
policy_rModel.getPolicy_r_DestGroup = function(idfirewall, offset, order, type, callback) {
	db.get(function(error, connection) {
		var nextRuleStr;

		if (error) return callback(error, null);

		if (offset > 0)
			nextRuleStr = " > ";
		else
			nextRuleStr = " < ";

		var sql = 'SELECT id, idgroup, rule_order ' +
			' FROM ' + tableModel + '  WHERE rule_order ' + nextRuleStr + connection.escape(order) + ' AND type= ' + connection.escape(type) + ' AND firewall=' + connection.escape(idfirewall) + ' LIMIT 1';
		connection.query(sql, function(error, row) {
			if (error) {
				logger.debug(error);
				callback(error, null);
			} else
				callback(null, row);
		});
	});
};

//Get routing by name and firewall and group
policy_rModel.getPolicy_rName = function(idfirewall, idgroup, name, callback) {
	db.get(function(error, connection) {
		if (error)
			callback(error, null);
		var namesql = '%' + name + '%';
		var whereGroup = '';
		if (idgroup !== '') {
			whereGroup = ' AND group=' + connection.escape(idgroup);
		}
		var sql = 'SELECT * FROM ' + tableModel + ' WHERE name like  ' + connection.escape(namesql) + ' AND firewall=' + connection.escape(idfirewall) + whereGroup;
		logger.debug(sql);
		connection.query(sql, function(error, row) {
			if (error)
				callback(error, null);
			else
				callback(null, row);
		});
	});
};

policy_rModel.insertDefaultPolicy = (fwId, loInterfaceId) => {
	return new Promise(async (resolve, reject) => {
		var policy_rData = {
			id: null,
			idgroup: null,
			firewall: fwId,
			rule_order: 1,
			action: 2,
			time_start: null,
			time_end: null,
			active: 1,
			options: 0,
			comment: '',
			type: 0,
			special: 0,
			style: null
		};

		var policy_r__interfaceData = {
			rule: null,
			interface: loInterfaceId,
			position: 20,
			position_order: 1
		};

		var policy_r__ipobjData = {
			rule: null,
			ipobj: -1,
			ipobj_g: 5,
			interface: -1,
			position: 3,
			position_order: 1
		};

		try {
			/**************************************/
			/* Generate the default INPUT policy. */
			/**************************************/
			policy_rData.type = 1;
			policy_rData.action = 1;

			// By defalt we create statefull firewalls.
			policy_rData.special = 1;
			policy_rData.comment = 'Stateful firewall rule.';
			await policy_rModel.insertPolicy_r(policy_rData);

			// Allow all incoming traffic from self host.
			policy_rData.special = 0;
			policy_rData.rule_order = 2;
			policy_rData.comment = 'Allow all incoming traffic from self host.';
			policy_r__interfaceData.rule = await policy_rModel.insertPolicy_r(policy_rData);
			await Policy_r__interfaceModel.insertPolicy_r__interface(fwId, policy_r__interfaceData);

			// Allow useful ICMP traffic.
			policy_rData.rule_order = 3;
			policy_rData.comment = 'Allow useful ICMP.';
			policy_r__ipobjData.rule = await policy_rModel.insertPolicy_r(policy_rData);
			await Policy_r__ipobjModel.insertPolicy_r__ipobj(policy_r__ipobjData);

			// Now create the catch all rule.
			policy_rData.action = 2;
			policy_rData.rule_order = 4;
			policy_rData.comment = 'Catch-all rule.';
			await policy_rModel.insertPolicy_r(policy_rData);
			/**************************************/


			/****************************************/
			/* Generate the default FORWARD policy. */
			/****************************************/
			policy_rData.type = 3;

			// By defalt we create statefull firewalls.
			policy_rData.special = 1;
			policy_rData.rule_order = 1;
			policy_rData.action = 1;
			policy_rData.comment = 'Stateful firewall rule.';
			await policy_rModel.insertPolicy_r(policy_rData);
			
			policy_rData.special = 0;
			policy_rData.rule_order = 2;
			policy_rData.action = 2;
			policy_rData.comment = 'Catch-all rule.';
			await policy_rModel.insertPolicy_r(policy_rData);
			/****************************************/


			/***************************************/
			/* Generate the default OUTPUT policy. */
			/***************************************/
			policy_rData.type = 2;
			policy_rData.action = 1; // For the OUTPUT chain by default allow all traffic.

			// By defalt we create statefull firewalls.
			policy_rData.special = 1;
			policy_rData.rule_order = 1;
			policy_rData.comment = 'Stateful firewall rule.';
			await policy_rModel.insertPolicy_r(policy_rData);

			policy_rData.special = 0;
			policy_rData.rule_order = 2;
			policy_rData.comment = 'Allow all outgoing traffic.';
			await policy_rModel.insertPolicy_r(policy_rData);
			/***************************************/

			resolve();
		} catch(error) { return reject(error) }
	});
};


//Add new policy_r from user
policy_rModel.insertPolicy_r = policy_rData => {
	return new Promise((resolve, reject) => {
		db.get((error, connection) => {
			if (error) return reject(error);

			connection.query('INSERT INTO ' + tableModel + ' SET ?', policy_rData, (error, result) => {
				if (error) return reject(error);
				resolve(result.insertId);
			});
		});
	});
};

var clon_data;

//Clone policy and IPOBJ
policy_rModel.cloneFirewallPolicy = function(iduser, fwcloud, idfirewall, idNewFirewall, dataI) {
	return new Promise((resolve, reject) => {
		clon_data = dataI;
		db.get((error, connection) => {
			if (error) return reject(error);

			sql = ' select ' + connection.escape(idNewFirewall) + ' as newfirewall, P.* ' +
				' from policy_r P ' +
				' where P.firewall=' + connection.escape(idfirewall);
			connection.query(sql, function(error, rows) {
				if (error) return reject(error);

				//Bucle por Policy
				Promise.all(rows.map(policy_rModel.clonePolicy))
					.then(() => Policy_gModel.clonePolicyGroups(idfirewall, idNewFirewall))
					.then(() => resolve())
					.catch(error => reject(error));
			});
		});
	});
};

policy_rModel.clonePolicy = function(rowData) {
	return new Promise((resolve, reject) => {
		db.get(async (error, connection) => {
			if (error) return reject(error);

			//CREATE NEW POLICY
			var policy_rData = {
				id: null,
				idgroup: rowData.idgroup,
				firewall: rowData.newfirewall,
				rule_order: rowData.rule_order,
				action: rowData.action,
				time_start: rowData.time_start,
				time_end: rowData.time_end,
				active: rowData.active,
				options: rowData.options,
				comment: rowData.comment,
				type: rowData.type,
				style: rowData.style,
				fw_apply_to: rowData.fw_apply_to
			};

			var newRule;
			try {
				newRule = await policy_rModel.insertPolicy_r(policy_rData);
			} catch(error) { return resolve(false) }

			//SELECT ALL IPOBJ UNDER POSITIONS
			sql = ' select ' + connection.escape(rowData.newfirewall) + ' as newfirewall, ' + connection.escape(newRule) + ' as newrule, O.* ' +
				' from policy_r__ipobj O ' +
				' where O.rule=' + connection.escape(rowData.id) +
				' ORDER BY position_order';
			connection.query(sql, (error, rows) => {
				if (error) return reject(error);
				if (clon_data) {
					for (var i = 0; i < rows.length; i++) {
						for (var item of clon_data) {
							if (rows[i].ipobj === -1 && rows[i].interface !== -1) {
								// Replace interfaces IDs with interfaces IDs of the cloned firewall.
								if (rows[i].interface === item.id_org) {
									rows[i].interface = item.id_clon;
									break;
								}
							} else {
								// Replace ipobj IDs with ipobj IDs of the cloned firewall.
								var found = 0;
								for (var addr of item.addr) {
									if (rows[i].ipobj === addr.id_org) {
										rows[i].ipobj = addr.id_clon;
										found = 1;
										break;
									}
								}
								if (found) break;
							}
						}
					}
				}

				//Bucle por IPOBJS
				Promise.all(rows.map(Policy_r__ipobjModel.clonePolicy_r__ipobj))
					.then(() => {
						//SELECT ALL INTERFACES UNDER POSITIONS
						sql = ' select ' + connection.escape(newRule) + ' as newrule, I.id as newInterface, O.* ' +
							' from policy_r__interface O ' +
							' inner join interface I on I.id=O.interface ' +
							' where O.rule=' + connection.escape(rowData.id) +
							' AND I.firewall=' + connection.escape(rowData.firewall) +
							' ORDER BY position_order';
						connection.query(sql, (error, rowsI) => {
							if (error) return reject(error);
							// Replace the interfaces IDs with interfaces IDs of the cloned firewall.
							if (clon_data) {
								for (var i = 0; i < rowsI.length; i++) {
									for (var item of clon_data) {
										if (rowsI[i].newInterface === item.id_org) {
											rowsI[i].newInterface = item.id_clon;
											break;
										}
									}
								}
							}
							//Bucle for INTERFACES
							Promise.all(rowsI.map(Policy_r__interfaceModel.clonePolicy_r__interface))
								.then(data => resolve(data))
								.catch(e => reject(e));
						});
					})
					.catch(e => reject(e));
			});
		});
	});
};


//Update policy_r from user
policy_rModel.updatePolicy_r = (dbCon, policy_rData) => {
	return new Promise((resolve, reject) => {
		let sql = 'UPDATE ' + tableModel + ' SET ';
		if (typeof policy_rData.idgroup !== 'undefined') sql += 'idgroup=' + policy_rData.idgroup + ',';
		if (policy_rData.rule_order) sql += 'rule_order=' + policy_rData.rule_order + ',';
		if (policy_rData.action) sql += 'action=' + policy_rData.action + ',';
		if (policy_rData.time_start) sql += 'time_start=' + policy_rData.time_start + ',';
		if (policy_rData.time_end) sql += 'time_end=' + policy_rData.time_end + ',';
		if (typeof policy_rData.options !== 'undefined') sql += 'options=' + policy_rData.options + ',';
		if (policy_rData.active) sql += 'active=' + policy_rData.active + ',';
		if (policy_rData.comment) sql += 'comment=' + dbCon.escape(policy_rData.comment) + ',';
		if (policy_rData.style) sql += 'style=' + policy_rData.style + ',';
		if (typeof policy_rData.fw_apply_to !== 'undefined') sql += 'fw_apply_to=' + policy_rData.fw_apply_to + ',';
		sql = sql.slice(0, -1) + ' WHERE id=' + policy_rData.id;

		dbCon.query(sql, (error, result) => {
			if (error) return reject(error);
			resolve();
		});
	});
};


//Update policy_r from user
policy_rModel.updatePolicy_r_Group = function(firewall, oldgroup, newgroup, id, callback) {

	db.get(function(error, connection) {
		if (error)
			callback(error, null);

		var sql = 'UPDATE ' + tableModel + ' SET ' +
			'idgroup = ' + connection.escape(newgroup) + ' ' +
			' WHERE id = ' + id + " and firewall=" + firewall;
		if (oldgroup !== null)
			sql += "  AND idgroup=" + oldgroup;
		logger.debug(sql);
		connection.query(sql, function(error, result) {
			if (error) {
				logger.error(error);
				callback(error, null);
			} else {
				if (result.affectedRows > 0) {
					callback(null, { "result": true });
				} else
					callback(null, { "result": false });
			}
		});
	});
};
//Update policy_r Style
policy_rModel.updatePolicy_r_Style = function(firewall, id, type, style, callback) {

	db.get(function(error, connection) {
		if (error)
			callback(error, null);

		var sql = 'UPDATE ' + tableModel + ' SET ' +
			'style = ' + connection.escape(style) + ' ' +
			' WHERE id = ' + connection.escape(id) + " and firewall=" + connection.escape(firewall) + " AND type=" + connection.escape(type);
		connection.query(sql, function(error, result) {
			if (error) {
				logger.error(error);
				callback(error, null);
			} else {
				if (result.affectedRows > 0) {
					callback(null, { "result": true });
				} else
					callback(null, { "result": false });
			}
		});
	});
};

//Update policy_r Active
policy_rModel.updatePolicy_r_Active = function(firewall, id, type, active, callback) {

	db.get(function(error, connection) {
		if (error)
			callback(error, null);

		var sql = 'UPDATE ' + tableModel + ' SET ' +
			'active = ' + connection.escape(active) + ' ' +
			' WHERE id = ' + connection.escape(id) + " and firewall=" + connection.escape(firewall) + " AND type=" + connection.escape(type);

		connection.query(sql, function(error, result) {
			if (error) {
				logger.error(error);
				callback(error, null);
			} else {
				if (result.affectedRows > 0) {
					callback(null, { "result": true });
				} else
					callback(null, { "result": false });
			}
		});

	});
};

//Update policy_r from user
policy_rModel.updatePolicy_r_GroupAll = function(firewall, idgroup, callback) {

	db.get(function(error, connection) {
		if (error)
			callback(error, null);

		var sql = 'UPDATE ' + tableModel + ' SET ' +
			'idgroup = NULL' + ' ' +
			' WHERE idgroup = ' + idgroup + " and firewall=" + firewall;

		connection.query(sql, function(error, result) {
			if (error) {
				logger.error(error);
				callback(error, null);
			} else {
				if (result.affectedRows > 0) {
					callback(null, { "result": true });
				} else
					callback(null, { "result": false });
			}
		});
	});
};

policy_rModel.makeBeforeRuleOrderGap = (firewall, type, rule) => {
	return new Promise((resolve, reject) => {
		db.get((error, connection) => {
			if (error) return reject(error);

			let sql='SELECT rule_order FROM '+tableModel+' WHERE firewall='+firewall+' AND type='+type+
				' AND rule_order<(select rule_order from '+tableModel+' where id='+rule+') ORDER BY rule_order DESC LIMIT 1';
			connection.query(sql, (error, result) => {
				if (error) return reject(error);

				let free_rule_order;
				let cond='';
				if (result.length===1) {
					free_rule_order = result[0].rule_order + 1;
					cond = '>'+result[0].rule_order;
				} else {
					free_rule_order = 1;
					cond = '>0';
				}

				sql = 'UPDATE ' + tableModel + ' SET rule_order=rule_order+1' +
					' WHERE firewall=' + firewall + ' AND type=' + type +
					' AND rule_order' + cond;
				connection.query(sql, (error, result) => {
					if (error) return reject(error);
					resolve(free_rule_order);
				});
			});
		});
	});
}

policy_rModel.makeAfterRuleOrderGap = (firewall, type, rule) => {
	return new Promise((resolve, reject) => {
		db.get((error, connection) => {
			if (error) return reject(error);

			let sql='SELECT rule_order FROM '+tableModel+' WHERE firewall='+firewall+' AND type='+type+' AND id='+rule;
			connection.query(sql, (error, result) => {
				if (error) return reject(error);

				if (result.length===1) {
					let free_rule_order = result[0].rule_order + 1;
					sql = 'UPDATE ' + tableModel + ' SET rule_order=rule_order+1' +
						' WHERE firewall=' + firewall + ' AND type=' + type +
						' AND rule_order>' + result[0].rule_order;
					connection.query(sql, (error, result) => {
						if (error) return reject(error);
						resolve(free_rule_order);
					});
				} else return reject(new Error('Rule not found'))
			});
		});
	});
}

policy_rModel.reorderAfterRuleOrder = (dbCon, firewall, type, rule_order) => {
	return new Promise((resolve, reject) => {
		let sql = 'UPDATE ' + tableModel + ' SET rule_order=rule_order+1' +
			' WHERE firewall=' + firewall + ' AND type=' + type +
			' AND rule_order>=' + rule_order;
		dbCon.query(sql, (error, result) => {
			if (error) return reject(error);
			resolve();
		});
	});
}


//Remove All policy_r from firewall
policy_rModel.deletePolicy_r_Firewall = function(idfirewall) {
	return new Promise((resolve, reject) => {
		db.get((error, connection) => {
			if (error) return reject(error);

			var sql = 'SELECT  I.*   FROM ' + tableModel + ' I ' +
				' WHERE (I.firewall=' + connection.escape(idfirewall) + ') ';
			connection.query(sql, (error, rows) => {
				if (error) return reject(error);
				//Bucle por reglas
				Promise.all(rows.map(policy_rModel.deletePolicy_rPro))
					.then(data => Policy_gModel.deleteFirewallGroups(idfirewall))
					.then(() => resolve())
					.catch(error => reject(error));
			});
		});

	});
};

policy_rModel.deletePolicy_rPro = function(data) {
	return new Promise((resolve, reject) => {
		policy_rModel.deletePolicy_r(data.firewall, data.id)
			.then(resp => {
				resolve(resp);
			})
			.catch(e => {
				reject(e);
			});
	});
};


//Remove policy_r with id to remove
policy_rModel.deletePolicy_r = (firewall, rule) => {
	return new Promise((resolve, reject) => {
		db.get((error, dbCon) => {
			if (error) return reject(error);

			//DELETE FROM policy_r__ipobj
			Policy_r__ipobjModel.deletePolicy_r__All(rule, (error, data) => {
				if (error) return reject(error);
				//DELETE FROM policy_r__interface
				Policy_r__interfaceModel.deletePolicy_r__All(rule, async (error, data) => {
					if (error) return reject(error);
					
					try {
						await policyOpenvpnModel.deleteFromRule(dbCon,rule);
						await policyPrefixModel.deleteFromRule(dbCon,rule);
						//DELETE POLICY_C compilation
						await Policy_cModel.deletePolicy_c(firewall, rule);
					} catch(error) { return reject(error) }

					// DELETE FULE
					dbCon.query(`DELETE FROM ${tableModel} WHERE id=${rule} AND firewall=${firewall}`, (error, result) => {
						if (error) return reject(error);

						if (result.affectedRows > 0) {
							resolve({ "result": true, "msg": "deleted" });
						} else
							resolve({ "result": false, "msg": "notExist" });
					});
				});
			});
		});
	});
};

//Compile rule and save it
policy_rModel.compilePolicy_r = (accessData, callback) => {
	var rule = accessData.rule;

	policy_rModel.getPolicy_r_id(rule, (error, data) => {
		if (error) return callback(error, null);
		if (data && data.length > 0) {

			RuleCompileModel.get(data[0].fwcloud, data[0].firewall, data[0].type, rule)
				.then(data => {
					if (data && data.length > 0) {
						callback(null, { "result": true, "msg": "Rule compiled" });
					} else {
						callback(null, { "result": false, "msg": "CS Empty, rule NOT compiled" });
					}
				})
				.catch(error => {
					callback(null, { "result": false, "msg": "ERROR rule NOT compiled" });
				});
		} else
			callback(null, { "result": false, "msg": "rule Not found, NOT compiled" });
	});
};


policy_rModel.cleanApplyTo = function(idfirewall, callback) {
	db.get(function(error, connection) {
		if (error) callback(error);

		var sql = 'UPDATE ' + tableModel + ' SET fw_apply_to=null WHERE firewall=' + connection.escape(idfirewall);
		connection.query(sql, (error, result) => {
			if (error)
				callback(error, null);
			else
				callback(null, { "result": true });
		});
	});
};

//Update apply_to fields of a cloned cluster to point to the new cluster nodes.
policy_rModel.updateApplyToRules = function(clusterNew, fwNewMaster) {
	return new Promise((resolve, reject) => {
		db.get((error, connection) => {
			if (error) return reject(error);
			let sql = 'select P.id,P.fw_apply_to,(select name from firewall where id=P.fw_apply_to) as name,' + clusterNew + ' as clusterNew FROM ' + tableModel + ' P' +
				' INNER JOIN firewall F on F.id=P.firewall' +
				' WHERE P.fw_apply_to is not NULL AND P.firewall=' + connection.escape(fwNewMaster) + ' AND F.cluster=' + connection.escape(clusterNew);
			connection.query(sql, (error, rows) => {
				if (error) return reject(error);
				//Bucle for rules with fw_apply_to defined.
				Promise.all(rows.map(policy_rModel.repointApplyTo))
					.then(data => resolve(data))
					.catch(e => reject(e));
			});
		});
	});
};

policy_rModel.repointApplyTo = function(rowData) {
	return new Promise((resolve, reject) => {
		db.get((error, connection) => {
			if (error) return reject(error);

			let sql = 'select id FROM firewall' +
				' WHERE cluster=' + connection.escape(rowData.clusterNew) + ' AND name=' + connection.escape(rowData.name);
			connection.query(sql, (error, rows) => {
				if (error) return reject(error);

				if (rows.length === 1)
					sql = 'UPDATE ' + tableModel + ' set fw_apply_to=' + connection.escape(rows[0].id) + ' WHERE id=' + connection.escape(rowData.id);
				else // We have not found the node in the new cluster.
					sql = 'UPDATE ' + tableModel + ' set fw_apply_to=NULL WHERE id=' + connection.escape(rowData.id);

				connection.query(sql, (error, rows1) => {
					if (error) return reject(error);
					resolve(rows1);
				});
			});
		});
	});
};

//Negate rule position.
policy_rModel.negateRulePosition = (dbCon, firewall, rule, position) => {
	return new Promise((resolve, reject) => {
		let sql = `select negate from ${tableModel} where id=${rule} and firewall=${firewall}`;
		dbCon.query(sql, (error, result) => {
			if (error) return reject(error);
			if (result.length!==1) return reject(new Error('Firewall rule not found'));
			
			let negate;
			if (!(result[0].negate))
				negate = `${position}`;
			else {
				let negate_position_list = result[0].negate.split(' ').map(val => { return parseInt(val) });
				// If the position that we want negate is already in the list, don't add again to the list.
				for (pos of negate_position_list) {
					if (pos === position) return resolve();
				}
				negate =`${result[0].negate} ${position}`;
			}

			sql = `update ${tableModel} set negate=${dbCon.escape(negate)} where id=${rule} and firewall=${firewall}`;
			dbCon.query(sql, (error, result) => {
				if (error) return reject(error);
				resolve();
			});
		});
	});
};

//Allow rule position.
policy_rModel.allowRulePosition = (dbCon, firewall, rule, position) => {
	return new Promise((resolve, reject) => {
		let sql = `select negate from ${tableModel} where id=${rule} and firewall=${firewall}`;
		dbCon.query(sql, (error, result) => {
			if (error) return reject(error);
			if (result.length!==1) return reject(new Error('Firewall rule not found'));

			// Rule position negated list is empty.
			if (!(result[0].negate)) return resolve();

			let negate_position_list = result[0].negate.split(' ').map(val => { return parseInt(val) });
			let new_negate_position_list = [];
			for (pos of negate_position_list) {
				if (pos !== position)
					new_negate_position_list.push(pos);
			}
			negate = (new_negate_position_list.length===0) ? null : new_negate_position_list.join(' ');

			sql = `update ${tableModel} set negate=${dbCon.escape(negate)} where id=${rule} and firewall=${firewall}`;
			dbCon.query(sql, (error, result) => {
				if (error) return reject(error);
				resolve();
			});
		});
	});
};

//Allow all positions of a rule that are empty.
policy_rModel.allowEmptyRulePositions = req => {
	return new Promise(async (resolve, reject) => {
		try {
			req.body.type = await policy_rModel.getPolicyRuleType(req.dbCon, req.body.fwcloud, req.body.firewall, req.body.rule);
			let data = await policy_rModel.getPolicyData(req);
			for (pos of data[0].positions) {
				if (pos.ipobjs.length===0)
					await policy_rModel.allowRulePosition(req.dbCon, req.body.firewall, req.body.rule, pos.id);
			}
		} catch(error) { return reject(error) }

		resolve();
	});
};

// Check special rules for stateful firewalls.
policy_rModel.checkStatefulRules = (dbCon, firewall, options) => {
	return new Promise(async (resolve, reject) => {
		// If this a stateful firewall verify that the stateful special rules exists.
		if (options & 0x0001) { // Statefull firewall
			let sql = `select id from ${tableModel} where firewall=${firewall} and special=1`;
			dbCon.query(sql, async (error, result) => {
				if (error) return reject(error);

				if (result.length===0) { 
					// If this is a stateful firewall and it doesn't has the stateful special rules, then create them.
					var policy_rData = {
						id: null,
						idgroup: null,
						firewall: firewall,
						rule_order: 1,
						action: 1, // ACCEPT
						time_start: null,
						time_end: null,
						active: 1,
						options: 0,
						comment: 'Stateful firewall rule.',
						type: 1,
						special: 1,
						style: null
					};					
					try {
						// INPUT
						policy_rData.type = 1;
						await policy_rModel.reorderAfterRuleOrder(dbCon, firewall, policy_rData.type, 1);
						await policy_rModel.insertPolicy_r(policy_rData);

						// OUTPUT
						policy_rData.type = 2;
						await policy_rModel.reorderAfterRuleOrder(dbCon, firewall, policy_rData.type, 1);
						await policy_rModel.insertPolicy_r(policy_rData);

						// FORWARD
						policy_rData.type = 3;
						await policy_rModel.reorderAfterRuleOrder(dbCon, firewall, policy_rData.type, 1);
						await policy_rModel.insertPolicy_r(policy_rData);
					} catch(error) { return reject(error) }
				}
				resolve();
			});
		} else { // Stateless firewall
			// Or remove them if this is not a stateful firewall.
			dbCon.query(`delete from ${tableModel} where firewall=${firewall} and special=1`, (error, result) => {
				if (error) return reject(error);
				resolve();
			});
		}
	});
};
