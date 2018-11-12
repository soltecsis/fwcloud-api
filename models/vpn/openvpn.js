//create object
var openvpnModel = {};

var config = require('../../config/config');

// Insert new CA in the database.
openvpnModel.createNewConfig = req => {
	return new Promise((resolve, reject) => {
    const cfg = {
      firrewall: req.body.firewall,
      crt: req.body.crt
    }
    req.dbCon.query('insert into openvpn_cfg SET ?', cfg, (error, result) => {
      if (error) return reject(error);
      resolve(result.insertId);
    });
  });
};

//Export the object
module.exports = openvpnModel;