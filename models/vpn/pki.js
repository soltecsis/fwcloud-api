//create object
var pkiModel = {};

var config = require('../../config/config');
const fwcTreeModel = require('../../models/tree/tree');
const openvpnModel = require('../../models/vpn/openvpn');
const policyPrefixModel = require('../../models/policy/prefix');
const spawn = require('child-process-promise').spawn;
const readline = require('readline');
const fs = require('fs');
 

// Insert new CA in the database.
pkiModel.createCA = req => {
	return new Promise((resolve, reject) => {
    const ca = {
      fwcloud: req.body.fwcloud,
      cn: req.body.cn,
      days: req.body.days,
      comment: req.body.comment,
      status: 1 // This status variable will be changed to 0 when the DF file generation is completed.
    }
    req.dbCon.query('insert into ca SET ?', ca, (error, result) => {
      if (error) return reject(error);
      resolve(result.insertId);
    });
  });
};

// Delete CA.
pkiModel.deleteCA = req => {
	return new Promise((resolve, reject) => {
    // Verify that the CA can be deleted.
    req.dbCon.query('SELECT count(*) AS n FROM crt WHERE ca='+req.body.ca, (error, result) => {
      if (error) return reject(error);
      if (result[0].n > 0) return reject(new Error('This CA can not be removed because it still has certificates'));

      req.dbCon.query('DELETE FROM ca WHERE id='+req.body.ca, (error, result) => {
        if (error) return reject(error);
        resolve();
      });
    });
  });
};




// Insert new certificate in the database.
pkiModel.createCRT = req => {
	return new Promise((resolve, reject) => {
    const cert = {
      ca: req.body.ca,
      cn: req.body.cn,
      days: req.body.days,
      type: req.body.type,
      comment: req.body.comment
    }
    req.dbCon.query('insert into crt SET ?', cert, (error, result) => {
      if (error) return reject(error);
      resolve(result.insertId);
    });
  });
};

// Delete CRT.
pkiModel.deleteCRT = req => {
	return new Promise((resolve, reject) => {
    // Verify that the CA can be deleted.
    req.dbCon.query('SELECT count(*) AS n FROM openvpn WHERE crt='+req.body.crt, (error, result) => {
      if (error) return reject(error);
      if (result[0].n > 0) return reject(new Error('This certificate can not be removed because it is used in a OpenVPN setup'));

      req.dbCon.query('DELETE FROM crt WHERE id='+req.body.crt, (error, result) => {
        if (error) return reject(error);
        resolve();
      });
    });
  });
};

// Get database certificate data.
pkiModel.getCRTdata = (dbCon,crt) => {
	return new Promise((resolve, reject) => {
    dbCon.query('SELECT * FROM crt WHERE id='+crt, (error, result) => {
      if (error) return reject(error);
      if (result.length!==1) return reject(new Error('CRT not found'));

      resolve(result[0]);
    });
  });
};

// Get certificate list for a CA.
pkiModel.getCRTlist = (dbCon,ca) => {
	return new Promise((resolve, reject) => {
    dbCon.query(`SELECT * FROM crt WHERE ca=${ca}`, (error, result) => {
      if (error) return reject(error);
      resolve(result);
    });
  });
};

// Get CA list for a fwcloud.
pkiModel.getCAlist = (dbCon,fwcloud) => {
	return new Promise((resolve, reject) => {
    dbCon.query(`SELECT * FROM ca WHERE fwcloud=${fwcloud}`, (error, result) => {
      if (error) return reject(error);
      resolve(result);
    });
  });
};

/** 
 * Store the CA and cert ids into the tree's nodes used for the OpenVPN configurations.
 */
pkiModel.storePkiInfo = (req,tree) => {
	return new Promise((resolve, reject) => {
    let sql =`SELECT VPN.id as openvpn,VPN.openvpn as openvpn_parent,CRT.id as crt,CRT.ca FROM crt CRT
      INNER JOIN openvpn VPN on VPN.crt=CRT.id
      INNER JOIN firewall FW ON FW.id=VPN.firewall
      WHERE FW.fwcloud=${req.body.fwcloud}`;
    req.dbCon.query(sql, (error, result) => {
      if (error) return reject(error);
      tree.openvpn_info = result;
      resolve();
    });
  });
};

// Execute EASY-RSA command.
pkiModel.runEasyRsaCmd = (req,easyrsaDataCmd) => {
	return new Promise((resolve, reject) => {
    const pki_dir = '--pki-dir=' + config.get('pki').data_dir + '/' + req.body.fwcloud + '/' + req.caId;
    var argv = ['--batch',pki_dir];

    switch(easyrsaDataCmd) {
      case 'init-pki':
      case 'gen-crl':
      case 'gen-dh':
      argv.push(easyrsaDataCmd);
      break;

      case 'build-ca':
      argv.push('--days='+req.body.days);
      argv.push('--req-cn='+req.body.cn);
      argv.push(easyrsaDataCmd);
      if (!req.body.pass)
        argv.push('nopass');
      break;

      case 'build-server-full':
      case 'build-client-full':
      argv.push('--days='+req.body.days);
      argv.push(easyrsaDataCmd);
      argv.push(req.body.cn);
      if (!req.body.pass)
        argv.push('nopass');
      break;
    }
    const promise = spawn(config.get('pki').easy_rsa_cmd, argv);
    //const childProcess = promise.childProcess;

    //if (!req.body.pass)
      //  childProcess.stdin.push('mipass');

    //childProcess.stdout.on('data', data => console.log('stdout: ', data.toString()) );
    //childProcess.stderr.on('data', data => console.log('stderr: ', data.toString()) );
    //childProcess.stdin.push('TEST');

    promise.then(result => resolve(result))
    .catch(error => reject(error));
	});
};

// Get certificate serial number.
pkiModel.delFromIndex = (dir,cn) => {
	return new Promise((resolve, reject) => {
    var serial = '';
    const substr = 'CN='+cn+'\n';
    const src_path = dir+'/index.txt';
    const dst_path = dir+'/index.txt.TMP';
    var rs = fs.createReadStream(src_path);
    var ws = fs.createWriteStream(dst_path);

    rs.on('error',error => reject(error));
    ws.on('error',error => reject(error));

    const rl = readline.createInterface({
      input: rs,
      crlfDelay: Infinity
    });

    rl.on('line', line => {
      const line2 = line + '\n';
      if(line2.indexOf(substr) > -1) {
        serial = line.split('\t')[3];
      } else ws.write(line2);
    });

    rl.on('close', () => {
      ws.close();
      fs.unlink(src_path, error => {
        if (error) return reject(error);
        fs.rename(dst_path,src_path, error => {
          if (error) return reject(error);
          resolve(serial);
        });
      });
    });
  });
};

// Get the ID of all CA who's status field is not zero.
pkiModel.getCAStatusNotZero = (req, data) => {
	return new Promise((resolve, reject) => {
    req.dbCon.query(`SELECT id,status FROM ca WHERE status!=0 AND fwcloud=${req.body.fwcloud}`, (error, rows) => {
      if (error) return reject(error);
      data.ca_status = rows;
      resolve(data);
    });
  });
};


pkiModel.searchCAHasCRTs = (dbCon,fwcloud,ca) => {
	return new Promise((resolve, reject) => {
    let sql = `SELECT CRT.id FROM crt CRT
      INNER JOIN ca CA ON CA.id=CRT.ca
      WHERE CA.fwcloud=${fwcloud} AND CA.id=${ca}`;
    dbCon.query(sql, async (error, result) => {
      if (error) return reject(error);

      if (result.length > 0)
        resolve({result: true, restrictions: { caHasCertificates: true}});
      else
        resolve({result: false});
    });
  });
};

pkiModel.searchCRTInOpenvpn = (dbCon,fwcloud,crt) => {
	return new Promise((resolve, reject) => {
    let sql = `SELECT VPN.id FROM openvpn VPN
      INNER JOIN crt CRT ON CRT.id=VPN.crt
      INNER JOIN ca CA ON CA.id=CRT.ca
      WHERE CA.fwcloud=${fwcloud} AND CRT.id=${crt}`;
    dbCon.query(sql, async (error, result) => {
      if (error) return reject(error);

      if (result.length > 0)
        resolve({result: true, restrictions: { crtUsedInOpenvpn: true}});
      else
        resolve({result: false});
    });
  });
};


// Validate new prefix container.
pkiModel.existsCrtPrefix = req => {
	return new Promise((resolve, reject) => {
    req.dbCon.query(`SELECT id FROM prefix WHERE ca=${req.body.ca} AND name=${req.dbCon.escape(req.body.name)}`, (error, result) => {
      if (error) return reject(error);
      resolve((result.length>0) ? true : false);
    });
  });
};

// Gest all prefixes for the indicated CA.
pkiModel.getPrefixes = (dbCon,ca) => {
	return new Promise((resolve, reject) => {
    dbCon.query(`SELECT id,name FROM prefix WHERE ca=${ca}`, (error, result) => {
      if (error) return reject(error);
      resolve(result);
    });
  });
};

// Get prefix info.
pkiModel.getPrefixInfo = (dbCon, fwcloud, prefix, type) => {
	return new Promise((resolve, reject) => {
    let sql = `select CA.fwcloud,PRE.*,CA.cn from prefix PRE 
      inner join ca CA on CA.id=PRE.ca
      where CA.fwcloud=${fwcloud} and PRE.id=${prefix}`;
    dbCon.query(sql, (error, result) => {
      if (error) return reject(error);
      resolve(result);
    });
  });
};

// Fill prefix node with matching entries.
pkiModel.fillPrefixNodeCA = (dbCon,fwcloud,ca,name,parent,node) => {
	return new Promise((resolve, reject) => {
    // Move all affected nodes into the new prefix container node.
    const prefix = dbCon.escape(name).slice(1,-1);
    let sql =`SELECT id,type,cn,SUBSTRING(cn,${prefix.length+1},255) as sufix FROM crt
      WHERE ca=${ca} AND cn LIKE '${prefix}%'`;
    dbCon.query(sql, async (error, result) => {
      if (error) return reject(error);

      try {
        for (let row of result)
          await fwcTreeModel.newNode(dbCon,fwcloud,row.sufix,node,'CRT',row.id,((row.type===1)?301:302));
      } catch(error) { return reject(error) }

      // Remove from root CA node the nodes that match de prefix.
      sql = `DELETE FROM fwc_tree WHERE id_parent=${parent} AND (obj_type=301 OR obj_type=302) AND name LIKE '${prefix}%'`;
      dbCon.query(sql, (error, result) => {
        if (error) return reject(error);
        resolve();
      });
    });
  });
};

// Fill prefix node with matching entries.
pkiModel.fillPrefixNodeOpenVPN = (dbCon,fwcloud,openvpn_ser,prefix_name,prefix_id,parent) => {
	return new Promise((resolve, reject) => {
    // Move all affected nodes into the new prefix container node.
    const prefix = dbCon.escape(prefix_name).slice(1,-1);
    let sql =`SELECT VPN.id,SUBSTRING(cn,${prefix.length+1},255) as sufix FROM crt CRT
      INNER JOIN openvpn VPN on VPN.crt=CRT.id
      WHERE VPN.openvpn=${openvpn_ser} AND CRT.type=1 AND CRT.cn LIKE '${prefix}%'`;
    dbCon.query(sql, async (error, result) => {
      if (error) return reject(error);

      if (result.length === 0) return resolve(); // If no prefix match then do nothing.

      try {
        // Create the prefix and OpenVPN client configuration nodes.
        let node_id = await fwcTreeModel.newNode(dbCon,fwcloud,prefix_name,parent,'PRE',prefix_id,400);
        for (let row of result)
          await fwcTreeModel.newNode(dbCon,fwcloud,row.sufix,node_id,'OCL',row.id,311);
      } catch(error) { return reject(error) }

      // Remove from OpenVPN server node the nodes that match de prefix.
      sql = `DELETE FROM fwc_tree WHERE id_parent=${parent} AND obj_type=311 AND name LIKE '${prefix}%'`;
      dbCon.query(sql, (error, result) => {
        if (error) return reject(error);
        resolve();
      });
    });
  });
};


// Apply CRT prefix to tree node.
pkiModel.applyCrtPrefixesOpenVPN = (dbCon,fwcloud,ca) => {
	return new Promise(async (resolve, reject) => {
    try {
      // Search all openvpn server configurations for this CA.
      const openvpn_ser_list = await openvpnModel.getOpenvpnServersByCA(dbCon,ca);
      for (let openvpn_ser of openvpn_ser_list) {
        let node = await fwcTreeModel.getNodeInfo(dbCon,fwcloud,'OSR',openvpn_ser.id);
        let node_id = node[0].id;
        // Remove all nodes under the OpenVPN server configuration node.
        await fwcTreeModel.deleteNodesUnderMe(dbCon,fwcloud,node_id);

        // Create all OpenVPN client config nodes.
        let openvpn_cli_list = await openvpnModel.getOpenvpnClients(dbCon,openvpn_ser.id);
        for (let openvpn_cli of openvpn_cli_list)
          await fwcTreeModel.newNode(dbCon,fwcloud,openvpn_cli.cn,node_id,'OCL',openvpn_cli.id,311);

        // Create the nodes for all not empty prefixes.
        const prefix_list = await pkiModel.getPrefixes(dbCon,ca);
        for (let prefix of prefix_list)
          await pkiModel.fillPrefixNodeOpenVPN(dbCon,fwcloud,openvpn_ser.id,prefix.name,prefix.id,node_id);
      }

      resolve();
    } catch(error) { return reject(error) }
  });
};


// Apply CRT prefix to tree node.
pkiModel.applyCrtPrefixes = (req,ca) => {
	return new Promise(async (resolve, reject) => {
    try {
   		// Search for the CA node tree.
      let node = await fwcTreeModel.getNodeInfo(req.dbCon,req.body.fwcloud,'CA',ca);
      if (node.length !== 1)
        throw (new Error(`Found ${node.length} CA nodes, awaited 1`));
      let node_id = node[0].id;

      // Remove all nodes under the CA node.
      await fwcTreeModel.deleteNodesUnderMe(req.dbCon,req.body.fwcloud,node_id);

      // Generate all the CRT tree nodes under the CA node.
      const crt_list = await pkiModel.getCRTlist(req.dbCon,ca);
      for (let crt of crt_list)
        await fwcTreeModel.newNode(req.dbCon,req.body.fwcloud,crt.cn,node_id,'CRT',crt.id,((crt.type===1)?301:302));

      // Create the nodes for all the prefixes.
      const prefix_list = await pkiModel.getPrefixes(req.dbCon,ca);
      for (let prefix of prefix_list) {
        let id = await fwcTreeModel.newNode(req.dbCon,req.body.fwcloud,prefix.name,node_id,'PRE',prefix.id,400);
        await pkiModel.fillPrefixNodeCA(req.dbCon,req.body.fwcloud,ca,prefix.name,node_id,id);
      }

      // Now apply to the OpenVPN nodes.
      await pkiModel.applyCrtPrefixesOpenVPN(req.dbCon,req.body.fwcloud,ca);

      resolve();
    } catch(error) { return reject(error) }
  });
};


// Add new prefix container.
pkiModel.createCrtPrefix = req => {
	return new Promise((resolve, reject) => {
    const prefixData = {
      id: null,
      name: req.body.name,
      ca: req.body.ca
    };
    req.dbCon.query(`INSERT INTO prefix SET ?`, prefixData, (error, result) => {
      if (error) return reject(error);
      resolve();
    });
  });
};

// Modify a CRT Prefix container.
pkiModel.modifyCrtPrefix = req => {
	return new Promise((resolve, reject) => {
    req.dbCon.query(`UPDATE prefix SET name=${req.dbCon.escape(req.body.name)} WHERE id=${req.body.prefix}`, (error, result) => {
      if (error) return reject(error);
      resolve();
    });
  });
};

// Delete CRT Prefix container.
pkiModel.deleteCrtPrefix = req => {
	return new Promise((resolve, reject) => {
    req.dbCon.query(`DELETE from prefix WHERE id=${req.body.prefix}`, (error, result) => {
      if (error) return reject(error);
      resolve();
    });
  });
};

pkiModel.searchPrefixUsage = (dbCon,fwcloud,prefix) => {
	return new Promise(async (resolve, reject) => {
    try {
      let search = {};
      search.result = false;
      search.restrictions ={};

      /* Verify that the OpenVPN configuration is not used in any
          - Rule (table policy_r__prefix)
          - IPBOJ group.
      */
      search.restrictions.PrefixInRules = await policyPrefixModel.searchPrefixInRule(dbCon,fwcloud,prefix);
      //search.restrictions.PrefixInGroup = await policyPrefixModel.searchPrefixInGroup(dbCon,fwcloud,prefix); 
      
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


//Export the object
module.exports = pkiModel;