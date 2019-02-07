var schema = {};
module.exports = schema;

const Joi = require('joi');
const sharedSch = require('../shared');

schema.validate = req => {
	return new Promise(async(resolve, reject) => {
		var schema = Joi.object().keys({ fwcloud: sharedSch.id });

		if (req.method==='POST' && req.url==='/tree/prefix') {
			schema = schema.append({ node_id: sharedSch.id, name: sharedSch.name });
		} else if (req.method === 'PUT') {
			if (req.url === '/tree/prefix')
				schema = schema.append({ node_id: sharedSch.id, old_name: sharedSch.name, new_name: sharedSch.name });
			else if (req.url === '/tree/prefix/del')
				schema = schema.append({ node_id: sharedSch.id });
		} else return reject(new Error('Request method and/or URL not accepted'));

		try {
			await Joi.validate(req.body, schema, sharedSch.joiValidationOptions);
			resolve();
		} catch (error) { return reject(error) }
	});
};