var schema = {};
module.exports = schema;

const Joi = require('joi');
const sharedSch = require('./shared');
const fwcError = require('../../utils/error_table');
 
schema.validate = req => {
  return new Promise(async (resolve, reject) => {
    const item2 = req.url.split('/')[2];
    if (item2==='folder' || item2==='repair' || item2==='prefix')
    try {
      const item1 = req.url.split('/')[1];
      return resolve (await require('./'+item1+'/'+item2).validate(req));
    } catch(error) { return reject(error) }
  
    var schema = Joi.object().keys({ fwcloud: sharedSch.id });
    
    if (req.method==='PUT') {
      if (req.url==='/tree/objects/get' || req.url==='/tree/services/get')
        schema = schema.append({ objStandard: sharedSch._0_1, objCloud: sharedSch._0_1 });
      else if (req.url==='/tree/node/get')
        schema = schema.append({ node_type: sharedSch.name, id_obj: sharedSch.id.allow(null) });
    } else if (req.method==='POST') {

    } else return reject(fwcError.BAD_API_CALL);

    try {
      await Joi.validate(req.body, schema, sharedSch.joiValidationOptions);
      resolve();
    } catch(error) { return reject(error) } 
  });
};
