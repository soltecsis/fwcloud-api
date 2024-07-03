/*
    Copyright 2022 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
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


var schema = {};
module.exports = schema;

const Joi = require('joi');
const sharedSch = require('../shared');
const fwcError = require('../../../utils/error_table');

schema.validate = req => {
	return new Promise(async(resolve, reject) => {
		var schema = Joi.object().keys({
			fwcloud: sharedSch.id,
			firewall: sharedSch.id
		});

		if (req.method === 'POST' || (req.method === 'PUT' && req.url === '/policy/rule')) {
			schema = schema.append({
				idgroup: sharedSch.id.allow(null).optional(),
				rule_order: sharedSch.id.optional(),
				action: sharedSch.rule_action.optional(),
				time_start: Joi.date().allow(null).allow('').optional(),
				time_end: Joi.date().allow(null).allow('').optional(),
				active: sharedSch._0_1.optional(),
				options: sharedSch.u16bits,
				comment: sharedSch.comment,
				type: sharedSch.policy_type.optional(),
				style: sharedSch.style.optional(),
				fw_apply_to: sharedSch.id.allow(null).optional(),
				mark: sharedSch.mark_id.allow(null).optional(),
				run_before: sharedSch.script_code.optional(),
				run_after: sharedSch.script_code.optional()
			});
			if (req.method === 'POST') schema = schema.append({ special: sharedSch.SpecialPolicyRule.optional() });
			if (req.method === 'PUT') schema = schema.append({ rule: sharedSch.id });
		} else if (req.method === 'PUT') {
			if (req.url === '/policy/rule/type/get' || req.url === '/policy/rule/type/grouped/get')
				schema = schema.append({ type: sharedSch.policy_type });
			else if (req.url === '/policy/rule/type/ingroup/get')
				schema = schema.append({ type: sharedSch.policy_type, idgroup: sharedSch.id });
			else if (req.url === '/policy/rule/get')
				schema = schema.append({ type: sharedSch.policy_type, rule: sharedSch.id });
			else if (req.url === '/policy/rule/position/negate' || req.url === '/policy/rule/position/allow')
				schema = schema.append({ rule: sharedSch.id, position: sharedSch.rule_position });
			else if (req.url === '/policy/rule/del')
				schema = schema.append({ rulesIds: Joi.array().items(sharedSch.id) });
			else if (req.url === '/policy/rule/active')
				schema = schema.append({
					type: sharedSch.policy_type,
					active: sharedSch._0_1,
					rulesIds: Joi.array().items(sharedSch.id)
				});
			else if (req.url === '/policy/rule/style')
				schema = schema.append({
					type: sharedSch.policy_type,
					style: sharedSch.style,
					rulesIds: Joi.array().items(sharedSch.id)
				});
			else if (req.url === '/policy/rule/copy' || req.url === '/policy/rule/move')
				schema = schema.append({
					pasteOnRuleId: sharedSch.id,
					pasteOffset: Joi.number().integer().valid(-1, 0, 1),
					rulesIds: Joi.array().items(sharedSch.id)
				});
		} else return reject(fwcError.BAD_API_CALL);

		try {
			await schema.validateAsync(req.body, sharedSch.joiValidationOptions);
			resolve();
		} catch (error) { return reject(error) }
	});
};