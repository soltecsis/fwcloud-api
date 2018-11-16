var schema = {};
module.exports = schema;

const Joi = require('joi');
const sharedSch = require('../shared');
 
schema.validate = req => {
  return new Promise(async (resolve, reject) => {
    var schema = Joi.object().keys({
      fwcloud: sharedSch.id,
      cn: sharedSch.cn,
      days: sharedSch.days,
      node_id: sharedSch.id
    });

    if (req.method==="POST") {
      if (req.url==='/vpn/pki/crt')
        schema = schema.append({ type: sharedSch.crt_type, ca: sharedSch.id });
    } else return reject(new Error('Request method not accepted'));

    try {
      await Joi.validate(req.body, schema, sharedSch.joiValidationOptions);
      resolve();
    } catch(error) { return reject(error) } 
  });
};
