var schema = {};
module.exports = schema;

const Joi = require('joi');
const sharedSch = require('../shared');
 
schema.validate = req => {
  return new Promise(async (resolve, reject) => {
    var schema = Joi.object().keys({ fwcloud: sharedSch.id });

    if (req.method==="POST" && req.url==='/vpn/pki/crt/prefix') {
      schema = schema.append({ node_id: sharedSch.id, ca: sharedSch.id, name: sharedSch.name });
    }
    else if (req.method==="POST") {
      schema = schema.append({ 
        cn: sharedSch.cn,
        days: sharedSch.days,
        node_id: sharedSch.id,
        comment: sharedSch.comment,
        socketid: sharedSch.socketio_id.optional()
      });
      if (req.url==='/vpn/pki/crt')
        schema = schema.append({ type: sharedSch.crt_type, ca: sharedSch.id });
    }
    else if (req.method==="PUT") {
      if (req.url==='/vpn/pki/crt/get' || req.url==='/vpn/pki/crt/del' || req.url==='/vpn/pki/crt/restricted')
        schema = schema.append({ crt: sharedSch.id });
      else if (req.url==='/vpn/pki/ca/get' || req.url==='/vpn/pki/ca/del' || req.url==='/vpn/pki/ca/restricted')
        schema = schema.append({ ca: sharedSch.id });
    } else return reject(new Error('Request method not accepted'));

    try {
      await Joi.validate(req.body, schema, sharedSch.joiValidationOptions);
      resolve();
    } catch(error) { return reject(error) } 
  });
};
