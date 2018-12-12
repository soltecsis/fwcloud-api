//create object
var openvpnModel = {};

var config = require('../../config/config');

// Insert new OpenVPN configuration register in the database.
openvpnModel.addCfg = req => {
	return new Promise((resolve, reject) => {
    const cfg = {
      firewall: req.body.firewall,
      crt: req.body.crt,
      comment: req.body.comment
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

openvpnModel.removeCfgOptAll = req => {
	return new Promise((resolve, reject) => {
    let sql = 'delete OPT.* from openvpn_opt OPT' +
      ' INNER JOIN openvpn_cfg CFG ON OPT.cfg=CFG.id' +
			' WHERE CFG.firewall=' + req.body.firewall + ' AND CFG.crt=' + req.body.crt;
    req.dbCon.query(sql, (error, result) => {
      if (error) return reject(error);
      resolve();
    });
  });
};

openvpnModel.removeCfg = req => {
	return new Promise((resolve, reject) => {
    let sql = 'delete from openvpn_cfg where id=' + req.body.openvpn;
    req.dbCon.query(sql, (error, result) => {
      if (error) return reject(error);
      resolve();
    });
  });
};

openvpnModel.getCfgId = req => {
	return new Promise((resolve, reject) => {
    let sql = 'select id from openvpn_cfg where firewall='+req.body.firewall+' and crt='+req.body.crt;
    req.dbCon.query(sql, (error, result) => {
      if (error) return reject(error);
      resolve(result[0].id);
    });
  });
};

openvpnModel.getCfg = req => {
	return new Promise((resolve, reject) => {
    let sql = 'select * from openvpn_cfg where id='+req.body.openvpn;
    req.dbCon.query(sql, (error, result) => {
      if (error) return reject(error);

      let data = result[0];
      sql = 'select * from openvpn_opt where cfg='+req.body.openvpn;
      req.dbCon.query(sql, (error, result) => {
        if (error) return reject(error);

        data.options = result;
        resolve(data);
      });
    });
  });
};

openvpnModel.installCfg = (req,cfg,scope) => {
	return new Promise((resolve, reject) => {
    const ca_dir = config.get('pki').data_dir + '/' + req.body.fwcloud + '/' + req.crt.ca + '/';
    const ca_crt_path = ca_dir + '/ca.crt';
    const crt_path = ca_dir + '/ca.crt';
    const key_path = ca_dir + '/ca.crt';

    //let sql = 'select * from openvpn_opt where cfg='+cfg+' and scope='+scope+' order by openvpn_opt.order asc

    req.dbCon.query('select * from openvpn_opt where cfg='+cfg+' and scope='+scope+' order by openvpn_opt.order asc', (error, result) => {
      if (error) return reject(error);
      resolve();
    });
  });
};

//Export the object
module.exports = openvpnModel;