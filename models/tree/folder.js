var db = require('../../db.js');
const fwcError = require('../../utils/error_table');

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
				' WHERE fwcloud=' + nodeData.fwcloud + ' AND id=' + nodeData.id_parent; 
			connection.query(sql, (error, result) => {
				if (error) return reject(error);
				if (result.length !== 1) return reject(fwcError.other('Parent node tree not found'));
				if (result[0].node_type!=='FDF' && result[0].node_type!=='FD') 
					return reject(fwcError.other('Can not create folders under this node type'));

				connection.query('INSERT INTO ' + tableModel + ' SET ?', nodeData, (error, result) => {
					if (error) return reject(error);
					// Return the las inserted id.
					(result.insertId) ?	resolve({"insertId": result.insertId}) : reject(fwcError.other('Node tree not created'));
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
			let sql =  'SELECT node_type,(select count(*) from '+tableModel+' where id_parent=' +  id + ') as childs' +
				' FROM ' + tableModel + ' WHERE fwcloud=' + fwcloud + ' AND id=' + id; 
			connection.query(sql, (error, result) => {
				if (error) return reject(error);
				if (result.length!==1) return reject(fwcError.NOT_FOUND);
				if (result[0].node_type!=='FD') return reject(fwcError.other('This node is not a folder'));
				if (result[0].childs!==0) return reject(fwcError.other('This folder node is not empty')); 

				sql = 'DELETE FROM ' + tableModel + ' WHERE fwcloud=' + fwcloud + ' AND id=' + id;
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
				' WHERE fwcloud=' + fwcloud + ' AND id=' + id + ' AND name=' + connection.escape(old_name); 
			connection.query(sql, (error, result) => {
				if (error) return reject(error);
				if (result.length!==1) return reject(fwcError.NOT_FOUND);
				if (result[0].node_type!=='FD') return reject(fwcError.other('This node is not a folder'));

				sql = 'UPDATE ' + tableModel +
					' SET name=' + connection.escape(new_name) +
					' WHERE fwcloud=' + fwcloud + ' AND id=' + id;
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
			' WHERE id=' + id + ' AND fwcloud=' + fwcloud; 
		connection.query(sql, (error, result) => {
			if (error) return reject(error);
			if (result.length!==1) return reject(fwcError.NOT_FOUND);
			if (result[0].node_type!=='FD' && result[0].node_type!=='FDF') return reject(fwcError.other('This node is not a folder'));

			resolve(result[0].id_parent);
		});
	});
};

//Move node into folder
fwc_treeFolderModel.moveToFolder = (fwcloud,src,dst) => {
	return new Promise((resolve, reject) => {
		if (src === dst) return reject(fwcError.other('Source and destination nodes are the same'));
		db.get((error, connection) => {
			if (error) return reject(error);
			// Verify that folder node exists and that the node that is being droped into can be moved.
			let sql = 'SELECT T1.node_type as src_type, T1.id_parent as id_parent_src, T2.node_type as dst_type, T2.id_parent as id_parent_dst' +
				' FROM ' + tableModel + ' as T1, ' + tableModel + ' as T2 ' +
				' WHERE T1.fwcloud=' + fwcloud + ' AND T1.id=' + src +
				' AND T2.fwcloud=' + fwcloud + ' AND T2.id=' + dst; 
			connection.query(sql, async (error, result) => {
				if (error) return reject(error);
				if (result.length!==1) return reject(fwcError.NOT_FOUND);
				if (result[0].src_type!=='FD' && result[0].src_type!=='FW' && result[0].src_type!=='CL') return reject(fwcError.other('Source node type is not valid'));
				if (result[0].dst_type!=='FD' && result[0].dst_type!=='FDF') return reject(fwcError.other('Destination folder is not valid'));
				if (result[0].id_parent_src === dst) return reject(fwcError.other('Source is already into destination'));

				// Verify that source node is not an ascensor of destination node.
				let parent_id = result[0].id_parent_dst;
				let max_deep = 100;
				while(parent_id!=null) {
					try {
						if (parent_id === src) return reject(fwcError.other('Source node is ancestor of destination node'));
						parent_id = await fwc_treeFolderModel.getParentId(connection,fwcloud,parent_id);
						if (--max_deep < 1) return reject(fwcError.other('Max deep level reached'));
					} catch(error) { return reject(error); }
				}

				// NOTE: It is not necessary verify that source and destination nodes are in the same tree, because in the
				// previos SQL we already verify that both nodes are in the same tree (fwcloud).

				sql = 'UPDATE ' + tableModel +
					' SET id_parent=' + dst +
					' WHERE fwcloud=' + fwcloud + ' AND id=' + src;
				connection.query(sql, (error, result) => {
					if (error) return reject(error);
					resolve();
				});
			});
		});
	});
};
