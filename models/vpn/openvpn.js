//create object
var openvpnModel = {};

const config = require('../../config/config');
const ipobjModel = require('../ipobj/ipobj');
const readline = require('readline');
const fwcTreemodel = require('../../models/tree/tree');
const sshTools = require('../../utils/ssh');
const streamModel = require('../../models/stream/stream');
const firewallModel = require('../../models/firewall/firewall');
const fs = require('fs');
const ip = require('ip');


// Insert new OpenVPN configuration register in the database.
openvpnModel.addCfg = req => {
	return new Promise((resolve, reject) => {
    const cfg = {
      openvpn: req.body.openvpn,
      firewall: req.body.firewall,
      crt: req.body.crt,
      comment: req.body.comment
    }
    req.dbCon.query('insert into openvpn SET ?', cfg, (error, result) => {
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

openvpnModel.delCfgOptAll = req => {
	return new Promise((resolve, reject) => {
    let sql = 'delete from openvpn_opt where openvpn='+req.body.openvpn;
    req.dbCon.query(sql, (error, result) => {
      if (error) return reject(error);
      resolve();
    });
  });
};

openvpnModel.delCfg = (dbCon,fwcloud,openvpn) => {
	return new Promise((resolve, reject) => {
    // Get all the ipobj referenced by this OpenVPN configuration.
    let sql = 'select OBJ.id,OBJ.type from openvpn_opt OPT'+
    ' inner join ipobj OBJ on OBJ.id=OPT.ipobj'+
    ' where OPT.openvpn='+openvpn;
    dbCon.query(sql, (error, ipobj_list) => {
      if (error) return reject(error);

      sql = 'delete from openvpn_opt where openvpn='+openvpn;
      dbCon.query(sql, (error, result) => {
        if (error) return reject(error);

        sql = 'delete from openvpn where id='+openvpn;
        dbCon.query(sql, async (error, result) => {
          if (error) return reject(error);

          // Remove all the ipobj referenced by this OpenVPN configuration.
          // In the restrictions check we have already checked that it is possible to remove them.
          try {
            for (let ipobj of ipobj_list) {
              await ipobjModel.deleteIpobj(dbCon,fwcloud,ipobj.id);
              await fwcTreemodel.deleteObjFromTree(fwcloud,ipobj.id,ipobj.type);
            }
          } catch(error) { return reject(error) }
    
          resolve();
        });
      });
    });
  });
};

openvpnModel.delCfgAll = (dbCon,fwcloud,firewall) => {
	return new Promise((resolve, reject) => {
    // Remove all the ipobj referenced by this OpenVPN configuration.
    // In the restrictions check we have already checked that it is possible to remove them.
    let sql = 'select id from openvpn where firewall='+firewall;
    dbCon.query(sql, async (error, result) => {
      if (error) return reject(error);

      try {
        for (let openvpn of result) {
          await openvpnModel.delCfg(dbCon,fwcloud,openvpn.id);
        }
      } catch(error) { return reject(error) }
      
      resolve();
    });
  });
};

openvpnModel.getCfgId = req => {
	return new Promise((resolve, reject) => {
    let sql = 'select id from openvpn where firewall='+req.body.firewall+' and crt='+req.body.crt;
    req.dbCon.query(sql, (error, result) => {
      if (error) return reject(error);
      resolve(result[0].id);
    });
  });
};

openvpnModel.getCfg = req => {
	return new Promise((resolve, reject) => {
    let sql = 'select * from openvpn where id='+req.body.openvpn;
    req.dbCon.query(sql, (error, result) => {
      if (error) return reject(error);

      let data = result[0];
      sql = 'select * from openvpn_opt where openvpn='+req.body.openvpn;
      req.dbCon.query(sql, (error, result) => {
        if (error) return reject(error);

        data.options = result;
        resolve(data);
      });
    });
  });
};

// Get certificate data form file.
openvpnModel.getCRTData = file => {
	return new Promise((resolve, reject) => {
    var data = '';
    var onData = 0;
    var rs = fs.createReadStream(file);

    rs.on('error',error => reject(error));

    const rl = readline.createInterface({
      input: rs,
      crlfDelay: Infinity
    });

    rl.on('line', line => {
      if (onData)
        data += line+'\n';
      else if(line.indexOf('-----BEGIN ') === 0) {
        data += line+'\n';
        onData = 1;
      }
    });

    rl.on('close', () => { resolve(data) } );
  });
};

openvpnModel.dumpCfg = req => {
	return new Promise((resolve, reject) => {
    // First obtain the CN of the certificate.
    let sql = 'select CRT.cn,CRT.ca from crt CRT' +
      ' INNER JOIN openvpn VPN ON CRT.id=VPN.crt' +
			' WHERE VPN.id=' + req.body.openvpn;

    req.dbCon.query(sql, (error, result) => {
      if (error) return reject(error);

      const ca_dir = config.get('pki').data_dir + '/' + req.body.fwcloud + '/' + result[0].ca + '/';
      const ca_crt_path = ca_dir + 'ca.crt';
      const crt_path = ca_dir + 'issued/' + result[0].cn + '.crt';
      const key_path = ca_dir + 'private/' + result[0].cn + '.key';
  
      // Get all the configuration options.
      sql = 'select name,ipobj,arg,scope,comment from openvpn_opt where openvpn='+req.body.openvpn+' order by openvpn_opt.order';
      req.dbCon.query(sql, async (error, result) => {
        if (error) return reject(error);

        // Generate the OpenVPN config file.
        var ovpn_cfg = '';
        var ovpn_ccd = '';

        // First add all the configuration options.
        for (let opt of result) {
          let cfg_line = ((opt.comment) ? '# '+opt.comment.replace('\n','\n# ')+'\n' : '') + opt.name;
          if (opt.ipobj) {
            // Get the ipobj data.
            const ipobj = await ipobjModel.getIpobjInfo(req.dbCon,req.body.fwcloud,opt.ipobj);
            if (ipobj.type===7) // Network
              cfg_line += ' '+ipobj.address+' '+ipobj.netmask;
            else if (ipobj.type===5) // Address
              cfg_line += ' '+ipobj.address;
          }
          else if (opt.arg)
            cfg_line += ' '+opt.arg;

          if (opt.scope===0) // CCD file
            ovpn_ccd += cfg_line+'\n';
          else // Config file
            ovpn_cfg += cfg_line+'\n';
        }

        // Now read the files data and put it into de config files.
        ovpn_cfg += '\n<ca>\n' + (await openvpnModel.getCRTData(ca_crt_path)) + "</ca>\n";
        ovpn_cfg += '\n<crt>\n' + (await openvpnModel.getCRTData(crt_path)) + "</crt>\n";
        ovpn_cfg += '\n<key>\n' + (await openvpnModel.getCRTData(key_path)) + "</key>\n";
        
        resolve({cfg: ovpn_cfg, ccd: ovpn_ccd});
      });
    });
  });
};


openvpnModel.installCfg = (req,cfg,dir,name) => {
	return new Promise(async (resolve, reject) => {
    const accessData = {sessionID: req.sessionID, iduser: req.session.user_id};

    try {
      const fwData = await firewallModel.getFirewallSSH(req);

			streamModel.pushMessageCompile(accessData, "Uploading OpenVPN configuration ("+fwData.SSHconn.host+")\n");
      await sshTools.uploadStringToFile(fwData.SSHconn,cfg,name);

      streamModel.pushMessageCompile(accessData, "Installing OpenVPN configuration.\n");
			await sshTools.runCommand(fwData.SSHconn,"sudo chown root:root "+name);
			await sshTools.runCommand(fwData.SSHconn,"sudo chmod 600 "+name);
			await sshTools.runCommand(fwData.SSHconn,"sudo mv "+name+" "+dir);

      resolve();
    } catch(error) { 
      streamModel.pushMessageCompile(accessData, "ERROR: "+error+"\n");
      reject(error); 
    }
  });
};


openvpnModel.freeVpnIP = req => {
	return new Promise((resolve, reject) => {
    // Search for the VPN LAN and mask.
    let sql = 'select OBJ.address,OBJ.netmask from openvpn_opt OPT'+
      ' inner join ipobj OBJ on OBJ.id=OPT.ipobj'+
      ' where OPT.openvpn='+req.body.openvpn+' and OPT.ipobj is not null';
    req.dbCon.query(sql, (error, result) => {
      if (error) return reject(error);

      // If we have no VPN LAN we can not give any free IP.
      if (result.length===0) return reject(new Error('OpenVPN LAN not found'));

      // net will contain information about the VPN network.
      const net = ip.subnet(result[0].address, result[0].netmask);
      net.firstLong = ip.toLong(net.firstAddress) + 1; // The first usable IP is for the OpenVPN server.
      net.lastLong = ip.toLong(net.lastAddress);
      
      // Obtain the VPN LAN used IPs.
      sql = 'select OBJ.address from openvpn VPN'+
        ' inner join openvpn_opt OPT on OPT.openvpn=VPN.id'+
        ' inner join ipobj OBJ on OBJ.id=OPT.ipobj'+
        ' where VPN.openvpn='+req.body.openvpn+' and OPT.ipobj is not null and OBJ.type=5'; // 5=ADDRESS
      req.dbCon.query(sql, (error, result) => {
        if (error) return reject(error);
      
        let freeIPLong;
        let found;
        for(freeIPLong=net.firstLong; freeIPLong<=net.lastLong; freeIPLong++) {
          found = 0;
          for (let ipCli of result) {
            if (freeIPLong != ip.toLong(ipCli)) {
              found=1;
              break;
            }
          }
          if (!found) 
            return resolve(ip.fromLong(freeIPLong));
        }
        reject(new Error('There are no free VPN IPs'));
      });
    });
  });
};

openvpnModel.searchOpenvpnInRules = (dbCon,fwcloud,openvpn) => {
	return new Promise((resolve, reject) => {
    // For each ipobj referenced by the OpenVPN configuration options, verify that it is not being used in any firewall rule.
    let sql = 'select OBJ.id,OBJ.type from openvpn_opt OPT'+
      ' inner join ipobj OBJ on OBJ.id=OPT.ipobj'+
      ' where OPT.openvpn='+openvpn;
    dbCon.query(sql, async (error, result) => {
      if (error) return reject(error);

      try {
        for (let ipobj of result) {
          const data = await ipobjModel.searchIpobjUsage(fwcloud, ipobj.id, ipobj.type, 1); // 1 = Search only in rules.
          if (data.result) return resolve(data);
        }         
      } catch(error) { reject(error) }

      resolve({result: false});
    });
  });
};

openvpnModel.searchOpenvpnInrulesOtherFirewall = req => {
	return new Promise((resolve, reject) => {
    // First get all firewalls OpenVPN configurations.
    let sql = 'select id from openvpn where firewall='+req.body.firewall;

    req.dbCon.query(sql, async (error, result) => {
      if (error) return reject(error);

      try {
        for (let openvpn of result) {
          const data = await openvpnModel.searchOpenvpnInRules(req.dbCon,req.body.fwcloud,openvpn.id);
          if (data.result) {
            // OpenVPN config IP object found in rules of other firewall.
            if (data.restrictions.IpobjInRules.length > 0) {
              for (let rule of data.restrictions.IpobjInRules) {
                if (rule.firewall_id != req.body.firewall)
                  return resolve(data);
              }
            }
            // OpenVPN config IP object found in a group.
            else if (data.restrictions.IpobjInGroup.length>0)
              return resolve(data);
          }
        }
      } catch(error) { reject(error) }

      resolve({result: false});
    });
  });
};

//Export the object
module.exports = openvpnModel;