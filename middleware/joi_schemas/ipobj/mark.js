var schema = {};
module.exports = schema;

const Joi = require('joi');
const sharedSch = require('../shared');
const fwcError = require('../../../utils/error_table');

schema.validate = req => {
	return new Promise(async(resolve, reject) => {
		var schema = Joi.object().keys({ fwcloud: sharedSch.id });

		if (req.method === 'POST') {
			schema = schema.append({
				code: sharedSch.id,
				name: sharedSch.name,
				comment: sharedSch.comment,
				node_id: sharedSch.id
			});
		} else if (req.method === 'PUT') {
			if (req.url === '/ipobj/mark') {
				schema = schema.append({
					mark: sharedSch.mark_id,
					code: sharedSch.id,
					name: sharedSch.name,
					comment: sharedSch.comment
				});
			} else if (req.url === '/ipobj/mark/get' || req.url === '/ipobj/mark/where' ||
				req.url === '/ipobj/mark/del' || req.url === '/ipobj/mark/restricted') {
				schema = schema.append({ mark: sharedSch.id });
			}
		} else return reject(fwcError.BAD_API_CALL);

		try {
			await Joi.validate(req.body, schema, sharedSch.joiValidationOptions);
			resolve();
		} catch (error) { return reject(error) }
	});
};