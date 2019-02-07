//create object
var treePrefixModel = {};

//Export the object
module.exports = treePrefixModel;

var tableModel = "fwc_tree";

//Add new folder node
treePrefixModel.createPrefixNode = nodeData => {
	return new Promise((resolve, reject) => {
		db.get((error, connection) => {
			if (error) return reject(error);
			// Verify that parent node exists and is a node that can contain folders.
			let sql =  'SELECT node_type FROM ' + tableModel +
				' WHERE fwcloud=' + nodeData.fwcloud + ' AND id=' + nodeData.id_parent; 
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
