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

//Move node into folder
fwc_treeFolderModel.moveToFolder = (fwcloud,src,dst) => {
	return new Promise((resolve, reject) => {
		db.get((error, connection) => {
			if (error) return reject(error);
			// Verify that folder node exists and that the node that is being droped into can be moved.
			let sql =  'SELECT T1.node_type as src_type,T2.node_type as dst_type' +
				' FROM ' + tableModel + ' as T1, ' + tableModel + ' as T2 ' +
				' WHERE T1.fwcloud=' + connection.escape(fwcloud) + ' AND T1.id=' + connection.escape(src) +
				' AND T2.fwcloud=' + connection.escape(fwcloud) + ' AND T2.id=' + connection.escape(dst); 
			connection.query(sql, (error, result) => {
				if (error) return reject(error);
				if (result.length!==1) return reject(new Error('Node not found'));
				if (result[0].src_type!=='FD' && result[0].src_type!=='FW' && result[0].src_type!=='CL') return reject(new Error('Source node type is not valid'));
				if (result[0].dst_type!=='FD' && result[0].dst_type!=='FDF') return reject(new Error('Destination folder is not valid'));

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
