const db = require('../../db.js');
const streamModel = require('../../models/stream/stream');
const fwcTreemodel = require('../../models/tree/fwc_tree');

//create object
var fwc_treeRepairModel = {};

//Export the object
module.exports = fwc_treeRepairModel;

var tableModel = "fwc_tree";

//Ontain all root nodes.
fwc_treeRepairModel.getRootNodes = (accessData,connection,fwcloud) => {
	return new Promise((resolve, reject) => {
    let sql = 'SELECT id,name,node_type,id_obj,obj_type FROM ' + tableModel +
      ' WHERE fwcloud=' + connection.escape(fwcloud) + ' AND id_parent=0';
    connection.query(sql, (error, nodes) => {
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
      }
      
      // Verify that we have found all nodes.
      if (!firewalls_found || !objects_found || !services_found) return reject(new Error('Not found all root nodes'));

      // The properties id_obj and obj_type must be null. If not we can repair it.
      if (update_obj_to_null) {
        streamModel.pushMessageCompile(accessData, "Repairing root nodes (setting id_obj and obj_type to null).\n");
        sql = 'update ' + tableModel + ' set id_obj=NULL,obj_type=NULL' +
          ' WHERE fwcloud=' + connection.escape(fwcloud) + ' AND id_parent=0';        
        connection.query(sql, (error, result) => {
          if (error) return reject(error);
          resolve(nodes);
        });
      } else    
        resolve(nodes);
    });
  });
};

// Resolve with the parent id of a tree node.
fwc_treeRepairModel.getParentId = (connection,id) => {
	return new Promise((resolve, reject) => {
		let sql = 'SELECT id_parent FROM ' + tableModel +
			' WHERE id=' + connection.escape(id); 
		connection.query(sql, (error, nodes) => {
			if (error) return reject(error);
			if (nodes.length!==1) return resolve(-1);
			resolve(nodes[0].id_parent);
		});
	});
};

// Delete tree node.
fwc_treeRepairModel.deleteNode = (connection,id) => {
	return new Promise((resolve, reject) => {
		let sql = 'DELETE FROM ' + tableModel +
			' WHERE id=' + connection.escape(id); 
		connection.query(sql, (error, result) => {
			if (error) return reject(error);
			resolve();
		});
	});
};

// Verify all not root nodes.
fwc_treeRepairModel.checkNotRootNodes = (accessData,connection,fwcloud,rootNodes) => {
	return new Promise((resolve, reject) => {
    let sql = 'SELECT id,id_parent,name,node_type,id_obj,obj_type FROM ' + tableModel +
      ' WHERE fwcloud=' + connection.escape(fwcloud) + ' AND id_parent!=0';
    connection.query(sql, async (error, nodes) => {
      if (error) return reject(error);

      try {
        let last_id_ancestor,id_ancestor,deep,root_node_found;
        for (let node of nodes) {
          id_ancestor = node.id;
          deep = 0;
          do {
            last_id_ancestor = id_ancestor;
            id_ancestor = await fwc_treeRepairModel.getParentId(connection,id_ancestor);

            // We are in a tree and then we can not have loops.
            // For security we allo a maximum deep of 100.
            if (id_ancestor===-1 || id_ancestor===node.id || (++deep)>100) {
              if (id_ancestor===-1)
                streamModel.pushMessageCompile(accessData, "Ancestor not found, deleting node: "+node+"\n");
              else if (id_ancestor===node.id)
                streamModel.pushMessageCompile(accessData, "Deleting node in a loop: "+node+"\n");
              else if (deep>100)
                streamModel.pushMessageCompile(accessData, "Deleting a too much deep node: "+node+"\n");

              await fwc_treeRepairModel.deleteNode(connection,node.id);
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
            streamModel.pushMessageCompile(accessData, "Root node for this node is not correct. Deleting node: "+node+"\n");
            await fwc_treeRepairModel.deleteNode(connection,node.id);
            continue;
          }

          // Check that the information in the node is consistent.
          if (node.id_obj) await fwc_treeRepairModel.checkNode(accessData,connection,node);
        }
      } catch (error) {reject(error)};

      resolve();
    });
  });
};

// Verify node information.
fwc_treeRepairModel.checkNode = (accessData,connection,node) => {
	return new Promise((resolve, reject) => {
    // Depending of the node type we will search for its referenced object in a different table.
    let searchTable;
    switch(node.node_type) {
      case 'IFF': 
        searchTable='interface';
        break;
      
      default:
        //return reject(new Error('Bad node type'));
        return resolve();
    }

    let sql = 'SELECT * FROM ' + searchTable + ' WHERE id=' + connection.escape(node.id_obj);
    connection.query(sql, async (error, objs) => {
      if (error) return reject(error);
      if (objs.length!==1) {
        streamModel.pushMessageCompile(accessData, "Oject referenced by node not found. Deleting node: "+node+"\n");
        await fwc_treeRepairModel.deleteNode(connection,node.id);
        return resolve();
      }

      if (node.name!==objs[0].name || node.obj_type!==objs[0].type)
      {
        streamModel.pushMessageCompile(accessData, "Bad data. Deleting node: "+node+"\n");
        await fwc_treeRepairModel.deleteNode(connection,node.id);
        return resolve();
      }

      resolve();
    });
  });
};

// Verify firewall/cluster nodes.
fwc_treeRepairModel.checkFirewallNodes = (accessData,connection,node) => {
	return new Promise((resolve, reject) => {
    let sql = 'SELECT name,node_type,id_obj,obj_type FROM ' + tableModel +
      ' WHERE id_parent=' + connection.escape(node.id);
    connection.query(sql, async (error, nodes) => {
      if (error) return reject(error);
      for(let node of nodes) {

      }
      resolve();
    });
  });
};

// Check that all interfaces appear in the tree and in the correct position.
fwc_treeRepairModel.findClustersNode = (accessData,connection,fwcloud,rootNode,cluster) => {
	return new Promise((resolve, reject) => {
    let sql = 'SELECT id,name,node_type,obj_type FROM fwc_tree' +
      ' WHERE fwcloud='+connection.escape(fwcloud)+' AND id_obj='+connection.escape(cluster.id) + ' AND node_type="CL"';
    connection.query(sql, async (error, nodes) => {
      if (error) return reject(error);
      
      if (nodes.length===0) {
        fwcTreemodel.insertFwc_Tree_New_cluster(fwcloud, rootNode.id, cluster.id, (error, dataTree) => {
          if (error) return reject(error);
          resolve();
        });

      } else
        resolve();
    });
  });
};

// Check that all interfaces appear in the tree and in the correct position.
fwc_treeRepairModel.checkClustersInTree = (accessData,connection,fwcloud,rootNode) => {
	return new Promise((resolve, reject) => {
    let sql = 'SELECT id,name FROM cluster WHERE fwcloud=' + connection.escape(fwcloud);
    connection.query(sql, async (error, clusters) => {
      if (error) return reject(error);
      try {
        for(let cluster of clusters) {
          await fwc_treeRepairModel.findClustersNode(accessData,connection,fwcloud,rootNode,cluster);
        }
      } catch(error) { return reject(error) };
      resolve();
    });
  });
};