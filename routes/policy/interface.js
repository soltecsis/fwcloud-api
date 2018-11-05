var express = require('express');
var router = express.Router();
var Policy_r__interfaceModel = require('../../models/policy/policy_r__interface');
var Policy_r__ipobjModel = require('../../models/policy/policy_r__ipobj');
var api_resp = require('../../utils/api_response');
var Policy_rModel = require('../../models/policy/policy_r');
var Policy_cModel = require('../../models/policy/policy_c');

var logger = require('log4js').getLogger("app");
var utilsModel = require("../../utils/utils.js");
var objModel = "Interface in Rule";


/* Create New policy_r__interface */
router.post("/",
utilsModel.checkFirewallAccess,  
utilsModel.disableFirewallCompileStatus,
(req, res) => {
	var idfirewall= req.body.firewall;
	
	//Create New objet with data policy_r__interface
	var policy_r__interfaceData = {
		rule: req.body.rule,
		interface: req.body.interface,
		negate: req.body.negate,
		position: req.body.position,
		position_order: req.body.position_order
	};

	Policy_r__interfaceModel.insertPolicy_r__interface(idfirewall, policy_r__interfaceData, function (error, data)
	{
		if (error)
			api_resp.getJson(data, api_resp.ACR_ERROR, '', objModel, error, function (jsonResp) {
				res.status(200).json(jsonResp);
			});
		else {
			//If saved policy_r__interface Get data
			if (data && data.result) {
				if (data.result){
					Policy_rModel.compilePolicy_r(policy_r__interfaceData.rule, function (error, datac) {});
					api_resp.getJson(data, api_resp.ACR_INSERTED_OK, 'INSERTED OK', objModel, null, function (jsonResp) {
						res.status(200).json(jsonResp);
					});
				}
				else if (!data.allowed) {
					api_resp.getJson(data, api_resp.ACR_NOT_ALLOWED, 'INTERFACE not allowed in this position', objModel, error, function (jsonResp) {
						res.status(200).json(jsonResp);
					});
				} else
					api_resp.getJson(data, api_resp.ACR_NOTEXIST, 'INTERFACE not found', objModel, error, function (jsonResp) {
						res.status(200).json(jsonResp);
					});
			} else
			{
				api_resp.getJson(data, api_resp.ACR_NOT_ALLOWED, ' INTERFACE not allowed in this position', objModel, null, function (jsonResp) {
					res.status(200).json(jsonResp);
				});
			}
		}
	});
});


/* Get all INTERFACE de una interface*/
router.get('/:idfirewall/:interface',utilsModel.checkFirewallAccess,  function (req, res)
{
	var interface = req.params.interface;
	Policy_r__interfaceModel.getPolicy_r__interfaces_rule(interface, function (error, data)
	{
		//If exists policy_r__interface get data
		if (data && data.length > 0)
		{
			api_resp.getJson(data, api_resp.ACR_OK, '', objModel, null, function (jsonResp) {
				res.status(200).json(jsonResp);
			});
		}
		//Get Error
		else
		{
			api_resp.getJson(data, api_resp.ACR_NOTEXIST, ' not found', objModel, null, function (jsonResp) {
				res.status(200).json(jsonResp);
			});
		}
	});
});

/* Get all interface for a rule */
router.get('/:idfirewall/:rule',utilsModel.checkFirewallAccess,  function (req, res)
{
	var rule = req.params.rule;
	Policy_r__interfaceModel.getPolicy_r__interfaces_interface(rule, function (error, data)
	{
		//If exists policy_r__interface get data
		if (data && data.length > 0)
		{
			api_resp.getJson(data, api_resp.ACR_OK, '', objModel, null, function (jsonResp) {
				res.status(200).json(jsonResp);
			});
		}
		//Get Error
		else
		{
			api_resp.getJson(data, api_resp.ACR_NOTEXIST, ' not found', objModel, null, function (jsonResp) {
				res.status(200).json(jsonResp);
			});
		}
	});
});



/* Get  policy_r__interface by rule and interface */
router.get('/:idfirewall/:rule/:interface',utilsModel.checkFirewallAccess,  function (req, res)
{
	var interface = req.params.interface;
	var rule = req.params.rule;

	Policy_r__interfaceModel.getPolicy_r__interface(interface, rule, function (error, data)
	{
		//If exists policy_r__interface get data
		if (data && data.length > 0)
		{
			api_resp.getJson(data, api_resp.ACR_OK, '', objModel, null, function (jsonResp) {
				res.status(200).json(jsonResp);
			});
		}
		//Get Error
		else
		{
			api_resp.getJson(data, api_resp.ACR_NOTEXIST, ' not found', objModel, null, function (jsonResp) {
				res.status(200).json(jsonResp);
			});
		}
	});
});






/* Update policy_r__interface that exist */
router.put('/policy-r__interface/:idfirewall', 
utilsModel.checkFirewallAccess, 
utilsModel.disableFirewallCompileStatus,
(req, res) => {
	var rule = req.body.get_rule;
	var interface = req.body.get_interface;
	var position = req.body.get_position;
	var position_order = req.body.get_position_order;
	var idfirewall= req.params.idfirewall;

	//Save New data into object
	var policy_r__interfaceData = {
		rule: req.body.rule,
		interface: req.body.interface,
		negate: req.body.negate,
		position: req.body.position,
		position_order: req.body.position_order
	};
	
	Policy_r__interfaceModel.updatePolicy_r__interface(idfirewall, rule, interface, position, position_order, policy_r__interfaceData, function (error, data)
	{
		if (error)
			api_resp.getJson(data, api_resp.ACR_ERROR, '', objModel, error, function (jsonResp) {
				res.status(200).json(jsonResp);
			});
		else {
			//If saved policy_r__interface saved ok, get data
			if (data && data.result) {
				if (data.result) {
					Policy_rModel.compilePolicy_r(policy_r__interfaceData.rule, function (error, datac) {});
					api_resp.getJson(data, api_resp.ACR_UPDATED_OK, 'UPDATED OK', objModel, null, function (jsonResp) {
						res.status(200).json(jsonResp);
					});
				} else if (!data.allowed) {
					api_resp.getJson(data, api_resp.ACR_NOT_ALLOWED, 'INTERFACE not allowed in this position', objModel, error, function (jsonResp) {
						res.status(200).json(jsonResp);
					});
				} else
					api_resp.getJson(data, api_resp.ACR_NOTEXIST, 'INTERFACE not found', objModel, error, function (jsonResp) {
						res.status(200).json(jsonResp);
					});
			} else
			{
				api_resp.getJson(data, api_resp.ACR_NOTEXIST, ' not found', objModel, null, function (jsonResp) {
				res.status(200).json(jsonResp);
			});
			}
		}
	});
});

/* Update POSITION policy_r__interface that exist */
router.put('/policy-r__interface/:idfirewall/:rule/:interface/:position/:position_order/:new_rule/:new_position/:new_order',
utilsModel.checkFirewallAccess,
utilsModel.disableFirewallCompileStatus,
async (req, res) => {
	var rule = req.params.rule;
	var interface = req.params.interface;
	var position = req.params.position;
	var position_order = req.params.position_order;
	var new_rule = req.params.new_rule;
	var new_position = req.params.new_position;
	var new_order = req.params.new_order;
	 var idfirewall= req.params.idfirewall;

	var content1 = 'O', content2 = 'O';

	logger.debug("POLICY_R-INTERFACES  MOVING FROM POSITION " + position + "  TO POSITION: " + new_position);
	
	// Invalidate compilation of the affected rules.
	Policy_cModel.deletePolicy_c(req.params.idfirewall,req.params.rule)
	.then(() => Policy_cModel.deletePolicy_c(req.params.idfirewall,req.params.new_rule))
	.then(() => {
		//Get position type
		Policy_r__ipobjModel.getTypePositions(position, new_position, function (error, data)
		{
			logger.debug(data);
			if (data) {
				content1 = data.content1;
				content2 = data.content2;

				if (content1 === content2) { //SAME POSITION
					Policy_r__interfaceModel.updatePolicy_r__interface_position(idfirewall, rule, interface, position, position_order, new_rule, new_position, new_order, function (error, data)
					{
						//If saved policy_r__ipobj saved ok, get data
						if (data) {
							if (data.result) {
								Policy_rModel.compilePolicy_r(rule, function (error, datac) {});
								Policy_rModel.compilePolicy_r(new_rule, function (error, datac) {});
								api_resp.getJson(data, api_resp.ACR_UPDATED_OK, 'UPDATED OK', objModel, null, function (jsonResp) {
									res.status(200).json(jsonResp);
								});
							} else if (!data.allowed) {
								api_resp.getJson(data, api_resp.ACR_NOT_ALLOWED, 'INTERFACE not allowed in this position', objModel, error, function (jsonResp) {
									res.status(200).json(jsonResp);
								});
							} else
								api_resp.getJson(data, api_resp.ACR_NOTEXIST, 'INTERFACE not found', objModel, error, function (jsonResp) {
									res.status(200).json(jsonResp);
								});
						} else
						{
							api_resp.getJson(data, api_resp.ACR_DATA_ERROR, 'Error updating', objModel, error, function (jsonResp) {
								res.status(200).json(jsonResp);
							});
						}
					});

				} else {//DIFFERENTS POSITIONS
					if (content1 === 'O' && content2 === 'I') {
						//Create New Position 'I'
						//Create New objet with data policy_r__interface
						var policy_r__interfaceData = {
							rule: new_rule,
							interface: interface,
							negate: 0,
							position: new_position,
							position_order: new_order
						};

						Policy_r__interfaceModel.insertPolicy_r__interface(idfirewall,policy_r__interfaceData, function (error, data)
						{
							//If saved policy_r__interface Get data
							if (data) {
								if (data.result) {
									//delete Position 'O'
									Policy_r__ipobjModel.deletePolicy_r__ipobj(rule, -1, -1, interface, position, position_order, function (error, data)
									{
										if (data && data.result)
										{
											Policy_rModel.compilePolicy_r(rule, function (error, datac) {});
											Policy_rModel.compilePolicy_r(new_rule, function (error, datac) {});
											api_resp.getJson(data, api_resp.ACR_UPDATED_OK, 'UPDATED OK', objModel, null, function (jsonResp) {
												res.status(200).json(jsonResp);
											});
										} else
										{
											api_resp.getJson(data, api_resp.ACR_DATA_ERROR, 'Error updating', objModel, error, function (jsonResp) {
												res.status(200).json(jsonResp);
											});
										}
									});
								} else if (!data.allowed) {
									api_resp.getJson(data, api_resp.ACR_NOT_ALLOWED, 'INTERFACE not allowed in this position', objModel, error, function (jsonResp) {
										res.status(200).json(jsonResp);
									});
								} else
									api_resp.getJson(data, api_resp.ACR_NOTEXIST, 'INTERFACE not found', objModel, error, function (jsonResp) {
										res.status(200).json(jsonResp);
									});
							} else
							{
								api_resp.getJson(data, api_resp.ACR_DATA_ERROR, 'Error updating', objModel, error, function (jsonResp) {
									res.status(200).json(jsonResp);
								});
							}
						});

					}
				}
			} else
				api_resp.getJson(data, api_resp.ACR_NOTEXIST, 'INTERFACE not found', objModel, error, function (jsonResp) {
					res.status(200).json(jsonResp);
				});
		});
	});
});


/* Update NEGATE de policy_r__interface that exist */
router.put('/policy-r__interface/:idfirewall/:rule/:interface/:position/negate/:negate',
utilsModel.checkFirewallAccess, 
utilsModel.disableFirewallCompileStatus,
(req, res) => {
	var rule = req.params.rule;
	var interface = req.params.interface;
	var negate = req.params.negate;
	var position = req.params.position;

	Policy_r__interfaceModel.updatePolicy_r__interface_negate(rule, interface, position, negate, function (error, data)
	{
		if (error)
			api_resp.getJson(data, api_resp.ACR_ERROR, '', objModel, error, function (jsonResp) {
				res.status(200).json(jsonResp);
			});
		else {
			//If saved policy_r__interface saved ok, get data
			if (data && data.result)
			{
				Policy_rModel.compilePolicy_r(rule, function (error, datac) {});
				api_resp.getJson(data, api_resp.ACR_UPDATED_OK, 'SET NEGATED OK', objModel, null, function (jsonResp) {
					res.status(200).json(jsonResp);
				});
			} else
			{
				api_resp.getJson(data, api_resp.ACR_DATA_ERROR, 'Error updating', objModel, error, function (jsonResp) {
					res.status(200).json(jsonResp);
				});
			}
		}
	});
});

/* Update ORDER de policy_r__interface that exist */
router.put('/policy-r__interface/:idfirewall/:rule/:interface/:position/order/:old_order/:new_order',
utilsModel.checkFirewallAccess,  
utilsModel.disableFirewallCompileStatus,
(req, res) => {
	var rule = req.params.rule;
	var interface = req.params.interface;
	var position = req.params.position;
	var old_order = req.params.old_order;
	var new_order = req.params.new_order;

	Policy_r__interfaceModel.updatePolicy_r__interface_order(rule, interface, position, old_order, new_order, function (error, data)
	{
		if (error)
			api_resp.getJson(data, api_resp.ACR_ERROR, '', objModel, error, function (jsonResp) {
				res.status(200).json(jsonResp);
			});
		else {
			//If saved policy_r__interface saved ok, get data
			if (data && data.result)
			{
				Policy_rModel.compilePolicy_r(rule, function (error, datac) {});
				api_resp.getJson(data, api_resp.ACR_UPDATED_OK, 'SET ORDER OK', objModel, null, function (jsonResp) {
					res.status(200).json(jsonResp);
				});
			} else
			{
				api_resp.getJson(data, api_resp.ACR_DATA_ERROR, 'Error updating', objModel, error, function (jsonResp) {
					res.status(200).json(jsonResp);
				});
			}
		}
	});
});



/* Remove policy_r__interface */
router.put("/del/policy-r__interface/:idfirewall/:rule/:interface/:position/:position_order", 
utilsModel.checkFirewallAccess, 
utilsModel.disableFirewallCompileStatus,
(req, res) => {
	//Id from policy_r__interface to remove
	var rule = req.params.rule;
	var interface = req.params.interface;
	var position = req.params.position;
	var old_order = req.params.position_order;


	Policy_r__interfaceModel.deletePolicy_r__interface(rule, interface, position, old_order, function (error, data)
	{
		if (data) {
			if (data.msg === "deleted")
			{
				Policy_rModel.compilePolicy_r(rule, function (error, datac) {});
				api_resp.getJson(data, api_resp.ACR_DELETED_OK, 'DELETE OK', objModel, null, function (jsonResp) {
					res.status(200).json(jsonResp);
				});
			} else if (data.msg === "notExist") {
				api_resp.getJson(data, api_resp.ACR_NOTEXIST, '', objModel, null, function (jsonResp) {
					res.status(200).json(jsonResp);
				});
			}
		} else
		{
			api_resp.getJson(data, api_resp.ACR_DATA_ERROR, 'Error updating', objModel, error, function (jsonResp) {
				res.status(200).json(jsonResp);
			});
		}
	});
});

/* Reorder ALL rule positions  */
router.put("/policy-r__interface/order/:idfirewall",
utilsModel.checkFirewallAccess,
utilsModel.disableFirewallCompileStatus,
(req, res) => {

	Policy_r__interfaceModel.orderAllPolicy(function (error, data)
	{
		if (data && data.result)
		{
			api_resp.getJson(data, api_resp.ACR_DELETED_OK, 'REORDER OK', objModel, null, function (jsonResp) {
				res.status(200).json(jsonResp);
			});
		} else
		{
			api_resp.getJson(data, api_resp.ACR_DATA_ERROR, 'Error REORDER', objModel, error, function (jsonResp) {
				res.status(200).json(jsonResp);
			});
		}
	});
});

/* Reorder ALL rule positions FROM RULE  */
router.put("/policy-r__interface/order//:idfirewall/:rule",
utilsModel.checkFirewallAccess,  
utilsModel.disableFirewallCompileStatus,
(req, res) => {
	var rule = req.params.rule;
	Policy_r__interfaceModel.orderPolicy(rule, function (error, data)
	{
		if (data && data.result)
		{
			api_resp.getJson(data, api_resp.ACR_DELETED_OK, 'REORDER OK', objModel, null, function (jsonResp) {
				res.status(200).json(jsonResp);
			});
		} else
		{
			api_resp.getJson(data, api_resp.ACR_DATA_ERROR, 'Error REORDER', objModel, error, function (jsonResp) {
				res.status(200).json(jsonResp);
			});
		}
	});
});

module.exports = router;