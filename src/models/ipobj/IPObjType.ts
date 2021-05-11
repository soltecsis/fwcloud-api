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
import { PrimaryColumn, Column, Entity, OneToMany, JoinTable, ManyToMany } from "typeorm";
import { FwcTree } from "../tree/fwc-tree.model";
import { IPObj } from "./IPObj";
import { PolicyPosition } from "../policy/PolicyPosition";
import { IPObjTypeToPolicyPosition } from "./IPObjTypeToPolicyPosition";

const tableName: string = 'ipobj_type';

@Entity(tableName)
export class IPObjType extends Model {
    
    @PrimaryColumn()
    id: number;

    @Column()
    type: string;

    @Column()
    protocol_number: number;

    @OneToMany(type => FwcTree, fwcTree => fwcTree.ipObjType)
    fwcTrees: Array<FwcTree>;

    @OneToMany(type => IPObj, ipObj => ipObj.ipObjType)
    ipObjs: Array<IPObj>;

    @ManyToMany(type => PolicyPosition, policyPosition => policyPosition.ipObjTypes)
    @JoinTable({
        name: 'ipobj_type__policy_position',
        joinColumn: {
            name: 'type'
        },
        inverseJoinColumn: {
            name: 'position'
        }
    })
    policyPositions: Array<PolicyPosition>;

    @OneToMany(type => IPObjTypeToPolicyPosition, model => model.ipObjType)
    ipObjTypeToPolicyPositions!: Array<IPObjTypeToPolicyPosition>;

    public getTableName(): string {
        return tableName;
    }

    //Get All ipobj_type
    public static getIpobj_types(callback) {

        db.get((error, connection) => {
            if (error) callback(error, null);
            connection.query('SELECT * FROM ' + tableName + ' ORDER BY id', (error, rows) => {
                if (error)
                    callback(error, null);
                else
                    callback(null, rows);
            });
        });
    }


    //Get ipobj_type by  id
    public static getIpobj_type(req, id) {
        return new Promise((resolve, reject) => {
            req.dbCon.query(`SELECT * FROM ${tableName} WHERE id=${id}`, (error, row) => {
                if (error) return reject(error);
                resolve(row);
            });
        });
    }

}