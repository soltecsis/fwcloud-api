//create object
var sharedSchema = {};
//Export the object
module.exports = sharedSchema;

const Joi = require('joi');

// Options used for the Joi validation function.
// https://github.com/hapijs/joi/blob/v14.0.0/API.md#validatevalue-schema-options-callback
sharedSchema.joiValidationOptions = {convert: false, presence: 'required'};

sharedSchema.fwcloud = Joi.number().integer().min(1);
sharedSchema.customer = Joi.number().integer().min(1);
sharedSchema.username = Joi.string().alphanum().min(3).max(32);
sharedSchema.password = Joi.string().regex(/^[a-zA-Z0-9]{6,32}$/);

sharedSchema.days = Joi.number().integer().min(1);
sharedSchema.cn = Joi.string().regex(/^[a-zA-Z0-9\-_]{4,64}$/);