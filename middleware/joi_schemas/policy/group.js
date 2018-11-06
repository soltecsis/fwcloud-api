var schema = {};
module.exports = schema;

const Joi = require('joi');
const sharedSch = require('../shared');
 
schema.validate = req => {
  return new Promise(async (resolve, reject) => {
    var schema = Joi.object().keys({ 
      fwcloud: sharedSch.id,
      firewall: sharedSch.id,
    });

    if (req.method==='POST' || (req.method==='PUT' && req.url==='/policy/group')) {
      schema = schema.append({
        name: sharedSch.name, 
        comment: sharedSch.comment,
        groupStyle: sharedSch.u16bits 
      });
      if (req.method==='PUT') schema = schema.append({ id: sharedSch.id });
      else schema = schema.append({ groupIds: Joi.array().items(sharedSch.id) });
    }
    else if (req.method==='PUT') {
      if (req.url==='/policy/group/style')
        schema = schema.append({ style: sharedSch.u16bits, groupIds: Joi.array().items(sharedSch.id) });
      else if (req.url==='/policy/group/id')
        schema = schema.append({ id: sharedSch.id, name: sharedSch.name });
      else if (req.url==='/policy/group/del')
        schema = schema.append({ id: sharedSch.id });
      else if (req.url==='/policy/group/rules/del')
        schema = schema.append({ id: sharedSch.id, rulesIds: Joi.array().items(sharedSch.id) });
    } else return reject(new Error('Request method not accepted'));

    try {
      await Joi.validate(req.body, schema, sharedSch.joiValidationOptions);
      resolve();
    } catch(error) { return reject(error) } 
  });
};