const db = require('../../db.js');
const streamModel = require('../../models/stream/stream');

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
		let sql = 'SELECT id_parent,node_type FROM ' + tableModel +
			' WHERE id=' + connection.escape(id); 
		connection.query(sql, (error, nodes) => {
			if (error) return reject(error);
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

//Ontain all root nodes.
fwc_treeRepairModel.verifyTreeNodes = (accessData,connection,fwcloud) => {
	return new Promise((resolve, reject) => {
    let sql = 'SELECT id,id_parent,name,node_type,id_obj,obj_type FROM ' + tableModel +
      ' WHERE fwcloud=' + connection.escape(fwcloud) + ' AND id_parent!=0';
    connection.query(sql, async (error, nodes) => {
      if (error) return reject(error);

      try {
        let id_ancestor = deep = 0;
        for (let node of nodes) {
          id_ancestor = node.id_parent;
          do {
            // We are in a tree and then we can not have loops.
            // For security we allo a maximum deep of 100.
            if (id_ancestor===node.id || (++deep)>100) {
              if (id_ancestor===node.id)
                streamModel.pushMessageCompile(accessData, "Deleting node in a loop: "+node+"\n");
              else if (deep>100)
                streamModel.pushMessageCompile(accessData, "Deleting a too much deep: "+node+"\n");

              await fwc_treeRepairModel.deleteNode(connection,node.id);
              break;
            }

            id_ancestor = await fwc_treeRepairModel.getParentId(connection,id_ancestor);
          } while (id_ancestor!==0);
        }
      } catch (error) {reject(error)};

      resolve();
    });
  });
};