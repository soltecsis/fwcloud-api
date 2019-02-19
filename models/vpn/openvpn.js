//create object
var openvpnModel = {};

const config = require('../../config/config');
const ipobjModel = require('../ipobj/ipobj');
const readline = require('readline');
const fwcTreemodel = require('../../models/tree/tree');
const sshTools = require('../../utils/ssh');
const socketTools = require('../../utils/socket');
const firewallModel = require('../../models/firewall/firewall');
const policyOpenvpnModel = require('../../models/policy/openvpn');
const fs = require('fs');
const ip = require('ip');


// Insert new OpenVPN configuration register in the database.
openvpnModel.addCfg = req => {
	return new Promise((resolve, reject) => {
    const cfg = {
      openvpn: req.body.openvpn,
      firewall: req.body.firewall,
      crt: req.body.crt,
      install_dir: req.body.install_dir,
      install_name: req.body.install_name,
      comment: req.body.comment,
      status: 1
    }
    req.dbCon.query('insert into openvpn SET ?', cfg, (error, result) => {
      if (error) return reject(error);
      resolve(result.insertId);
    });
  });
};

openvpnModel.updateCfg = req => {
	return new Promise((resolve, reject) => {
    let sql =`UPDATE openvpn SET install_dir=${req.dbCon.escape(req.body.install_dir)},
      install_name=${req.dbCon.escape(req.body.install_name)},
      comment=${req.dbCon.escape(req.body.comment)}
      WHERE id=${req.body.openvpn}`
    req.dbCon.query(sql, (error, result) => {
      if (error) return reject(error);
      resolve();
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
    let sql = `select OBJ.id,OBJ.type from openvpn_opt OPT
      inner join ipobj OBJ on OBJ.id=OPT.ipobj
      where OPT.openvpn=${openvpn} and OPT.name!='remote'`;
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

openvpnModel.getOptData = (dbCon,openvpn,name) => {
	return new Promise((resolve, reject) => {
    let sql = 'select * from openvpn_opt where openvpn='+openvpn+' and name='+dbCon.escape(name);
    dbCon.query(sql, (error, result) => {
      if (error) return reject(error);
      if (result.length<1) return reject(new Error('OpenVPN option not found'))

      resolve(result[0]);
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

// Get data of an OpenVPN server clients.
openvpnModel.getOpenvpnClients = (dbCon, openvpn) => {
	return new Promise((resolve, reject) => {
    let sql = `select VPN.id,CRT.cn from openvpn VPN 
      inner join crt CRT on CRT.id=VPN.crt
      where openvpn=${openvpn}`;
    dbCon.query(sql, (error, result) => {
      if (error) return reject(error);
      resolve(result);
    });
  });
};

// Get OpenVPN client configuration data.
openvpnModel.getOpenvpnInfo = (dbCon, fwcloud, openvpn, type) => {
	return new Promise((resolve, reject) => {
    let sql = `select F.fwcloud,VPN.*,CRT.cn,CA.cn as CA_cn,O.address ${(type===2)?`,O.netmask`:``}, ${(type===1)?`311`:`312`} as type
      from openvpn VPN 
      inner join crt CRT on CRT.id=VPN.crt
      inner join ca CA on CA.id=CRT.ca
      inner join firewall F on F.id=VPN.firewall
      inner join openvpn_opt OPT on OPT.openvpn=${openvpn}
      inner join ipobj O on O.id=OPT.ipobj
      where F.fwcloud=${fwcloud} and VPN.id=${openvpn} ${(type===1)?`and OPT.name='ifconfig-push'`:``}`;
    dbCon.query(sql, (error, result) => {
      if (error) return reject(error);
      resolve(result);
    });
  });
};

openvpnModel.getOpenvpnServersByCA = (dbCon,ca) => {
	return new Promise((resolve, reject) => {
    let sql = `select VPN.id,CRT.cn from openvpn VPN 
      inner join crt CRT on CRT.id=VPN.crt
      inner join ca CA on CA.id=CRT.ca
      where CA.id=${ca} and CRT.type=2`; // 2 = Server certificate.
    dbCon.query(sql, (error, result) => {
      if (error) return reject(error);
      resolve(result);
    });
  });
};

openvpnModel.dumpCfg = (dbCon,fwcloud,openvpn) => {
	return new Promise((resolve, reject) => {
    // First obtain the CN of the certificate.
    let sql = `select CRT.cn,CRT.ca,CRT.type from crt CRT
      INNER JOIN openvpn VPN ON CRT.id=VPN.crt
			WHERE VPN.id=${openvpn}`;

    dbCon.query(sql, (error, result) => {
      if (error) return reject(error);

      const ca_dir = config.get('pki').data_dir + '/' + fwcloud + '/' + result[0].ca + '/';
      const ca_crt_path = ca_dir + 'ca.crt';
      const crt_path = ca_dir + 'issued/' + result[0].cn + '.crt';
      const key_path = ca_dir + 'private/' + result[0].cn + '.key';
      let dh_path = (result[0].type === 2) ? ca_dir+'dh.pem' : '';
  
      // Get all the configuration options.
      sql = `select name,ipobj,arg,scope,comment from openvpn_opt where openvpn=${openvpn} order by openvpn_opt.order`;
      dbCon.query(sql, async (error, result) => {
        if (error) return reject(error);

        try {
          // Generate the OpenVPN config file.
          var ovpn_cfg = '';
          var ovpn_ccd = '';

          // First add all the configuration options.
          for (let opt of result) {
            let cfg_line = ((opt.comment) ? '# '+opt.comment.replace('\n','\n# ')+'\n' : '') + opt.name;
            if (opt.ipobj) {
              // Get the ipobj data.
              const ipobj = await ipobjModel.getIpobjInfo(dbCon,fwcloud,opt.ipobj);
              if (ipobj.type===7) // Network
                cfg_line += ' '+ipobj.address+' '+ipobj.netmask;
              else if (ipobj.type===5) { // Address
                cfg_line += ' '+ipobj.address;
                if (opt.name==='ifconfig-push')
                  cfg_line += ' '+ipobj.netmask;
                else if (opt.name==='remote')
                  cfg_line += ' '+opt.arg;
              }
              else if (ipobj.type===9) { // DNS Name
                cfg_line += ' '+ipobj.address;
                if (opt.name==='remote')
                  cfg_line += ' '+opt.arg;
              }
            }
            else if (opt.arg)
              cfg_line += ' '+opt.arg;

            if (opt.scope===0) // CCD file
              ovpn_ccd += cfg_line+'\n';
            else // Config file
              ovpn_cfg += cfg_line+'\n';
          }

          // Now read the files data and put it into de config files.
          if (dh_path) // Configuración OpenVPN de servidor.
            ovpn_cfg += '\n<dh>\n' + (await openvpnModel.getCRTData(dh_path)) + "</dh>\n";
          ovpn_cfg += '\n<ca>\n' + (await openvpnModel.getCRTData(ca_crt_path)) + "</ca>\n";
          ovpn_cfg += '\n<cert>\n' + (await openvpnModel.getCRTData(crt_path)) + "</cert>\n";
          ovpn_cfg += '\n<key>\n' + (await openvpnModel.getCRTData(key_path)) + "</key>\n";
          
          resolve({cfg: ovpn_cfg, ccd: ovpn_ccd});
        } catch(error) { reject(error) }
      });
    });
  });
};


openvpnModel.installCfg = (req,cfg,dir,name,type) => {
	return new Promise(async (resolve, reject) => {
    socketTools.init(req); // Init the socket used for message notification by the socketTools module.

    try {
      const fwData = await firewallModel.getFirewallSSH(req);

      if (type===1) // Client certificarte
        socketTools.msg(`Uploading CCD configuration file '${name}' to: (${fwData.SSHconn.host})\n`);
      else // Server certificate.
        socketTools.msg(`Uploading OpenVPN configuration file '${name}' to: (${fwData.SSHconn.host})\n`);
      await sshTools.uploadStringToFile(fwData.SSHconn,cfg,name);

      const existsDir = await sshTools.runCommand(fwData.SSHconn,`if [ -d "${dir}" ]; then echo -n 1; else echo -n 0; fi`);
      if (existsDir==="0") {
        socketTools.msg(`Creating install directory.\n`);
        await sshTools.runCommand(fwData.SSHconn,`sudo mkdir "${dir}"`);
        await sshTools.runCommand(fwData.SSHconn,`sudo chown root:root "${dir}"`);
        await sshTools.runCommand(fwData.SSHconn,`sudo chmod 755 "${dir}"`);
      }

      socketTools.msg(`Installing OpenVPN configuration file.\n`);
			await sshTools.runCommand(fwData.SSHconn,`sudo mv ${name} ${dir}/`);

      socketTools.msg(`Setting up file permissions.\n\n`);
      await sshTools.runCommand(fwData.SSHconn,`sudo chown root:root ${dir}/${name}`);
      if (type===1) // Client certificate.
        await sshTools.runCommand(fwData.SSHconn,`sudo chmod 644 ${dir}/${name}`);
      else // Server certificate.
			  await sshTools.runCommand(fwData.SSHconn,`sudo chmod 600 ${dir}/${name}`);

      socketTools.msgEnd();
      resolve();
    } catch(error) { 
      socketTools.msg(`ERROR: ${error}\n`);
      socketTools.msgEnd();
      reject(error); 
    }
  });
};

openvpnModel.uninstallCfg = (req,dir,name) => {
	return new Promise(async (resolve, reject) => {
    socketTools.init(req); // Init the socket used for message notification by the socketTools module.

    try {
      const fwData = await firewallModel.getFirewallSSH(req);

      socketTools.msg(`Removing OpenVPN configuration file '${name}' from: (${fwData.SSHconn.host})\n`);
      await sshTools.runCommand(fwData.SSHconn,`sudo rm -f "${dir}/${name}"`);

      socketTools.msgEnd();
      resolve();
    } catch(error) { 
      socketTools.msg(`ERROR: ${error}\n`);
      socketTools.msgEnd();
      reject(error); 
    }
  });
};

openvpnModel.ccdCompare = (req,dir,clients) => {
	return new Promise(async (resolve, reject) => {
    socketTools.init(req); // Init the socket used for message notification by the socketTools module.

    try {
      const fwData = await firewallModel.getFirewallSSH(req);

      socketTools.msg(`Comparing files with OpenVPN client configurations.\n`);
      const fileList = (await sshTools.runCommand(fwData.SSHconn,`cd ${dir}; ls -p | grep -v "/$"`)).trim().split('\r\n');
      let found;
      let notFoundList = "";
      for (let file of fileList) {
        found = 0;
        for (let client of clients) {
          if (client.cn === file) {
            found = 1;
            break;
          }
        }
        if (!found) notFoundList += `${file} `;
      }

      if (notFoundList) {
        socketTools.msg(`<strong><font color="orange">
            WARNING: Found files in the directory '${dir}' without OpenVPN config file:\n
            ${notFoundList}
          </font></strong>\n\n`);
      }
      else
        socketTools.msg(`Ok.\n\n`);

      socketTools.msgEnd();
      resolve(notFoundList);
    } catch(error) { 
      socketTools.msg(`ERROR: ${error}\n`);
      socketTools.msgEnd();
      reject(error); 
    }
  });
};


openvpnModel.updateOpenvpnStatus = (dbCon, openvpn, status_action) => {
	return new Promise((resolve, reject) => {
    dbCon.query(`UPDATE openvpn SET status=status${status_action} WHERE id=${openvpn}`, (error, result) => {
      if (error) return reject(error);
      resolve({"result": true});
    });
  });
};

openvpnModel.updateOpenvpnStatusIPOBJ = (req, ipobj, status_action) => {
	return new Promise((resolve, reject) => {
    var sql=`UPDATE openvpn VPN
      INNER JOIN openvpn_opt OPT ON OPT.openvpn=VPN.id
      INNER JOIN ipobj O ON O.id=OPT.ipobj
      SET VPN.status=VPN.status${status_action}
      WHERE O.fwcloud=${req.body.fwcloud} AND O.id=${ipobj}`;
    req.dbCon.query(sql, (error, result) => {
      if (error) return reject(error);
      resolve();
    });
  });
};

openvpnModel.freeVpnIP = req => {
	return new Promise((resolve, reject) => {
    // Search for the VPN LAN and mask.
    let sql = `select OBJ.address,OBJ.netmask from openvpn_opt OPT
      inner join ipobj OBJ on OBJ.id=OPT.ipobj
      where OPT.openvpn=${req.body.openvpn} and OPT.ipobj is not null`;
    req.dbCon.query(sql, (error, result) => {
      if (error) return reject(error);

      // If we have no VPN LAN we can not give any free IP.
      if (result.length===0) return reject(new Error('OpenVPN LAN not found'));

      // net will contain information about the VPN network.
      const netmask = result[0].netmask;
      const net = ip.subnet(result[0].address, netmask);
      net.firstLong = ip.toLong(net.firstAddress) + 1; // The first usable IP is for the OpenVPN server.
      net.lastLong = ip.toLong(net.lastAddress);
      
      // Obtain the VPN LAN used IPs.
      sql = `select OBJ.address from openvpn VPN
        inner join openvpn_opt OPT on OPT.openvpn=VPN.id
        inner join ipobj OBJ on OBJ.id=OPT.ipobj
        where VPN.openvpn=${req.body.openvpn} and OPT.ipobj is not null and OBJ.type=5`; // 5=ADDRESS
      req.dbCon.query(sql, (error, result) => {
        if (error) return reject(error);
      
        let freeIPLong;
        let found;
        for(freeIPLong=net.firstLong; freeIPLong<=net.lastLong; freeIPLong++) {
          found = 0;
          for (let ipCli of result) {
            if (freeIPLong === ip.toLong(ipCli.address)) {
              found=1;
              break;
            }
          }
          if (!found) 
            return resolve({'ip': ip.fromLong(freeIPLong), 'netmask': netmask});
        }
        reject(new Error('There are no free VPN IPs'));
      });
    });
  });
};

openvpnModel.searchOpenvpnUsage = (dbCon,fwcloud,openvpn) => {
	return new Promise(async (resolve, reject) => {
    try {
      let search = {};
      search.result = false;
      search.restrictions ={};

      /* Verify that the OpenVPN configuration is not used in any
          - Rule (table policy_r__openvpn)
          - IPBOJ group.
          - CRT prefix used in a rule or group.
      */
      search.restrictions.OpenvpnInRules = await policyOpenvpnModel.searchOpenvpnInRule(dbCon,fwcloud,openvpn);
      search.restrictions.OpenvpnInGroup = await policyOpenvpnModel.searchOpenvpnInGroup(dbCon,fwcloud,openvpn); 
      //search.restrictions.OpenvpnInPrefix = await Policy_r__ipobjModel.searchIpobjGroupInRule(id, type, fwcloud); //SEARCH IPOBJ GROUP IN RULES
      
      for (let key in search.restrictions) {
        if (search.restrictions[key].length > 0) {
          search.result = true;
          break;
        }
      }
      resolve(search);
    } catch(error) { reject(error) }
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
          const data = await openvpnModel.searchOpenvpnUsage(req.dbCon,req.body.fwcloud,openvpn.id);
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


openvpnModel.searchOpenvpnChilds = (dbCon,fwcloud,openvpn) => {
	return new Promise((resolve, reject) => {
    let sql = `SELECT VPN.id FROM openvpn VPN
      INNER JOIN firewall FW ON FW.id=VPN.firewall
      WHERE FW.fwcloud=${fwcloud} AND VPN.openvpn=${openvpn}`;
    dbCon.query(sql, async (error, result) => {
      if (error) return reject(error);

      if (result.length > 0)
        resolve({result: true, restrictions: { openvpnHasChilds: true}});
      else
        resolve({result: false});
    });
  });
};


// Get the ID of all OpenVPN configurations who's status field is not zero.
openvpnModel.getOpenvpnStatusNotZero = (req, data) => {
	return new Promise((resolve, reject) => {
    const sql = `SELECT VPN.id,VPN.status FROM openvpn VPN
      INNER JOIN firewall FW on FW.id=VPN.firewall
      WHERE VPN.status!=0 AND FW.fwcloud=${req.body.fwcloud}`
    req.dbCon.query(sql, (error, rows) => {
      if (error) return reject(error);
      data.openvpn_status = rows;
      resolve(data);
    });
  });
};

openvpnModel.addToGroup = req => {
	return new Promise((resolve, reject) => {
		req.dbCon.query(`INSERT INTO openvpn__ipobj_g values(${req.body.ipobj},${req.body.ipobj_g})`,(error, result) => {
      if (error) return reject(error);
      resolve(result.insertId);
    });
  });
};

openvpnModel.removeFromGroup = req => {
	return new Promise((resolve, reject) => {
    let sql = `DELETE FROM openvpn__ipobj_g WHERE ipobj_g=${req.body.ipobj_g} AND openvpn=${req.body.ipobj}`;		
		req.dbCon.query(sql,(error, result) => {
      if (error) return reject(error);
      resolve(result.insertId);
    });
  });
};

//Export the object
module.exports = openvpnModel;