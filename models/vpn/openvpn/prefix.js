//create object
var openvpnPrefixModel = {};

const fwcTreeModel = require('../../../models/tree/tree');
const openvpnModel = require('../../../models/vpn/openvpn/openvpn');

const tableModel = 'openvpn_prefix';

// Validate new prefix container.
openvpnPrefixModel.existsPrefix = (dbCon,openvpn,name) => {
	return new Promise((resolve, reject) => {
    dbCon.query(`SELECT id FROM ${tableModel} WHERE openvpn=${openvpn} AND name=${dbCon.escape(name)}`, (error, result) => {
      if (error) return reject(error);
      resolve((result.length>0) ? true : false);
    });
  });
};

// Add new prefix container.
openvpnPrefixModel.createPrefix = req => {
	return new Promise((resolve, reject) => {
    const prefixData = {
      id: null,
      name: req.body.name,
      openvpn: req.body.openvpn
    };
    req.dbCon.query(`INSERT INTO ${tableModel} SET ?`, prefixData, (error, result) => {
      if (error) return reject(error);
      resolve(result.insertId);
    });
  });
};


// Modify a CRT Prefix container.
openvpnPrefixModel.modifyPrefix = req => {
	return new Promise((resolve, reject) => {
    req.dbCon.query(`UPDATE ${tableModel} SET name=${req.dbCon.escape(req.body.name)} WHERE id=${req.body.prefix}`, (error, result) => {
      if (error) return reject(error);
      resolve();
    });
  });
};

// Delete CRT Prefix container.
openvpnPrefixModel.deletePrefix = (dbCon,prefix) => {
	return new Promise((resolve, reject) => {
    dbCon.query(`DELETE from ${tableModel} WHERE id=${prefix}`, (error, result) => {
      if (error) return reject(error);
      resolve();
    });
  });
};

// Remove all prefixes under the indicated firewall.
openvpnPrefixModel.deletePrefixAll = (dbCon,fwcloud,firewall) => {
	return new Promise((resolve, reject) => {
    let sql = `delete PRE from ${tableModel} as PRE
      inner join openvpn VPN on VPN.id=PRE.openvpn
      inner join firewall FW on FW.id=VPN.firewall
      where FW.id=${firewall} and FW.fwcloud=${fwcloud}`;
    dbCon.query(sql, (error, result) => {
      if (error) return reject(error);
      resolve(result);
    });
  });
};

// Get all prefixes for the indicated openvpn.
openvpnPrefixModel.getPrefixes = (dbCon,openvpn) => {
	return new Promise((resolve, reject) => {
    dbCon.query(`SELECT id,name FROM ${tableModel} WHERE openvpn=${openvpn}`, (error, result) => {
      if (error) return reject(error);
      resolve(result);
    });
  });
};

// Get all prefixes for the indicated CA.
openvpnPrefixModel.getOpenvpnClientesUnderPrefix = (dbCon,openvpn,prefix_name) => {
	return new Promise((resolve, reject) => {
    let sql = `select VPN.id from openvpn VPN 
      inner join crt CRT on CRT.id=VPN.crt
      where openvpn=${openvpn} and CRT.cn LIKE '${prefix_name}%'`;
    dbCon.query(sql, (error, result) => {
      if (error) return reject(error);
      resolve(result);
    });
  });
};

// Get information about a prefix used in an OpenVPN server configuration.
openvpnPrefixModel.getPrefixOpenvpnInfo = (dbCon, fwcloud, prefix) => {
	return new Promise((resolve, reject) => {
    let sql = `select P.*, FW.id as firewall_id, FW.name as firewall_name, CRT.cn, CA.cn as ca_cn, FW.cluster as cluster_id,
      IF(FW.cluster is null,null,(select name from cluster where id=FW.cluster)) as cluster_name, 401 as type
      from openvpn_prefix P
      inner join openvpn VPN on VPN.id=P.openvpn
      inner join crt CRT on CRT.id=VPN.crt
      inner join ca CA on CA.id=CRT.ca
      inner join firewall FW on FW.id=VPN.firewall 
      where FW.fwcloud=${fwcloud} and P.id=${prefix}`;
    dbCon.query(sql, async (error, result) => {
      if (error) return reject(error);

      result[0].openvpn_clients = [];
      try {
        let openvpn_clients = await openvpnPrefixModel.getOpenvpnClientesUnderPrefix(dbCon,result[0].openvpn,result[0].name);
        for(let openvpn_client of openvpn_clients)
          result[0].openvpn_clients.push((await openvpnModel.getOpenvpnInfo(dbCon,fwcloud,openvpn_client.id,1))[0]);
      } catch(error) { return reject(error) }
      
      resolve(result);
    });
  });
};

// Fill prefix node with matching entries.
openvpnPrefixModel.fillPrefixNodeOpenVPN = (dbCon,fwcloud,openvpn_ser,prefix_name,prefix_id,parent) => {
	return new Promise((resolve, reject) => {
    // Move all affected nodes into the new prefix container node.
    const prefix = dbCon.escape(prefix_name).slice(1,-1);
    let sql =`SELECT VPN.id,SUBSTRING(cn,${prefix.length+1},255) as sufix FROM crt CRT
      INNER JOIN openvpn VPN on VPN.crt=CRT.id
      WHERE VPN.openvpn=${openvpn_ser} AND CRT.type=1 AND CRT.cn LIKE '${prefix}%'`;
    dbCon.query(sql, async (error, result) => {
      if (error) return reject(error);

      try {
        // Create the prefix and OpenVPN client configuration nodes.
        let node_id = await fwcTreeModel.newNode(dbCon,fwcloud,prefix_name,parent,'PRO',prefix_id,401);
        for (let row of result)
          await fwcTreeModel.newNode(dbCon,fwcloud,row.sufix,node_id,'OCL',row.id,311);
      } catch(error) { return reject(error) }

      if (result.length === 0) return resolve();

      // Remove from OpenVPN server node the nodes that match de prefix.
      sql = `DELETE FROM fwc_tree WHERE id_parent=${parent} AND obj_type=311 AND name LIKE '${prefix}%'`;
      dbCon.query(sql, (error, result) => {
        if (error) return reject(error);
        resolve();
      });
    });
  });
};


// Apply OpenVPN server prefixes to tree node.
openvpnPrefixModel.applyOpenVPNPrefixes = (dbCon,fwcloud,openvpn_srv) => {
	return new Promise(async (resolve, reject) => {
    try {
      let node = await fwcTreeModel.getNodeInfo(dbCon,fwcloud,'OSR',openvpn_srv);
      let node_id = node[0].id;
      // Remove all nodes under the OpenVPN server configuration node.
      await fwcTreeModel.deleteNodesUnderMe(dbCon,fwcloud,node_id);

      // Create all OpenVPN client config nodes.
      let openvpn_cli_list = await openvpnModel.getOpenvpnClients(dbCon,openvpn_srv);
      for (let openvpn_cli of openvpn_cli_list)
        await fwcTreeModel.newNode(dbCon,fwcloud,openvpn_cli.cn,node_id,'OCL',openvpn_cli.id,311);

      // Create the nodes for all the prefixes.
      const prefix_list = await openvpnPrefixModel.getPrefixes(dbCon,openvpn_srv);
      for (let prefix of prefix_list)
        await openvpnPrefixModel.fillPrefixNodeOpenVPN(dbCon,fwcloud,openvpn_srv,prefix.name,prefix.id,node_id);

      resolve();
    } catch(error) { return reject(error) }
  });
};


openvpnPrefixModel.addPrefixToGroup = req => {
	return new Promise((resolve, reject) => {
    const data = {
      prefix: req.body.ipobj,
      ipobj_g: req.body.ipobj_g
    }
		req.dbCon.query(`INSERT INTO openvpn_prefix__ipobj_g SET ?`,data,(error, result) => {
      if (error) return reject(error);
      resolve(result.insertId);
    });
  });
};

openvpnPrefixModel.removePrefixFromGroup = req => {
	return new Promise((resolve, reject) => {
    let sql = `DELETE FROM openvpn_prefix__ipobj_g 
      WHERE prefix=${req.body.ipobj} AND ipobj_g=${req.body.ipobj_g}`;		
		req.dbCon.query(sql,(error, result) => {
      if (error) return reject(error);
      resolve(result.insertId);
    });
  });
};



openvpnPrefixModel.searchPrefixInRule = (dbCon,fwcloud,prefix) => {
	return new Promise((resolve, reject) => {
    var sql = `select O.*, FW.id as firewall_id, FW.name as firewall_name,
      O.prefix obj_id, PRE.name obj_name,
      R.id as rule_id, R.type rule_type, 401 as obj_type_id,
			PT.name rule_type_name, O.position as rule_position_id, P.name rule_position_name,
			FW.cluster as cluster_id, IF(FW.cluster is null,null,(select name from cluster where id=FW.cluster)) as cluster_name
		 	from policy_r__openvpn_prefix O
			inner join policy_r R on R.id=O.rule
			inner join firewall FW on FW.id=R.firewall
			inner join policy_position P on P.id=O.position
      inner join policy_type PT on PT.id=R.type
      inner join openvpn_prefix PRE on PRE.id=O.prefix
			where FW.fwcloud=${fwcloud} and O.prefix=${prefix}`;
		dbCon.query(sql, (error, rows) => {
			if (error) return reject(error);
			resolve(rows);
		});
	});
};

openvpnPrefixModel.searchPrefixInGroup = (dbCon,fwcloud,prefix) => {
	return new Promise((resolve, reject) => {
    var sql = `select P.*, P.ipobj_g as group_id, G.name as group_name,
      401 obj_type_id, PRE.name obj_name
      from openvpn_prefix__ipobj_g P
      inner join openvpn_prefix PRE on PRE.id=P.prefix
			inner join ipobj_g G on G.id=P.ipobj_g
			where G.fwcloud=${fwcloud} and P.prefix=${prefix}`;
		dbCon.query(sql, (error, rows) => {
			if (error) return reject(error);
			resolve(rows);
		});
	});
};


openvpnPrefixModel.searchPrefixUsage = (dbCon,fwcloud,prefix) => {
	return new Promise(async (resolve, reject) => {
    try {
      let search = {};
      search.result = false;
      search.restrictions ={};

      /* Verify that the OpenVPN server prefix is not used in any
          - Rule (table policy_r__openvpn_prefix)
          - IPBOJ group.
      */
      search.restrictions.PrefixInRule = await openvpnPrefixModel.searchPrefixInRule(dbCon,fwcloud,prefix);
      search.restrictions.PrefixInGroup = await openvpnPrefixModel.searchPrefixInGroup(dbCon,fwcloud,prefix); 
      
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


openvpnPrefixModel.searchPrefixUsageOutOfThisFirewall = req => {
	return new Promise((resolve, reject) => {
    // First get all firewalls prefixes for OpenVPN configurations.
    let sql = `select P.id from ${tableModel} P
      inner join openvpn VPN on VPN.id=P.openvpn
      where VPN.firewall=${req.body.firewall}`;

    req.dbCon.query(sql, async (error, result) => {
      if (error) return reject(error);

      let answer = {};
			answer.restrictions = {};
			answer.restrictions.PrefixInRule = [];
			answer.restrictions.PrefixInGroup = [];

      try {
        for (let prefix of result) {
          const data = await openvpnPrefixModel.searchPrefixUsage(req.dbCon,req.body.fwcloud,prefix.id);
          if (data.result) {
            // OpenVPN prefix found in rules of other firewall.
            if (data.restrictions.PrefixInRule.length > 0) {
              for (let rule of data.restrictions.PrefixInRule) {
                if (rule.firewall_id != req.body.firewall)
                  answer.restrictions.PrefixInRule.push(rule);
              }
            }
            
            // OpenVPN prefix found in a group.
            if (data.restrictions.PrefixInGroup.length>0)
              answer.restrictions.PrefixInGroup = answer.restrictions.PrefixInGroup.concat(data.restrictions.PrefixInGroup);
          }
        }
      } catch(error) { reject(error) }

      resolve(answer);
    });
  });
};


//Export the object
module.exports = openvpnPrefixModel;

