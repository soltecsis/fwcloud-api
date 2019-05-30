var schema = {};
module.exports = schema;

const Joi = require('joi');
const sharedSch = require('./shared');
const fwcError = require('../../utils/error_table');

schema.validate = req => {
	return new Promise(async(resolve, reject) => {
		var schema = {};

    if (req.method==='POST' && (req.url==='/user/login' || req.url==='/user/logout')) {
			if (req.url==='/user/login') {
				schema = Joi.object().keys({
					customer: sharedSch.id,
					username: sharedSch.username,
					password: sharedSch.password,
				});
			}
    }
		else if (req.url==='/user' && (req.method==='POST' || req.method==='PUT')) {
			schema = Joi.object().keys({
				customer: sharedSch.id,
				email: Joi.string().email().optional(),
        username: sharedSch.username,
				password: sharedSch.password,
				enabled: sharedSch._0_1,
				role: sharedSch.role,
				allowed_from: sharedSch.comment
			});

			if (req.method==='POST')
				schema = schema.append({ name: Joi.string().regex(/^[\x09-\x0D -~\x80-\xFE]{1,254}$/) });
			else
				schema = schema.append({ user: sharedSch.id, customer: sharedSch.id, name: Joi.string().regex(/^[\x09-\x0D -~\x80-\xFE]{1,254}$/).optional() });
		} 
    else if ((req.url==='/user/fwcloud' && req.method==='POST') || (req.url==='/user/fwcloud/del' && req.method==='PUT')) {
			schema = schema = Joi.object().keys({ user: sharedSch.id, fwcloud: sharedSch.id });
		}
		else if (req.method==='PUT') {
			if (req.url === '/user/get')
				schema = schema = Joi.object().keys({ customer: sharedSch.id, user: sharedSch.id.optional() });
			else if (req.url === '/user/del' || req.url === '/user/restricted')
				schema = schema = Joi.object().keys({ customer: sharedSch.id, user: sharedSch.id });
			else if (req.url==='/user/fwcloud/get')
				schema = schema = Joi.object().keys({ user: sharedSch.id});
			else if (req.url==='/user/changepass')
				schema = schema = Joi.object().keys({ password: sharedSch.password});
			else return reject(fwcError.BAD_API_CALL);
		} else return reject(fwcError.BAD_API_CALL);

		try {
			await Joi.validate(req.body, schema, sharedSch.joiValidationOptions);
			resolve();
		} catch (error) { return reject(error) }
	});
};