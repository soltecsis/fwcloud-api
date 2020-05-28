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
import { app, logger } from '../../fonaments/abstract-application';
import { RepositoryService } from '../../database/repository.service';
import { In } from 'typeorm';
const fwcError = require('../../utils/error_table');
const app = require('../../fonaments/abstract-application').app;



/* Create New PolicyGroup */
router.post('/', async (req, res) => {
	const repository = await app().getService(RepositoryService.name);
	var body = req.body;

	const policyGroupRepository = repository.for(PolicyGroup);
	const policyRuleRepository = repository.for(PolicyRule);

	try {
		policyGroup = policyGroupRepository.create({
			name: body.name,
			comment: body.comment,
			firewallId: body.firewall
		});
		policyGroup = await policyGroupRepository.save(policyGroup);

		if (body.rulesIds.length > 0) {
			const policyRules = await policyRuleRepository.find({where: {id: In(body.rulesIds)}});
			policyRuleRepository.assignToGroup(policyRules, policyGroup);
		}
		res.status(200).json({ "insertId": policyGroup.id });
	} catch (e) {
		res.status(400).json(fwcError.NOT_FOUND);
	}
});


/* Update PolicyGroup that exist */
router.put('/', async (req, res) => {
	const repository = await app().getService(RepositoryService.name);
	//Save data into object
	var data = {
		id: req.body.id,
		name: req.body.name,
		firewall: req.body.firewall,
		comment: req.body.comment,
		groupStyle: req.body.style
	};


	try {
		const policyGroup = repository.for(PolicyGroup).update(data.id, {
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
	const repository = await app().getService(RepositoryService.name);
	var data = { 
		iduser: req.session.user_id, 
		fwcloud: req.body.fwcloud, 
		idfirewall: req.body.firewall
	};

	var style = req.body.style;
	var groupIds = req.body.groupIds;

	try {
		await repository.for(PolicyGroup).update({firewall: data.idfirewall, id: groupIds}, { groupstyle: style} );
		res.status(204).end();
	} catch (error) { res.status(400).json(fwcError.NOT_FOUND); }
});


/* Update PolicyGruop Name  */
router.put('/name', async (req, res) => {
	const repository = await app().getService(RepositoryService.name);
	//Save data into object
	var data = { id: req.body.id, name: req.body.name };

	try {
		await repository.for(PolicyGroup).update(data.id, {
			name: data.name
		});
		res.status(204).end();
	} catch (e) {
		res.status(400).json(fwcError.NOT_FOUND);
	}
});


/* Remove PolicyGroup */
router.put("/del", async (req, res) => {
	const repository = await app().getService(RepositoryService.name);
	var idfirewall = req.body.firewall;
	var id = req.body.id;

	logger().debug("Removed all Policy from Group " + id);
	const policyGroup = await repository.for(PolicyGroup).findOne(id);

	try {
		if (policyGroup) {
			await repository.for(PolicyGroup).remove(policyGroup);
			res.status(204).end();
		}
	} catch(error) { res.status(400).json(fwcError.NOT_FOUND) }
});


/* Remove rules from Group */
router.put("/rules/del", async (req, res) => {
	const repository = await app().getService(RepositoryService.name);
	try {
		await removeRules(req.body.firewall, req.body.id, req.body.rulesIds);
		// If after removing the rules the group is empty, remove the rules group from the data base.
		const policyGroup = await repository.for(PolicyGroup).findOne(req.body.id);
		if (policyGroup) {
			await repository.for(PolicyGroup).deleteIfEmpty(policyGroup);
		}
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

async function ruleRemove(ruleidfirewall, idgroup, rule) {
	return new Promise(async (resolve, reject) => {
		const repository = await app().getService(RepositoryService.name);
		let policyRule = await repository.for(PolicyRule).findOne(rule);
		
		if(policyRule) {
			policyRule = await repository.for(PolicyRule).assignToGroup(policyRule, null);
			return resolve();
		}
	});
}

module.exports = router;