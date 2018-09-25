const db = require('../../db.js');
const streamModel = require('../../models/stream/stream');
const fwcTreemodel = require('../../models/tree/fwc_tree');
var utils = require('../../utils/utils');

//create object
var fwc_treeRepairModel = {};

var accessData;
var dbCon;

//Export the object
module.exports = fwc_treeRepairModel;

var tableModel = "fwc_tree";

fwc_treeRepairModel.initData = req => {
	return new Promise(async resolve => {
    accessData = {sessionID: req.sessionID, iduser: req.iduser, fwcloud: req.fwcloud};
    dbCon = await utils.getDbConnection();
    resolve();
  });
};


//Ontain all root nodes.
fwc_treeRepairModel.checkRootNodes = fwcloud => {
	return new Promise((resolve, reject) => {
    let sql = 'SELECT id,name,node_type,id_obj,obj_type FROM ' + tableModel +
      ' WHERE fwcloud=' + dbCon.escape(fwcloud) + ' AND id_parent=0';
    dbCon.query(sql, (error, nodes) => {
      if (error) return reject(error);

      // Verify that we have three root nodes.
      if (nodes.length!==3) return reject(new Error('We must have 3 root nodes, but we found '+nodes.lenght)); 

      // The nodes must have the names: FIREWALLS, OBJECTS and SERVICES; with
      // the respective node types FDF, FDO, FDS.
      let update_obj_to_null = firewalls_found = objects_found = services_found = 0;
      for (let node of nodes) {
        if (node.name==='FIREWALLS' && node.node_type==='FDF') firewalls_found=1;
        else if (node.name==='OBJECTS' && node.node_type==='FDO') objects_found=1;
        else if (node.name==='SERVICES' && node.node_type==='FDS') services_found=1;
        else return reject(new Error('Root node with bad name or type (ID: '+node.name+')'));

        if (node.id_obj!=null || node.obj_type!=null) {
          node.id_obj = node.obj_type = null;
          update_obj_to_null = 1;
        }

        // If it is a firewall or cluster node, veify that the referenced firewall/cluster exists.

      }
      
      // Verify that we have found all nodes.
      if (!firewalls_found || !objects_found || !services_found) return reject(new Error('Not found all root nodes'));

      // The properties id_obj and obj_type must be null. If not we can repair it.
      if (update_obj_to_null) {
        streamModel.pushMessageCompile(accessData, "Repairing root nodes (setting id_obj and obj_type to null).\n");
        sql = 'update ' + tableModel + ' set id_obj=NULL,obj_type=NULL' +
          ' WHERE fwcloud=' + dbCon.escape(fwcloud) + ' AND id_parent=0';        
        dbCon.query(sql, (error, result) => {
          if (error) return reject(error);
          resolve(nodes);
        });
      } else    
        resolve(nodes);
    });
  });
};

// Resolve with the parent id of a tree node.
fwc_treeRepairModel.getParentId = id => {
	return new Promise((resolve, reject) => {
		let sql = 'SELECT id_parent FROM ' + tableModel +
			' WHERE id=' + dbCon.escape(id); 
		dbCon.query(sql, (error, nodes) => {
			if (error) return reject(error);
			if (nodes.length!==1) return resolve(-1);
			resolve(nodes[0].id_parent);
		});
	});
};

// Verify all not root nodes.
fwc_treeRepairModel.checkNotRootNodes = rootNodes => {
	return new Promise((resolve, reject) => {
    let sql = 'SELECT id,id_parent,name,node_type,id_obj,obj_type FROM ' + tableModel +
      ' WHERE fwcloud=' + dbCon.escape(accessData.fwcloud) + ' AND id_parent!=0';
    dbCon.query(sql, async (error, nodes) => {
      if (error) return reject(error);

      try {
        let last_id_ancestor,id_ancestor,deep,root_node_found;
        for (let node of nodes) {
          id_ancestor = node.id;
          deep = 0;
          do {
            last_id_ancestor = id_ancestor;
            id_ancestor = await fwc_treeRepairModel.getParentId(id_ancestor);

            // We are in a tree and then we can not have loops.
            // For security we allo a maximum deep of 100.
            if (id_ancestor===-1 || id_ancestor===node.id || (++deep)>100) {
              if (id_ancestor===-1)
                streamModel.pushMessageCompile(accessData, "Ancestor not found, deleting node: "+JSON.stringify(node)+"\n");
              else if (id_ancestor===node.id)
                streamModel.pushMessageCompile(accessData, "Deleting node in a loop: "+JSON.stringify(node)+"\n");
              else if (deep>100)
                streamModel.pushMessageCompile(accessData, "Deleting a too much deep node: "+JSON.stringify(node)+"\n");

              await fwcTreemodel.deleteFwc_TreeFullNode({id: node.id, fwcloud: accessData.fwcloud});
              break;
            }
          } while (id_ancestor!==0);

          // Verify that the last ancestor id is the one of one of the root nodes.
          root_node_found = 0;
          for(let rootNode of rootNodes) {
            if (last_id_ancestor === rootNode.id) {
              root_node_found = 1;
              break;
            }
          }
          if (!root_node_found) {
            streamModel.pushMessageCompile(accessData, "Root node for this node is not correct. Deleting node: "+JSON.stringify(node)+"\n");
            await fwcTreemodel.deleteFwc_TreeFullNode({id: node.id, fwcloud: accessData.fwcloud});
            continue;
          }
        }
      } catch (error) {reject(error)};

      resolve();
    });
  });
};


// Regenerate firewalls tree.
fwc_treeRepairModel.regenerateFirewallTree = (rootNode,firewall) => {
	return new Promise((resolve, reject) => {
    let sql = 'SELECT T1.id,T1.id_parent,T2.node_type as parent_node_type FROM fwc_tree T1' +
      ' INNER JOIN fwc_tree T2 on T2.id=T1.id_parent ' +
      ' WHERE T1.fwcloud='+dbCon.escape(accessData.fwcloud)+' AND T1.id_obj='+dbCon.escape(firewall.id) + ' AND T1.node_type="FW"';
    dbCon.query(sql, async (error, nodes) => {
      if (error) return reject(error);
      
      try {
        let nodeId = rootNode.id;

        if (nodes.length===0) // No node found for this firewall.
          streamModel.pushMessageCompile(accessData, "No node found for firewall: "+JSON.stringify(firewall)+"\n");
        else {
          if (nodes.length===1) { // The common case, firewall referenced by only one node three.
            if (nodes[0].parent_node_type==='FDF' || nodes[0].parent_node_type==='FD')
              nodeId = nodes[0].id_parent;
          } else if (nodes.length!==1)
            streamModel.pushMessageCompile(accessData, "Found several nodes for firewall: "+JSON.stringify(firewall)+"\n");
          
          // Remove nodes for this firewall.
          for(let node of nodes)
            await fwcTreemodel.deleteFwc_TreeFullNode({id: node.id, fwcloud: accessData.fwcloud});
        }

        // Regenerate the tree.
        streamModel.pushMessageCompile(accessData, "Regenerating tree for firewall: "+JSON.stringify(firewall)+"\n");
        await insertFwc_Tree_New_firewall(accessData.fwcloud, nodeId,firewall.id);
      } catch(err) { reject(err) }
      resolve();
    });
  });
};

// Check that all firewalls appear in the tree.
fwc_treeRepairModel.checkFirewallsInTree = rootNode => {
	return new Promise((resolve, reject) => {
    let sql = 'SELECT id,name FROM firewall WHERE cluster is null AND fwcloud=' + dbCon.escape(accessData.fwcloud);
    dbCon.query(sql, async (error, firewalls) => {
      if (error) return reject(error);
      try {
        for(let firewall of firewalls)
          await fwc_treeRepairModel.regenerateFirewallTree(rootNode,firewall);
      } catch(error) { return reject(error) };
      resolve();
    });
  });
};


// Regenerate cluster tree.
fwc_treeRepairModel.regenerateClusterTree = (rootNode,cluster) => {
	return new Promise((resolve, reject) => {
    let sql = 'SELECT T1.id,T1.id_parent,T2.node_type as parent_node_type FROM fwc_tree T1' +
      ' INNER JOIN fwc_tree T2 on T2.id=T1.id_parent ' +
      ' WHERE T1.fwcloud='+dbCon.escape(accessData.fwcloud)+' AND T1.id_obj='+dbCon.escape(cluster.id) +
      ' AND T1.node_type="CL"';
    dbCon.query(sql, async (error, nodes) => {
      if (error) return reject(error);
      
      try {
        let nodeId = rootNode.id;

        if (nodes.length===0) // No node found for this cluster.
          streamModel.pushMessageCompile(accessData, "No node found for cluster: "+JSON.stringify(cluster)+"\n");
        else {
          if (nodes.length===1) { // The common case, cluster referenced by only one node three.
            if (nodes[0].parent_node_type==='FDF' || nodes[0].parent_node_type==='FD')
              nodeId = nodes[0].id_parent;
          } else if (nodes.length!==1)
            streamModel.pushMessageCompile(accessData, "Found several nodes for cluster: "+JSON.stringify(cluster)+"\n");
          
          // Remove nodes for this cluster.
          for(let node of nodes)
            await fwcTreemodel.deleteFwc_TreeFullNode({id: node.id, fwcloud: accessData.fwcloud});
        }

        // Regenerate the tree.
        streamModel.pushMessageCompile(accessData, "Regenerating tree for cluster: "+JSON.stringify(cluster)+"\n");
        await fwcTreemodel.insertFwc_Tree_New_cluster(accessData.fwcloud, nodeId, cluster.id);
      } catch(err) { reject(err) }
      resolve();
    });
  });
};

// Check that all clusters appear in the tree.
fwc_treeRepairModel.checkClustersInTree = rootNode => {
	return new Promise((resolve, reject) => {
    let sql = 'SELECT C.id,C.name,F.id as fwmaster_id FROM cluster C ' +
      ' INNER JOIN firewall F on F.cluster=C.id ' +
      ' WHERE C.fwcloud=' + dbCon.escape(accessData.fwcloud) + ' AND F.fwmaster=1';
    dbCon.query(sql, async (error, clusters) => {
      if (error) return reject(error);
      try {
        for(let cluster of clusters)
          await fwc_treeRepairModel.regenerateClusterTree(rootNode,cluster);
      } catch(error) { return reject(error) };
      resolve();
    });
  });
};

