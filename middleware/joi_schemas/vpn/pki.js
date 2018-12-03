var schema = {};
module.exports = schema;

const Joi = require('joi');
const sharedSch = require('../shared');
 
schema.validate = req => {
  return new Promise(async (resolve, reject) => {
    var schema = Joi.object().keys({ fwcloud: sharedSch.id });

    if (req.method==="POST") {
      schema = schema.append({ 
        cn: sharedSch.cn,
        days: sharedSch.days,
        node_id: sharedSch.id,
        comment: sharedSch.comment
      });
      if (req.url==='/vpn/pki/crt')
        schema = schema.append({ type: sharedSch.crt_type, ca: sharedSch.id });
    }
    else if (req.method==="PUT") {
      if (req.url==='/vpn/pki/crt/del')
        schema = schema.append({ crt: sharedSch.id });
      else if (req.url==='/vpn/pki/ca/del')
        schema = schema.append({ ca: sharedSch.id });
    } else return reject(new Error('Request method not accepted'));

    try {
      await Joi.validate(req.body, schema, sharedSch.joiValidationOptions);
      resolve();
    } catch(error) { return reject(error) } 
  });
};
