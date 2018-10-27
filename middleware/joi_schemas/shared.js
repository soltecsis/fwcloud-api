//create object
var sharedSchema = {};
//Export the object
module.exports = sharedSchema;

const Joi = require('joi');

// Options used for the Joi validation function.
// https://github.com/hapijs/joi/blob/v14.0.0/API.md#validatevalue-schema-options-callback
sharedSchema.joiValidationOptions = {convert: false, presence: 'required'};

sharedSchema.id = Joi.number().integer().min(1);

sharedSchema.username = Joi.string().alphanum().min(3).max(32);
sharedSchema.password = Joi.string().regex(/^[ -~\x80-\xFE]{6,64}$/);

sharedSchema.days = Joi.number().integer().min(1).max(9999999);
sharedSchema.cn = Joi.string().regex(/^[a-zA-Z0-9\-_]{4,64}$/);

sharedSchema.name = Joi.string().regex(/^[ -~\x80-\xFE]{6,64}$/);
sharedSchema.comment = Joi.string().allow('').regex(/^[ -~\x80-\xFE]{1,254}$/).optional();

sharedSchema.img = Joi.string().allow('').dataUri().min(3).max(64).optional();
