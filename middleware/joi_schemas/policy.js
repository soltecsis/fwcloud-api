var schema = {};
module.exports = schema;

schema.validate = req => {
  return new Promise(async (resolve, reject) => {
    const item2 = req.url.split('/')[2];
    if (item2==='rule' || item2==='compile' || item2==='install' || item2==='ipobj' || item2==='interface' 
      || item2==='group' || item2==='openvpn' || item2==='prefix' || item2==='positions')
    try {
      const item1 = req.url.split('/')[1];
      return resolve (await require('./'+item1+'/'+item2).validate(req));
    } catch(error) { return reject(error) }
  
    return reject(new Error('Request method not accepted'));
  });
};
