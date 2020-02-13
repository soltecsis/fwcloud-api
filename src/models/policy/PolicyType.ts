/*
    Copyright 2019 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
    https://soltecsis.com
    info@soltecsis.com


    This file is part of FWCloud (https://fwcloud.net).

    FWCloud is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    FWCloud is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with FWCloud.  If not, see <https://www.gnu.org/licenses/>.
*/

import Model from "../Model";
import db from '../../database/DatabaseService';
import { PrimaryColumn, Column, Entity } from "typeorm";
import modelEventService from "../ModelEventService";
var logger = require('log4js').getLogger("app");

const tableName: string = 'policy_type';

@Entity(tableName)
export class PolicyType extends Model {
    
    @PrimaryColumn()
    id: number;

    @Column()
    type: string;

    @Column()
    type_order: string;

    @Column()
    show_action: number;

    public getTableName(): string {
        return tableName;
    }

    //Get All policy_type
    public static getPolicy_types(callback) {
        db.get((error, connection) => {
            if (error) callback(error, null);
            connection.query('SELECT * FROM ' + tableName + ' ORDER BY type_order', (error, rows) => {
                if (error)
                    callback(error, null);
                else
                    callback(null, rows);
            });
        });
    }





    //Get policy_type by  type
    public static getPolicy_type(id, callback) {
        db.get((error, connection) => {
            if (error) callback(error, null);
            var sql = 'SELECT * FROM ' + tableName + ' WHERE id = ' + connection.escape(id);
            connection.query(sql, (error, row) => {
                if (error)
                    callback(error, null);
                else{                
                    callback(null, row);
                }
            });
        });
    }

    //Get policy_type by  type Letter
    public static getPolicy_typeL(id, callback) {
        db.get((error, connection) => {
            if (error) callback(error, null);
            var sql = 'SELECT * FROM ' + tableName + ' WHERE type = ' + connection.escape(id);
            connection.query(sql, (error, row) => {
                if (error)
                    callback(error, null);
                else{                
                    callback(null, row);
                }
            });
        });
    }

    //Get policy_type by name
    public static getPolicy_typeName(name, callback) {
        db.get((error, connection) => {
            if (error) callback(error, null);
            var namesql = '%' + name + '%';
            var sql = 'SELECT * FROM ' + tableName + ' WHERE name like  ' + connection.escape(namesql) + ' ORDER BY type_order' ;
            connection.query(sql, (error, row) => {
                if (error)
                    callback(error, null);
                else
                    callback(null, row);
            });
        });
    }



    //Add new policy_type
    public static insertPolicy_type(policy_typeData, callback) {
        db.get((error, connection) => {
            if (error) callback(error, null);
            connection.query('INSERT INTO ' + tableName + ' SET ?', policy_typeData, (error, result) => {
                if (error) {
                    callback(error, null);
                }
                else {
                    //devolvemos la última id insertada
                    callback(null, { "insertId": result.insertId });
                }
            });
        });
    }

    //Update policy_type
    public static updatePolicy_type(policy_typeData, callback) {

        db.get((error, connection) => {
            if (error) callback(error, null);
            var sql = 'UPDATE ' + tableName + ' SET name = ' + connection.escape(policy_typeData.name) + ', ' +            
                    ' SET type = ' + connection.escape(policy_typeData.type) + ', ' +            
                    ' SET id = ' + connection.escape(policy_typeData.id) + ' ' +            
                ' WHERE type = ' + policy_typeData.type;
                logger.debug(sql);
            connection.query(sql, (error, result) => {
                if (error) {
                    callback(error, null);
                }
                else {
                    callback(null, { "result": true });
                }
            });
        });
    }

    //Remove policy_type with type to remove
    public static deletePolicy_type(type, callback) {
        db.get((error, connection) => {
            if (error) callback(error, null);
            var sqlExists = 'SELECT * FROM ' + tableName + ' WHERE type = ' + connection.escape(type);
            connection.query(sqlExists, (error, row) => {
                //If exists Id from policy_type to remove
                if (row) {
                    db.get((error, connection) => {
                        var sql = 'DELETE FROM ' + tableName + ' WHERE type = ' + connection.escape(type);
                        connection.query(sql, (error, result) => {
                            if (error) {
                                callback(error, null);
                            }
                            else {
                                callback(null, { "result": true });
                            }
                        });
                    });
                }
                else {
                    callback(null, { "result": false });
                }
            });
        });
    }
}