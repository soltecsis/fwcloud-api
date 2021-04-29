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

import { IdManager } from "./id-manager";
import { ExporterResult } from "../../../database-exporter/exporter-result";

export type IdMap = {old: any, new: any}

export class ImportMapping {
    _idManager: IdManager;
    _data: ExporterResult;

    constructor(idManager: IdManager, data: ExporterResult, public maps: Map<string, number> = new Map<string, number>()) {
        this._idManager = idManager;
        this._data = data;
    }

    /**
     * Gets the mapped id if it exists or create a new map
     * 
     * @param tableName 
     * @param propertyName 
     * @param old 
     */
    public getMappedId(tableName: string, propertyName: string, old: number): number {
        const key: string = this.generateKey(tableName, propertyName, old);
        const newId: number = this.maps.get(key);

        if (newId) {
            return newId;
        }

        if (this.shouldGenerateNewId(tableName, propertyName, old)) {
            return this.generateNewId(tableName, propertyName, old);
        }

        this.maps.set(key, old);
        return old;
    }

    /**
     * Returns whether an id should be refreshed. Notice only exported ids must be refreshed
     * 
     * @param tableName 
     * @param propertyName 
     * @param value 
     */
    protected shouldGenerateNewId(tableName: string, propertyName: string, value: any): boolean {
        const tableData: Array<object> = this._data.getTableResults(tableName);
        if (tableData) {
            return this._data.getTableResults(tableName).filter((item: object) => {
                return item.hasOwnProperty(propertyName) && item[propertyName] === value;
            }).length > 0;
        }

        return false;
        
    }

    /**
     * Makes a id mapping with the id returned by the id manager
     * 
     * @param tableName 
     * @param propertyName 
     * @param old 
     */
    protected generateNewId(tableName: string, propertyName: string, old: number): number {
        let newId: number = this._idManager.getNewId(tableName, propertyName);
        if (!newId) {
            newId = old;
        }
        this.maps.set(this.generateKey(tableName, propertyName, old), newId);

        return newId;
    }

    protected generateKey(tableName: string, propertyName: string, old: number): string {
        return `${tableName}:${propertyName}:${old}`
    }
}