/*
    Copyright 2019 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
    https://soltecsis.com
    info@soltecsis.com


    This file is part of FWCloud (https://fwcloud.net).

    FWCloud is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    FWCloud is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with FWCloud.  If not, see <https://www.gnu.org/licenses/>.
*/


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

sharedSchema.script_code = Joi.string().allow('').allow(null).regex(/^[\x09-\x0D -~\x80-\xFE]{1,65535}$/).optional();

sharedSchema.img = Joi.string().allow('').allow(null).dataUri().min(3).max(64);

sharedSchema.style = Joi.string().allow('').allow(null).max(50);

sharedSchema._0_1 = Joi.number().integer().valid(0, 1);

sharedSchema.linux_user = Joi.string().regex(/^[a-zA-Z_]([a-zA-Z0-9_-]{0,31}|[a-zA-Z0-9_-]{0,30}\$)$/);
sharedSchema.linux_pass = Joi.string().regex(/^[ -~\x80-\xFE]{2,64}$/);

sharedSchema.linux_path = Joi.string().regex(/^\/{1}(((\/{1}\.{1})?[a-zA-Z0-9 -_]+\/?)+(\.{1}[a-zA-Z0-9]{2,4})?)$/);

sharedSchema.mac_addr = Joi.string().regex(/^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/);

sharedSchema.interface_type = Joi.number().integer().valid(10, 11);
sharedSchema.group_type = Joi.number().integer().valid(20, 21);
sharedSchema.policy_type = Joi.number().integer().valid(1, 2, 3, 4, 5, 6, 61, 62, 63, 64, 65, 66, 67, 68, 66, 67, 68);

sharedSchema.policy_compiler = Joi.string().valid('IPTables','NFTables');

sharedSchema.ipv4 = Joi.string().ip({ version: ['ipv4'], cidr: 'forbidden' });
sharedSchema.ipv4_netmask_cidr = Joi.string().regex(/^(\/([0-9]|[1-2][0-9]|3[0-2]))$/);
sharedSchema.ipv4_netmask = Joi.string().regex(/^(((255\.){3}(255|254|252|248|240|224|192|128|0+))|((255\.){2}(255|254|252|248|240|224|192|128|0+)\.0)|((255\.)(255|254|252|248|240|224|192|128|0+)(\.0+){2})|((255|254|252|248|240|224|192|128|0+)(\.0+){3}))$/);
sharedSchema.ipv6 = Joi.string().ip({ version: ['ipv6'], cidr: 'forbidden' });
sharedSchema.ipv6_netmask = Joi.string().regex(/^(\/([0-9]|[1-9][0-9]|1[0-1][0-9]|12[0-8]))$/);

sharedSchema.u8bits = Joi.number().integer().min(0).max(255);
sharedSchema.u16bits = Joi.number().integer().min(0).max(65535);
sharedSchema.u32bits = Joi.number().integer().min(0).max(4294967295);

sharedSchema.rule_action = Joi.number().integer().min(1).max(5);
sharedSchema.rule_position = Joi.number().integer().min(1).max(61);

sharedSchema.date = Joi.date().min(1).max(5);

sharedSchema.crt_type = Joi.number().integer().valid(1, 2); // 1=Client certificate, 2=Server certificate.

sharedSchema.rule_clipboard_action = Joi.number().integer().valid(1, 2);

sharedSchema.socketio_id = Joi.string().regex(/^[a-zA-Z0-9\-_]{4,64}$/);

sharedSchema.dns_name = Joi.string().regex(/^(([a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9\-]*[a-zA-Z0-9])\.)*([A-Za-z0-9]|[A-Za-z0-9][A-Za-z0-9\-]*[A-Za-z0-9])$/);

sharedSchema.role = Joi.number().integer().min(1).max(2);

sharedSchema.backup_id = Joi.string().regex(/^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[1-2][0-9]|3[0-1])_(2[0-3]|[01][0-9]):[0-5][0-9]:[0-5][0-9]$/);

//sharedSchema.cron_schedule = Joi.string().regex(/^(((([\*]{1}){1})|((\*\/){0,1}(([0-9]{1}){1}|(([1-5]{1}){1}([0-9]{1}){1}){1}))) ((([\*]{1}){1})|((\*\/){0,1}(([0-9]{1}){1}|(([1-5]{1}){1}([0-9]{1}){1}){1}))) ((([\*]{1}){1})|((\*\/){0,1}(([0-9]{1}){1}|(([1]{1}){1}([0-9]{1}){1}){1}|([2]{1}){1}([0-3]{1}){1}))) ((([\*]{1}){1})|((\*\/){0,1}(([1-9]{1}){1}|(([1-2]{1}){1}([0-9]{1}){1}){1}|([3]{1}){1}([0-1]{1}){1}))) ((([\*]{1}){1})|((\*\/){0,1}(([1-9]{1}){1}|(([1-2]{1}){1}([0-9]{1}){1}){1}|([3]{1}){1}([0-1]{1}){1}))) ((([\*]{1}){1})|((\*\/){0,1}(([0-7]{1}){1}))))$/);
sharedSchema.cron_schedule = Joi.string().regex(/^(((\*|(\d\d?))(\/\d\d?)?)|(\d\d?\-\d\d?))(,(((\*|(\d\d?))(\/\d\d?)?)|(\d\d?\-\d\d?)))*\s(((\*|(\d\d?))(\/\d\d?)?)|(\d\d?\-\d\d?))(,(((\*|(\d\d?))(\/\d\d?)?)|(\d\d?\-\d\d?)))*\s(((\*|(\d\d?))(\/\d\d?)?)|(\d\d?\-\d\d?))(,(((\*|(\d\d?))(\/\d\d?)?)|(\d\d?\-\d\d?)))*\s(\?|(((\*|(\d\d?L?))(\/\d\d?)?)|(\d\d?L?\-\d\d?L?)|L|(\d\d?W))(,(((\*|(\d\d?L?))(\/\d\d?)?)|(\d\d?L?\-\d\d?L?)|L|(\d\d?W)))*)\s(((\*|(\d|10|11|12|JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC))(\/\d\d?)?)|((\d|10|11|12|JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\-(\d|10|11|12|JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)))(,(((\*|(\d|10|11|12|JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC))(\/\d\d?)?)|((\d|10|11|12|JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\-(\d|10|11|12|JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC))))*\s(((\*|([0-7]|MON|TUE|WED|THU|FRI|SAT|SUN)L?)(\/\d\d?)?)|(([0-7]|MON|TUE|WED|THU|FRI|SAT|SUN)L?\-([0-7]|MON|TUE|WED|THU|FRI|SAT|SUN)L?)|([0-7]|MON|TUE|WED|THU|FRI|SAT|SUN)L?#([1-5]))(,(((\*|([0-7]|MON|TUE|WED|THU|FRI|SAT|SUN)L?)(\/\d\d?)?)|(([0-7]|MON|TUE|WED|THU|FRI|SAT|SUN)L?\-([0-7]|MON|TUE|WED|THU|FRI|SAT|SUN)L?)|([0-7]|MON|TUE|WED|THU|FRI|SAT|SUN)L?#([1-5])))*$/);

sharedSchema.SpecialPolicyRule = Joi.number().integer().valid(0, 1, 2, 3, 4, 5 ,6);

sharedSchema.authCode = Joi.string().allow(null).allow("")
