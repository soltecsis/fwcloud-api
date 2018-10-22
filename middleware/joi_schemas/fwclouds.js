//create object
var schema = {};
//Export the object
module.exports = schema;

const Joi = require('joi');
const sharedSchema = require('./shared');
 
schema.validate = req => {
  return new Promise(async (resolve, reject) => {
    // We don't need input data validation here because we have no input data.
    if (req.method==="GET" && req.url==='/fwclouds') return resolve();

    var schema = Joi.object().keys({ 
      fwcloud: sharedSchema.id
    });

    if (req.method==="POST" && req.url==='/fwclouds/fwcloud') {
      schema = Joi.object().keys({
        name: sharedSchema.name,
        image: Joi.string().allow('').optional(),
        comment: sharedSchema.comment,
      });
    }

    try {
      await Joi.validate(req.body, schema, sharedSchema.joiValidationOptions);
      resolve();
    } catch(error) { return reject(error) } 
  });
};
