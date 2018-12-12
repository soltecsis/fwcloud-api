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
    let sql = 'delete from openvpn_opt where cfg=' + req.body.openvpn;
    req.dbCon.query(sql, (error, result) => {
      if (error) return reject(error);

      sql = 'delete from openvpn_cfg where id=' + req.body.openvpn;
      req.dbCon.query(sql, (error, result) => {
        if (error) return reject(error);

        resolve();
      });
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

openvpnModel.dumpCfg = req => {
	return new Promise((resolve, reject) => {
    // First obtain the CN of the certificate.
    let sql = 'select CRT.cn,CRT.ca from crt CRT' +
      ' INNER JOIN openvpn_cfg CFG ON CRT.id=CFG.crt' +
			' WHERE CFG.id=' + req.body.openvpn;

    req.dbCon.query(sql, (error, result) => {
      if (error) return reject(error);

      const ca_dir = config.get('pki').data_dir + '/' + req.body.fwcloud + '/' + result[0].ca + '/';
      const ca_crt_path = ca_dir + 'ca.crt';
      const crt_path = ca_dir + 'issued/' + result[0].cn + '.crt';
      const key_path = ca_dir + 'private/' + result[0].cn + '.key';
  
      // Get all the configuration options.
      sql = 'select name,ipobj,arg,scope,comment from openvpn_opt where cfg='+req.body.openvpn+' order by openvpn_opt.order';
      req.dbCon.query(sql, (error, result) => {
        if (error) return reject(error);

        // Generate the OpenVPN config file.
        var ovpn_cfg = '';
        var ovpn_ccd = '';

        // First add all the configuration options.
        for (let opt of result) {
          let cfg_line = ((opt.comment) ? '# '+opt.comment.replace('\n','\n# ')+'\n' : '') + opt.name;
          if (opt.ipobj) {
            // Get the ipobj data.
          }
          else if (opt.arg)
            cfg_line += ' '+opt.arg;

          if (opt.scope===0) // CCD file
            ovpn_ccd += cfg_line+'\n';
          else // Config file
            ovpn_cfg += cfg_line+'\n';
        }

        // Now read the files data and put it into de config files.

        
        resolve({cfg: ovpn_cfg, ccd: ovpn_ccd});
      });
    });
  });
};

openvpnModel.installCfg = (req,cfg) => {
	return new Promise((resolve, reject) => {
    resolve();
  });
};

//Export the object
module.exports = openvpnModel;