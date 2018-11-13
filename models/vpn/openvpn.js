//create object
var openvpnModel = {};

var config = require('../../config/config');

// Insert new OpenVPN configuration register in the database.
openvpnModel.addCfg = req => {
	return new Promise((resolve, reject) => {
    const cfg = {
      firewall: req.body.firewall,
      crt: req.body.crt
    }
    req.dbCon.query('insert into openvpn_cfg SET ?', cfg, (error, result) => {
      if (error) return reject(error);
      resolve(result.insertId);
    });
  });
};

openvpnModel.addCfgOpt = (req, opt) => {
	return new Promise((resolve, reject) => {
    req.dbCon.query('insert into openvpn_opt SET ?', opt, (error, result) => {
      if (error) return reject(error);
      resolve();
    });
  });
};

//Export the object
module.exports = openvpnModel;