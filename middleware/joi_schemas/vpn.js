var schema = {};
module.exports = schema;

const Joi = require('joi');
const sharedSch = require('./shared');
 
schema.validate = req => {
  return new Promise(async (resolve, reject) => {
    const item2 = req.url.split('/')[2];
    if (item2==='cert' || item2==='openvpn')
    try {
      const item1 = req.url.split('/')[1];
      return resolve (await require('./'+item1+'/'+item2).validate(req));
    } catch(error) { return reject(error) }
  
    return reject(new Error('Request method not accepted'));
  });
};
