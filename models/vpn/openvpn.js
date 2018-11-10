//create object
var openvpnModel = {};

var config = require('../../config/config');

// Insert new CA in the database.
openvpnModel.createNewConfig = req => {
	return new Promise((resolve, reject) => {
    const ca = {
      fwcloud: req.body.fwcloud,
      cn: req.body.cn,
      days: req.body.days
    }
    req.dbCon.query('insert into ca SET ?', ca, (error, result) => {
      if (error) return reject(error);
      resolve(result.insertId);
    });
  });
};


//Export the object
module.exports = openvpnModel;