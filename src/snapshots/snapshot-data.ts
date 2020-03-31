/*!
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

import { DeepPartial } from "typeorm";
import Model from "../models/Model";
import ObjectHelpers from "../utils/object-helpers";

export class SnapshotData {
    data: {[table_name: string]: 
        {[entity_name: string]: Array<DeepPartial<Model>>}
    };

    constructor() {
        this.data = {};
    }

    public hasItem(entity: Function, data: DeepPartial<Model>): boolean {
        const tableName: string = entity.prototype.getTableName();
        const entityName: string = entity.prototype.constructor.name;

        if (!this.data[tableName]) {
            return false;
        }

        if (!this.data[tableName][entityName]) {
            return false;
        }

        if (!Array.isArray(this.data[tableName][entityName])) {
            return false;
        }

        const matches = this.data[tableName][entityName].filter((item: DeepPartial<Model>) => {
            return ObjectHelpers.contains(item, data);
        });

        return matches.length > 0;
    }

    public addSection<T extends Model>(entity: T) {
        const tableName: string = entity.getTableName();
        const entityName: string = entity.constructor.name;

        if (!this.data[tableName]) {
            this.data[tableName] = {};
        }

        if (!this.data[tableName][entityName]) {
            this.data[tableName][entityName] = [];
        }
    }

    public hasSection<T extends Model>(entity: T): boolean {
        const tableName: string = entity.getTableName();
        const entityName: string = entity.constructor.name;

        if (!this.data[tableName]) {
            return false;
        }

        if (!this.data[tableName][entityName]) {
            return false;
        }

        if (!Array.isArray(this.data[tableName][entityName])) {
            return false;
        }

        return true;
    }

    public addItem<T extends Model>(entity: T) {
        const tableName: string = entity.getTableName();
        const entityName: string = entity.constructor.name;

        if (!this.data[tableName]) {
            this.data[tableName] = {};
        }

        if (!this.data[tableName][entityName]) {
            this.data[tableName][entityName] = [];
        }

        this.data[tableName][entityName].push(entity.toJSON({removeNullFields: true}));
    }

    merge(other: SnapshotData): SnapshotData {
        for(let tableName in other.data) {
            for(let entityName in other.data[tableName]) {
                for(let i = 0; i < other.data[tableName][entityName].length; i++) {
                    if (!this.data[tableName]) {
                        this.data[tableName] = {};
                    }

                    if (!this.data[tableName][entityName]) {
                        this.data[tableName][entityName] = [];
                    } 
                    
                    if(this.data[tableName][entityName].indexOf(other.data[tableName][entityName][i]) < 0) {
                        this.data[tableName][entityName].push(other.data[tableName][entityName][i]);
                    }
                }
            }
        }

        return this;
    }
}