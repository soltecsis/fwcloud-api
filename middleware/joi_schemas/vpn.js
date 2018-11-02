var schema = {};
module.exports = schema;

const Joi = require('joi');
const sharedSch = require('./shared');
 
schema.validate = req => {
  return new Promise(async (resolve, reject) => {
    var schema = Joi.object().keys({
      fwcloud: sharedSch.id,
      days: sharedSch.days,
      cn: sharedSch.cn,
    });

    if (req.method==="POST" && req.url==='/vpn/openvpn/cert') {
      schema = schema.append({ type: Joi. number().integer().valid([1,2]) });
      schema = schema.append({ ca: sharedSch.id });
    }

    try {
      await Joi.validate(req.body, schema, sharedSch.joiValidationOptions);
      resolve();
    } catch(error) { return reject(error) } 
  });
};
