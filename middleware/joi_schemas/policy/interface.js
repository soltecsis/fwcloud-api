var schema = {};
module.exports = schema;

const Joi = require('joi');
const sharedSch = require('../shared');
 
schema.validate = req => {
  return new Promise(async (resolve, reject) => {
    var schema = Joi.object().keys({ 
      fwcloud: sharedSch.id,
      firewall: sharedSch.id
    });
    
    if (req.method==='POST' || (req.method==='PUT' && req.url==='/policy/rule')) {
      schema = schema.append({
        idgroup: sharedSch.id,
        rule_order: sharedSch.id,
        action: sharedSch.rule_action,
        time_start: Joi.number.date().allow(null),
        time_end: Joi.number.date().allow(null),
        active: sharedSch._0_1,
        options: sharedSch.unsigned_byte,
        comment: sharedSch.comment.optional(),
        type: sharedSch.unsigned_byte,
        style: sharedSch.unsigned_byte,
        fw_apply_to: sharedSch.id
      });
      if (req.method==='PUT') schema = schema.append({ id: sharedSch.id });
    }
    else if (req.method==='PUT') {
      if (req.url==='/policy/rule/type/get')
        schema = schema.append({ type: sharedSch.unsigned_byte });
      else if (req.url==='/policy/rule/del')
        schema = schema.append({ rulesIds: Joi.array().items(sharedSch.id) });
      else if (req.url==='/policy/rule/active')
        schema = schema.append({ type: sharedSch.unsigned_byte, active: sharedSch._0_1, rulesIds: Joi.array().items(sharedSch.id) });
      else if (req.url==='/policy/rule/style')
        schema = schema.append({ type: sharedSch.unsigned_byte, style: sharedSch.unsigned_byte, rulesIds: Joi.array().items(sharedSch.id) });
      else if (req.url==='/policy/rule/copy')
        schema = schema.append({ type: sharedSch.unsigned_byte, style: sharedSch.unsigned_byte, rulesIds: Joi.array().items(sharedSch.id) });
    } else return reject(new Error('Request method not accepted'));

    try {
      await Joi.validate(req.body, schema, sharedSch.joiValidationOptions);
      resolve();
    } catch(error) { return reject(error) } 
  });
};