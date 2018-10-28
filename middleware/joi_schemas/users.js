var schema = {};
module.exports = schema;

const Joi = require('joi');
const sharedSc = require('./shared');
 
schema.validate = req => {
  return new Promise(async (resolve, reject) => {
    const schema = Joi.object().keys({
      customer: sharedSc.id,
      username: sharedSc.username,
      password: sharedSc.password,
    });

    try {
      await Joi.validate(req.body, schema, sharedSc.joiValidationOptions);
      resolve();
    } catch(error) { return reject(error) } 
  });
};
