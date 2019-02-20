//create object
var openvpnPrefixModel = {};

const fwcTreeModel = require('../../../models/tree/tree');
const openvpnModel = require('../../../models/vpn/openvpn/openvpn');
const policyPrefixModel = require('../../../models/policy/prefix');
const pkiCRTModel = require('../../../models/vpn/pki/crt');

// Get information about a prefix used in an OpenVPN configuration.
openvpnPrefixModel.getPrefixOpenvpnInfo = (dbCon, fwcloud, rule, prefix, openvpn) => {
	return new Promise((resolve, reject) => {
    let sql = `select CA.fwcloud,P.*,PRE.name,CA.cn from policy_r__prefix_openvpn P
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
openvpnPrefixModel.fillPrefixNodeOpenVPN = (dbCon,fwcloud,openvpn_ser,prefix_name,prefix_id,parent) => {
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
openvpnPrefixModel.applyCrtPrefixesOpenVPN = (dbCon,fwcloud,ca) => {
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


openvpnPrefixModel.searchCRTInOpenvpn = (dbCon,fwcloud,crt) => {
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





//Export the object
module.exports = openvpnPrefixModel;

