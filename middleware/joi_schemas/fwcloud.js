var schema = {};
module.exports = schema;

const Joi = require('joi');
const sharedSch = require('./shared');
const fwcError = require('../../utils/error_table');
 
schema.validate = req => {
  return new Promise(async (resolve, reject) => {
    var schema = Joi.object().keys({
      name: sharedSch.name,
      image: sharedSch.img.optional(),
      comment: sharedSch.comment,
    });
    
    if (req.method==='PUT') {
      if (req.url==='/fwcloud/get' || req.url==='/fwcloud/del' || req.url==='/fwcloud/restricted')
        schema = Joi.object().keys({ fwcloud: sharedSch.id });
      else if (req.url==='/fwcloud' || req.url==='/fwcloud/lock' || req.url==='/fwcloud/unlock' || req.url==='/fwcloud/lock/get')
        schema = schema.append({ fwcloud: sharedSch.id });
      else return reject(fwcError.BAD_API_CALL);
    } else if (req.method!=='POST' && req.url!=='/fwcloud') return reject(fwcError.BAD_API_CALL);


    try {
      await Joi.validate(req.body, schema, sharedSch.joiValidationOptions);
      resolve();
    } catch(error) { return reject(error) } 
  });
};
