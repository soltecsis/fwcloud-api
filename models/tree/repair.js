const fwcTreemodel = require('./tree');
const socketTools = require('../../utils/socket');

//create object
var fwc_treeRepairModel = {};

var dbCon;
var fwcloud;

//Export the object
module.exports = fwc_treeRepairModel;

var tableModel = "fwc_tree";

fwc_treeRepairModel.initData = req => {
	return new Promise(async resolve => {
    socketTools.socket = req.app.get('socketio').sockets.connected[req.body.socketid];
    dbCon = req.dbCon;
    fwcloud = req.body.fwcloud;
    resolve();
  });
};


//Ontain all root nodes.
fwc_treeRepairModel.checkRootNodes = () => {
	return new Promise((resolve, reject) => {
    let sql = 'SELECT id,name,node_type,id_obj,obj_type FROM ' + tableModel +
      ' WHERE fwcloud=' + dbCon.escape(fwcloud) + ' AND id_parent is null';
    dbCon.query(sql, async (error, nodes) => {
      if (error) return reject(error);

      // The nodes must have the names: FIREWALLS, OBJECTS and SERVICES; with
      // the respective node types FDF, FDO, FDS.
      let update_obj_to_null = firewalls_found = objects_found = services_found = ca_found = 0;
      for (let node of nodes) {
        if (node.name==='FIREWALLS' && node.node_type==='FDF') {
          socketTools.msg("Root node found: "+JSON.stringify(node)+"\n");
          firewalls_found=1;
        }
        else if (node.name==='OBJECTS' && node.node_type==='FDO') {
          socketTools.msg("Root node found: "+JSON.stringify(node)+"\n");
          objects_found=1;
        }
        else if (node.name==='SERVICES' && node.node_type==='FDS'){
          socketTools.msg("Root node found: "+JSON.stringify(node)+"\n");
          services_found=1;
        }
        else if (node.name==='CA' && node.node_type==='FCA'){
          socketTools.msg("Root node found: "+JSON.stringify(node)+"\n");
          ca_found=1;
        }
        else {
          socketTools.msg('<font color="red">Deleting invalid root node: '+JSON.stringify(node)+'</font>\n');
          await fwcTreemodel.deleteFwc_TreeFullNode({id: node.id, fwcloud: fwcloud});
        }

        if (node.id_obj!=null || node.obj_type!=null) {
          node.id_obj = node.obj_type = null;
          update_obj_to_null = 1;
        }
      }
      
      // Verify that we have found all nodes.
      if (!firewalls_found || !objects_found || !services_found || !ca_found)
        return reject(new Error('Not found all root nodes'));

      // The properties id_obj and obj_type must be null. If not we can repair it.
      if (update_obj_to_null) {
        socketTools.msg('<font color="red">Repairing root nodes (setting id_obj and obj_type to null).</font>\n');
        sql = 'update ' + tableModel + ' set id_obj=NULL,obj_type=NULL' +
          ' WHERE fwcloud=' + dbCon.escape(fwcloud) + ' AND id_parent is null';        
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
		let sql = 'SELECT id_parent FROM ' + tableModel + ' WHERE id=' + id; 
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
      ' WHERE fwcloud=' + fwcloud + ' AND id_parent is not null';
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
                socketTools.msg('<font color="red">Ancestor not found, deleting node: '+JSON.stringify(node)+'</font>\n');
              else if (id_ancestor===node.id)
                socketTools.msg('<font color="red">Deleting node in a loop: '+JSON.stringify(node)+'</font>\n');
              else if (deep>100)
                socketTools.msg('<font color="red">Deleting a too much deep node: '+JSON.stringify(node)+'</font>\n');

              await fwcTreemodel.deleteFwc_TreeFullNode({id: node.id, fwcloud: fwcloud});
              break;
            }
          } while (id_ancestor);

          // Verify that the last ancestor id is the one of one of the root nodes.
          root_node_found = 0;
          for(let rootNode of rootNodes) {
            if (last_id_ancestor === rootNode.id) {
              root_node_found = 1;
              break;
            }
          }
          if (!root_node_found) {
            socketTools.msg('<font color="red">Root node for this node is not correct. Deleting node: '+JSON.stringify(node)+'</font>\n');
            await fwcTreemodel.deleteFwc_TreeFullNode({id: node.id, fwcloud: fwcloud});
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
      ' WHERE T1.fwcloud='+fwcloud+' AND T1.id_obj='+firewall.id+' AND T1.node_type="FW"';
    dbCon.query(sql, async (error, nodes) => {
      if (error) return reject(error);
      
      try {
        let nodeId = rootNode.id;

        if (nodes.length===0) // No node found for this firewall.
          socketTools.msg('<font color="red">No node found for firewall: '+JSON.stringify(firewall)+'</font>\n');
        else {
          if (nodes.length===1) { // The common case, firewall referenced by only one node three.
            if (nodes[0].parent_node_type==='FDF' || nodes[0].parent_node_type==='FD')
              nodeId = nodes[0].id_parent;
          } else if (nodes.length!==1)
            socketTools.msg('<font color="red">Found several nodes for firewall: '+JSON.stringify(firewall)+'>/font>\n');
          
          // Remove nodes for this firewall.
          for(let node of nodes)
            await fwcTreemodel.deleteFwc_TreeFullNode({id: node.id, fwcloud: fwcloud});
        }

        // Regenerate the tree.
        socketTools.msg( "Regenerating tree for firewall: "+JSON.stringify(firewall)+"\n");
        await fwcTreemodel.insertFwc_Tree_New_firewall(fwcloud, nodeId,firewall.id);
      } catch(err) { reject(err) }
      resolve();
    });
  });
};

// Check that all firewalls appear in the tree.
fwc_treeRepairModel.checkFirewallsInTree = rootNode => {
	return new Promise((resolve, reject) => {
    let sql = 'SELECT id,name FROM firewall WHERE cluster is null AND fwcloud=' + dbCon.escape(fwcloud);
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
      ' WHERE T1.fwcloud='+dbCon.escape(fwcloud)+' AND T1.id_obj='+dbCon.escape(cluster.id) +
      ' AND T1.node_type="CL"';
    dbCon.query(sql, async (error, nodes) => {
      if (error) return reject(error);
      
      try {
        let nodeId = rootNode.id;

        if (nodes.length===0) // No node found for this cluster.
          socketTools.msg('<font color="red">No node found for cluster: '+JSON.stringify(cluster)+'</font>\n');
        else {
          if (nodes.length===1) { // The common case, cluster referenced by only one node three.
            if (nodes[0].parent_node_type==='FDF' || nodes[0].parent_node_type==='FD')
              nodeId = nodes[0].id_parent;
          } else if (nodes.length!==1)
            socketTools.msg('<font color="red">Found several nodes for cluster: '+JSON.stringify(cluster)+'</font>\n');
          
          // Remove nodes for this cluster.
          for(let node of nodes)
            await fwcTreemodel.deleteFwc_TreeFullNode({id: node.id, fwcloud: fwcloud});
        }

        // Regenerate the tree.
        socketTools.msg( "Regenerating tree for cluster: "+JSON.stringify(cluster)+"\n");
        await fwcTreemodel.insertFwc_Tree_New_cluster(fwcloud, nodeId, cluster.id);
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
      ' WHERE C.fwcloud=' + dbCon.escape(fwcloud) + ' AND F.fwmaster=1';
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

// Verify that the nodes into de folders are valid.
fwc_treeRepairModel.checkNode = node => {
	return new Promise(async (resolve, reject) => {
    try {
      let sql = '';
      if (node.node_type==='FW') {
        if (node.obj_type!==0) { // Verify that object type is correct.
          socketTools.msg('<font color="red">Deleting node with bad obj_type: '+JSON.stringify(node)+'</font>\n');
          await fwcTreemodel.deleteFwc_TreeFullNode({id: node.id, fwcloud: fwcloud});
          return resolve(false);
        }
        sql = 'SELECT id FROM firewall WHERE fwcloud=' + dbCon.escape(fwcloud) + ' AND id=' + dbCon.escape(node.id_obj) + ' AND cluster is null';
      }
      else if (node.node_type==='CL') {
        if (node.obj_type!==100) { // Verify that object type is correct.
          socketTools.msg('<font color="red">Deleting node with bad obj_type: '+JSON.stringify(node)+'</font>\n');
          await fwcTreemodel.deleteFwc_TreeFullNode({id: node.id, fwcloud: fwcloud});
          return resolve(false);
        }
        sql = 'SELECT id FROM cluster WHERE fwcloud=' + dbCon.escape(fwcloud) + ' AND id=' + dbCon.escape(node.id_obj);
      }
      else return resolve(true);  

      // Check that referenced object exists.
      dbCon.query(sql, async (error, rows) => {
        if (error) return reject(error);

        if (rows.length!==1) {
          socketTools.msg('<font color="red">Referenced object not found. Deleting node: '+JSON.stringify(node)+'</font>\n');
          await fwcTreemodel.deleteFwc_TreeFullNode({id: node.id, fwcloud: fwcloud});
          resolve(false);
        } else resolve(true);
      }); 
    } catch(error) { reject(error) }
  });
};


// Verify that the nodes into de folders are valid.
fwc_treeRepairModel.checkFirewallsFoldersContent = rootNode => {
	return new Promise((resolve, reject) => {
    let sql = 'SELECT id,node_type,id_obj,obj_type FROM ' + tableModel +
      ' WHERE fwcloud=' + dbCon.escape(fwcloud) + ' AND id_parent=' + dbCon.escape(rootNode.id);
    dbCon.query(sql, async (error, nodes) => {
      if (error) return reject(error);

      try {
        for (let node of nodes) {
          // Into a folder we can have only more folders, firewalls or clusters.
          if (node.node_type!=='FD' && node.node_type!=='FW' && node.node_type!=='CL') {
            socketTools.msg('<font color="red">This node type can not be into a folder. Deleting it: '+JSON.stringify(node)+'</font>\n');
            await fwcTreemodel.deleteFwc_TreeFullNode({id: node.id, fwcloud: fwcloud});
          }

          // Check that the firewall or cluster pointed by the node exists.
          if (node.node_type==='FW' || node.node_type==='CL')
            await fwc_treeRepairModel.checkNode(node);          
          else { // Recursively check the folders nodes.
            socketTools.msg('Checking folder node: '+JSON.stringify(node)+'\n');
            await fwc_treeRepairModel.checkFirewallsFoldersContent(node);
          }
        }
      } catch (error) { reject(error) }
      resolve();
    });
  });
};

// Regenerate host tree.
fwc_treeRepairModel.regenerateHostTree = (hostsNode,host) => {
	return new Promise(async (resolve, reject) => {
    try {
      let newId = await fwcTreemodel.newNode(dbCon,fwcloud,host.name,hostsNode.id,'OIH',host.id,8);
      await fwcTreemodel.interfacesTree(dbCon,fwcloud,newId,host.id,'HOST');
    } catch(error) { reject(error) }
    resolve();
  });
};

// Verify that the host objects are correct.
fwc_treeRepairModel.checkHostObjects = rootNode => {
	return new Promise((resolve, reject) => {
    // Verify that we have only one Hosts node.
    let sql = 'SELECT id FROM ' + tableModel +
      ' WHERE fwcloud=' + dbCon.escape(fwcloud) + ' AND id_parent=' + dbCon.escape(rootNode.id) +
      ' AND node_type="OIH" AND id_obj IS NULL and obj_type=8';
    dbCon.query(sql, (error, nodes) => {
      if (error) return reject(error);
      if (nodes.length!==1) return reject(new Error('Hosts node not found'));

      // Clear the hosts node removing all child nodes.
      sql = 'SELECT id FROM ' + tableModel +
        ' WHERE fwcloud=' + dbCon.escape(fwcloud) + ' AND id_parent=' + dbCon.escape(nodes[0].id);
      dbCon.query(sql, async (error, childs) => {
        if (error) return reject(error);
        try {
          for (let child of childs)
              await fwcTreemodel.deleteFwc_TreeFullNode({id: child.id, fwcloud: fwcloud});
        } catch (error) { return reject(error) }

        // Search for all the hosts in the selected cloud.
        sql = 'SELECT id,name FROM ipobj' +
          ' WHERE fwcloud=' + dbCon.escape(fwcloud) + ' AND type=8';
        dbCon.query(sql, async (error, hosts) => {
          if (error) return reject(error);
          try {
            for (let host of hosts)
                await fwc_treeRepairModel.regenerateHostTree(nodes[0],host);
          } catch (error) { return reject(error) }
          resolve();
        });
      });
    });
  });
};

