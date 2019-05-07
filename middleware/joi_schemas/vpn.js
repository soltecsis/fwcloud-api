var schema = {};
module.exports = schema;
const fwcError = require('../../utils/error_table');

schema.validate = req => {
  return new Promise(async (resolve, reject) => {
    const item = req.url.split('/');
    if (item[2]==='openvpn' || item[2]==='pki')
    try {
      return resolve (await require(`./${item[1]}/${item[2]}`).validate(req));
    } catch(error) { return reject(error) }
  
    return reject(fwcError.BAD_API_CALL);
  });
};
