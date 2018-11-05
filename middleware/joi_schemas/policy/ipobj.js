var schema = {};
module.exports = schema;

const Joi = require('joi');
const sharedSch = require('../shared');
 
schema.validate = req => {
  return new Promise(async (resolve, reject) => {
    var schema = Joi.object().keys({ 
      fwcloud: sharedSch.id,
      firewall: sharedSch.id,
      rule: sharedSch.id
    });

    if (req.method==='PUT' && req.url==='/policy/ipobj/negate')
        schema = schema.append({ position: sharedSch.rule_position, negate: sharedSch._0_1 });
    else if (req.method==='POST' || req.method==='PUT') {
      schema = schema.append({
        ipobj: sharedSch.id.allow(-1),
        ipobj_g: sharedSch.id.allow(-1),
        interface: sharedSch.id.allow(-1),
        position: sharedSch.rule_position,
        position_order: sharedSch.unsigned_byte
      });
      if (req.method==='PUT' && req.url==='/policy/ipobj/move') 
        schema = schema.append({ new_rule: sharedSch.id, new_position: sharedSch.rule_position, new_order: sharedSch.unsigned_byte });
      else if (req.method==='PUT' && req.url==='/policy/ipobj/order') 
        schema = schema.append({ new_order: sharedSch.unsigned_byte });
    } else return reject(new Error('Request method not accepted'));

    try {
      await Joi.validate(req.body, schema, sharedSch.joiValidationOptions);

      // Semantic validation.
      if ((req.body.ipobj===-1 && req.body.ipobj_g===-1 && req.body.interface===-1)
          || (req.body.ipobj!==-1 && (req.body.ipobj_g!==-1 || req.body.interface!==-1))
          || (req.body.ipobj_g!==-1 && (req.body.ipobj!==-1 || req.body.interface!==-1))
          || (req.body.interface!==-1 && (req.body.ipobj!==-1 || req.body.ipobj_g!==-1)))
        throw(new Error('Only one of ipob, ipobj_g and interface must different from -1'));
    
      resolve();
    } catch(error) { return reject(error) } 
  });
};