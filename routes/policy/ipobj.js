var express = require('express');
var router = express.Router();
const policy_r__ipobjModel = require('../../models/policy/policy_r__ipobj');
const policy_r__interfaceModel = require('../../models/policy/policy_r__interface');
const policy_rModel = require('../../models/policy/policy_r');
const policy_cModel = require('../../models/policy/policy_c');
const firewallModel = require('../../models/firewall/firewall');
const fwcError = require('../../utils/error_table');

var logger = require('log4js').getLogger("app");
var utilsModel = require("../../utils/utils.js");


/* Create New policy_r__ipobj */
router.post("/",
utilsModel.disableFirewallCompileStatus,
async (req, res) => {
	//Create New objet with data policy_r__ipobj
	var policy_r__ipobjData = {
		rule: req.body.rule,
		ipobj: req.body.ipobj,
		ipobj_g: req.body.ipobj_g,
		interface: req.body.interface,
		position: req.body.position,
		position_order: req.body.position_order
	};

	/* Before inserting the new IP object into the rule, verify that there is no container in the 
	destination position that already contains it. */

	try {
		// Don't allow to put in positions with O content empty object containers (interfaces, hosts, groups, etc.)
		if (await policy_r__ipobjModel.emptyIpobjContainerToObjectPosition(req.dbCon,policy_r__ipobjData))
			throw fwcError.IPOBJ_EMPTY_CONTAINER;

		if (await policy_r__ipobjModel.checkExistsInPosition(policy_r__ipobjData))
			throw fwcError.ALREADY_EXISTS;

		// Depending on the IP version of the policy_type of the rule we are working on, verify that we have root objects 
		// of this IP version in the object that we are moving to this rule position.
		if (!(await policy_r__ipobjModel.checkIpVersion(req.dbCon,policy_r__ipobjData)))
			throw fwcError.IPOBJ_BAD_IP_VERSION;

		const data = await policy_r__ipobjModel.insertPolicy_r__ipobj(policy_r__ipobjData);
		//If saved policy_r__ipobj Get data
		if (data && data.result) {
			if (data.result && data.allowed) {
				var accessData = { sessionID: req.sessionID, iduser: req.session.user_id, fwcloud: req.body.fwcloud, idfirewall: req.body.firewall, rule: policy_r__ipobjData.rule };
				policy_rModel.compilePolicy_r(accessData, function(error, datac) {});
				res.status(200).json(data);
			} else if (!data.allowed)
				throw fwcError.NOT_ALLOWED;
			else
				throw fwcError.NOT_FOUND;
		}
	} catch(error) { api_resp.getJson(null, api_resp.ACR_ERROR, '', '', error, jsonResp => res.status(200).json(jsonResp)) }
});


/* Update POSITION policy_r__ipobj that exist */
router.put('/move',
utilsModel.disableFirewallCompileStatus,
async (req, res) => {
	var firewall = req.body.firewall;
	var rule = req.body.rule;
	var ipobj = req.body.ipobj;
	var ipobj_g = req.body.ipobj_g;
	var interface = req.body.interface;
	var position = req.body.position;
	var position_order = req.body.position_order;
	var new_rule = req.body.new_rule;
	var new_position = req.body.new_position;
	var new_order = req.body.new_order;

	var content1 = 'O',
		content2 = 'O';

	var accessData = {
		sessionID: req.sessionID,
		iduser: req.session.user_id,
		fwcloud: req.body.fwcloud,
		idfirewall: firewall,
		rule: rule
	};

	logger.debug("POLICY_R-IPOBJS  MOVING FROM POSITION " + position + "  TO POSITION: " + new_position);

	var policy_r__ipobjData = {
		rule: new_rule,
		ipobj: ipobj,
		ipobj_g: ipobj_g,
		interface: interface,
		position: new_position,
		position_order: new_order
	};

	try {
		// Invalidate compilation of the affected rules.
		await policy_cModel.deletePolicy_c(firewall, rule);
		await policy_cModel.deletePolicy_c(firewall, new_rule);
		await firewallModel.updateFirewallStatus(req.body.fwcloud,firewall,"|3");

		if (await policy_r__ipobjModel.checkExistsInPosition(policy_r__ipobjData))
			throw fwcError.ALREADY_EXISTS;

		// Get positions content.
		const data = await 	policy_r__ipobjModel.getPositionsContent(req.dbCon, position, new_position);
		content1 = data.content1;
		content2 = data.content2;	
	} catch(error) { return res.status(400).json(error) }

	if (content1 === content2) { //SAME POSITION
		policy_r__ipobjModel.updatePolicy_r__ipobj_position(rule, ipobj, ipobj_g, interface, position, position_order, new_rule, new_position, new_order, async (error, data) => {
			//If saved policy_r__ipobj saved ok, get data
			if (data) {
				if (data.result) {
					policy_rModel.compilePolicy_r(accessData, function(error, datac) {});
					accessData.rule = new_rule;
					policy_rModel.compilePolicy_r(accessData, function(error, datac) {});

					// If after the move we have empty rule positions, then remove them from the negate position list.
					try {
						await policy_rModel.allowEmptyRulePositions(req);
					} catch(error) { return res.status(400).json(error) }

					res.status(200).json(data);
				} else if (!data.allowed) return res.status(400).json(fwcError.NOT_ALLOWED);
				else return res.status(400).json(fwcError.NOT_FOUND);
			} else return res.status(400).json(error);
		});
	} else { //DIFFERENTS POSITIONS
		if (content1 === 'I' && content2 === 'O') {
			//Create New Position 'O'
			//Create New objet with data policy_r__ipobj
			var policy_r__ipobjData = {
				rule: new_rule,
				ipobj: ipobj,
				ipobj_g: ipobj_g,
				interface: interface,
				position: new_position,
				position_order: new_order
			};

			var data;
			try {
				data = await policy_r__ipobjModel.insertPolicy_r__ipobj(policy_r__ipobjData);
			} catch(error) { return res.status(400).json(error) }

			//If saved policy_r__ipobj Get data
			if (data) {
				if (data.result) {
					//Delete position 'I'
					policy_r__interfaceModel.deletePolicy_r__interface(rule, interface, position, position_order, async (error, data) => {
						if (data && data.result) {
							policy_rModel.compilePolicy_r(accessData, function(error, datac) {});
							accessData.rule = new_rule;
							policy_rModel.compilePolicy_r(accessData, function(error, datac) {});

							// If after the move we have empty rule positions, then remove them from the negate position list.
							try {
								await policy_rModel.allowEmptyRulePositions(req);
							} catch(error) { return res.status(400).json(error) }

							res.status(200).json(data);
						} else return res.status(400).json(error);
					});
				} else if (!data.allowed) return res.status(400).json(fwcError.NOT_ALLOWED);
				else return res.status(400).json(fwcError.NOT_FOUND);
			} else return res.status(400).json(error);
		} else return res.status(400).json(fwcError.NOT_ALLOWED);
	}
});

/* Update ORDER policy_r__ipobj that exist */
router.put('/order',
utilsModel.disableFirewallCompileStatus,
(req, res) => {
	var rule = req.body.rule;
	var ipobj = req.body.ipobj;
	var ipobj_g = req.body.ipobj_g;
	var interface = req.body.interface;
	var position = req.body.position;
	var position_order = req.body.position_order;
	var new_order = req.body.new_order;

	policy_r__ipobjModel.updatePolicy_r__ipobj_position_order(rule, ipobj, ipobj_g, interface, position, position_order, new_order, function(error, data) {
		if (error) return res.status(400).json(error);
		//If saved policy_r__ipobj saved ok, get data
		if (data && data.result) {
			var accessData = { sessionID: req.sessionID, iduser: req.session.user_id, fwcloud: req.body.fwcloud, idfirewall: req.body.firewall, rule: rule };
			policy_rModel.compilePolicy_r(accessData, function(error, datac) {});
			res.status(200).json(data);
		} else 
			res.status(400).json(fwcError.NOT_FOUND);
	});
});


/* Get all policy_r__ipobjs by rule*/
router.put('/get', (req, res) => {
	policy_r__ipobjModel.getPolicy_r__ipobjs(req.body.rule, (error, data) => {
		//If exists policy_r__ipobj get data
    if (data && data.length > 0)
      res.status(200).json(data);
    else
			res.status(400).json(fwcError.NOT_FOUND);
	});
});


/* Remove policy_r__ipobj */
router.put("/del",
utilsModel.disableFirewallCompileStatus,
(req, res) => {
	//Id from policy_r__ipobj to remove
	var rule = req.body.rule;
	var ipobj = req.body.ipobj;
	var ipobj_g = req.body.ipobj_g;
	var interface = req.body.interface;
	var position = req.body.position;
	var position_order = req.body.position_order;

	policy_r__ipobjModel.deletePolicy_r__ipobj(rule, ipobj, ipobj_g, interface, position, position_order, async (error, data) => {
		if (data && data.result) {
			if (data.msg === "deleted") {
				var accessData = { sessionID: req.sessionID, iduser: req.session.user_id, fwcloud: req.body.fwcloud, idfirewall: req.body.firewall, rule: rule };
				policy_rModel.compilePolicy_r(accessData, function(error, datac) {});

				// If after the delete we have empty rule positions, then remove them from the negate position list.
				try {
					await policy_rModel.allowEmptyRulePositions(req);
				} catch(error) { return res.status(400).json(error) }
				
				res.status(200).json(data);
			} else if (data.msg === "notExist") 
				res.status(400).json(fwcError.NOT_FOUND);
		} else res.status(400).json(error);
	});
});


module.exports = router;