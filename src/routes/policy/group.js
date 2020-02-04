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
var Policy_rModel = require('../../models/policy/policy_r');
import db from '../../database/DatabaseService';
import { getRepository } from 'typeorm';
import { PolicyGroup } from '../../models/policy/PolicyGroup';
const fwcError = require('../../utils/error_table');


var logger = require('log4js').getLogger("app");

/* Create New PolicyGroup */
router.post('/', async (req, res) => {
	var body = req.body;

	let policyG = new PolicyG();
	policyG.name = body.name;
	policyG.comment = body.comment;
	policyG.firewall = body.firewall;

	const policyGRepository = getRepository(PolicyG);

	try {
		policyG = policyGRepository.create(policyG);
		policyG = await policyGRepository.save(policyG);

		if (body.rulesIds.length > 0) {

			//Add rules to group
			for (var rule of body.rulesIds) {
				Policy_rModel.updatePolicy_r_Group(body.firewall, null, policyG.id, rule, function (error, data) {
					logger.debug("ADDED to Group " + policyG.id + " POLICY: " + rule);
				});
			}
		}
		res.status(200).json({ "insertId": policyG.id });
	} catch (e) {
		res.status(400).json(fwcError.NOT_FOUND);
	}
});


/* Update PolicyGroup that exist */
router.put('/', (req, res) => {
	//Save data into object
	var data = {
		id: req.body.id,
		name: req.body.name,
		firewall: req.body.firewall,
		comment: req.body.comment,
		groupStyle: req.body.style
	};


	try {
		const policyG = getRepository(PolicyG).update(data.id, {
			name: req.body.name,
			firewall: req.body.firewall,
			comment: req.body.comment,
			groupStyle: req.body.style
		});

		res.status(204).end();
	} catch (error) {
		res.status(400).json(fwcError.NOT_FOUND);
	};
});

/* Update Style PolicyGroup  */
router.put('/style', async (req, res) => {
	var data = { 
		iduser: req.session.user_id, 
		fwcloud: req.body.fwcloud, 
		idfirewall: req.body.firewall
	};

	var style = req.body.style;
	var groupIds = req.body.groupIds;

	db.lockTableCon(PolicyGroup.getTableName(), " WHERE firewall=" + data.idfirewall, function () {
		db.startTXcon(async () => {
			try {
				await getRepository(PolicyG).update({firewall: data.idfirewall, id: groupIds}, {
					groupstyle: style
				});
			} catch (e) {
				res.status(400).json(fwcError.NOT_FOUND);
			}
			db.endTXcon(function () { });
		});
	});
	res.status(204).end();
});


/* Update PolicyGruop Name  */
router.put('/name', (req, res) => {
	//Save data into object
	var data = { id: req.body.id, name: req.body.name };

	try {
		getRepository(PolicyG).update(data.id, {
			name: data.name
		});
		res.status(204).end();
	} catch (e) {
		res.status(400).json(fwcError.NOT_FOUND);
	}
});


/* Remove PolicyGroup */
router.put("/del", async (req, res) => {
	var idfirewall = req.body.firewall;
	var id = req.body.id;

	logger.debug("Removed all Policy from Group " + id);
	const policyGs = await getRepository(PolicyG).find({firewall: idfirewall, id: id});

	try {
		policyGs.forEach(policyG => {
			Policy_rModel.updatePolicy_r_GroupAll(idfirewall, id, function(error, data) {
				getRepository(PolicyG).delete(policyG.id);
			});
		});
		res.status(204).end();
	} catch(e) {
		res.status(400).json(fwcError.NOT_FOUND);
	}
});

/* Remove rules from Group */
router.put("/rules/del", async (req, res) => {
	try {
		const policyGroup = await getRepository(PolicyGroup).findOne(req.body.id);
		await removeRules(req.body.firewall, req.body.id, req.body.rulesIds);
		// If after removing the rules the group is empty, remove the rules group from the data base.
		await policyGroup.deleteIfEmpty(req.dbCon, req.body.firewall);
		res.status(204).end();
	} catch (error) { res.status(400).json(error) }
});

async function removeRules(idfirewall, idgroup, rulesIds) {
	return new Promise(async (resolve, reject) => {
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