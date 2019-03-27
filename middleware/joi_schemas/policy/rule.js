var schema = {};
module.exports = schema;

const Joi = require('joi');
const sharedSch = require('../shared');

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
				style: sharedSch.u16bits.optional(),
				fw_apply_to: sharedSch.id.allow(null).optional(),
				mark: sharedSch.id.allow(null).optional()
			});
			if (req.method === 'PUT') schema = schema.append({ id: sharedSch.id });
		} else if (req.method === 'PUT') {
			if (req.url === '/policy/rule/type/get')
				schema = schema.append({ type: sharedSch.policy_type });
			else if (req.url === '/policy/rule/get')
				schema = schema.append({ type: sharedSch.policy_type, rule: sharedSch.id });
			else if (req.url==='/policy/rule/position/negate' || req.url==='/policy/rule/position/allow')
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
					style: sharedSch.u16bits, 
					rulesIds: Joi.array().items(sharedSch.id)
				});
			else if (req.url==='/policy/rule/copy' || req.url==='/policy/rule/move')
				schema = schema.append({ 
					pasteOnRuleId: sharedSch.id, 
					pasteOffset: Joi.number().integer().valid([-1,0,1]), 
					rulesIds: Joi.array().items(sharedSch.id) 
				});
		} else return reject(new Error('Request method not accepted'));

		try {
			await Joi.validate(req.body, schema, sharedSch.joiValidationOptions);
			resolve();
		} catch (error) { return reject(error) }
	});
};