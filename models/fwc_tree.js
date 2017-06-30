var db = require('../db.js');
var async = require('async');


//create object
var fwc_treeModel = {};


var tableModel = "fwc_tree";
//var Node = require("tree-node");
var Tree = require('easy-tree');
var fwc_tree_node= require("./fwc_tree_node.js");


//Get fwc_tree by  id 
fwc_treeModel.getFwc_TreeId = function (iduser, id, callback) {
    db.get(function (error, connection) {
        if (error)
            return done('Database problem');

        var sql = 'SELECT * FROM ' + tableModel + ' WHERE id = ' + connection.escape(id);
        connection.query(sql, function (error, row) {
            if (error)
                callback(error, null);
            else
                callback(null, row);
        });
    });
};

//Get FLAT TREE by user
fwc_treeModel.getFwc_TreeUser = function (iduser, callback) {

    db.get(function (error, connection) {
        if (error)
            return done('Database problem');

        var sql = 'SELECT * FROM ' + tableModel + ' WHERE  id_user=' + connection.escape(iduser) + ' ORDER BY id_parent,node_order';
        console.log(sql);
        connection.query(sql, function (error, rows) {
            if (error)
                callback(error, null);
            else
                callback(null, rows);
        });
    });
};

//Get firewall node Id
fwc_treeModel.getFwc_TreeUserFolder = function (iduser,foldertype, callback) {

    db.get(function (error, connection) {
        if (error)
            return done('Database problem');

        var sql = 'SELECT * FROM ' + tableModel + ' WHERE  id_user=' + connection.escape(iduser) + '  AND node_type=' + connection.escape(foldertype) + ' AND id_parent=0 ORDER BY id limit 1';
        console.log(sql);
        connection.query(sql, function (error, rows) {
            if (error)
                callback(error, null);
            else
                callback(null, rows);
        });
    });
};
//Get COMPLETE TREE by user
fwc_treeModel.getFwc_TreeUserFull = function (iduser, idparent, tree, AllDone) {

    db.get(function (error, connection) {
        if (error)
            return done('Database problem');

        //Get ALL CHILDREN NODES FROM idparent
        var sql = 'SELECT * FROM ' + tableModel + ' WHERE  id_user=' + connection.escape(iduser) + ' AND id_parent=' + connection.escape(idparent) + ' ORDER BY node_order';
        //console.log(sql);
        connection.query(sql, function (error, rows) {
            if (error)
                callback(error, null);
            else {

                if (rows) {
                    console.log("---> DENTRO de PADRE: " + idparent);

                    async.forEachSeries(rows,
                            function (row, callback) {
                                hasLines(row.id, function (t) {
                                    //console.log(row);
                                    var tree_node = new fwc_tree_node(row);
                                    if (!t) {
                                        //Añadimos nodo hijo

                                        console.log("--->  AÑADIENDO NODO FINAL " + row.id + " con PADRE: " + idparent);

                                        tree.append([], tree_node);

                                        callback();
                                    } else {
                                        //dig(row.tree_id, treeArray, callback);
                                        console.log("--->  AÑADIENDO NODO PADRE " + row.id + " con PADRE: " + idparent);
                                        console.log("-------> LLAMANDO A HIJO: " + row.id);

                                        var treeP = new Tree(tree_node);
                                        tree.append([], treeP);
                                        fwc_treeModel.getFwc_TreeUserFull(iduser, row.id, treeP, callback);
                                    }
                                });
                            },
                            function (err) {
                                if (err)
                                    AllDone(err, tree);
                                else
                                    AllDone(null, tree);
                            });
                } else
                    AllDone(null, tree);
            }
        });

    });
};

//Get TREE by User and Parent
fwc_treeModel.getFwc_TreeUserParent = function (iduser, idparent, callback) {
    db.get(function (error, connection) {
        if (error)
            return done('Database problem');

        var sql = 'SELECT * FROM ' + tableModel + ' WHERE id_user = ' + connection.escape(iduser) + ' AND id_parent=' + connection.escape(idparent);
        connection.query(sql, function (error, row) {
            if (error)
                callback(error, null);
            else
                callback(null, row);
        });
    });
};

//Get NODES by name 
fwc_treeModel.getFwc_TreeName = function (iduser, name, callback) {
    db.get(function (error, connection) {
        if (error)
            return done('Database problem');
        var namesql = '%' + name + '%';

        var sql = 'SELECT * FROM ' + tableModel + ' WHERE id_user = ' + connection.escape(iduser) + " AND name like " + connection.escape(namesql);

        connection.query(sql, function (error, row) {
            if (error)
                callback(error, null);
            else
                callback(null, row);
        });
    });
};



//Add new NODE from user
fwc_treeModel.insertFwc_Tree = function (fwc_treeData, callback) {
    db.get(function (error, connection) {
        if (error)
            return done('Database problem');
        connection.query('INSERT INTO ' + tableModel + ' SET ?', fwc_treeData, function (error, result) {
            if (error) {
                callback(error, null);
            } else {
                //devolvemos la última id insertada
                callback(null, {"insertId": result.insertId});
            }
        });
    });
};

//Update NODE from user
fwc_treeModel.updateFwc_Tree = function (nodeTreeData, callback) {

    db.get(function (error, connection) {
        if (error)
            return done('Database problem');
        var sql = 'UPDATE ' + tableModel + ' SET ' +
                'id_user = ' + connection.escape(nodeTreeData.iduser) + ',' +
                'name = ' + connection.escape(nodeTreeData.name) + ' ' +
                ' WHERE id = ' + nodeTreeData.id;

        connection.query(sql, function (error, result) {
            if (error) {
                callback(error, null);
            } else {
                callback(null, {"msg": "success"});
            }
        });
    });
};

//FALTA BORRADO EN CASCADA
//Remove NODE with id to remove
fwc_treeModel.deleteFwc_Tree = function (iduser, id, callback) {
    db.get(function (error, connection) {
        if (error)
            return done('Database problem');
        var sqlExists = 'SELECT * FROM ' + tableModel + '  WHERE id_user = ' + connection.escape(iduser) + ' AND id = ' + connection.escape(id);
        connection.query(sqlExists, function (error, row) {
            //If exists Id from ipobj to remove
            if (row) {
                db.get(function (error, connection) {
                    var sql = 'DELETE FROM ' + tableModel + ' WHERE id_user = ' + connection.escape(iduser) + ' AND id = ' + connection.escape(id);
                    connection.query(sql, function (error, result) {
                        if (error) {
                            callback(error, null);
                        } else {
                            callback(null, {"msg": "deleted"});
                        }
                    });
                });
            } else {
                callback(null, {"msg": "notExist"});
            }
        });
    });
};

function hasLines(id, callback) {
    var ret;

    db.get(function (error, connection) {
        if (error)
            return done('Database problem');

        var sql = 'SELECT * FROM  ' + tableModel + '  where id_parent = ' + id;
        connection.query(sql, function (error, rows) {
            if (rows.length > 0) {
                ret = true;
            } else {
                ret = false;
            }
            callback(ret);
        });
    });

}

//Export the object
module.exports = fwc_treeModel;