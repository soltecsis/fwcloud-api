var schema = {};
module.exports = schema;

const Joi = require('joi');
const sharedSch = require('../shared');

schema.validate = req => {
    return new Promise(async(resolve, reject) => {
        var schema = Joi.object().keys({ fwcloud: sharedSch.id });

        if (req.method === 'POST') {
            schema = schema.append({ id_parent: sharedSch.id, name: sharedSch.name });
        } else if (req.method === 'PUT') {
            if (req.url === '/tree/folder')
                schema = schema.append({ id: sharedSch.id, old_name: sharedSch.name, new_name: sharedSch.name });
            else if (req.url === '/tree/folder/del')
                schema = schema.append({ id: sharedSch.id });
            else if (req.url === '/tree/folder/drop')
                schema = schema.append({ src: sharedSch.id, dst: sharedSch.id });
        } else return reject(new Error('Request method not accepted'));

        try {
            await Joi.validate(req.body, schema, sharedSch.joiValidationOptions);
            resolve();
        } catch (error) { return reject(error) }
    });
};