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
import { PolicyRule } from '../../models/policy/PolicyRule';
import { PolicyGroup } from '../../models/policy/PolicyGroup';
import { logger } from '../../fonaments/abstract-application';
import { In } from 'typeorm';
import { PolicyRuleRepository } from '../../models/policy/policy-rule.repository';
import { PolicyGroupRepository } from "../../repositories/PolicyGroupRepository";
import db from '../../database/database-manager';

const fwcError = require('../../utils/error_table');

/* Create New PolicyGroup */
router.post('/', async (req, res) => {
	var body = req.body;

	const policyGroupRepository = await db.getSource().manager.getRepository(PolicyGroup);
	const policyRuleRepository = new PolicyRuleRepository(db.getSource().manager);

	try {
		var policyGroup = await policyGroupRepository.create({
			name: body.name,
			comment: body.comment,
			firewallId: body.firewall
		});
		policyGroup = await policyGroupRepository.save(policyGroup);

		if (body.rulesIds.length > 0) {
			const policyRules = await db.getSource().manager.getRepository(PolicyRule).find({where: {id: In(body.rulesIds)}});
			policyRuleRepository.assignToGroup(policyRules, policyGroup);
		}
		res.status(200).json({ "insertId": policyGroup.id });
	} catch (e) {
		logger().error('Error creating policy group: ' + e.message);
		res.status(400).json(fwcError.NOT_FOUND);
	}
});


/* Update PolicyGroup that exist */
router.put('/', async (req, res) => {
	//Save data into object
	const data = {
		id: req.body.id,
		name: req.body.name,
		firewall: req.body.firewall,
		comment: req.body.comment,
		groupStyle: req.body.style
	};


	try {
		await db.getSource().manager.getRepository(PolicyGroup).update(data.id, {
			name: req.body.name,
			firewall: req.body.firewall,
			comment: req.body.comment,
			groupStyle: req.body.style
		});

		res.status(204).end();
	} catch (error) {
		logger().error('Error updating policy group: ' + e.message);
		res.status(400).json(fwcError.NOT_FOUND);
	};
});

/* Update Style PolicyGroup  */
router.put('/style', async (req, res) => {
	const data = { 
		iduser: req.session.user_id, 
		fwcloud: req.body.fwcloud, 
		idfirewall: req.body.firewall
	};

	const style = req.body.style;
	const groupIds = req.body.groupIds;

	try {
		await db.getSource().manager.getRepository(PolicyGroup).update({firewallId: data.idfirewall, id: groupIds}, { groupstyle: style} );
		res.status(204).end();
	} catch (error) {
		logger().error('Error updating policy group style: ' + e.message);
		res.status(400).json(fwcError.NOT_FOUND);
	}
});


/* Update PolicyGruop Name  */
router.put('/name', async (req, res) => {
	//Save data into object
	const data = { id: req.body.id, name: req.body.name };

	try {
		await db.getSource().manager.getRepository(PolicyGroup).update(data.id, {
			name: data.name
		});
		res.status(204).end();
	} catch (e) {
		logger().error('Error updating policy group name: ' + e.message);
		res.status(400).json(fwcError.NOT_FOUND);
	}
});


/* Remove PolicyGroup */
router.put("/del", async (req, res) => {
	logger().debug("Removed all Policy from Group " + req.body.id);
	const policyGroup = await db.getSource().manager.getRepository(PolicyGroup).find({where: {id: req.body.id}});	

	try {
		if (policyGroup) {
			await db.getSource().manager.getRepository(PolicyGroup).remove(policyGroup);
			res.status(204).end();
		}
	} catch(error) {
		logger().error('Error removing policy group: ' + error.message);
		res.status(400).json(fwcError.NOT_FOUND);
	}
});


/* Remove rules from Group */
router.put("/rules/del", async (req, res) => {
	try {
		await removeRules(req.body.firewall, req.body.id, req.body.rulesIds);
		// If after removing the rules the group is empty, remove the rules group from the data base.
		const policyGroup = await db.getSource().manager.getRepository(PolicyGroup).findOne(req.body.id);
		if (policyGroup) {
			await new PolicyGroupRepository(db.getSource().manager).deleteIfEmpty(policyGroup);
		}
		res.status(204).end();
	} catch (error) {
		logger().error('Error removing policy group rules: ' + error.message);
		res.status(400).json(error);
	}
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

async function ruleRemove(ruleidfirewall, idgroup, rule) {
	return new Promise(async (resolve, reject) => {
		let policyRule = await db.getSource().manager.getRepository(PolicyRule).findOne(rule);
		
		if(policyRule) {
			policyRule = await new PolicyRuleRepository(db.getSource().manager).assignToGroup(policyRule, null);
			return resolve();
		}
	});
}

module.exports = router;