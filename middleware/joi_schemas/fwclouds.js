//create object
var schema = {};
//Export the object
module.exports = schema;

const Joi = require('joi');
const sharedSchema = require('./shared');
 
schema.validate = req => {
  return new Promise(async (resolve, reject) => {
    var schema = Joi.object().keys({
      name: sharedSchema.name,
      image: sharedSchema.img,
      comment: sharedSchema.comment,
    });
    
    if (req.method==='PUT') {
      if (req.url==='/fwclouds/get' || req.url==='/fwclouds/del')
        schema = Joi.object().keys({ fwcloud: sharedSchema.id });
      else
        schema = schema.append({ fwcloud: sharedSchema.id });
    }

    try {
      await Joi.validate(req.body, schema, sharedSchema.joiValidationOptions);
      resolve();
    } catch(error) { return reject(error) } 
  });
};
