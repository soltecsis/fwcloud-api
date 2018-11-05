var schema = {};
module.exports = schema;

const Joi = require('joi');
const sharedSch = require('./shared');
 
schema.validate = req => {
  return new Promise(async (resolve, reject) => {
    var schema = {};
    
    if (req.method==='POST' || (req.method==='PUT' && req.url==='/firewall')) {
      schema = Joi.object().keys({ 
        cluster: sharedSch.id.optional(),
        name: sharedSch.name,
        comment: sharedSch.comment.optional(),
        fwcloud: sharedSch.id,
        install_user: sharedSch.linux_user.optional(),
        install_pass: sharedSch.linux_pass.optional(),
        save_user_pass: sharedSch._0_1,
        install_interface: sharedSch.id.optional(),
        install_ipobj: sharedSch.id.optional(),
        fwmaster: sharedSch._0_1,
        install_port: Joi.number().port().optional(),
        options: Joi.number().port(),
        node_id: sharedSch.id
      });
      if (req.method==='PUT') schema = schema.append({ id: sharedSch.id });
    } 
    else if (req.method==='PUT') {
      schema = Joi.object().keys({ fwcloud: sharedSch.id });

      if (req.url==='/firewall/get' || req.url==='/firewall/del')
        schema = schema.append({ id: sharedSch.id });
      else if (req.url==='/firewall/cluster/get')
        schema = schema.append({ idcluster: sharedSch.id });
      else if (req.url==='/firewall/clone')
        schema = schema.append({ id: sharedSch.id, name: sharedSchema.name, comment: sharedSch.comment.optional() });
      else if (req.url==='/firewall/delfromcluster')
        schema = schema.append({ id: sharedSch.id, idcluster: sharedSch.id });
    } else return reject(new Error('Request method not accepted'));

    try {
      await Joi.validate(req.body, schema, sharedSch.joiValidationOptions);
      resolve();
    } catch(error) { return reject(error) } 
  });
};
