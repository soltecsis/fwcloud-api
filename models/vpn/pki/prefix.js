//create object
var pkiPrefixModel = {};

const fwcTreeModel = require('../../../models/tree/tree');
const openvpnModel = require('../../../models/vpn/openvpn/openvpn');
const policyPrefixModel = require('../../../models/policy/prefix');

// Validate new prefix container.
pkiPrefixModel.existsCrtPrefix = req => {
	return new Promise((resolve, reject) => {
    req.dbCon.query(`SELECT id FROM prefix WHERE ca=${req.body.ca} AND name=${req.dbCon.escape(req.body.name)}`, (error, result) => {
      if (error) return reject(error);
      resolve((result.length>0) ? true : false);
    });
  });
};

// Gest all prefixes for the indicated CA.
pkiPrefixModel.getPrefixes = (dbCon,ca) => {
	return new Promise((resolve, reject) => {
    dbCon.query(`SELECT id,name FROM prefix WHERE ca=${ca}`, (error, result) => {
      if (error) return reject(error);
      resolve(result);
    });
  });
};

// Get prefix info.
pkiPrefixModel.getPrefixInfo = (dbCon, fwcloud, prefix) => {
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

// Get information about a prefix used in an OpenVPN configuration.
pkiPrefixModel.getPrefixOpenvpnInfo = (dbCon, fwcloud, rule, prefix, openvpn) => {
	return new Promise((resolve, reject) => {
    let sql = `select CA.fwcloud,P.*,PRE.name,CA.cn from policy_r__prefix P
      inner join prefix PRE on PRE.id=P.prefix 
      inner join ca CA on CA.id=PRE.ca
      where CA.fwcloud=${fwcloud} and P.rule=${rule} and P.prefix=${prefix} and P.openvpn=${openvpn}`;
    dbCon.query(sql, (error, result) => {
      if (error) return reject(error);
      resolve(result);
    });
  });
};

// Fill prefix node with matching entries.
pkiPrefixModel.fillPrefixNodeCA = (dbCon,fwcloud,ca,name,parent,node) => {
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
pkiPrefixModel.fillPrefixNodeOpenVPN = (dbCon,fwcloud,openvpn_ser,prefix_name,prefix_id,parent) => {
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
pkiPrefixModel.applyCrtPrefixesOpenVPN = (dbCon,fwcloud,ca) => {
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
        const prefix_list = await pkiPrefixModel.getPrefixes(dbCon,ca);
        for (let prefix of prefix_list)
          await pkiPrefixModel.fillPrefixNodeOpenVPN(dbCon,fwcloud,openvpn_ser.id,prefix.name,prefix.id,node_id);
      }

      resolve();
    } catch(error) { return reject(error) }
  });
};


// Apply CRT prefix to tree node.
pkiPrefixModel.applyCrtPrefixes = (req,ca) => {
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
      const crt_list = await pkiPrefixModel.getCRTlist(req.dbCon,ca);
      for (let crt of crt_list)
        await fwcTreeModel.newNode(req.dbCon,req.body.fwcloud,crt.cn,node_id,'CRT',crt.id,((crt.type===1)?301:302));

      // Create the nodes for all the prefixes.
      const prefix_list = await pkiPrefixModel.getPrefixes(req.dbCon,ca);
      for (let prefix of prefix_list) {
        let id = await fwcTreeModel.newNode(req.dbCon,req.body.fwcloud,prefix.name,node_id,'PRE',prefix.id,400);
        await pkiPrefixModel.fillPrefixNodeCA(req.dbCon,req.body.fwcloud,ca,prefix.name,node_id,id);
      }

      // Now apply to the OpenVPN nodes.
      await pkiPrefixModel.applyCrtPrefixesOpenVPN(req.dbCon,req.body.fwcloud,ca);

      resolve();
    } catch(error) { return reject(error) }
  });
};


// Add new prefix container.
pkiPrefixModel.createCrtPrefix = req => {
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
pkiPrefixModel.modifyCrtPrefix = req => {
	return new Promise((resolve, reject) => {
    req.dbCon.query(`UPDATE prefix SET name=${req.dbCon.escape(req.body.name)} WHERE id=${req.body.prefix}`, (error, result) => {
      if (error) return reject(error);
      resolve();
    });
  });
};

// Delete CRT Prefix container.
pkiPrefixModel.deleteCrtPrefix = req => {
	return new Promise((resolve, reject) => {
    req.dbCon.query(`DELETE from prefix WHERE id=${req.body.prefix}`, (error, result) => {
      if (error) return reject(error);
      resolve();
    });
  });
};

pkiPrefixModel.searchPrefixUsage = (dbCon,fwcloud,prefix) => {
	return new Promise(async (resolve, reject) => {
    try {
      let search = {};
      search.result = false;
      search.restrictions ={};

      /* Verify that the CRT prefix is not used in any
          - Rule (table policy_r__prefix)
          - IPOBJ Group
      */
      search.restrictions.PrefixInRule = await policyPrefixModel.searchPrefixInRule(dbCon,fwcloud,prefix);
      search.restrictions.PrefixInGroup = await policyPrefixModel.searchPrefixInGroup(dbCon,fwcloud,prefix); 
      
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

pkiPrefixModel.addPrefixToGroup = req => {
	return new Promise((resolve, reject) => {
    const data = {
      prefix: req.body.ipobj,
      openvpn: req.body.openvpn,
      ipobj_g: req.body.ipobj_g
    }
		req.dbCon.query(`INSERT INTO prefix__ipobj_g SET ?`,data,(error, result) => {
      if (error) return reject(error);
      resolve(result.insertId);
    });
  });
};

pkiPrefixModel.removePrefixFromGroup = req => {
	return new Promise((resolve, reject) => {
    let sql = `DELETE FROM prefix__ipobj_g 
      WHERE prefix=${req.body.ipobj} AND openvpn=${req.body.openvpn} AND ipobj_g=${req.body.ipobj_g}`;		
		req.dbCon.query(sql,(error, result) => {
      if (error) return reject(error);
      resolve(result.insertId);
    });
  });
};

//Export the object
module.exports = pkiPrefixModel;

