var schema = {};
module.exports = schema;

const Joi = require('joi');
const sharedSch = require('./shared');
 
schema.validate = req => {
  return new Promise(async (resolve, reject) => {
    var schema = {};
    
    if (req.method==='POST' || (req.method==='PUT' && req.url==='/cluster')) {
      const schemaItem = Joi.object().keys({ 
        cluster: sharedSch.id,
        name: sharedSchema.name,
        comment: sharedSch.comment.optional(),
        fwcloud: sharedSch.id,
        install_user: sharedSch.linux_user.optional(),
        install_pass: sharedSch.linux_pass.optional(),
        save_user_pass: sharedSch._0_1,
        install_interface: sharedSch.id.optional(),
        install_ipobj: sharedSch.id.optional(),
        fwmaster: sharedSch._0_1,
        install_port: Joi.number().port().optional(),
        options: Joi.number().port()
      });

      const schemaClusterData = Joi.object().keys({ 
        name: sharedSchema.name,
        comment: sharedSch.comment.optional(),
        fwnodes: Joi.array().items(schemaItem)
      });

      if (req.method==='PUT') schema = schemaItem.append({ id: sharedSch.id });
      
      schema = Joi.object().keys({ fwcloud: sharedSch.id, clusterData: schemaClusterData });
    } 
    else if (req.method==='PUT') {
      schema = Joi.object().keys({ fwcloud: sharedSch.id });

      if (req.url==='/cluster/get' || req.url==='/cluster/del' || req.url==='/cluster/clone' 
          || req.url==='/cluster/clustertofw')
        schema = schema.append({ id: sharedSch.id });
      else if (req.url==='/cluster/fwtocluster')
        schema = schema.append({ idfirewall: sharedSch.id });
    } else return reject(new Error('Request method not accepted'));

    try {
      await Joi.validate(req.body, schema, sharedSch.joiValidationOptions);
      resolve();
    } catch(error) { return reject(error) } 
  });
};
