var schema = {};
module.exports = schema;

const Joi = require('joi');
const sharedSch = require('./shared');
 
schema.validate = req => {
  return new Promise(async (resolve, reject) => {
    var schema = {};
    
    if (req.method==='POST' || (req.method==='PUT' && req.url==='/cluster')) {
      const schemaItem = Joi.object().keys({ 
        name: sharedSch.name,
        comment: sharedSch.comment,
        install_user: sharedSch.linux_user.allow(null).allow('').optional(),
        install_pass: sharedSch.linux_pass.allow(null).allow('').optional(),
        save_user_pass: sharedSch._0_1,
        install_interface: sharedSch.id.allow(null).optional(),
        install_ipobj: sharedSch.id.allow(null).optional(),
        fwmaster: sharedSch._0_1,
        install_port: Joi.number().port(),
      });

      const schemaClusterData = Joi.object().keys({ 
        name: sharedSch.name,
        comment: sharedSch.comment,
        options: sharedSch.u16bits,
        fwnodes: Joi.array().items(schemaItem)
      });

      if (req.method==='PUT') schemaItem = schemaItem.append({ id: sharedSch.id, cluster: sharedSch.id });
      else if (req.method==='POST') schemaClusterData = schemaClusterData.append({ node_id: sharedSch.id });
      
      schema = Joi.object().keys({ fwcloud: sharedSch.id, clusterData: schemaClusterData });
    } 
    else if (req.method==='PUT') {
      schema = Joi.object().keys({ fwcloud: sharedSch.id });

      if (req.url==='/cluster/get' || req.url==='/cluster/del' || req.url==='/cluster/clustertofw')
          schema = schema.append({ cluster: sharedSch.id });
      else if (req.url==='/cluster/clone')
        schema = schema.append({ cluster: sharedSch.id, node_id: sharedSch.id });
      else if (req.url==='/cluster/fwtocluster')
        schema = schema.append({ firewall: sharedSch.id });
    } else return reject(new Error('Request method not accepted'));

    try {
      await Joi.validate(req.body, schema, sharedSch.joiValidationOptions);
      resolve();
    } catch(error) { return reject(error) } 
  });
};
