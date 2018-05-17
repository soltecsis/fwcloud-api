var db = require('../../db.js');
var asyncMod = require('async');

//create object
var policy_r__interfaceModel = {};
var tableModel = "policy_r__interface";


var logger = require('log4js').getLogger("app");

//Get All policy_r__interface by policy_r
policy_r__interfaceModel.getPolicy_r__interfaces_rule = function (interface, callback) {

	db.get(function (error, connection) {
		if (error)
			callback(error, null);
		var sql = 'SELECT * FROM ' + tableModel + ' WHERE interface = ' + connection.escape(interface) + ' ORDER by interface_order';
		connection.query(sql, function (error, rows) {
			if (error)
				callback(error, null);
			else
				callback(null, rows);
		});
	});
};

//Get All policy_r__interface by policy_r
policy_r__interfaceModel.getPolicy_r__interfaces_interface = function (rule, callback) {

	db.get(function (error, connection) {
		if (error)
			callback(error, null);
		var sql = 'SELECT * FROM ' + tableModel + ' WHERE rule = ' + connection.escape(rule) + ' ORDER by interface_order';
		connection.query(sql, function (error, rows) {
			if (error)
				callback(error, null);
			else
				callback(null, rows);
		});
	});
};




//Get policy_r__interface by  rule and  interface
policy_r__interfaceModel.getPolicy_r__interface = function (interface, rule, callback) {
	db.get(function (error, connection) {
		if (error)
			callback(error, null);
		var sql = 'SELECT * FROM ' + tableModel + ' WHERE rule = ' + connection.escape(rule) + ' AND interface = ' + connection.escape(interface);
		connection.query(sql, function (error, row) {
			if (error)
				callback(error, null);
			else
				callback(null, row);
		});
	});
};



//Add new policy_r__interface
policy_r__interfaceModel.insertPolicy_r__interface = function (idfirewall, policy_r__interfaceData, callback) {


	//Check if IPOBJ TYPE is ALLOWED in this Position
	checkInterfacePosition(idfirewall, policy_r__interfaceData.rule, policy_r__interfaceData.interface, policy_r__interfaceData.position, function (error, data) {
		if (error) {
			callback(error, null);
		} else {
			allowed = data;
			if (allowed) {
				db.get(function (error, connection) {
					if (error)
						callback(error, null);
					connection.query('INSERT INTO ' + tableModel + ' SET ?', policy_r__interfaceData, function (error, result) {
						if (error) {
							callback(error, null);
						} else {
							if (result.affectedRows > 0) {
								OrderList(policy_r__interfaceData.position_order, policy_r__interfaceData.rule, policy_r__interfaceData.position, 999999, policy_r__interfaceData.interface);

								callback(null, {"result": true, "allowed": "1"});
							} else {
								callback(null, {"result": false, "allowed": "1"});
							}
						}
					});
				});
			} else {
				callback(null, {"result": false, "allowed": "0"});
			}
		}
	});
};

//Clone policy_r__interface
policy_r__interfaceModel.clonePolicy_r__interface = function ( policy_r__interfaceData) {
	return new Promise((resolve, reject) => {

		var p_interfaceData = {
			rule: policy_r__interfaceData.newrule,
			interface: policy_r__interfaceData.newInterface,
			negate: policy_r__interfaceData.negate,
			position: policy_r__interfaceData.position,
			position_order: policy_r__interfaceData.position_order          
		};

		db.get(function (error, connection) {
			if (error)
				reject(error);
			connection.query('INSERT INTO ' + tableModel + ' SET ?', p_interfaceData, function (error, result) {
				if (error) {
					reject(error);
				} else {
					if (result.affectedRows > 0) {
						OrderList(p_interfaceData.position_order, p_interfaceData.rule, p_interfaceData.position, 999999, p_interfaceData.interface);

						resolve({"result": true, "allowed": "1"});
					} else {
						resolve({"result": false, "allowed": "1"});
					}
				}
			});
		});
	});
};

//Duplicate policy_r__interface RULES
policy_r__interfaceModel.duplicatePolicy_r__interface = function (rule, new_rule, callback) {


	db.get(function (error, connection) {
		if (error)
			callback(error, null);
		var sql = 'INSERT INTO  ' + tableModel + ' (rule,  interface, position,position_order, negate) ' +
				'(SELECT ' + connection.escape(new_rule) + ', interface, position, position_order, negate ' +
				'from ' + tableModel + ' where rule=' + connection.escape(rule) + ' order by  position, position_order)';

		connection.query(sql, function (error, result) {
			if (error) {
				logger.debug(error);
				logger.debug(sql);
				callback(error, null);
			} else {
				if (result.affectedRows > 0) {
					callback(null, {"result": true});
				} else {
					callback(null, {"result": false});
				}
			}
		});
	});
};


//Update policy_r__interface
policy_r__interfaceModel.updatePolicy_r__interface = function (idfirewall, rule, interface, old_position, old_position_order, policy_r__interfaceData, callback) {

	//Check if IPOBJ TYPE is ALLOWED in this Position
	checkInterfacePosition(idfirewall, policy_r__interfaceData.rule, policy_r__interfaceData.interface, policy_r__interfaceData.position, function (error, data) {
		if (error) {
			callback(error, null);
		} else {
			allowed = data;
			if (allowed) {

				db.get(function (error, connection) {
					if (error)
						callback(error, null);
					var sql = 'UPDATE ' + tableModel + ' SET position = ' + connection.escape(policy_r__interfaceData.position) + ',' +
							'negate = ' + connection.escape(policy_r__interfaceData.negate) +
							' WHERE rule = ' + policy_r__interfaceData.rule + ' AND  interface = ' + policy_r__interfaceData.interface;

					connection.query(sql, function (error, result) {
						if (error) {
							callback(error, null);
						} else {
							if (result.affectedRows > 0) {
								OrderList(policy_r__interfaceData.position_order, rule, old_position_order, interface);
								callback(null, {"result": true});
							} else {
								callback(null, {"result": false});
							}
						}
					});
				});
			}
		}
	});
};

//Update policy_r__interface POSITION AND RULE
policy_r__interfaceModel.updatePolicy_r__interface_position = function (idfirewall, rule, interface, old_position, old_position_order, new_rule, new_position, new_order, callback) {

	//Check if IPOBJ TYPE is ALLOWED in this Position
	checkInterfacePosition(idfirewall, new_rule, interface, new_position, function (error, data) {
		if (error) {
			callback(error, null);
		} else {
			allowed = data;
			if (allowed) {
				getNegateRulePosition(new_rule, new_position, function (error, data) {
					if (error) {
						logger.debug("ERROR : ", error);
					} else {
						negate = data;
						db.get(function (error, connection) {
							if (error)
								callback(error, null);


							var sql = 'UPDATE ' + tableModel + ' SET position = ' + connection.escape(new_position) + ',' +
									'negate = ' + connection.escape(negate) + ', ' +
									'rule = ' + connection.escape(new_rule) + ', ' +
									'position_order = ' + connection.escape(new_order) + ' ' +
									' WHERE rule = ' + rule + ' AND  interface = ' + interface + ' AND position=' + connection.escape(old_position);
							logger.debug(sql);
							connection.query(sql, function (error, result) {
								if (error) {
									callback(error, null);
								} else {
									if (result.affectedRows > 0) {
										//Order New position
										OrderList(new_order, new_rule, new_position, 999999, interface);

										logger.debug("ORDENANDO OLD POSITION");
										logger.debug(result);
										//Order OLD position
										OrderList(999999, rule, old_position, old_position_order, interface);

										callback(null, {"result": true, "allowed": 1});
									} else {
										callback(null, {"result": false, "allowed": 1});
									}
								}
							});
						});
					}
				});
			} else {
				callback(null, {"result": false, "allowed": 0});
			}
		}
	});
};

//Update NEGATE policy_r__interface for all interface in the rule
policy_r__interfaceModel.updatePolicy_r__interface_negate = function (rule, interface, position, negate, callback) {

	db.get(function (error, connection) {
		if (error)
			callback(error, null);
		var sql = 'UPDATE ' + tableModel + ' SET ' +
				' negate = ' + connection.escape(negate) + ' ' +
				' WHERE rule = ' + connection.escape(rule) + ' AND position=' + connection.escape(position);

		connection.query(sql, function (error, result) {
			if (error) {
				callback(error, null);
			} else {
				callback(null, {"result": true});
			}
		});
	});
};

//Update ORDER policy_r__interface
policy_r__interfaceModel.updatePolicy_r__interface_order = function (rule, interface, position, old_order, new_order, callback) {

	OrderList(new_order, rule, position, old_order, interface);
	db.get(function (error, connection) {
		if (error)
			callback(error, null);
		var sql = 'UPDATE ' + tableModel + ' SET ' +
				' position_order = ' + connection.escape(new_order) + ' ' +
				' WHERE rule = ' + rule + ' AND  interface = ' + interface;

		connection.query(sql, function (error, result) {
			if (error) {
				callback(error, null);
			} else {
				callback(null, {"result": true});
			}
		});
	});
};

function OrderList(new_order, rule, position, old_order, interface) {
	var increment = '+1';
	var order1 = new_order;
	var order2 = old_order;
	if (new_order > old_order) {
		increment = '-1';
		order1 = old_order;
		order2 = new_order;
	}

	logger.debug("---> ORDENANDO RULE INTERFACE: " + rule + " POSITION: " + position + "  OLD_ORDER: " + old_order + "  NEW_ORDER: " + new_order);

	db.get(function (error, connection) {
		if (error)
			callback(error, null);
		var sql = 'UPDATE ' + tableModel + ' SET ' +
				'position_order = position_order' + increment +
				' WHERE rule = ' + connection.escape(rule) + ' AND position=' + connection.escape(position) +
				' AND position_order>=' + order1 + ' AND position_order<=' + order2 +
				' AND interface<>' + interface;
		logger.debug(sql);
		connection.query(sql);

	});

}
;

//Check if a object (type) can be inserted in a position type
function checkInterfacePosition(idfirewall, rule, id, position, callback) {

	var allowed = 0;
	db.get(function (error, connection) {
		if (error)
			callback(null, 0);
		var sql = 'select A.allowed from ipobj_type__policy_position A  ' +
				'inner join interface I on A.type=I.interface_type ' +
				'inner join policy_position P on P.id=A.position ' +
				' WHERE I.id = ' + connection.escape(id) + ' AND A.position=' + connection.escape(position) +
				' AND I.firewall= ' + connection.escape(idfirewall);
		logger.debug(sql);
		connection.query(sql, function (error, rows) {
			if (error)
				callback(error, null);
			else {
				if (rows.length > 0) {
					allowed = rows[0].allowed;
					logger.debug("ALLOWED: " + allowed);
					if (allowed > 0)
						callback(null, 1);
					else
						callback(null, 0);
				} else
					callback(null, 0);
			}
		});
	});
}

function getNegateRulePosition(rule, position, callback) {

	var Nneg = 0;
	db.get(function (error, connection) {
		if (error)
			callback(error, null);
		var sql = 'SELECT count(negate) as neg FROM ' + tableModel +
				' WHERE rule = ' + connection.escape(rule) + ' AND position=' + connection.escape(position) +
				' AND negate=1';
		logger.debug('SQL: ' + sql);
		connection.query(sql, function (error, rows) {
			if (error)
				callback(error, null);
			else {
				Nneg = rows[0].neg;
				logger.debug('Nneg 1: ' + Nneg);
				if (Nneg > 0)
					callback(null, 1);
				else
					callback(null, 0);
			}
		});
	});
}

//Remove policy_r__interface with id to remove
policy_r__interfaceModel.deletePolicy_r__interface = function (rule, interface, position, old_order, callback) {

	db.get(function (error, connection) {
		if (error)
			callback(error, null);
		var sqlExists = 'SELECT * FROM ' + tableModel + ' WHERE rule = ' + connection.escape(rule) + ' AND  interface = ' + connection.escape(interface) + ' AND position=' + connection.escape(position);
		connection.query(sqlExists, function (error, row) {
			//If exists Id from policy_r__interface to remove
			if (row) {
				db.get(function (error, connection) {
					var sql = 'DELETE FROM ' + tableModel + ' WHERE rule = ' + connection.escape(rule) + ' AND  interface = ' + connection.escape(interface) + ' AND position=' + connection.escape(position);
					logger.debug(sql);
					connection.query(sql, function (error, result) {
						if (error) {
							callback(error, null);
						} else {
							if (result.affectedRows > 0) {
								OrderList(999999, rule, position, old_order, interface);
								callback(null, {"result": true, "msg": "deleted"});
							} else {
								callback(null, {"result": false, "msg": "notExist"});
							}
						}
					});
				});
			} else {
				callback(null, {"result": false, "msg": "notExist"});
			}
		});
	});
};

//Remove policy_r__interface with id to remove
policy_r__interfaceModel.deletePolicy_r__All = function (rule, callback) {

	db.get(function (error, connection) {
		if (error)
			callback(error, null);
		var sqlExists = 'SELECT * FROM ' + tableModel + ' WHERE rule = ' + connection.escape(rule);
		connection.query(sqlExists, function (error, row) {
			//If exists Id from policy_r__interface to remove
			if (row) {
				logger.debug("DELETING INTERFACES FROM RULE: " + rule);
				db.get(function (error, connection) {
					var sql = 'DELETE FROM ' + tableModel + ' WHERE rule = ' + connection.escape(rule);
					connection.query(sql, function (error, result) {
						if (error) {
							logger.debug(error);
							callback(error, null);
						} else {
							if (result.affectedRows > 0) {
								callback(null, {"result": true, "msg": "deleted"});
							} else {
								callback(null, {"result": false});
							}
						}
					});
				});
			} else {
				callback(null, {"result": false});
			}
		});
	});
};

//Order policy_r__interfaces Position
policy_r__interfaceModel.orderPolicyPosition = function (rule, position, callback) {

	logger.debug("DENTRO ORDER   Rule: " + rule + '  Position: ' + position);

	db.get(function (error, connection) {
		if (error)
			callback(error, null);
		var sqlPos = 'SELECT * FROM ' + tableModel + ' WHERE rule = ' + connection.escape(rule) + ' AND position= ' + connection.escape(position) + ' order by position_order';
		//logger.debug(sqlPos);
		connection.query(sqlPos, function (error, rows) {
			if (rows.length > 0) {
				var order = 0;
				asyncMod.map(rows, function (row, callback1) {
					order++;
					db.get(function (error, connection) {
						sql = 'UPDATE ' + tableModel + ' SET position_order=' + order +
								' WHERE rule = ' + connection.escape(row.rule) +
								' AND position=' + connection.escape(row.position) +
								' AND interface=' + connection.escape(row.interface);
						//logger.debug(sql);
						connection.query(sql, function (error, result) {
							if (error) {
								callback1();
							} else {
								callback1();
							}
						});
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

//Order policy_r__interfaces Position
policy_r__interfaceModel.orderPolicy = function (rule, callback) {


	db.get(function (error, connection) {
		if (error)
			callback(error, null);
		var sqlRule = 'SELECT * FROM ' + tableModel + ' WHERE rule = ' + connection.escape(rule) + ' order by position, position_order';
		//logger.debug(sqlRule);
		connection.query(sqlRule, function (error, rows) {
			if (rows.length > 0) {
				var order = 0;
				var prev_position = 0;
				asyncMod.map(rows, function (row, callback1) {
					var position = row.position;
					if (position !== prev_position) {
						order = 1;
						prev_position = position;
					} else
						order++;

					db.get(function (error, connection) {
						sql = 'UPDATE ' + tableModel + ' SET position_order=' + order +
								' WHERE rule = ' + connection.escape(row.rule) +
								' AND position=' + connection.escape(row.position) +
								' AND interface=' + connection.escape(row.interface);
						//logger.debug(sql);
						connection.query(sql, function (error, result) {
							if (error) {
								callback1();
							} else {
								callback1();
							}
						});
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

//Order policy_r__interfaces Position
policy_r__interfaceModel.orderAllPolicy = function (callback) {


	db.get(function (error, connection) {
		if (error)
			callback(error, null);
		var sqlRule = 'SELECT * FROM ' + tableModel + ' ORDER by rule,position, position_order';
		//logger.debug(sqlRule);
		connection.query(sqlRule, function (error, rows) {
			if (rows.length > 0) {
				var order = 0;
				var prev_rule = 0;
				var prev_position = 0;
				asyncMod.map(rows, function (row, callback1) {
					var position = row.position;
					var rule = row.rule;
					if (position !== prev_position || rule !== prev_rule) {
						order = 1;
						prev_rule = rule;
						prev_position = position;
					} else
						order++;

					db.get(function (error, connection) {
						sql = 'UPDATE ' + tableModel + ' SET position_order=' + order +
								' WHERE rule = ' + connection.escape(row.rule) +
								' AND position=' + connection.escape(row.position) +
								' AND interface=' + connection.escape(row.interface);
						//logger.debug(sql);
						connection.query(sql, function (error, result) {
							if (error) {
								callback1();
							} else {
								callback1();
							}
						});
					});
				}, //Fin de bucle
						function (err) {
							logger.debug("FIN De BUCLE");
							callback(null, {"result": true});
						}

				);

			} else {
				callback(null, {"result": false});
			}
		});
	});
};


//check if INTERFACE Exists in any rule
policy_r__interfaceModel.checkInterfaceInRule = function (interface, type, fwcloud, callback) {

	logger.debug("CHECK DELETING interface I POSITIONS:" + interface + " Type:" + type + "  fwcloud:" + fwcloud);
	db.get(function (error, connection) {
		if (error)
			callback(error, null);
		var sql = 'SELECT count(*) as n FROM ' + tableModel + ' O INNER JOIN policy_r R on R.id=O.rule ' +
				' INNER JOIN firewall F on F.id=R.firewall ' +
				' INNER JOIN fwcloud C on C.id=F.fwcloud ' +
				' inner join interface I on I.id=O.interface ' +
				' WHERE I.id=' + connection.escape(interface) + ' AND I.interface_type=' + connection.escape(type) +
				' AND C.id=' + connection.escape(fwcloud);
		//logger.debug(sql);
		connection.query(sql, function (error, rows) {
			if (!error) {
				if (rows.length > 0) {
					if (rows[0].n > 0) {
						logger.debug("ALERT DELETING interface IN RULE:" + interface + " type: " + type + " fwcloud:" + fwcloud + " --> FOUND IN " + rows[0].n + " RULES");
						callback(null, {"result": true});
					} else {
						callback(null, {"result": false});
					}
				} else {
					callback(null, {"result": false});
				}
			} else
				callback(null, {"result": false});
		});
	});
};

//check if HOST ALL INTERFACEs Exists in any rule
policy_r__interfaceModel.checkHostAllInterfacesInRule = function (ipobj_host, fwcloud, callback) {

	logger.debug("CHECK DELETING HOST ALL interfaces I POSITIONS:" + ipobj_host + "  fwcloud:" + fwcloud);
	db.get(function (error, connection) {
		if (error)
			callback(error, null);
		var sql = 'SELECT count(*) as n FROM ' + tableModel + ' O ' +
				' inner join interface__ipobj J on J.interface=O.interface  ' +
				' INNER JOIN policy_r R on R.id=O.rule ' +
				' INNER JOIN firewall F on F.id=R.firewall ' +
				' inner join fwcloud C on C.id=F.fwcloud ' +
				' WHERE J.ipobj=' + connection.escape(ipobj_host) + ' AND C.id=' + connection.escape(fwcloud);
		//logger.debug(sql);
		connection.query(sql, function (error, rows) {
			if (!error) {
				if (rows.length > 0) {
					if (rows[0].n > 0) {
						logger.debug("ALERT DELETING HOST ALL interfaces IN RULE:" + ipobj_host + " fwcloud:" + fwcloud + " --> FOUND IN " + rows[0].n + " RULES");
						callback(null, {"result": true});
					} else {
						callback(null, {"result": false});
					}
				} else {
					callback(null, {"result": false});
				}
			} else
				callback(null, {"result": false});
		});
	});
};

//Search if HOST ALL INTERFACEs Exists in any rule
//SEARCH IPOBJ UNDER INTERFACES IN RULES  'I'  POSITIONS
policy_r__interfaceModel.searchInterfacesInRule = function (ipobj, fwcloud, callback) {

	logger.debug("SEARCH IPOBJ  interfaces I POSITIONS:" + ipobj + "  fwcloud:" + fwcloud);
	db.get(function (error, connection) {
		if (error)
			callback(error, null);
		var sql = 'SELECT O.interface obj_id,K.name obj_name, K.interface_type obj_type_id,T.type obj_type_name, ' +
				'C.id cloud_id, C.name cloud_name, R.firewall firewall_id, F.name firewall_name ,O.rule rule_id, R.rule_order,R.type rule_type,PT.name rule_type_name,    ' +
				'O.position rule_position_id,  P.name rule_position_name,R.comment rule_comment ' +
				'FROM  policy_r__interface O  ' +
				'INNER JOIN interface K on K.id=O.interface ' +
				'INNEr JOIN ipobj J ON J.interface=K.id ' +
				'INNER JOIN policy_r R on R.id=O.rule  ' +
				'INNER JOIN firewall F on F.id=R.firewall ' +
				'inner join fwcloud C on C.id=F.fwcloud  ' +
				'inner join ipobj_type T on T.id=K.interface_type ' +
				'inner join policy_position P on P.id=O.position ' +
				'inner join policy_type PT on PT.id=R.type ' +
				' WHERE J.id=' + connection.escape(ipobj) + ' AND C.id=' + connection.escape(fwcloud);
		//logger.debug(sql);
		connection.query(sql, function (error, rows) {
			if (!error) {
				if (rows.length > 0) {
					logger.debug(">>>>>>>>> FOUND interfaces IN RULE:" + ipobj + " fwcloud:" + fwcloud + " --> FOUND IN " + rows[0].n + " RULES");
					callback(null, {"found": rows});

				} else {
					callback(null, {"found": ""});
				}
			} else
				callback(null, {"found": ""});
		});
	});
};

//search if INTERFACE Exists in any rule I POSITIONS
policy_r__interfaceModel.SearchInterfaceInRules = function (interface, type, fwcloud, firewall, diff_firewall, callback) {

	db.get(function (error, connection) {
		if (error)
			callback(error, null);
		var sql = "";
		if (firewall === null) {
			//Search interfaces in all Firewalls from Cloud
			logger.debug("SEARCH interface I POSITIONS IN ALL CLOUD's Firewalls:" + interface + " Type:" + type + "  fwcloud:" + fwcloud + "  Different FW: " + diff_firewall);
			sql = 'SELECT O.interface obj_id,I.name obj_name, I.interface_type obj_type_id,T.type obj_type_name, ' +
					'C.id cloud_id, C.name cloud_name, R.firewall firewall_id, F.name firewall_name ,O.rule rule_id, R.rule_order,R.type rule_type, ' +
					'PT.name rule_type_name,O.position rule_position_id,  P.name rule_position_name,R.comment rule_comment ' +
					'FROM policy_r__interface O ' +
					'INNER JOIN policy_r R on R.id=O.rule   ' +
					'INNER JOIN firewall F on F.id=R.firewall   ' +
					'INNEr JOIN interface I on I.id=O.interface ' +
					'inner join ipobj_type T on T.id=I.interface_type ' +
					'inner join policy_position P on P.id=O.position ' +
					'inner join policy_type PT on PT.id=R.type ' +
					'inner join fwcloud C on C.id=F.fwcloud ' +
					' WHERE I.id=' + connection.escape(interface) + ' AND I.interface_type=' + connection.escape(type) +
					' AND C.id=' + connection.escape(fwcloud);
			if (diff_firewall !== '')
				sql += ' AND F.id<>' + connection.escape(diff_firewall);
		} else {
			//Search interfaces only in Firewall interface
			logger.debug("SEARCH interface I POSITIONS IN INTERFACE's FIREWALL:" + interface + " Type:" + type + "  fwcloud:" + fwcloud + "  Firewall: " + firewall + "  Different FW: " + diff_firewall);
			sql = 'SELECT O.interface obj_id,I.name obj_name, I.interface_type obj_type_id,T.type obj_type_name, ' +
					'C.id cloud_id, C.name cloud_name, R.firewall firewall_id, F.name firewall_name ,O.rule rule_id, R.rule_order,R.type rule_type, ' +
					'PT.name rule_type_name,O.position rule_position_id,  P.name rule_position_name,R.comment rule_comment ' +
					'FROM policy_r__interface O ' +
					'INNER JOIN policy_r R on R.id=O.rule   ' +
					'INNER JOIN firewall F on F.id=R.firewall   ' +
					'INNEr JOIN interface I on I.id=O.interface ' +
					'inner join ipobj_type T on T.id=I.interface_type ' +
					'inner join policy_position P on P.id=O.position ' +
					'inner join policy_type PT on PT.id=R.type ' +
					'inner join fwcloud C on C.id=F.fwcloud ' +
					' WHERE I.id=' + connection.escape(interface) + ' AND I.interface_type=' + connection.escape(type) +
					' AND C.id=' + connection.escape(fwcloud);
			if (diff_firewall !== '')
				sql += ' AND F.id<>' + connection.escape(diff_firewall);
			else
				sql += ' AND F.id=' + connection.escape(firewall);
		}
		//logger.debug(sql);
		connection.query(sql, function (error, rows) {
			if (!error) {
				if (rows.length > 0) {
					logger.debug(">>>>>>>>> FOUND interface IN RULES:" + interface + " type: " + type + " fwcloud:" + fwcloud + " --> FOUND IN " + rows.length + " RULES");
					callback(null, {"found": rows});

				} else {
					callback(null, {"found": ""});
				}
			} else
				callback(null, {"found": ""});
		});
	});
};

//Export the object
module.exports = policy_r__interfaceModel;