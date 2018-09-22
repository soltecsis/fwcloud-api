const db = require('../../db.js');

//create object
var fwc_treeRepairModel = {};

//Export the object
module.exports = fwc_treeFolderModel;

var tableModel = "fwc_tree";

//Ontain all root nodes.
fwc_treeRepairModel.getRootNodes = fwcloud => {
	return new Promise((resolve, reject) => {
		db.get((error, connection) => {
			if (error) return reject(error);
			// Verify that parent node exists and is a node that can contain folders.
			let sql =  'SELECT id,name,node_type,id_obj,obj_type FROM ' + tableModel +
				' WHERE fwcloud=' + connection.escape(fwcloud); 
			connection.query(sql, (error, nodes) => {
        if (error) return reject(error);

        // Verify that we have three root nodes.
        if (nodes.length!==3) return reject(new Error('We must have 3 root nodes, but we found '+nodes.lenght)); 

        // The nodes must have the names: FIREWALLS, OBJECTS and SERVICES; with
        // the respective node types FDF, FDO, FDS.
        let update_obj_to_null, firewalls_found, objects_found, services_found = 0;
        for (let node of nodes) {
          if (node.name==='FIREWALLS' && node.node_type==='FDF') firewalls_found=1;
          else if (node.name==='OBJECTS' && node.node_type==='FDO') objects_found=1;
          else if (node.name==='SERVICES' && node.node_type==='FDS') services_found=1;
          else return reject(new Error('Root node with bad name or type (ID: '+node.name+')'));

          if (node.id_obj!=null || node.obj_type!=null) update_obj_to_null = 1;
        }
        
        // Verify that we have found all nodes.
        if (firewalls_found!==1 || objects_found!==1 || services_found!==1)
          return reject(new Error('Not found all root nodes'));

        // The properties id_obj and obj_type mus be null. If not we can repair it.
        
        
        resolve(nodes);
			});
		});
	});
};