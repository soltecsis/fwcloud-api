//create object
var pkiPrefixModel = {};

const fwcTreeModel = require('../../../models/tree/tree');
const pkiCRTModel = require('../../../models/vpn/pki/crt');

// Validate new prefix container.
pkiPrefixModel.existsCrtPrefix = req => {
	return new Promise((resolve, reject) => {
    req.dbCon.query(`SELECT id FROM ca_prefix WHERE ca=${req.body.ca} AND name=${req.dbCon.escape(req.body.name)}`, (error, result) => {
      if (error) return reject(error);
      resolve((result.length>0) ? true : false);
    });
  });
};

// Get all prefixes for the indicated CA.
pkiPrefixModel.getPrefixes = (dbCon,ca) => {
	return new Promise((resolve, reject) => {
    dbCon.query(`SELECT id,name FROM ca_prefix WHERE ca=${ca}`, (error, result) => {
      if (error) return reject(error);
      resolve(result);
    });
  });
};

// Get prefix info.
pkiPrefixModel.getPrefixInfo = (dbCon, fwcloud, prefix) => {
	return new Promise((resolve, reject) => {
    let sql = `select CA.fwcloud,PRE.*,CA.cn from ca_prefix PRE 
      inner join ca CA on CA.id=PRE.ca
      where CA.fwcloud=${fwcloud} and PRE.id=${prefix}`;
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
      const crt_list = await pkiCRTModel.getCRTlist(req.dbCon,ca);
      for (let crt of crt_list)
        await fwcTreeModel.newNode(req.dbCon,req.body.fwcloud,crt.cn,node_id,'CRT',crt.id,((crt.type===1)?301:302));

      // Create the nodes for all the prefixes.
      const prefix_list = await pkiPrefixModel.getPrefixes(req.dbCon,ca);
      for (let prefix of prefix_list) {
        let id = await fwcTreeModel.newNode(req.dbCon,req.body.fwcloud,prefix.name,node_id,'PRE',prefix.id,400);
        await pkiPrefixModel.fillPrefixNodeCA(req.dbCon,req.body.fwcloud,ca,prefix.name,node_id,id);
      }

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
    req.dbCon.query(`INSERT INTO ca_prefix SET ?`, prefixData, (error, result) => {
      if (error) return reject(error);
      resolve(result.insertId);
    });
  });
};

// Modify a CRT Prefix container.
pkiPrefixModel.modifyCrtPrefix = req => {
	return new Promise((resolve, reject) => {
    req.dbCon.query(`UPDATE ca_prefix SET name=${req.dbCon.escape(req.body.name)} WHERE id=${req.body.prefix}`, (error, result) => {
      if (error) return reject(error);
      resolve();
    });
  });
};

// Delete CRT Prefix container.
pkiPrefixModel.deleteCrtPrefix = req => {
	return new Promise((resolve, reject) => {
    req.dbCon.query(`DELETE from ca_prefix WHERE id=${req.body.prefix}`, (error, result) => {
      if (error) return reject(error);
      resolve();
    });
  });
};


//Export the object
module.exports = pkiPrefixModel;

