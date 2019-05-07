var schema = {};
module.exports = schema;

const Joi = require('joi');
const sharedSch = require('../shared');
const fwcError = require('../../../utils/error_table');

schema.validate = req => {
	return new Promise(async(resolve, reject) => {
		var schema = Joi.object().keys({
			fwcloud: sharedSch.id,
			firewall: sharedSch.id,
		});

		if (req.method === 'POST' || (req.method === 'PUT' && req.url === '/policy/group')) {
			schema = schema.append({
				name: sharedSch.name,
				comment: sharedSch.comment
			});
			if (req.method === 'PUT') schema = schema.append({ id: sharedSch.id });
			else schema = schema.append({ rulesIds: Joi.array().items(sharedSch.id) });
		} else if (req.method === 'PUT') {
			if (req.url === '/policy/group/style')
				schema = schema.append({ style: sharedSch.u16bits, groupIds: Joi.array().items(sharedSch.id) });
			else if (req.url === '/policy/group/name')
				schema = schema.append({ id: sharedSch.id, name: sharedSch.name });
			else if (req.url === '/policy/group/del')
				schema = schema.append({ id: sharedSch.id });
			else if (req.url === '/policy/group/rules/del')
				schema = schema.append({ id: sharedSch.id, rulesIds: Joi.array().items(sharedSch.id) });
		} else return reject(fwcError.BAD_API_CALL);

		try {
			await Joi.validate(req.body, schema, sharedSch.joiValidationOptions);
			resolve();
		} catch (error) { return reject(error) }
	});
};