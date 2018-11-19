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

openvpnModel.dumpCfg = (req,cfg,scope) => {
	return new Promise((resolve, reject) => {
    var fs = require('fs');
    var path = config.get('pki').data_dir + '/' + req.body.fwcloud + '/' + req.crt.ca + '/openvpn';

    if (!fs.existsSync(path))
      fs.mkdirSync(path);
    path += "/" + req.crt.cn;
    var stream = fs.createWriteStream(path);
  
    req.dbCon.query('select * from openvpn_opt where cfg='+cfg+' and scope='+scope+' order by openvpn_opt.order asc', (error, result) => {
      if (error) return reject(error);
      resolve();
    });
  });
};

//Export the object
module.exports = openvpnModel;