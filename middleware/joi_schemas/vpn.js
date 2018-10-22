//create object
var schema = {};
//Export the object
module.exports = schema;

const Joi = require('joi');
const sharedSchema = require('./shared');
 
schema.validate = req => {
  return new Promise(async (resolve, reject) => {
    var schema = Joi.object().keys({
      fwcloud: sharedSchema.id,
      days: sharedSchema.days,
      cn: sharedSchema.cn,
    });

    if (req.method==="POST" && req.url==='/vpn/openvpn/cert') {
      schema = schema.append({ type: Joi. number().integer().valid([1,2]) });
      schema = schema.append({ ca: sharedSchema.id });
    }

    try {
      await Joi.validate(req.body, schema, sharedSchema.joiValidationOptions);
      resolve();
    } catch(error) { return reject(error) } 
  });
};
