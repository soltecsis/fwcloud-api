var schema = {};
module.exports = schema;

const Joi = require('joi');
const sharedSch = require('./shared');
 
schema.validate = req => {
  return new Promise(async (resolve, reject) => {
    var schema = Joi.object().keys({
      name: sharedSch.name,
      image: sharedSch.img.optional(),
      comment: sharedSch.comment.optional(),
    });
    
    if (req.method==='PUT') {
      if (req.url==='/fwclouds/get' || req.url==='/fwclouds/del')
        schema = Joi.object().keys({ fwcloud: sharedSch.id });
      else
        schema = schema.append({ fwcloud: sharedSch.id });
    }

    try {
      await Joi.validate(req.body, schema, sharedSch.joiValidationOptions);
      resolve();
    } catch(error) { return reject(error) } 
  });
};
