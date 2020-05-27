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
import db from '../../database/database-manager';
import modelEventService from "../ModelEventService";
import { Entity, PrimaryColumn, ManyToOne, JoinColumn } from "typeorm";
import { IPObjType } from "./IPObjType";
import { PolicyPosition } from "../policy/PolicyPosition";
import { logger } from "../../fonaments/abstract-application";

const tableName: string = 'ipobj_type__policy_position';

@Entity(tableName)
export class IPObjTypeToPolicyPosition extends Model {

    @PrimaryColumn({name: 'type'})
    ipObjTypeId: number;

    @ManyToOne(type => IPObjType, model => model.ipObjTypeToPolicyPositions)
    @JoinColumn({
        name: 'type'
    })
    ipObjType: IPObjType;


    @PrimaryColumn({name: 'position'})
    policyPositionId: number;

    @ManyToOne(type => PolicyPosition, model => model.ipObjTypeToPolicyPositions)
    @JoinColumn({
        name: 'position'
    })
    policyPosition: PolicyPosition;

    public getTableName(): string {
        return tableName;
    }

    //Get All ipobj_type__policy_position
    public static getIpobj_type__policy_positions = callback => {
        db.get((error, connection) => {
            if (error) return callback(error, null);
            connection.query(`SELECT type,position FROM ${tableName} ORDER BY type,position`, (error, rows) => {
                if (error)
                    callback(error, null);
                else
                    callback(null, rows);
            });
        });
    }





    //Get ipobj_type__policy_position by  id
    public static getIpobj_type__policy_position(type, position, callback) {
        db.get((error, connection) => {
            if (error) callback(error, null);
            var sql = 'SELECT type, position, allowed FROM ' + tableName + ' WHERE type = ' + connection.escape(type) + 'AND  position = ' + connection.escape(position);
            logger().debug(sql);
            connection.query(sql, (error, row) => {
                if (error)
                    callback(error, null);
                else
                    callback(null, row);
            });
        });
    }


    //Add new ipobj_type__policy_position
    public static insertIpobj_type__policy_position(ipobj_type__policy_positionData, callback) {
        db.get((error, connection) => {
            if (error) callback(error, null);
            connection.query('INSERT INTO ' + tableName + ' SET ?', ipobj_type__policy_positionData, (error, result) => {
                if (error) {
                    callback(error, null);
                }
                else {
                    //devolvemos la última id insertada
                    callback(null, { "insertId": 'success' });
                }
            });
        });
    }

    //Update ipobj_type__policy_position
    public static updateIpobj_type__policy_position(ipobj_type__policy_positionData, callback) {

        db.get((error, connection) => {
            if (error) callback(error, null);
            var sql = 'UPDATE ' + tableName + ' SET type = ' + connection.escape(ipobj_type__policy_positionData.type) + ' ' +
                ' WHERE type = ' + connection.escape(ipobj_type__policy_positionData.type) + ' position = ' + connection.escape(ipobj_type__policy_positionData.position);
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

    //Remove ipobj_type__policy_position with id to remove
    public static deleteIpobj_type__policy_position(type, position, callback) {
        db.get((error, connection) => {
            if (error) callback(error, null);
            var sqlExists = 'SELECT * FROM ' + tableName + ' WHERE type = ' + connection.escape(type) + ' position = ' + connection.escape(position);
            connection.query(sqlExists, (error, row) => {
                //If exists Id from ipobj_type__policy_position to remove
                if (row) {
                    db.get((error, connection) => {
                        var sql = 'DELETE FROM ' + tableName + ' WHERE type = ' + connection.escape(type) + ' position = ' + connection.escape(position);
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