var db = require('../../db.js');

//create object
var fwc_treeFolderModel = {};

//Export the object
module.exports = fwc_treeFolderModel;

var tableModel = "fwc_tree";

//Add new folder node
fwc_treeFolderModel.createFolderNode = nodeData => {
	return new Promise((resolve, reject) => {
		db.get((error, connection) => {
			if (error) return reject(error);
			// Verify that parent node exists and is a node that can contain folders.
			let sql =  'SELECT node_type FROM ' + tableModel +
				' WHERE fwcloud=' + connection.escape(nodeData.fwcloud) + ' AND id=' + connection.escape(nodeData.id_parent); 
			connection.query(sql, (error, result) => {
				if (error) return reject(error);
				if (result.length !== 1) return reject(new Error('Parent node tree not found'));
				if (result[0].node_type!=='FDF' && result[0].node_type!=='FD') 
					return reject(new Error('Can not create folders under this node type'));

				connection.query('INSERT INTO ' + tableModel + ' SET ?', nodeData, (error, result) => {
					if (error) return reject(error);
					// Return the las inserted id.
					(result.insertId) ?	resolve({"insertId": result.insertId}) : reject(new Error('Node tree not created'));
				});
			});
		});
	});
};

//Remove folder node from tree
fwc_treeFolderModel.deleteFolderNode = (fwcloud,id) => {
	return new Promise((resolve, reject) => {
		db.get((error, connection) => {
			if (error) return reject(error);
			// Verify that node exists, has no childs and the type of it is 'FD' (folder).
			let sql =  'SELECT node_type,(select count(*) from '+tableModel+' where id_parent=' +  connection.escape(id) + ') as childs' +
				' FROM ' + tableModel + ' WHERE fwcloud=' + connection.escape(fwcloud) + ' AND id=' + connection.escape(id); 
			connection.query(sql, (error, result) => {
				if (error) return reject(error);
				if (result.length!==1) return reject(new Error('Node tree not found'));
				if (result[0].node_type!=='FD') return reject(new Error('This node is not a folder'));
				if (result[0].childs!==0) return reject(new Error('This folder node is not empty')); 

				sql = 'DELETE FROM ' + tableModel +
					' WHERE fwcloud=' + connection.escape(fwcloud) + ' AND id=' + connection.escape(id);
				connection.query(sql, (error, result) => {
					if (error) return reject(error);
					resolve();
				});
			});
		});
	});
};

//Rename folder node
fwc_treeFolderModel.renameFolderNode = (fwcloud,id,old_name,new_name) => {
	return new Promise((resolve, reject) => {
		db.get((error, connection) => {
			if (error) return reject(error);
			// Verify that node exists, the old name is correct and the type of it is 'FD' (folder).
			let sql =  'SELECT node_type FROM ' + tableModel +
				' WHERE fwcloud=' + connection.escape(fwcloud) + ' AND id=' + connection.escape(id) + ' AND name=' + connection.escape(old_name); 
			connection.query(sql, (error, result) => {
				if (error) return reject(error);
				if (result.length!==1) return reject(new Error('Node tree not found'));
				if (result[0].node_type!=='FD') return reject(new Error('This node is not a folder'));

				sql = 'UPDATE ' + tableModel +
					' SET name=' + connection.escape(new_name) +
					' WHERE fwcloud=' + connection.escape(fwcloud) + ' AND id=' + connection.escape(id);
				connection.query(sql, (error, result) => {
					if (error) return reject(error);
					resolve();
				});
			});
		});
	});
};

// Resolve with the parent id of a tree node.
fwc_treeFolderModel.getParentId = (connection,fwcloud,id) => {
	return new Promise((resolve, reject) => {
		let sql = 'SELECT id_parent,node_type FROM ' + tableModel +
			' WHERE id=' + connection.escape(id) + ' AND fwcloud=' + connection.escape(fwcloud); 
		connection.query(sql, (error, result) => {
			if (error) return reject(error);
			if (result.length!==1) return reject(new Error('Node not found'));
			if (result[0].node_type!=='FD' && result[0].node_type!=='FDF') return reject(new Error('This node is not a folder'));

			resolve(result[0].id_parent);
		});
	});
};

//Move node into folder
fwc_treeFolderModel.moveToFolder = (fwcloud,src,dst) => {
	return new Promise((resolve, reject) => {
		if (src === dst) return reject(new Error('Source and destination nodes are the same'));		
		db.get((error, connection) => {
			if (error) return reject(error);
			// Verify that folder node exists and that the node that is being droped into can be moved.
			let sql = 'SELECT T1.node_type as src_type, T1.id_parent as id_parent_src, T2.node_type as dst_type, T2.id_parent as id_parent_dst' +
				' FROM ' + tableModel + ' as T1, ' + tableModel + ' as T2 ' +
				' WHERE T1.fwcloud=' + connection.escape(fwcloud) + ' AND T1.id=' + connection.escape(src) +
				' AND T2.fwcloud=' + connection.escape(fwcloud) + ' AND T2.id=' + connection.escape(dst); 
			connection.query(sql, async (error, result) => {
				if (error) return reject(error);
				if (result.length!==1) return reject(new Error('Node not found'));
				if (result[0].src_type!=='FD' && result[0].src_type!=='FW' && result[0].src_type!=='CL') return reject(new Error('Source node type is not valid'));
				if (result[0].dst_type!=='FD' && result[0].dst_type!=='FDF') return reject(new Error('Destination folder is not valid'));
				if (result[0].id_parent_src === dst) return reject(new Error('Source is already into destination'));

				// Verify that source node is not an ascensor of destination node.
				let parent_id = result[0].id_parent_dst;
				let max_deep = 100;
				while(parent_id!==0) {
					try {
						if (parent_id === src) return reject(new Error('Source node is ancestor of destination node'));
						parent_id = await fwc_treeFolderModel.getParentId(connection,fwcloud,parent_id);
						if (--max_deep < 1) return reject(new Error('Max deep level reached'));
					} catch(error) { return reject(error); }
				}

				// NOTE: It is not necessary verify that source and destination nodes are in the same tree, because in the
				// previos SQL we already verify that both nodes are in the same tree (fwcloud).

				sql = 'UPDATE ' + tableModel +
					' SET id_parent=' + connection.escape(dst) +
					' WHERE fwcloud=' + connection.escape(fwcloud) + ' AND id=' + connection.escape(src);
				connection.query(sql, (error, result) => {
					if (error) return reject(error);
					resolve();
				});
			});
		});
	});
};
