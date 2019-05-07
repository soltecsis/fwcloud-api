var schema = {};
module.exports = schema;

const Joi = require('joi');
const sharedSch = require('../../shared');
const fwcError = require('../../../../utils/error_table');
 
schema.validate = req => {
  return new Promise(async (resolve, reject) => {
    var schema = Joi.object().keys({ fwcloud: sharedSch.id });

   if (req.method==="POST") {
      schema = schema.append({ 
        cn: sharedSch.cn,
        days: sharedSch.days,
        node_id: sharedSch.id,
        comment: sharedSch.comment,
        socketid: sharedSch.socketio_id.optional()
      });
    }
    else if (req.method==="PUT") {
      schema = schema.append({ ca: sharedSch.id });
    } else return reject(fwcError.BAD_API_CALL);

    try {
      await Joi.validate(req.body, schema, sharedSch.joiValidationOptions);
      resolve();
    } catch(error) { return reject(error) } 
  });
};
