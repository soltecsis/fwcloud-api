var schema = {};
module.exports = schema;

const Joi = require('joi');
const sharedSch = require('./shared');

schema.validate = req => {
	return new Promise(async(resolve, reject) => {
		var schema = {};

		if (req.method === 'POST' || (req.method === 'PUT' && req.url === '/user')) {
			schema = Joi.object().keys({
				addr: sharedSch.comment,
				phone: sharedSch.comment,
				email: Joi.string().email().optional(),
				web: sharedSch.comment
			});

			if (req.method === 'POST')
				schema = schema.append({ customer: sharedSch.id.optional(),	name: Joi.string().regex(/^[\x09-\x0D -~\x80-\xFE]{1,254}$/) });
			else
				schema = schema.append({ customer: sharedSch.id, name: Joi.string().regex(/^[\x09-\x0D -~\x80-\xFE]{1,254}$/).optional() });
		} else if (req.method === 'PUT') {
			if (req.url === '/user/get')
				schema = schema = Joi.object().keys({ customer: sharedSch.id.optional() });
			else if (req.url === '/user/del' || req.url === '/user/restricted')
				schema = schema = Joi.object().keys({ customer: sharedSch.id });
			else return reject(new Error('Request URL not accepted'));
		} else return reject(new Error('Request method not accepted'));

		try {
			await Joi.validate(req.body, schema, sharedSch.joiValidationOptions);
			resolve();
		} catch (error) { return reject(error) }
	});
};