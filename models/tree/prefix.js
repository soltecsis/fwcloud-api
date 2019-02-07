//create object
var treePrefixModel = {};

//Export the object
module.exports = treePrefixModel;

var tableModel = "fwc_tree";

//Add new folder node
treePrefixModel.createPrefixNode = req => {
	return new Promise((resolve, reject) => {
    // Verify that we are not creating a prefix of a prefix that already exists.

    const nodeData = {
      id: null,
      name: req.body.name,
      id_parent: req.body.node_id,
      node_type: 'FD',
      obj_type: null,
      id_obj: null,
      fwcloud: req.body.fwcloud
    };
  
    req.dbCon.query(`INSERT INTO ${tableModel} SET ?`, nodeData, (error, result) => {
      if (error) return reject(error);

      // Move all affected nodes into the new prefix container node.
      const prefix = req.dbCon.escape(req.body.name).slice(1,-1);
      const sql =`UPDATE ${tableModel} SET id_parent=${result.insertId},
        name=SUBSTRING(name,${prefix.length+1},255)
        WHERE id_parent=${req.body.node_id} AND node_type='CRT' AND name LIKE '${prefix}%'`;
      req.dbCon.query(sql, nodeData, (error, result) => {
        if (error) return reject(error);
        resolve();
      });
    });
  });
};
