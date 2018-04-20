var db = require('../../db.js');

/**
 * Module to manage Fwcloud data
 *
 * @module Fwcloud
 * 
 * @requires db
 * 
 */

/**
 * Class to manage fwclouds data
 *
 * @class FwcloudModel
 * @uses db
 * 
 */
var fwcloudModel = {};



//Export the object
module.exports = fwcloudModel;


/**
 * Property Table
 *
 * @property tableModel
 * @type "fwcloud"
 * @private
 * 
 */
var tableModel = "fwcloud";



var logger = require('log4js').getLogger("app");


/**
 * Get Fwcloud by User
 *  
 * @method getFwcloud
 * 
 * @param {Integer} iduser User identifier
 * @param {Function} callback    Function callback response
 * 
 *       callback(error, Rows)
 * 
 * @return {ARRAY of Fwcloud objects} Returns `ARRAY OBJECT FWCLOUD DATA` 
 * 
 * Table: __fwcloud__
 * 
 *           id	int(11) AI PK
 *           cluster	int(11)
 *           fwcloud	int(11)
 *           name	varchar(255)
 *           comment	longtext
 *           created_at	datetime
 *           updated_at	datetime
 *           by_user	int(11)
 *           id_fwb	varchar(45)
 */
fwcloudModel.getFwclouds = function (iduser, callback) {

    db.get(function (error, connection) {
        if (error)
            callback(error, null);
        var sql = 'SELECT distinctrow C.* FROM ' + tableModel + ' C  ' +
                ' INNER JOIN user__cloud U ON C.id=U.fwcloud ' +
                ' WHERE U.id_user=' + connection.escape(iduser) + ' AND U.allow_access=1 ORDER BY C.id';
        logger.debug(sql);
        connection.query(sql, function (error, rows) {
            if (error)
                callback(error, null);
            else
                callback(null, rows);
        });
    });
};



/**
 * Get Fwcloud by User and ID
 *  
 * @method getFwcloud
 * 
 * @param {Integer} iduser User identifier
 * @param {Integer} id fwcloud identifier
 * @param {Function} callback    Function callback response
 * 
 *       callback(error, Rows)
 * 
 * @return {Fwcloud object} Returns `OBJECT FWCLOUD DATA` 
 * 
 * Table: __fwcloud__
 * 
 *           id	int(11) AI PK
 *           cluster	int(11)
 *           fwcloud	int(11)
 *           name	varchar(255)
 *           comment	longtext
 *           created_at	datetime
 *           updated_at	datetime
 *           by_user	int(11)
 *           id_fwb	varchar(45)
 */
fwcloudModel.getFwcloud = function (iduser, fwcloud, callback) {
    db.get(function (error, connection) {
        if (error)
            callback(error, null);

        var sql = 'SELECT distinctrow C.* FROM ' + tableModel + ' C  ' +
                ' INNER JOIN user__cloud U ON C.id=U.fwcloud ' +
                ' WHERE U.id_user=' + connection.escape(iduser) + ' AND U.allow_access=1 AND C.id=' + connection.escape(fwcloud);
        connection.query(sql, function (error, row) {
            if (error)
                callback(error, null);
            else
                callback(null, row);
        });
    });
};

/**
 * Get Fwcloud Access by Locked 
 *  
 * @method getFwcloudLockedAccess
 * 
 * @param {Integer} iduser User identifier
 * @param {Integer} fwcloud fwcloud identifier 
 * @param {Function} callback    Function callback response
 * 
 *       callback(error, Rows)
 * 
 * @return {Boolean} Returns `LOCKED STATUS` 
 * 
 */
fwcloudModel.getFwcloudAccess = function (iduser, fwcloud) {
    return new Promise((resolve, reject) => {
        db.get(function (error, connection) {
            if (error)
                reject(false);
            var sql = 'SELECT distinctrow C.* FROM ' + tableModel + ' C  ' +
                    ' INNER JOIN user__cloud U ON C.id=U.fwcloud ' +
                    ' WHERE U.id_user=' + connection.escape(iduser) + ' AND U.allow_access=1 AND C.id=' + connection.escape(fwcloud);
            connection.query(sql, function (error, row) {
                if (error)
                    reject(false);
                else if (row && row.length > 0) {
                    //logger.debug(row[0]);
                    logger.debug("IDUSER: " + iduser);
                    if (row[0].locked === 1 && Number(row[0].locked_by) === Number(iduser))
                    {
                        //Access OK, LOCKED by USER
                        resolve({"access": true, "locked": true, "mylock": true, "locked_at": row[0].locked_at, "locked_by": row[0].locked_by});
                    } else if (row[0].locked === 1 && Number(row[0].locked_by) !== Number(iduser))
                    {
                        //Access OK, LOCKED by OTHER USER
                        resolve({"access": true, "locked": true, "mylock": false, "locked_at": row[0].locked_at, "locked_by": row[0].locked_by});
                    } else if (row[0].locked === 0)
                    {
                        //Access OK, NOT LOCKED
                        resolve({"access": true, "locked": false, "mylock": false, "locked_at": "", "locked_by": ""});
                    }
                } else {
                    //Access ERROR, NOT LOCKED
                    resolve({"access": false, "locked": "", "mylock": false, "locked_at": "", "locked_by": ""});
                }
            });
        });
    });
};

/**
 * Check Fwcloud locked timeout
 *  
 * @method getFwcloudLockedTimeout
 * 
 * @param {Function} callback    Function callback response
 * 
 *       callback(error, Rows)
 * 
 * @return {Boolean} Returns `RESULT UNLOCKED` 
 * 
 */
fwcloudModel.checkFwcloudLockTimeout = function (timeout, callback) {
    return new Promise((resolve, reject) => {
        db.get(function (error, connection) {
            if (error)
                reject(false);
            var sql = 'select TIMESTAMPDIFF(MINUTE, updated_at, NOW()) as dif,  C.* from ' + tableModel + ' C WHERE C.locked=1 HAVING dif>' + timeout;
            connection.query(sql, function (error, rows) {
                if (error)
                    reject(false);
                else if (rows && rows.length > 0) {
                    //UNLOCK ALL
                    for (var i = 0; i < rows.length; i++) {
                        var row = rows[i];
                        var sqlupdate = 'UPDATE ' + tableModel + ' SET locked = 0  WHERE id = ' + row.id;
                        connection.query(sqlupdate, function (error, result) {
                            logger.info("-----> UNLOCK FWCLOUD: " + row.id + " BY TIMEOT INACTIVITY of " + row.dif + "  Min LAST UPDATE: " + row.updated_at +
                                    "  LAST LOCK: " + row.locked_at + "  BY: " + row.locked_by);
                        });
                    }
                    resolve(true);
                } else {
                    reject(false);
                }
            });
        });
    });
};

/**
 * Get Fwcloud by User and Name
 *  
 * @method getFwcloudName
 * 
 * @param {Integer} iduser User identifier
 * @param {String} Name Fwcloud Name
 * @param {Function} callback    Function callback response
 * 
 *       callback(error, Rows)
 * 
 * @return {ARRAY of Fwcloud objects} Returns `ARRAY OBJECT FWCLOUD DATA` 
 * 
 * Table: __fwcloud__
 * 
 *           fwcloud	int(11)
 *           name	varchar(255)
 */
fwcloudModel.getFwcloudName = function (iduser, name, callback) {
    db.get(function (error, connection) {
        if (error)
            callback(error, null);
        var namesql = '%' + name + '%';
        var sql = 'SELECT distinctrow C.* FROM ' + tableModel + ' C  ' +
                ' INNER JOIN user__cloud U ON C.id=U.fwcloud ' +
                ' WHERE U.id_user=' + connection.escape(iduser) + ' AND U.allow_access=1  AND C.name like ' + connection.escape(namesql);


        connection.query(sql, function (error, row) {
            if (error)
                callback(error, null);
            else
                callback(null, row);
        });
    });
};


/**
 * ADD New Fwcloud
 *  
 * @method insertFwcloud
 * 
 * @param iduser {Integer}  User identifier
 * @param fwcloudData {Fwcloud Object}  Fwcloud Object data
 *       @param fwcloudData.id {NULL} 
 *       @param fwcloudData.name {string} Fwcloud Name
 * @param {Function} callback    Function callback response
 * 
 *       callback(error, Rows)
 * 
 * @return {CALLBACK RESPONSE}
 * 
 * @example
 * #### RESPONSE OK:
 *    
 *       callback(null, {"insertId": fwid});
 *       
 * #### RESPONSE ERROR:
 *    
 *       callback(error, null);
 *       
 */
fwcloudModel.insertFwcloud = function (iduser, fwcloudData, callback) {
    db.get(function (error, connection) {
        if (error)
            callback(error, null);
        connection.query('INSERT INTO ' + tableModel + ' SET ?', fwcloudData, function (error, result) {
            if (error) {
                logger.debug("FWCLOUD ERROR: ", error);
                callback(error, null);
            } else {
                var fwid = result.insertId;
                sqlinsert='INSERT INTO  user__cloud  SET fwcloud=' + connection.escape(fwid) + ' , id_user=' + connection.escape(iduser) + ' , allow_access=1, allow_edit=1';
                connection.query(sqlinsert, function (error, result) {
                    if (error) {
                        logger.debug("SQL ERROR USER INSERT: ", error,"\n", sqlinsert);
                        callback(error, null);
                    } else {
                        callback(null, {"insertId": fwid});
                    }
                });
            }
        });
    });
};

/**
 * UPDATE Fwcloud
 *  
 * @method updateFwcloud
 * 
 * @param iduser {Integer}  User identifier
 * @param fwcloudData {Fwcloud Object}  Fwcloud Object data
 *       @param fwcloudData.id {NULL} 
 *       @param fwcloudData.name {string} Fwcloud Name
 * @param {Function} callback    Function callback response
 * 
 *       callback(error, Rows)
 * 
 * @return {CALLBACK RESPONSE}
 * 
 * @example
 * #### RESPONSE OK:
 *    
 *       callback(null, {"result": true});
 *       
 * #### RESPONSE ERROR:
 *    
 *       callback(error, null);
 *       
 */
fwcloudModel.updateFwcloud = function (fwcloudData, callback) {

    db.get(function (error, connection) {
        if (error)
            callback(error, null);
        var sql = 'UPDATE ' + tableModel + ' SET name = ' + connection.escape(fwcloudData.name)  +
                ' ,comment = ' + connection.escape(fwcloudData.comment)  +
                ' ,image = ' + connection.escape(fwcloudData.image)  +
                ' WHERE id = ' + fwcloudData.id;
        logger.debug(sql);
        connection.query(sql, function (error, result) {
            if (error) {
                callback(error, null);
            } else {
                callback(null, {"result": true});
            }
        });
    });
};

/**
 * UPDATE Fwcloud lock status
 *  
 * @method updateFwcloudLock
 * 
 * @param iduser {Integer}  User identifier
 * @param fwcloudData {Fwcloud Object}  Fwcloud Object data
 *       @param fwcloudData.id {NULL} 
 *       @param fwcloudData.fwcloud {Integer} FWcloud ID
 *       @param fwcloudData.locked {Integer} Locked status
 * @param {Function} callback    Function callback response
 * 
 *       callback(error, Rows)
 * 
 * @return {CALLBACK RESPONSE}
 * 
 * @example
 * #### RESPONSE OK:
 *    
 *       callback(null, {"result": true});
 *       
 * #### RESPONSE ERROR:
 *    
 *       callback(error, null);
 *       
 */
fwcloudModel.updateFwcloudLock = function (fwcloudData) {
    return new Promise((resolve, reject) => {
        var locked = 1;
        db.get(function (error, connection) {
            db.lockTable(connection, "fwcloud", " WHERE id=" + fwcloudData.fwcloud, function () {
                db.startTX(connection, function () {
                    if (error)
                        reject(error);
                    //Check if FWCloud is unlocked or locked by the same user
                    var sqlExists = 'SELECT id FROM ' + tableModel + '  ' +
                            ' WHERE id = ' + connection.escape(fwcloudData.fwcloud) +
                            ' AND (locked=0 OR (locked=1 AND locked_by=' + connection.escape(fwcloudData.iduser) + ')) ';

                    connection.query(sqlExists, function (error, row) {
                        if (row && row.length > 0) {
                            //Check if there are Firewalls in FWCloud with Access and Edit permissions
                            //var sqlExists = 'SELECT F.id FROM firewall F inner join ' + tableModel + ' C ON C.id=F.fwcloud ' +
                            //        ' INNER JOIN user__firewall U on U.id_firewall=F.id AND U.id_user=' + connection.escape(fwcloudData.iduser) +
                            //        ' WHERE C.id = ' + connection.escape(fwcloudData.fwcloud) +
                            //        ' AND U.allow_access=1 AND U.allow_edit=1 ';
                            //        
                            //Check if there are FWCloud with Access and Edit permissions
                            var sqlExists = 'SELECT C.id FROM ' + tableModel  + ' C ' +
                                    ' INNER JOIN user__cloud U on U.fwcloud=C.id AND U.id_user=' + connection.escape(fwcloudData.iduser) +
                                    ' WHERE C.id = ' + connection.escape(fwcloudData.fwcloud) +
                                    ' AND U.allow_access=1 AND U.allow_edit=1 ';
                            logger.debug(sqlExists);
                            connection.query(sqlExists, function (error, row) {
                                if (row && row.length > 0) {

                                    var sql = 'UPDATE ' + tableModel + ' SET locked = ' + connection.escape(locked) + ',' +
                                            'locked_at = CURRENT_TIMESTAMP ,' +
                                            'locked_by = ' + connection.escape(fwcloudData.iduser) + ' ' +
                                            ' WHERE id = ' + fwcloudData.fwcloud;
                                    logger.debug(sql);
                                    connection.query(sql, function (error, result) {
                                        if (error) {
                                            reject(error);
                                        } else {
                                            db.endTX(connection, function () {});
                                            resolve({"result": true});
                                        }
                                    });
                                } else {
                                    db.endTX(connection, function () {});
                                    resolve({"result": false});
                                }
                            });
                        } else {
                            db.endTX(connection, function () {});
                            resolve({"result": false});
                        }
                    });
                });
            });
        });
    });
};

/**
 * UNLOCK Fwcloud status
 *  
 * @method updateFwcloudUnlock
 * 
 * @param iduser {Integer}  User identifier
 * @param fwcloudData {Fwcloud Object}  Fwcloud Object data
 *       @param fwcloudData.id {NULL} 
 *       @param fwcloudData.fwcloud {Integer} FWcloud ID
 *       @param fwcloudData.locked {Integer} Locked status
 * @param {Function} callback    Function callback response
 * 
 *       callback(error, Rows)
 * 
 * @return {CALLBACK RESPONSE}
 * 
 * @example
 * #### RESPONSE OK:
 *    
 *       callback(null, {"result": true});
 *       
 * #### RESPONSE ERROR:
 *    
 *       callback(error, null);
 *       
 */
fwcloudModel.updateFwcloudUnlock = function (fwcloudData, callback) {
    return new Promise((resolve, reject) => {
        var locked = 0;
        db.get(function (error, connection) {
            if (error)
                reject(error);
            var sqlExists = 'SELECT id FROM ' + tableModel + '  ' +
                    ' WHERE id = ' + connection.escape(fwcloudData.id) +
                    ' AND (locked=1 AND locked_by=' + connection.escape(fwcloudData.iduser) + ') ';
            connection.query(sqlExists, function (error, row) {
                //If exists Id from fwcloud to remove
                if (row && row.length > 0) {
                    var sql = 'UPDATE ' + tableModel + ' SET locked = ' + connection.escape(locked) + ',' +
                            'locked_at = CURRENT_TIMESTAMP ,' +
                            'locked_by = ' + connection.escape(fwcloudData.iduser) + ' ' +
                            ' WHERE id = ' + fwcloudData.id;

                    connection.query(sql, function (error, result) {
                        if (error) {
                            reject(error);
                        } else {
                            resolve({"result": true});
                        }
                    });
                } else {
                    resolve({"result": false});
                }
            });
        });
    });
};

/**
 * DELETE Fwcloud
 *  
 * @method deleteFwcloud
 * 
 * @param iduser {Integer}  User identifier
 * @param id {Integer}  Fwcloud identifier
 * @param {Function} callback    Function callback response
 * 
 *       callback(error, Rows)
 * 
 * @return {CALLBACK RESPONSE}
 * 
 * @example
 * #### RESPONSE OK:
 *    
 *       callback(null, {"result": true, "msg": "deleted"});
 *       
 * #### RESPONSE ERROR:
 *    
 *       callback(null, {"result": false});
 *       
 */

//FALTA BORADO EN CASCADA DE TODO: IPOBJS, FIREWALL, INTERFACES, REGLAS
fwcloudModel.deleteFwcloud = function (iduser, id, callback) {
    db.get(function (error, connection) {
        if (error)
            callback(error, null);
        var sqlExists = 'SELECT T.* FROM ' + tableModel + 
                ' INNER JOIN user__cloud U ON C.id=U.fwcloud ' +
                ' WHERE U.id_user=' + connection.escape(iduser) + ' AND U.allow_access=1  AND C.id= ' + connection.escape(id);
        connection.query(sqlExists, function (error, row) {
            //If exists Id from fwcloud to remove
            if (row) {
                //DELETE FIREWALLS
                
                //DELETE OBJECTS
                
                db.get(function (error, connection) {                    
                    var sql = 'DELETE FROM user_cloud WHERE fwcloud = ' + connection.escape(id) ;
                    connection.query(sql, function (error, result) {
                        if (error) {
                            callback(error, null);
                        } else {
                            var sql = 'DELETE FROM ' + tableModel + ' WHERE id = ' + connection.escape(id);
                            connection.query(sql, function (error, result) {
                                if (error) {
                                    callback(error, null);
                                } else {
                                    callback(null, {"result": true, "msg": "deleted"});
                                }
                            });
                        }
                    });
                });
            } else {
                callback(null, {"result": false});
            }
        });
    });
};

fwcloudModel.EmptyFwcloudStandard = function (fwcloud) {
    return new Promise((resolve, reject) => {
        var sqlcloud = "  is null";
        if (fwcloud !== null)
            sqlcloud = "= " + fwcloud;

        db.get(function (error, connection) {
            if (error)
                reject(error);
            connection.query("SET FOREIGN_KEY_CHECKS = 0", function (error, result) {
                if (error) {
                    reject(error);
                } else {
                    connection.query("DELETE I.* from  interface I inner join interface__ipobj II on II.interface=I.id inner join ipobj G On  G.id=II.ipobj where G.fwcloud" + sqlcloud, function (error, result) {
                        if (error) {
                            reject(error);
                        } else {
                            connection.query("DELETE II.* from  interface__ipobj II inner join ipobj G On  G.id=II.ipobj where G.fwcloud" + sqlcloud, function (error, result) {
                                if (error) {
                                    reject(error);
                                } else {
                                    connection.query("DELETE II.* from  ipobj__ipobjg II inner join ipobj G On  G.id=II.ipobj where G.fwcloud" + sqlcloud, function (error, result) {
                                        if (error) {
                                            reject(error);
                                        } else {
                                            connection.query("DELETE  FROM ipobj_g where fwcloud" + sqlcloud, function (error, result) {
                                                if (error) {
                                                    reject(error);
                                                } else {
                                                    connection.query("DELETE  FROM ipobj where fwcloud" + sqlcloud, function (error, result) {
                                                        if (error) {
                                                            reject(error);
                                                        } else {
                                                            connection.query("DELETE  FROM ipobj where fwcloud" + sqlcloud, function (error, result) {
                                                                if (error) {
                                                                    reject(error);
                                                                } else {
                                                                    connection.query("SET FOREIGN_KEY_CHECKS = 1", function (error, result) {
                                                                        if (error) {
                                                                            reject(error);
                                                                        } else {
                                                                            resolve({"result": true});
                                                                        }
                                                                    });
                                                                }
                                                            });
                                                        }
                                                    });
                                                }
                                            });
                                        }
                                    });
                                }
                            });
                        }
                    });
                }
            });

        });
    });
};

