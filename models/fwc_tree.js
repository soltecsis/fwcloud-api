var db = require('../db.js');
var async = require('async');

/**
 * Property Logger to manage App logs
 *
 * @property logger
 * @type log4js/app
 * 
 */
var logger = require('log4js').getLogger("app");

//create object
var fwc_treeModel = {};


var tableModel = "fwc_tree";
//var Node = require("tree-node");
var Tree = require('easy-tree');
var fwc_tree_node = require("./fwc_tree_node.js");


//Get fwc_tree by  id 
fwc_treeModel.getFwc_TreeId = function (iduser,fwcloud, id, callback) {
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

        connection.query(sql, function (error, rows) {
            if (error)
                callback(error, null);
            else
                callback(null, rows);
        });
    });
};

//Get firewall node by folder
fwc_treeModel.getFwc_TreeUserFolder = function (iduser,fwcloud, foldertype, callback) {

    db.get(function (error, connection) {
        if (error)
            return done('Database problem');

        var sql = 'SELECT * FROM ' + tableModel + ' T' +
                ' inner join fwcloud C on C.id=T.fwcloud ' +
                ' inner join firewall F on F.fwcloud=C.id ' + 
                ' inner join user__firewall U on U.id_firewall=F.id ' +
                ' WHERE  T.fwcloud=' + connection.escape(fwcloud) + '  AND T.node_type=' + connection.escape(foldertype) + ' AND T.id_parent=0 ' + 
                ' AND U.id_user=' + connection.escape(iduser) + ' AND U.allow_access=1 ' +
                ' ORDER BY T.id limit 1';
        logger.debug(sql);

        connection.query(sql, function (error, rows) {
            if (error){
                logger.error(error);
                callback(error, null);
            }
            else
                callback(null, rows);
        });
    });
};

//Get firewall node ID
fwc_treeModel.getFwc_TreeId = function (fwcloud, id, callback) {

    db.get(function (error, connection) {
        if (error)
            return done('Database problem');

        var sql = 'SELECT * FROM ' + tableModel + ' WHERE  fwcloud=' + connection.escape(fwcloud) + '  AND id=' + connection.escape(id);

        connection.query(sql, function (error, rows) {
            if (error)
                callback(error, null);
            else
                callback(null, rows);
        });
    });
};
//Get COMPLETE TREE by user
fwc_treeModel.getFwc_TreeUserFull = function (iduser, fwcloud, idparent, tree, objStandard, objCloud,node_type, AllDone) {

    db.get(function (error, connection) {
        if (error)
            return done('Database problem');

        //FALTA CONTROLAR EN QUE FWCLOUD ESTA EL USUARIO
        var sqlfwcloud = "";
        if (objStandard === '1' && objCloud === '0')
            sqlfwcloud = " AND (fwcloud is null OR (id_obj is null AND fwcloud=" + fwcloud + ")) ";   //Only Standard objects
        else if (objStandard === '0' && objCloud === '1')
            sqlfwcloud = " AND (fwcloud=" + fwcloud + " OR (id_obj is null AND fwcloud=" + fwcloud + ")) ";   //Only fwcloud objects
        else 
            sqlfwcloud = " AND (fwcloud=" + fwcloud + " OR fwcloud is null OR (id_obj is null AND fwcloud=" + fwcloud + ")) ";   //ALL  objects

        //Get ALL CHILDREN NODES FROM idparent
        var sql = 'SELECT * FROM ' + tableModel + ' WHERE id_parent=' + connection.escape(idparent) + sqlfwcloud + ' ORDER BY node_order';
        logger.debug(sql);    
        connection.query(sql, function (error, rows) {
            if (error)
                callback(error, null);
            else {

                if (rows) {
                    logger.debug("---> DENTRO de PADRE: " + idparent + "  NODE TYPE: " + node_type);
                    //FIREWALL CONTROL ACCESS
                    

                    async.forEachSeries(rows,
                            function (row, callback) {
                                hasLines(row.id, function (t) {
                                    //logger.debug(row);
                                    var tree_node = new fwc_tree_node(row);
                                    if (!t) {
                                        //Añadimos nodo hijo

                                        //logger.debug("--->  AÑADIENDO NODO FINAL " + row.id + " con PADRE: " + idparent);

                                        tree.append([], tree_node);

                                        callback();
                                    } else {
                                        //dig(row.tree_id, treeArray, callback);
                                        //logger.debug("--->  AÑADIENDO NODO PADRE " + row.id + " con PADRE: " + idparent);
                                        logger.debug("-------> LLAMANDO A HIJO: " + row.id + "   Node Type: " + row.node_type);

                                        var treeP = new Tree(tree_node);
                                        tree.append([], treeP);
                                        fwc_treeModel.getFwc_TreeUserFull(iduser, fwcloud, row.id, treeP, objStandard, objCloud, row.node_type ,callback);
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
fwc_treeModel.getFwc_TreeUserParent = function (fwcloud, idparent, callback) {
    db.get(function (error, connection) {
        if (error)
            return done('Database problem');

        var sql = 'SELECT * FROM ' + tableModel + ' WHERE fwcloud = ' + connection.escape(fwcloud) + ' AND id_parent=' + connection.escape(idparent);
        connection.query(sql, function (error, row) {
            if (error)
                callback(error, null);
            else
                callback(null, row);
        });
    });
};

//Get NODES by name 
fwc_treeModel.getFwc_TreeName = function (fwcloud, name, callback) {
    db.get(function (error, connection) {
        if (error)
            return done('Database problem');
        var namesql = '%' + name + '%';

        var sql = 'SELECT * FROM ' + tableModel + ' WHERE fwcloud = ' + connection.escape(fwcloud) + " AND name like " + connection.escape(namesql);

        connection.query(sql, function (error, row) {
            if (error)
                callback(error, null);
            else
                callback(null, row);
        });
    });
};

//Init TREE  from cloud
fwc_treeModel.insertFwc_Tree_init = function (fwcloud, AllDone) {
    db.get(function (error, connection) {
        if (error)
            return done('Database problem');
        
        //QUITAR PARA MERMITIR VARIOS CLOUD
        //DELETE PREVIUS DATA
        //sqldelete = "delete from fwc_tree where fwcloud=" +  connection.escape(fwcloud) ;
        sqldelete = "truncate table fwc_tree ";
        connection.query(sqldelete, function (error, result) {
            if (error) {
                AllDone(error, null);
            } else {
                //INSERT NODE FIREWALLS
                sqlinsert = "INSERT INTO " + tableModel + "( name, comment, id_parent, node_order,node_level, node_type, expanded, subfolders, id_obj,obj_type,fwcloud) " +
                        " VALUES (" + "'FIREWALLS','',0,1,1,'FDF',0,0,null,null," + connection.escape(fwcloud) + ")";
                logger.debug(sqlinsert);
                connection.query(sqlinsert, function (error, result) {
                    if (error)
                        logger.debug("ERROR FDF : " + error);
                });
                //INSERT NODE OBJECTS
                sqlinsert = "INSERT INTO " + tableModel + "( name, comment, id_parent, node_order,node_level, node_type, expanded, subfolders, id_obj,obj_type,fwcloud) " +
                        " VALUES (" + "'OBJECTS','',0,2,1,'FDO',0,0,null,null," + connection.escape(fwcloud) + ")";
                connection.query(sqlinsert, function (error, result) {
                    if (error)
                        logger.debug("ERROR FDO : " + error);
                    else {
                        var parent_id = result.insertId;
                        sqlinsert = "INSERT INTO " + tableModel + "( name, comment, id_parent, node_order,node_level, node_type, expanded, subfolders, id_obj,obj_type,fwcloud) " +
                                " VALUES (" + "'Addresses',''," + parent_id + ",1,2,'OIA',0,0,null,5," + connection.escape(fwcloud) + ")";
                        connection.query(sqlinsert, function (error, result) {
                            if (error)
                                logger.debug("ERROR OIA : " + error);
                        });
                        sqlinsert = "INSERT INTO " + tableModel + "( name, comment, id_parent, node_order,node_level, node_type, expanded, subfolders, id_obj,obj_type,fwcloud) " +
                                " VALUES (" + "'Address Ranges',''," + parent_id + ",2,2,'OIR',0,0,null,6," + connection.escape(fwcloud) + ")";
                        connection.query(sqlinsert, function (error, result) {
                            if (error)
                                logger.debug("ERROR OIR : " + error);
                        });
                        sqlinsert = "INSERT INTO " + tableModel + "( name, comment, id_parent, node_order,node_level, node_type, expanded, subfolders, id_obj,obj_type,fwcloud) " +
                                " VALUES (" + "'Networks',''," + parent_id + ",3,2,'OIN',0,0,null,7," + connection.escape(fwcloud) + ")";
                        connection.query(sqlinsert, function (error, result) {
                            if (error)
                                logger.debug("ERROR OIN : " + error);
                        });
                        sqlinsert = "INSERT INTO " + tableModel + "( name, comment, id_parent, node_order,node_level, node_type, expanded, subfolders, id_obj,obj_type,fwcloud) " +
                                " VALUES (" + "'Hosts',''," + parent_id + ",4,2,'OIH',0,0,null,8," + connection.escape(fwcloud) + ")";
                        connection.query(sqlinsert, function (error, result) {
                            if (error)
                                logger.debug("ERROR OIH : " + error);
                        });
                        sqlinsert = "INSERT INTO " + tableModel + "( name, comment, id_parent, node_order,node_level, node_type, expanded, subfolders, id_obj,obj_type,fwcloud) " +
                                " VALUES (" + "'Groups',''," + parent_id + ",5,2,'OIG',0,0,null,20," + connection.escape(fwcloud) + ")";
                        connection.query(sqlinsert, function (error, result) {
                            if (error)
                                logger.debug("ERROR OIG : " + error);
                        });
                    }
                });
                //INSERT NODE SERVICES
                sqlinsert = "INSERT INTO " + tableModel + "( name, comment, id_parent, node_order,node_level, node_type, expanded, subfolders, id_obj,obj_type,fwcloud) " +
                        " VALUES (" + "'SERVICES','',0,3,1,'FDS',0,0,null,null," + connection.escape(fwcloud) + ")";
                connection.query(sqlinsert, function (error, result) {
                    if (error)
                        logger.debug("ERROR FDS : " + error);
                    else {
                        var parent_id = result.insertId;
                        sqlinsert = "INSERT INTO " + tableModel + "( name, comment, id_parent, node_order,node_level, node_type, expanded, subfolders, id_obj,obj_type,fwcloud) " +
                                " VALUES (" + "'IP',''," + parent_id + ",1,2,'SOI',0,0,null,1," + connection.escape(fwcloud) + ")";
                        connection.query(sqlinsert, function (error, result) {
                            if (error)
                                logger.debug("ERROR SOI : " + error);
                        });
                        sqlinsert = "INSERT INTO " + tableModel + "( name, comment, id_parent, node_order,node_level, node_type, expanded, subfolders, id_obj,obj_type,fwcloud) " +
                                " VALUES (" + "'TCP',''," + parent_id + ",2,2,'SOT',0,0,null,2," + connection.escape(fwcloud) + ")";
                        connection.query(sqlinsert, function (error, result) {
                            if (error)
                                logger.debug("ERROR SOT : " + error);
                        });
                        sqlinsert = "INSERT INTO " + tableModel + "( name, comment, id_parent, node_order,node_level, node_type, expanded, subfolders, id_obj,obj_type,fwcloud) " +
                                " VALUES (" + "'ICMP',''," + parent_id + ",3,2,'SOM',0,0,null,3," + connection.escape(fwcloud) + ")";
                        connection.query(sqlinsert, function (error, result) {
                            if (error)
                                logger.debug("ERROR SOM : " + error);
                        });
                        sqlinsert = "INSERT INTO " + tableModel + "( name, comment, id_parent, node_order,node_level, node_type, expanded, subfolders, id_obj,obj_type,fwcloud) " +
                                " VALUES (" + "'UDP',''," + parent_id + ",4,2,'SOU',0,0,null,4," + connection.escape(fwcloud) + ")";
                        connection.query(sqlinsert, function (error, result) {
                            if (error)
                                logger.debug("ERROR SOU : " + error);
                        });
                        sqlinsert = "INSERT INTO " + tableModel + "( name, comment, id_parent, node_order,node_level, node_type, expanded, subfolders, id_obj,obj_type,fwcloud) " +
                                " VALUES (" + "'Groups',''," + parent_id + ",5,2,'SOG',0,0,null,21," + connection.escape(fwcloud) + ")";
                        connection.query(sqlinsert, function (error, result) {
                            if (error)
                                logger.debug("ERROR SOG : " + error);
                        });
                    }
                });
                //INSERT NODE TIME
                sqlinsert = "INSERT INTO " + tableModel + "( name, comment, id_parent, node_order,node_level, node_type, expanded, subfolders, id_obj,obj_type,fwcloud) " +
                        " VALUES (" + "'TIME','',0,4,1,'FDT',0,0,null,null," + connection.escape(fwcloud) + ")";
                connection.query(sqlinsert, function (error, result) {
                    if (error)
                        logger.debug("ERROR FDT : " + error);
                });
                AllDone(null, {"msg": "ok"});
            }
        });

    });
};

//FALTA CONTROLAR OBJETOS IP en INTERFACE DE TIPO <> 5
//Add new TREE FIREWALLS from cloud
fwc_treeModel.insertFwc_Tree_firewalls = function (fwcloud, folder, AllDone) {
    db.get(function (error, connection) {
        if (error)
            return done('Database problem');

        //Select Parent Node by type   
        sql = 'SELECT T1.* FROM ' + tableModel + ' T1  where T1.node_type=' + connection.escape(folder) + ' and T1.id_parent=0 AND T1.fwcloud=' + connection.escape(fwcloud) + ' order by T1.node_order';
        //logger.debug(sql);
        connection.query(sql, function (error, rows) {
            if (error) {
                AllDone(error, null);
            } else {
                //For each node Select Objects by  type
                if (rows) {
                    async.forEachSeries(rows, function (row, callback) {
                        //logger.debug(row);
                        //logger.debug("---> DENTRO de NODO: " + row.name + " - " + row.node_type);
                        var tree_node = new fwc_tree_node(row);
                        //Añadimos nodos FIREWALL del CLOUD
                        sqlnodes = 'SELECT  F.id,F.name,F.fwcloud, F.comment FROM firewall F inner join fwcloud C on C.id=F.fwcloud WHERE C.id=' + connection.escape(fwcloud);
                        //logger.debug(sqlnodes);
                        connection.query(sqlnodes, function (error, rowsnodes) {
                            if (error)
                                callback(error, null);
                            else {
                                var i = 0;
                                if (rowsnodes) {
                                    async.forEachSeries(rowsnodes, function (rnode, callback2) {
                                        var idfirewall = rnode.id;
                                        i++;
                                        //Insertamos nodos Firewall
                                        sqlinsert = 'INSERT INTO ' + tableModel +
                                                '( name, comment, id_parent, node_order,node_level, node_type, expanded, `subfolders`, id_obj,obj_type,fwcloud) ' +
                                                ' VALUES (' +
                                                connection.escape(rnode.name) + ',' +
                                                connection.escape(rnode.comment) + ',' + connection.escape(row.id) + ',' +
                                                i + ',' + (row.node_level + 1) + ',"FW",' +
                                                '0,0,' + connection.escape(rnode.id) + ',0,' +
                                                connection.escape(rnode.fwcloud) + ")";
                                        //logger.debug(sqlinsert);
                                        var parent_firewall;
                                        connection.query(sqlinsert, function (error, result) {
                                            if (error) {
                                                logger.debug("ERROR FIREWALL INSERT : " + rnode.id + " - " + rnode.name + " -> " + error);
                                            } else {
                                                logger.debug("INSERT FIREWALL OK NODE: " + rnode.id + " - " + rnode.name);
                                                parent_firewall = result.insertId;

                                                //Insertamos nodo POLICY IN
                                                sqlinsert = 'INSERT INTO ' + tableModel + '( name, comment, id_parent, node_order,node_level, node_type, expanded, subfolders, id_obj,obj_type,fwcloud) ' +
                                                        ' VALUES (' + '"Policy IN","",' + parent_firewall + ',1,' + (row.node_level + 2) + ',"PI",0,0,null,null,' + connection.escape(rnode.fwcloud) + ")";
                                                //logger.debug(sqlinsert);
                                                connection.query(sqlinsert, function (error, result) {
                                                    if (error)
                                                        logger.debug("ERROR PI : " + error);
                                                });
                                                //Insertamos nodo POLICY OUT
                                                sqlinsert = 'INSERT INTO ' + tableModel + '( name, comment, id_parent, node_order,node_level, node_type, expanded, subfolders, id_obj,obj_type,fwcloud) ' +
                                                        ' VALUES (' + '"Policy OUT","",' + parent_firewall + ',2,' + (row.node_level + 2) + ',"PO",0,0,null,null,' + connection.escape(rnode.fwcloud) + ")";
                                                connection.query(sqlinsert, function (error, result) {
                                                    if (error)
                                                        logger.debug("ERROR PO : " + error);
                                                });
                                                //Insertamos nodo POLICY FORWARD
                                                sqlinsert = 'INSERT INTO ' + tableModel + '( name, comment, id_parent, node_order,node_level, node_type, expanded, subfolders, id_obj,obj_type,fwcloud) ' +
                                                        ' VALUES (' + '"Policy FORWARD","",' + parent_firewall + ',3,' + (row.node_level + 2) + ',"PF",0,0,null,null,' + connection.escape(rnode.fwcloud) + ")";
                                                connection.query(sqlinsert, function (error, result) {
                                                    if (error)
                                                        logger.debug("ERROR PF: " + error);
                                                });
                                                //Insertamos nodo NAT
                                                sqlinsert = 'INSERT INTO ' + tableModel + '( name, comment, id_parent, node_order,node_level, node_type, expanded, subfolders, id_obj,obj_type,fwcloud) ' +
                                                        ' VALUES (' + '"NAT","",' + parent_firewall + ',4,' + (row.node_level + 2) + ',"NAT",0,0,null,null,' + connection.escape(rnode.fwcloud) + ")";
                                                connection.query(sqlinsert, function (error, result) {
                                                    if (error)
                                                        logger.debug("ERROR NAT: " + error);
                                                });
                                                //Insertamos nodo ROUTING
                                                sqlinsert = 'INSERT INTO ' + tableModel + '( name, comment, id_parent, node_order,node_level, node_type, expanded, subfolders, id_obj,obj_type,fwcloud) ' +
                                                        ' VALUES (' + '"Routing","",' + parent_firewall + ',4,' + (row.node_level + 2) + ',"RR",0,0,null,null,' + connection.escape(rnode.fwcloud) + ")";
                                                connection.query(sqlinsert, function (error, result) {
                                                    if (error)
                                                        logger.debug("ERROR RR : " + error);
                                                });

                                                var nodeInterfaces;
                                                //Insertamos nodo INTERFACES FIREWALL
                                                sqlinsert = 'INSERT INTO ' + tableModel + '( name, comment, id_parent, node_order,node_level, node_type, expanded, subfolders, id_obj,obj_type,fwcloud) ' +
                                                        ' VALUES (' + '"Interfaces","",' + parent_firewall + ',5,' + (row.node_level + 2) + ',"FDI",0,0,null,10,' + connection.escape(rnode.fwcloud) + ")";
                                                connection.query(sqlinsert, function (error, result) {
                                                    if (error)
                                                        logger.debug("ERROR FDI: " + error);
                                                    else
                                                        nodeInterfaces = result.insertId;
                                                });


                                                //Insertamos nodos hijos Interface
                                                sqlInt = 'SELECT  id,name,labelName FROM interface where interface_type=10 AND  firewall=' + connection.escape(idfirewall);
                                                connection.query(sqlInt, function (error, rowsnodesInt) {
                                                    if (error) {
                                                        logger.debug("Error Select interface");
                                                        callback2(error, null);
                                                    } else {
                                                        var j = 0;
                                                        if (rowsnodesInt) {
                                                            //logger.debug("INTERFACES: " + rowsnodesInt.length);
                                                            async.forEachSeries(rowsnodesInt, function (rnodeInt, callback3) {
                                                                j++;
                                                                //Insertamos nodos Interfaces
                                                                sqlinsert = 'INSERT INTO ' + tableModel +
                                                                        '( name, comment, id_parent, node_order,node_level, node_type, expanded, `subfolders`, id_obj,obj_type,fwcloud) ' +
                                                                        ' VALUES (' +
                                                                        connection.escape(rnodeInt.name) + ',' +
                                                                        connection.escape(rnodeInt.comment) + ',' + connection.escape(nodeInterfaces) + ',' +
                                                                        j + ',' + (row.node_level + 3) + ',"IFF",' +
                                                                        '0,0,' + connection.escape(rnodeInt.id) + ',10,' +
                                                                        connection.escape(rnode.fwcloud) + ")";

                                                                connection.query(sqlinsert, function (error, result) {
                                                                    var idinterface;
                                                                    if (error) {
                                                                        logger.debug("ERROR INTERFACE INSERT : " + rnodeInt.id + " - " + rnodeInt.name + " -> " + error);
                                                                    } else {
                                                                        //logger.debug("INSERT INTERFACE OK NODE: " + rnodeInt.id + " - " + rnodeInt.name);
                                                                        idinterface = result.insertId;
                                                                    }
                                                                    //Insertamos objetos IP de Interface
                                                                    //Insertamos nodos Interface
                                                                    sqlnodesIP = 'SELECT  O.id,O.name,O.type,O.fwcloud, O.comment, T.node_type FROM ipobj O inner join fwc_tree_node_types T on  T.obj_type=O.type where O.interface=' + connection.escape(rnodeInt.id);
                                                                    //logger.debug(sqlnodesIP);
                                                                    connection.query(sqlnodesIP, function (error, rowsnodesIP) {
                                                                        if (error) {
                                                                            logger.debug(error);
                                                                        } else {
                                                                            var k = 0;
                                                                            if (rowsnodesIP) {
                                                                                //logger.debug("OBJS IP: " + rowsnodesIP.length);
                                                                                async.forEachSeries(rowsnodesIP, function (rnodeIP, callback4) {
                                                                                    k++;
                                                                                    //Insertamos nodos IP
                                                                                    sqlinsert = 'INSERT INTO ' + tableModel +
                                                                                            '( name, comment, id_parent, node_order,node_level, node_type, expanded, `subfolders`, id_obj,obj_type,fwcloud) ' +
                                                                                            ' VALUES (' +
                                                                                            connection.escape(rnodeIP.name) + ',' +
                                                                                            connection.escape(rnodeIP.comment) + ',' + connection.escape(idinterface) + ',' +
                                                                                            k + ',' + (row.node_level + 4) + ',' + connection.escape(rnodeIP.node_type) + ',' +
                                                                                            '0,0,' + connection.escape(rnodeIP.id) + ',5,' +
                                                                                            connection.escape(rnode.fwcloud) + ")";
                                                                                    connection.query(sqlinsert, function (error, result) {
                                                                                        if (error) {
                                                                                            logger.debug("ERROR IP OBJECT INSERT : " + rnodeIP.id + " - " + rnodeIP.name + " -> " + error);
                                                                                        } else {
                                                                                            //logger.debug("INSERT IPOBJ OK NODE: " + rnodeIP.id + " - " + rnodeIP.name);
                                                                                        }
                                                                                    });
                                                                                    callback4();
                                                                                }
                                                                                );
                                                                            }

                                                                        }
                                                                    });
                                                                });
                                                                callback3();
                                                            }
                                                            );
                                                        }

                                                    }

                                                });



                                            }

                                        });
                                        callback2();
                                    }
                                    );
                                }
                            }
                        });
                        callback();
                    },
                            function (err) {
                                if (err)
                                    AllDone(err, null);
                                else
                                    AllDone(null, {"msg": "ok"});
                            });
                } else
                    AllDone(null, {"msg": "ok"});
            }
        });

    });

};


//Add new TREE OBJECTS from user
fwc_treeModel.insertFwc_Tree_objects = function (fwcloud, folder, AllDone) {
    db.get(function (error, connection) {
        if (error)
            return done('Database problem');

        //Select Parent Node by type   
        sql = 'SELECT T1.* FROM ' + tableModel + ' T1 inner join fwc_tree T2 on T1.id_parent=T2.id where T2.node_type=' + connection.escape(folder) + ' and T2.id_parent=0 AND (T1.fwcloud=' + connection.escape(fwcloud) + ' OR T1.fwcloud is null) order by T1.node_order';
        logger.debug(sql);
        connection.query(sql,
                function (error, rows) {
                    if (error) {
                        callback(error, null);
                    } else {
                        //For each node Select Objects by  type
                        if (rows) {
                            async.forEachSeries(rows,
                                    function (row, callback) {
                                        //logger.debug(row);
                                        logger.debug("---> DENTRO de NODO: " + row.name + " - Node_Type:" + row.node_type + "  Obj_type:" + row.obj_type);
                                        var tree_node = new fwc_tree_node(row);
                                        //Añadimos nodos hijos del tipo
                                        if (row.node_type === "OIG" || row.node_type === "SOG") {
                                            sqlnodes = 'SELECT  id,name,type,fwcloud, comment FROM ipobj_g  where type=' + row.obj_type + ' AND (fwcloud=' + fwcloud + ' OR fwcloud is null) ';
                                        } else
                                            sqlnodes = 'SELECT  id,name,type,fwcloud, comment FROM ipobj  where type=' + row.obj_type + ' AND interface is null' + ' AND (fwcloud=' + fwcloud + ' OR fwcloud is null) ';

                                        logger.debug(sqlnodes);
                                        connection.query(sqlnodes, function (error, rowsnodes) {
                                            if (error)
                                                callback(error, null);
                                            else {
                                                var i = 0;
                                                if (rowsnodes) {
                                                    async.forEachSeries(rowsnodes,
                                                            function (rnode, callback) {
                                                                i++;
                                                                //Insertamos nodo
                                                                sqlinsert = 'INSERT INTO ' + tableModel +
                                                                        '( name, comment, id_parent, node_order,node_level, node_type, expanded, `subfolders`, id_obj,obj_type,fwcloud) ' +
                                                                        ' VALUES (' +
                                                                        connection.escape(rnode.name) + ',' +
                                                                        connection.escape(rnode.comment) + ',' + connection.escape(row.id) + ',' +
                                                                        i + ',' + (row.node_level + 1) + ',' + connection.escape(row.node_type) + ',' +
                                                                        '0,0,' + connection.escape(rnode.id) + ',' + connection.escape(rnode.type) + ',' +
                                                                        connection.escape(rnode.fwcloud) + ")";
                                                                //logger.debug(sqlinsert);
                                                                connection.query(sqlinsert, function (error, result) {
                                                                    if (error) {
                                                                        logger.debug("ERROR INSERT : " + rnode.id + " - " + rnode.name + " Type: " + rnode.type + " --> " + error);

                                                                    } else {
                                                                        var NodeId = result.insertId;
                                                                        logger.debug("INSERT OK NODE : " + rnode.id + " - " + rnode.name + "  Type: " + rnode.type + "  fwcloud:" + rnode.fwcloud);
                                                                        //INSERT OBJECTS FROM GROUPS
                                                                        if (row.node_type === "OIG" || row.node_type === "SOG") {
                                                                            sqlinsert = 'INSERT INTO ' + tableModel +
                                                                                    '( name, comment, id_parent, node_order,node_level, node_type, expanded, `subfolders`, id_obj,obj_type,fwcloud) ' +
                                                                                    ' SELECT O.name, O.comment,' + connection.escape(NodeId) + ',1,' + (row.node_level + 2) + ',' +
                                                                                    ' T.node_type,0,0,O.id, O.type, O.fwcloud ' +
                                                                                    ' FROM fwcloud_db.ipobj O ' +
                                                                                    ' INNER JOIN ipobj__ipobjg G on O.id=G.ipobj ' +
                                                                                    ' inner join fwc_tree_node_types T on T.obj_type=O.type ' +
                                                                                    ' WHERE G.ipobj_g=' + rnode.id;
                                                                            //logger.debug(sqlinsert);
                                                                            connection.query(sqlinsert, function (error, result) {
                                                                                if (error) {
                                                                                    logger.debug("ERROR INSERT GROUP OBJECTS: " + rnode.id + " - " + rnode.name + " Type: " + rnode.type + " --> " + error);
                                                                                } else {
                                                                                    //logger.debug("INSERT OK GROUP CHILD NODE Objects: " + result.affectedRows);
                                                                                }
                                                                            });
                                                                        }
                                                                        //INSERT INTERFACES FROM  HOST
                                                                        else if (row.node_type === "OIH") {
                                                                            sqlnodes = 'SELECT  O.id,O.name,O.interface_type, O.comment, T.node_type FROM interface O ' +
                                                                                    ' inner join interface__ipobj F on F.interface=O.id ' +
                                                                                    ' inner join fwc_tree_node_types T on T.obj_type=O.interface_type ' +
                                                                                    ' WHERE F.ipobj=' + rnode.id;
                                                                            connection.query(sqlnodes, function (error, rowsnodesObj) {
                                                                                if (error)
                                                                                    logger.debug(error);
                                                                                else {
                                                                                    var j = 0;
                                                                                    async.forEachSeries(rowsnodesObj,
                                                                                            function (rnodeObj, callback2) {
                                                                                                j++;

                                                                                                sqlinsert = 'INSERT INTO ' + tableModel +
                                                                                                        '( name, comment, id_parent, node_order,node_level, node_type, expanded, `subfolders`, id_obj,obj_type,fwcloud) ' +
                                                                                                        ' SELECT O.name, O.comment,' + connection.escape(NodeId) + ',1,' + (row.node_level + 2) + ',' +
                                                                                                        ' T.node_type,0,0,O.id, O.interface_type, ' + rnode.fwcloud +
                                                                                                        ' FROM fwcloud_db.interface O ' +
                                                                                                        ' inner join interface__ipobj F on F.interface=O.id ' +
                                                                                                        ' inner join fwc_tree_node_types T on T.obj_type=O.interface_type ' +
                                                                                                        ' WHERE F.ipobj=' + rnode.id + ' AND O.id=' + rnodeObj.id;
                                                                                                //logger.debug(sqlinsert);
                                                                                                connection.query(sqlinsert, function (error, result) {
                                                                                                    if (error) {
                                                                                                        logger.debug("ERROR INSERT HOST INTERFACES: " + rnode.id + " - " + rnode.name + " Type: " + rnode.type + " --> " + error);
                                                                                                    } else {
                                                                                                        idNodeinterface = result.insertId;
                                                                                                        //logger.debug("INSERT OK CHILD NODE HOST: " + rnode.id + " - " + rnode.name + "  INTERFACE:" + rnodeObj.id + " - " + rnodeObj.name);
                                                                                                        sqlinsertObj = 'INSERT INTO ' + tableModel +
                                                                                                                '(name, comment, id_parent, node_order,node_level, node_type, expanded, `subfolders`, id_obj,obj_type,fwcloud) ' +
                                                                                                                ' SELECT O.name, O.comment,' + connection.escape(idNodeinterface) + ',1,' + (row.node_level + 3) + ',' +
                                                                                                                ' T.node_type,0,0,O.id, O.type,O.fwcloud ' +
                                                                                                                ' FROM fwcloud_db.ipobj O ' +
                                                                                                                ' inner join fwc_tree_node_types T on T.obj_type=O.type ' +
                                                                                                                ' WHERE  O.interface=' + rnodeObj.id;
                                                                                                        //logger.debug(sqlinsertObj);
                                                                                                        connection.query(sqlinsertObj, function (error, result) {
                                                                                                            if (error) {
                                                                                                                logger.debug("ERROR INSERT HOST INTERFACES: " + rnode.id + " - " + rnode.name + " Type: " + rnode.type + " --> " + error);
                                                                                                            } else {
                                                                                                                //logger.debug("INSERT OK CHILD  OBJ NODE HOST INTERFACE:" + rnodeObj.id + " - " + rnodeObj.name);

                                                                                                            }
                                                                                                        });


                                                                                                    }
                                                                                                });
                                                                                                callback2();
                                                                                            });
                                                                                }
                                                                            });
                                                                        }

                                                                    }
                                                                });
                                                                callback();
                                                            }

                                                    );
                                                }
                                            }
                                        });


                                        callback();
                                    },
                                    function (err) {
                                        if (err)
                                            AllDone(err, null);
                                        else
                                            AllDone(null, {"msg": "ok"});
                                    });
                        } else
                            AllDone(null, {"msg": "ok"});
                    }
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

//Add new NODE from IPOBJ or Interface
fwc_treeModel.insertFwc_TreeOBJ = function (id_user,fwcloud, node_parent, node_order, node_type, node_Data, callback) {

    var fwc_treeData = {
        id: null,
        name: node_Data.name,
        id_parent: node_parent,
        node_order: node_order,
        node_icon: null,
        expanded: 0,
        node_type: node_type,
        api_call: null,
        obj_type: node_Data.type,
        id_obj: node_Data.id,
        node_level: 0,
        fwcloud: fwcloud,
        comment: node_Data.comment
    };

    db.get(function (error, connection) {
        if (error)
            return done('Database problem');
        connection.query('INSERT INTO ' + tableModel + ' SET ?', fwc_treeData, function (error, result) {
            if (error) {
                callback(error, null);
            } else {
                if (result.affectedRows > 0) {
                    logger.debug("Insertado nuevo NODO id:" + result.insertId);
                    //devolvemos la última id insertada
                    callback(null, {"insertId": result.insertId});
                } else
                    callback(null, {"insertId": 0});
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
                ' name = ' + connection.escape(nodeTreeData.name) + ' ' +
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

//Update NODE from IPOBJ or INTERFACE UPDATE
fwc_treeModel.updateFwc_Tree_OBJ = function (fwcloud, ipobjData, callback) {


    db.get(function (error, connection) {
        if (error)
            return done('Database problem');
        var sql = 'UPDATE ' + tableModel + ' SET ' +
                ' name = ' + connection.escape(ipobjData.name) + ' , comment= ' + connection.escape(ipobjData.comment) +
                ' WHERE id_obj = ' + connection.escape(ipobjData.id) + ' AND obj_type=' + connection.escape(ipobjData.type) + ' AND fwcloud=' + connection.escape(fwcloud);
        logger.debug(sql);
        connection.query(sql, function (error, result) {
            if (error) {
                callback(error, null);
            } else {
                if (result.affectedRows > 0)
                    callback(null, {"msg": "success"});
                else
                    callback(null, {"msg": "nothing"});
            }
        });
    });
};


//FALTA BORRADO EN CASCADA
//Remove NODE with id to remove
fwc_treeModel.deleteFwc_Tree = function (iduser, fwcloud, id, type, callback) {
    db.get(function (error, connection) {
        if (error)
            return done('Database problem');
        var sqlExists = 'SELECT * FROM ' + tableModel + '  WHERE fwcloud = ' + connection.escape(fwcloud) + ' AND id = ' + connection.escape(id) + ' AND obj_type=' + connection.escape(type);
        connection.query(sqlExists, function (error, row) {
            //If exists Id from ipobj to remove
            if (row) {
                db.get(function (error, connection) {
                    var sql = 'DELETE FROM ' + tableModel + ' WHERE fwcloud = ' + connection.escape(fwcloud) + ' AND id_obj = ' + connection.escape(id) + ' AND obj_type=' + connection.escape(type);
                    logger.debug(sql);
                    connection.query(sql, function (error, result) {
                        if (error) {
                            callback(error, null);
                        } else {
                            if (result.affectedRows > 0)
                                callback(null, {"msg": "deleted"});
                            else
                                callback(null, {"msg": "nothing"});
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