/*
    Copyright 2019 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
    https://soltecsis.com
    info@soltecsis.com


    This file is part of FWCloud (https://fwcloud.net).

    FWCloud is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    FWCloud is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with FWCloud.  If not, see <https://www.gnu.org/licenses/>.
*/


var express = require('express');
var router = express.Router();
var Policy_gModel = require('../../models/policy/policy_g');
var Policy_rModel = require('../../models/policy/policy_r');
import db from '../../database/DatabaseService';
const fwcError = require('../../utils/error_table');


var logger = require('log4js').getLogger("app");

/* Create New policy_g */
router.post('/', (req, res) => {
	var JsonCopyData = req.body;

	Policy_gModel.insertPolicy_g(JsonCopyData, function(error, data) {
		if (error) return res.status(400).json(error);
		//If saved policy_g Get data
		if (data && data.insertId) {
			if (JsonCopyData.rulesIds.length > 0) {
				var idGroup = data.insertId;
				//Add rules to group
				for (var rule of JsonCopyData.rulesIds) {
					Policy_rModel.updatePolicy_r_Group(JsonCopyData.firewall, null, idGroup, rule, function(error, data) {
						logger.debug("ADDED to Group " + idGroup + " POLICY: " + rule);
					});
				}
			}
			res.status(200).json({ "insertId": data.insertId });
		} else res.status(400).json(fwcError.NOT_FOUND);
	});
});


/* Update policy_g that exist */
router.put('/', (req, res) => {
	//Save data into object
	var policy_gData = {
		id: req.body.id,
		name: req.body.name,
		firewall: req.body.firewall,
		comment: req.body.comment,
		groupStyle: req.body.style
	};

	Policy_gModel.updatePolicy_g(policy_gData, (error, data) => {
		if (error) return res.status(400).json(error);
		//If saved policy_g saved ok, get data
		if (data && data.result)
			res.status(204).end();
		else
			res.status(400).json(fwcError.NOT_FOUND);
	});
});

/* Update Style policy_g  */
router.put('/style', (req, res) => {
	var accessData = { iduser: req.session.user_id, fwcloud: req.body.fwcloud, idfirewall: req.body.firewall };

	var style = req.body.style;
	var groupIds = req.body.groupIds;

	db.lockTableCon("policy_g", " WHERE firewall=" + accessData.idfirewall, function() {
		db.startTXcon(function() {
			for (var group of groupIds) {
				Policy_gModel.updatePolicy_g_Style(accessData.idfirewall, group, style, function(error, data) {
					if (error)
						logger.debug("ERROR UPDATING STYLE for GROUP: " + group + "  STYLE: " + style);
					if (data && data.result) {
						logger.debug("UPDATED STYLE for GROUP: " + group + "  STYLE: " + style);
					} else
						logger.debug("NOT UPDATED STYLE for GROUP: " + group + "  STYLE: " + style);
				});
			}
			db.endTXcon(function() {});
		});
	});
	res.status(204).end();
});


/* Update policy_g NAMe  */
router.put('/name', (req, res) => {
	//Save data into object
	var policy_gData = { id: req.body.id, name: req.body.name };
	Policy_gModel.updatePolicy_g_name(policy_gData, function(error, data) {
		if (error) return res.status(400).json(error);
		//If saved policy_g saved ok, get data
		if (data && data.result)
			res.status(204).end();
		else
			res.status(400).json(fwcError.NOT_FOUND);
	});
});


/* Remove policy_g */
router.put("/del", (req, res) => {
	//Id from policy_g to remove
	var idfirewall = req.body.firewall;
	var id = req.body.id;

	//Remove group from Rules
	Policy_rModel.updatePolicy_r_GroupAll(idfirewall, id, function(error, data) {
		logger.debug("Removed all Policy from Group " + id);
		Policy_gModel.deletePolicy_g(idfirewall, id, function(error, data) {
			if (error) return res.status(400).json(error);
			if (data && data.result)
				res.status(204).end();
			else
				res.status(400).json(fwcError.NOT_FOUND);
		});
	});
});

/* Remove rules from Group */
router.put("/rules/del", async(req, res) => {
	try {
		await removeRules(req.body.firewall, req.body.id, req.body.rulesIds);
		// If after removing the rules the group is empty, remove the rules group from the data base.
		await Policy_gModel.deleteIfEmptyPolicy_g(req.dbCon, req.body.firewall, req.body.id);
		res.status(204).end();
	} catch(error) { res.status(400).json(error) }
});

async function removeRules(idfirewall, idgroup, rulesIds) {
	return new Promise(async(resolve, reject) => {
		for (let rule of rulesIds) {
			await ruleRemove(idfirewall, idgroup, rule)
				.then(() => resolve())
				.catch(error => reject(error));
		}
	});
}

function ruleRemove(idfirewall, idgroup, rule) {
	return new Promise((resolve, reject) => {
		Policy_rModel.updatePolicy_r_Group(idfirewall, idgroup, null, rule, (error, data) => {
			if (error) return reject(error);
			resolve();
		});
	});
}

module.exports = router;