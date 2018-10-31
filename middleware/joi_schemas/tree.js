var schema = {};
module.exports = schema;

const Joi = require('joi');
const sharedSch = require('./shared');
 
schema.validate = req => {
  return new Promise(async (resolve, reject) => {
    const item2 = req.url.split('/')[2];
    if (item2==='folder' || item2==='repair')
    try {
      const item1 = req.url.split('/')[1];
      resolve (await require('./'+item1+'/'+item2).validate(req));
    } catch(error) { return reject(error) }
  
    var schema = Joi.object().keys({ fwcloud: sharedSch.id });
    
    if (req.method==='PUT') {
      if (req.url==='/tree/objects/get' || req.url==='/tree/services/get')
        schema = schema.append({ objStandard: sharedSch._0_1, objCloud: sharedSch._0_1 });
      else if (req.url==='/tree/objects/node/get' || req.url==='/tree/services/node/get')
        schema = schema.append({ id: sharedSch.id, objStandard: sharedSch._0_1, objCloud: sharedSch._0_1 });
      else if (req.url==='/tree/get')
        schema = schema.append({ id: sharedSch.id });
    } else if (req.method==='POST') {

    } else return reject(new Error('Request method not accepted'));

    try {
      await Joi.validate(req.body, schema, sharedSch.joiValidationOptions);
      resolve();
    } catch(error) { return reject(error) } 
  });
};
