//create object
var sharedSchema = {};
//Export the object
module.exports = sharedSchema;

const Joi = require('joi');

// Options used for the Joi validation function.
// https://github.com/hapijs/joi/blob/v14.0.0/API.md#validatevalue-schema-options-callback
sharedSchema.joiValidationOptions = { convert: false, presence: 'required' };

sharedSchema.id = Joi.number().integer().min(1);

sharedSchema.mark_id = Joi.number().integer().min(0);

sharedSchema.username = Joi.string().alphanum().min(3).max(32);
sharedSchema.password = Joi.string().regex(/^[ -~\x80-\xFE]{6,64}$/);

sharedSchema.days = Joi.number().integer().min(1).max(36500);
sharedSchema.cn = Joi.string().regex(/^[a-zA-Z0-9\-_\.]{1,64}$/);

sharedSchema.name = Joi.string().regex(/^[ -~\x80-\xFE]{1,64}$/);
sharedSchema.comment = Joi.string().allow('').allow(null).regex(/^[\x09-\x0D -~\x80-\xFE]{1,254}$/).optional();

sharedSchema.img = Joi.string().allow('').allow(null).dataUri().min(3).max(64);

sharedSchema._0_1 = Joi.number().integer().valid([0, 1]);

sharedSchema.linux_user = Joi.string().regex(/^[a-zA-Z_]([a-zA-Z0-9_-]{0,31}|[a-zA-Z0-9_-]{0,30}\$)$/);
sharedSchema.linux_pass = Joi.string().regex(/^[ -~\x80-\xFE]{2,64}$/);

sharedSchema.linux_path = Joi.string().regex(/^\/{1}(((\/{1}\.{1})?[a-zA-Z0-9 ]+\/?)+(\.{1}[a-zA-Z0-9]{2,4})?)$/);

sharedSchema.mac_addr = Joi.string().regex(/^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/);

sharedSchema.interface_type = Joi.number().integer().valid([10, 11]);
sharedSchema.group_type = Joi.number().integer().valid([20, 21]);
sharedSchema.policy_type = Joi.number().integer().valid([1,2,3,4,5,6,61,62,63,64,65]);

sharedSchema.ipv4 = Joi.string().ip({ version: ['ipv4'], cidr: 'forbidden' });
sharedSchema.ipv4_netmask_cidr = Joi.string().regex(/^(\/([0-9]|[1-2][0-9]|3[0-2]))$/);
sharedSchema.ipv4_netmask = Joi.string().regex(/^(((255\.){3}(255|254|252|248|240|224|192|128|0+))|((255\.){2}(255|254|252|248|240|224|192|128|0+)\.0)|((255\.)(255|254|252|248|240|224|192|128|0+)(\.0+){2})|((255|254|252|248|240|224|192|128|0+)(\.0+){3}))$/);
sharedSchema.ipv6 = Joi.string().ip({ version: ['ipv6'], cidr: 'forbidden' });
sharedSchema.ipv6_netmask = Joi.string().regex(/^(\/([0-9]|[1-9][0-9]|1[0-1][0-9]|12[0-8]))$/);

sharedSchema.u8bits = Joi.number().integer().min(0).max(255);
sharedSchema.u16bits = Joi.number().integer().min(0).max(65535);

sharedSchema.rule_action = Joi.number().integer().min(1).max(5);
sharedSchema.rule_position = Joi.number().integer().min(1).max(61);

sharedSchema.date = Joi.date().min(1).max(5);

sharedSchema.crt_type = Joi.number().integer().valid([1, 2]); // 1=Client certificate, 2=Server certificate.

sharedSchema.rule_clipboard_action = Joi.number().integer().valid([1, 2]);

sharedSchema.socketio_id = Joi.string().regex(/^[a-zA-Z0-9\-_]{4,64}$/);

sharedSchema.dns_name = Joi.string().regex(/^(([a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9\-]*[a-zA-Z0-9])\.)*([A-Za-z0-9]|[A-Za-z0-9][A-Za-z0-9\-]*[A-Za-z0-9])$/);

sharedSchema.role = Joi.number().integer().min(1).max(2);