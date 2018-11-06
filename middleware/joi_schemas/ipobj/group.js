var schema = {};
module.exports = schema;

const Joi = require('joi');
const sharedSch = require('../shared');
 
schema.validate = req => {
  return new Promise(async (resolve, reject) => {
    var schema = Joi.object().keys({ fwcloud: sharedSch.id });
    
    if (req.method==='POST' || (req.method==='PUT' && req.url==='/ipobj/group')) {
      schema = Joi.object().keys({ 
        name: sharedSch.name,
        type: sharedSch.group_type,
        comment: sharedSch.comment
      });
      if (req.method==='PUT') schema = schema.append({ id: sharedSch.id });
      else if (req.method==='POST') schema = schema.append({ node_parent: sharedSch.id, node_order: sharedSch.id, node_type: sharedSch.id });
    } 
    else if (req.method==='PUT') {
      if (req.url==='/ipobj/group/get')
        schema = schema.append({ id: sharedSch.id });
      else if (req.url==='/ipobj/group/del')
        schema = schema.append({ id: sharedSch.id, type: sharedSch.group_type });
      else if (req.url==='/ipobj/group/addto')
        schema = schema.append({ node_parent: sharedSch.id, node_order: sharedSch.id, node_type: sharedSch.id, ipobj_g: sharedSch.id, ipobj: sharedSch.id });
      else if (req.url==='/ipobj/group/delfrom')
        schema = schema.append({ node_parent: sharedSch.id, ipobjg: sharedSch.id, ipobj: sharedSch.id });
    } else return reject(new Error('Request method not accepted'));


    try {
      await Joi.validate(req.body, schema, sharedSch.joiValidationOptions);
      resolve();
    } catch(error) { return reject(error) } 
  });
};