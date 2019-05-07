var schema = {};
module.exports = schema;
const fwcError = require('../../../utils/error_table');

schema.validate = req => {
  return new Promise(async (resolve, reject) => {
    const item = req.url.split('/');
    if (item[3]==='ca' || item[3]==='crt' || item[3]==='prefix')
    try {
      return resolve (await require(`./${item[2]}/${item[3]}`).validate(req));
    } catch(error) { return reject(error) }
  
    return reject(fwcError.BAD_API_CALL);
  });
};
