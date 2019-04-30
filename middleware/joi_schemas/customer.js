var schema = {};
module.exports = schema;

const Joi = require('joi');
const sharedSch = require('./shared');

schema.validate = req => {
	return new Promise(async(resolve, reject) => {
		var schema = {};

		if (req.method === 'POST' || (req.method === 'PUT' && req.url === '/cluster')) {
			schema = Joi.object().keys({
				name: Joi.string().regex(/^[\x09-\x0D -~\x80-\xFE]{1,254}$/),
				email: Joi.string().email().optional(),
				address: sharedSch.comment,
				cif: Joi.string().alphanum().min(3).max(32).optional(),
				telephone: Joi.string().alphanum().min(3).max(32).optional(),
				web: sharedSch.comment
			});
		} else if (req.method === 'PUT') {
			schema = Joi.object().keys({ fwcloud: sharedSch.id });

			if (req.url === '/customer/get' || req.url === '/customer/del')
				schema = schema.append({ cluster: sharedSch.id });
			else if (req.url === '/customer/restricted')
				schema = schema.append({ firewall: sharedSch.id });
		} else return reject(new Error('Request method not accepted'));

		try {
			await Joi.validate(req.body, schema, sharedSch.joiValidationOptions);
			resolve();
		} catch (error) { return reject(error) }
	});
};