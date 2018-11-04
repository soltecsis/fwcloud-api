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

sharedSchema.name = Joi.string().regex(/^[ -~\x80-\xFE]{1,64}$/);
sharedSchema.comment = Joi.string().allow('').allow(null).regex(/^[ -~\x80-\xFE]{1,254}$/);

sharedSchema.img = Joi.string().allow('').allow(null).dataUri().min(3).max(64);

sharedSchema._0_1 = Joi.number().integer().valid([0,1]);

sharedSchema.linux_user = Joi.string().regex(/^[a-z_]([a-z0-9_-]{0,31}|[a-z0-9_-]{0,30}\$)$/);
sharedSchema.linux_pass = Joi.string().regex(/^[ -~\x80-\xFE]{2,64}$/);

sharedSchema.mac_addr = Joi.string().regex(/^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/);

sharedSchema.interface_type = Joi.number().integer().valid([10,11]);
sharedSchema.group_type = Joi.number().integer().valid([20,21]);
sharedSchema.policy_type = Joi.number().integer().min(1).max(6);

sharedSchema.ipv4 = Joi.string().ip({ version: ['ipv4'], cidr: 'forbidden'});
sharedSchema.ipv6 = Joi.string().ip({ version: ['ipv6'], cidr: 'forbidden'});

sharedSchema.unsigned_byte = Joi.number.integer().min(0).max(255);

sharedSchema.rule_action = Joi.number.integer().min(1).max(5);

sharedSchema.date = Joi.number.date().min(1).max(5);