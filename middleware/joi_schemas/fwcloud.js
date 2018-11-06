var schema = {};
module.exports = schema;

const Joi = require('joi');
const sharedSch = require('./shared');
 
schema.validate = req => {
  return new Promise(async (resolve, reject) => {
    var schema = Joi.object().keys({
      name: sharedSch.name,
      image: sharedSch.img.allow(null).optional(),
      comment: sharedSch.comment.allow(null).optional(),
    });
    
    if (req.method==='PUT') {
      if (req.url==='/fwcloud/get' || req.url==='/fwcloud/del' || req.url==='/fwcloud/restricted')
        schema = Joi.object().keys({ fwcloud: sharedSch.id });
      else
        schema = schema.append({ fwcloud: sharedSch.id });
    } else if (req.method!=='POST') return reject(new Error('Request method not accepted'));


    try {
      await Joi.validate(req.body, schema, sharedSch.joiValidationOptions);
      resolve();
    } catch(error) { return reject(error) } 
  });
};
