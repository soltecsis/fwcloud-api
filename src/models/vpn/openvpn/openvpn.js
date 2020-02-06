/*
    Copyright 2019 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
    https://soltecsis.com
    info@soltecsis.com


    This file is part of FWCloud (https://fwcloud.net).

    FWCloud is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    FWCloud is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with FWCloud.  If not, see <https://www.gnu.org/licenses/>.
*/


//create object
var openvpnModel = {};

const config = require('../../../config/config');
const ipobjModel = require('../../ipobj/ipobj');
const readline = require('readline');
const fwcTreeModel = require('../../../models/tree/tree');
const sshTools = require('../../../utils/ssh');
const socketTools = require('../../../utils/socket');
import { Firewall } from '../../../models/firewall/Firewall';
import { PolicyRuleToOpenVPN } from '../../../models/policy/PolicyRuleToOpenVPN';
import { Interface } from '../../../models/interface/Interface';
const fwcError = require('../../../utils/error_table');
const fs = require('fs');
const ip = require('ip');

const tableModel = 'openvpn';


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
    req.dbCon.query(`insert into ${tableModel} SET ?`, cfg, (error, result) => {
      if (error) return reject(error);
      resolve(result.insertId);
    });
  });
};

openvpnModel.updateCfg = req => {
	return new Promise((resolve, reject) => {
    let sql =`UPDATE ${tableModel} SET install_dir=${req.dbCon.escape(req.body.install_dir)},
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

      dbCon.query(`delete from openvpn_opt where openvpn=${openvpn}`, (error, result) => {
        if (error) return reject(error);

        dbCon.query(`delete from openvpn_prefix where openvpn=${openvpn}`, (error, result) => {
          if (error) return reject(error);

          dbCon.query(`delete from ${tableModel} where id=${openvpn}`, async (error, result) => {
            if (error) return reject(error);

            // Remove all the ipobj referenced by this OpenVPN configuration.
            // In the restrictions check we have already checked that it is possible to remove them.
            try {
              for (let ipobj of ipobj_list) {
                await ipobjModel.deleteIpobj(dbCon,fwcloud,ipobj.id);
                await fwcTreeModel.deleteObjFromTree(fwcloud,ipobj.id,ipobj.type);
              }
            } catch(error) { return reject(error) }
      
            resolve();
          });
        });
      });
    });
  });
};

openvpnModel.delCfgAll = (dbCon,fwcloud,firewall) => {
	return new Promise((resolve, reject) => {
    // Remove all the ipobj referenced by this OpenVPN configuration.
    // In the restrictions check we have already checked that it is possible to remove them.
    // IMPORTANT: Order by CRT type for remove clients before servers. If we don't do it this way, 
    // and the OpenVPN server is removed first, we will get a database foreign key constraint fails error.
    let sql = `select VPN.id,CRT.type from ${tableModel} VPN
      inner join crt CRT on CRT.id=VPN.crt
      where VPN.firewall=${firewall} order by CRT.type asc`;
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
    let sql = `select id from ${tableModel} where firewall=${req.body.firewall} and crt=${req.body.crt}`;
    req.dbCon.query(sql, (error, result) => {
      if (error) return reject(error);
      resolve(result[0].id);
    });
  });
};

openvpnModel.getCfg = req => {
	return new Promise((resolve, reject) => {
    let sql = `select * from ${tableModel} where id=${req.body.openvpn}`;
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
      resolve(result.length===0 ? null : result[0]);
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
    let sql = `select VPN.*, FW.fwcloud, FW.id firewall_id, FW.name firewall_name, CRT.cn, CA.cn as CA_cn, O.address, FW.cluster cluster_id,
      IF(FW.cluster is null,null,(select name from cluster where id=FW.cluster)) as cluster_name,
      IF(VPN.openvpn is null,VPN.openvpn,(select crt.cn from openvpn inner join crt on crt.id=openvpn.crt where openvpn.id=VPN.openvpn)) as openvpn_server_cn
      ${(type===2)?`,O.netmask`:``}, ${(type===1)?`311`:`312`} as type
      from openvpn VPN 
      inner join crt CRT on CRT.id=VPN.crt
      inner join ca CA on CA.id=CRT.ca
      inner join firewall FW on FW.id=VPN.firewall
      inner join openvpn_opt OPT on OPT.openvpn=${openvpn}
      inner join ipobj O on O.id=OPT.ipobj
      where FW.fwcloud=${fwcloud} and VPN.id=${openvpn} ${(type===1)?`and OPT.name='ifconfig-push'`:``}`;
    dbCon.query(sql, (error, result) => {
      if (error) return reject(error);
      resolve(result);
    });
  });
};

openvpnModel.getOpenvpnServersByCloud = (dbCon,fwcloud) => {
	return new Promise((resolve, reject) => {
    let sql = `select VPN.id,CRT.cn from openvpn VPN 
      inner join crt CRT on CRT.id=VPN.crt
      inner join ca CA on CA.id=CRT.ca
      where CA.fwcloud=${fwcloud} and CRT.type=2`; // 2 = Server certificate.
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
                cfg_line += ' '+ipobj.name;
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


openvpnModel.installCfg = (req,cfg,dir,name,type,close_socketio) => {
	return new Promise(async (resolve, reject) => {
    socketTools.init(req); // Init the socket used for message notification by the socketTools module.

    try {
      const fwData = await Firewall.getFirewallSSH(req);

      if (type===1) // Client certificarte
        socketTools.msg(`Uploading CCD configuration file '${dir}/${name}' to: (${fwData.SSHconn.host})\n`);
      else // Server certificate.
        socketTools.msg(`Uploading OpenVPN configuration file '${dir}/${name}' to: (${fwData.SSHconn.host})\n`);
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

      if (close_socketio) socketTools.msgEnd();
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
      const fwData = await Firewall.getFirewallSSH(req);

      socketTools.msg(`Removing OpenVPN configuration file '${dir}/${name}' from: (${fwData.SSHconn.host})\n`);
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
      const fwData = await Firewall.getFirewallSSH(req);

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
        if (!found) notFoundList += `${file}\n`;
      }

      if (notFoundList) {
        socketTools.msg(`<strong><font color="purple">WARNING: Found files in the directory '${dir}' without OpenVPN config:
          ${notFoundList}
          </font></strong>`);
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

openvpnModel.updateOpenvpnInstallDate = (dbCon, openvpn) => {
	return new Promise((resolve, reject) => {
    dbCon.query(`UPDATE openvpn SET installed_at=NOW() WHERE id=${openvpn}`, (error, result) => {
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
      if (result.length===0) return reject(fwcError.other('OpenVPN LAN not found'));

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
        reject(fwcError.other('There are no free VPN IPs'));
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
          - OpenVPN is the last in a CRT prefix used in a rule or group.
      */
      search.restrictions.OpenvpnInRule = await PolicyRuleToOpenVPN.searchOpenvpnInRule(dbCon,fwcloud,openvpn);
      search.restrictions.OpenvpnInGroup = await PolicyRuleToOpenVPN.searchOpenvpnInGroup(dbCon,fwcloud,openvpn); 
      search.restrictions.LastOpenvpnInPrefixInRule = await PolicyRuleToOpenVPN.searchLastOpenvpnInPrefixInRule(dbCon,fwcloud,openvpn); 
      search.restrictions.LastOpenvpnInPrefixInGroup = await PolicyRuleToOpenVPN.searchLastOpenvpnInPrefixInGroup(dbCon,fwcloud,openvpn); 
      
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

openvpnModel.searchOpenvpnUsageOutOfThisFirewall = req => {
	return new Promise((resolve, reject) => {
    // First get all firewalls OpenVPN configurations.
    let sql = 'select id from openvpn where firewall='+req.body.firewall;

    req.dbCon.query(sql, async (error, result) => {
      if (error) return reject(error);

      let answer = {};
			answer.restrictions = {};
			answer.restrictions.OpenvpnInRule = [];
			answer.restrictions.OpenvpnInGroup = [];

      try {
        for (let openvpn of result) {
          const data = await openvpnModel.searchOpenvpnUsage(req.dbCon,req.body.fwcloud,openvpn.id);
          if (data.result) {
            // OpenVPN config found in rules of other firewall.
            if (data.restrictions.OpenvpnInRule.length > 0) {
              for (let rule of data.restrictions.OpenvpnInRule) {
                if (rule.firewall_id != req.body.firewall)
                  answer.restrictions.OpenvpnInRule.push(rule);
              }
            }
            
            // OpenVPN config found in a group.
            if (data.restrictions.OpenvpnInGroup.length>0)
              answer.restrictions.OpenvpnInGroup = answer.restrictions.OpenvpnInGroup.concat(data.restrictions.OpenvpnInGroup);
          }
        }
      } catch(error) { reject(error) }

      resolve(answer);
    });
  });
};


openvpnModel.searchOpenvpnChild = (dbCon,fwcloud,openvpn) => {
	return new Promise((resolve, reject) => {
    let sql = `SELECT VPN.id FROM openvpn VPN
      INNER JOIN firewall FW ON FW.id=VPN.firewall
      WHERE FW.fwcloud=${fwcloud} AND VPN.openvpn=${openvpn}`;
    dbCon.query(sql, async (error, result) => {
      if (error) return reject(error);

      if (result.length > 0)
        resolve({result: true, restrictions: { OpenvpnHasChild: true}});
      else
        resolve({result: false});
    });
  });
};


openvpnModel.searchIPObjInOpenvpnOpt = (dbCon,ipobj,name) => {
	return new Promise((resolve, reject) => {
    dbCon.query(`select openvpn from openvpn_opt where ipobj=${ipobj} and name=${dbCon.escape(name)}`, (error, result) => {
      if (error) return reject(error);      
      resolve((result.length<1) ? false : true);
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


openvpnModel.getStatusFile = (req,status_file_path) => {
	return new Promise(async (resolve, reject) => {
    try {
      const fwData = await Firewall.getFirewallSSH(req);
      
      let data = await sshTools.runCommand(fwData.SSHconn,`sudo cat "${status_file_path}"`);
      // Remove the first line ()
      let lines = data.split('\n');
      if (lines[0].startsWith('[sudo] password for ')) 
        lines.splice(0,1);
      // join the array back into a single string
      data = lines.join('\n');

      resolve(data);
    } catch(error) { reject(error) }
  });
};


openvpnModel.createOpenvpnServerInterface = (req,cfg) => {
	return new Promise(async (resolve, reject) => {
    try {
			let openvpn_opt = await openvpnModel.getOptData(req.dbCon,cfg,'dev');
			if (openvpn_opt) {
        const interface_name = openvpn_opt.arg;

        // If we already have an interface with the same name then do nothing.
        const interfaces = await Interface.getInterfaces(req.dbCon, req.body.fwcloud, req.body.firewall);
        for (interface of  interfaces) {
          if (interface.name===interface_name)
            return resolve();
        }

				// Create the OpenVPN server network interface.
				const interfaceData = {
					id: null,
					firewall: req.body.firewall,
					name: interface_name,
					labelName: '',
					type: 10,
					interface_type: 10,
					comment: '',
					mac: ''
        };
        
				const interfaceId = await Interface.insertInterface(req.dbCon, interfaceData);
				if (interfaceId) {
					const interfaces_node = await fwcTreeModel.getNodeUnderFirewall(req.dbCon,req.body.fwcloud,req.body.firewall,'FDI')
					if (interfaces_node) {
						const nodeId = await fwcTreeModel.newNode(req.dbCon, req.body.fwcloud, interface_name, interfaces_node.id, 'IFF', interfaceId, 10);

            // Create the network address for the new interface.
            openvpn_opt = await openvpnModel.getOptData(req.dbCon,cfg,'server');
            if (openvpn_opt && openvpn_opt.ipobj) {
              // Get the ipobj data.
              const ipobj = await ipobjModel.getIpobjInfo(req.dbCon,req.body.fwcloud,openvpn_opt.ipobj);
              if (ipobj.type===7) { // Network
                const net = ip.subnet(ipobj.address, ipobj.netmask);

                const ipobjData = {
                  id: null,
                  fwcloud: req.body.fwcloud,
                  interface: interfaceId,
                  name: interface_name,
                  type: 5,
                  protocol: null,
                  address: net.firstAddress,
                  netmask: ipobj.netmask,
                  diff_serv: null,
                  ip_version: 4,
                  icmp_code: null,
                  icmp_type: null,
                  tcp_flags_mask: null,
                  tcp_flags_settings: null,
                  range_start: null,
                  range_end: null,
                  source_port_start: 0,
                  source_port_end: 0,
                  destination_port_start: 0,
                  destination_port_end: 0,
                  options: null
                };
        
                const ipobjId = await ipobjModel.insertIpobj(req, ipobjData);
                await fwcTreeModel.newNode(req.dbCon, req.body.fwcloud, `${interface_name} (${net.firstAddress})`, nodeId, 'OIA', ipobjId, 5);
              }
            }
					}
				}
      }
      
      resolve();
    } catch(error) { reject(error) }
  });
};

//Move rules from one firewall to other.
openvpnModel.moveToOtherFirewall = (dbCon, src_firewall, dst_firewall) => {
	return new Promise((resolve, reject) => {
		dbCon.query(`UPDATE ${tableModel} SET firewall=${dst_firewall} WHERE firewall=${src_firewall}`, (error, result) => {
			if (error) return reject(error);
			resolve();
		});
	});
};


//Export the object
module.exports = openvpnModel;
