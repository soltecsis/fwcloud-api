var schema = {};
module.exports = schema;

const Joi = require('joi');
const sharedSch = require('./shared');
 
schema.validate = req => {
  return new Promise(async (resolve, reject) => {
    var schema = Joi.object().keys({ fwcloud: sharedSch.id });
    
    if (req.method==='POST' || (req.method==='PUT' && req.url==='/interface')) {
      schema = Joi.object().keys({ 
        firewall: sharedSch.id,
        host: sharedSch.id.allow(null),
        name: sharedSch.name,
        labelName: sharedSch.name.optional(),
        type: sharedSch.interface_type,
        interface_type: sharedSch.interface_type,
        comment: sharedSch.comment.optional(),
        mac: sharedSch.mac_addr.optional(),
      });
      if (req.method==='POST') schema = schema.append({ node_parent: sharedSch.id, node_order: sharedSch.id, node_type: sharedSch.id });
    } 
    else if (req.method==='PUT') {
      if (req.url==='/interface/fw/all/get' || req.url==='/interface/fw/full/get')
        schema = schema.append({ idfirewall: sharedSch.id });
      else if (req.url==='/interface/fw/get')
        schema = schema.append({ idfirewall: sharedSch.id, id: sharedSch.id });
      else if (req.url==='/interface/host/all/get')
        schema = schema.append({ idhost: sharedSch.id });
      else if (req.url==='/interface/host/get')
        schema = schema.append({ idhost: sharedSch.id, id: sharedSch.id });
      else if (req.url==='/interface/fw/del')
        schema = schema.append({ idfirewall: sharedSch.id, id: sharedSch.id, type: sharedSch.interface_type });
      else if (req.url==='/interface/host/del')
        schema = schema.append({ idhost: sharedSch.id, id: sharedSch.id, type: sharedSch.interface_type });
      else if (req.url==='/interface/where' || req.url==='/interface/where/rules')
        schema = schema.append({ id: sharedSch.id, type: sharedSch.interface_type });
      else if (req.url==='/interface/restricted')
        schema = schema.append({ id: sharedSch.id, idhost: sharedSch.id,optional() });
    } else return reject(new Error('Request method not accepted'));

    try {
      await Joi.validate(req.body, schema, sharedSch.joiValidationOptions);
      resolve();
    } catch(error) { return reject(error) } 
  });
};
