var schema = {};
module.exports = schema;

const Joi = require('joi');
const sharedSch = require('../shared');

schema.validate = req => {
	return new Promise(async(resolve, reject) => {
		var schema = Joi.object().keys({
			fwcloud: sharedSch.id,
			firewall: sharedSch.id,
			rule: sharedSch.id
		});

		if (req.method === 'POST' || req.method === 'PUT') {
			schema = schema.append({
				position: sharedSch.rule_position,
				position_order: sharedSch.u16bits
			});
			if (req.method === 'PUT' && req.url === '/policy/openvpn/move')
				schema = schema.append({ new_rule: sharedSch.id, new_position: sharedSch.rule_position, new_order: sharedSch.u16bits });
			else if (req.method === 'PUT' && req.url === '/policy/openvpn/order')
				schema = schema.append({ new_order: sharedSch.u16bits });
		} else return reject(new Error('Request method not accepted'));

		try {
			await Joi.validate(req.body, schema, sharedSch.joiValidationOptions);
			resolve();
		} catch (error) { return reject(error) }
	});
};