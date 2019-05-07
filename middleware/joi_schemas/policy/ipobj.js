var schema = {};
module.exports = schema;

const Joi = require('joi');
const sharedSch = require('../shared');
const fwcError = require('../../../utils/error_table');
 
schema.validate = req => {
  return new Promise(async (resolve, reject) => {
    var schema = Joi.object().keys({ 
      fwcloud: sharedSch.id,
      firewall: sharedSch.id,
      rule: sharedSch.id
    });

   if (req.method==='POST' || req.method==='PUT') {
      schema = schema.append({
        ipobj: sharedSch.id.allow(-1),
        ipobj_g: sharedSch.id.allow(-1),
        interface: sharedSch.id.allow(-1),
        position: sharedSch.rule_position,
        position_order: sharedSch.u16bits
      });
      if (req.method==='PUT' && req.url==='/policy/ipobj/move') 
        schema = schema.append({ new_rule: sharedSch.id, new_position: sharedSch.rule_position, new_order: sharedSch.u16bits });
      else if (req.method==='PUT' && req.url==='/policy/ipobj/order') 
        schema = schema.append({ new_order: sharedSch.u16bits });
    } else return reject(fwcError.BAD_API_CALL);

    try {
      await Joi.validate(req.body, schema, sharedSch.joiValidationOptions);

      // Semantic validation.
      if (req.method==='POST') {
        if ((req.body.ipobj===-1 && req.body.ipobj_g===-1 && req.body.interface===-1)
            || (req.body.ipobj!==-1 && (req.body.ipobj_g!==-1 || req.body.interface!==-1))
            || (req.body.ipobj_g!==-1 && (req.body.ipobj!==-1 || req.body.interface!==-1))
            || (req.body.interface!==-1 && (req.body.ipobj!==-1 || req.body.ipobj_g!==-1)))
          throw fwcError.ONLY_ONE_NOT_NEGATIVE;
      }
    
      resolve();
    } catch(error) { return reject(error) } 
  });
};