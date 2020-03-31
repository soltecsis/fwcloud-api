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

import Model from "../models/Model";

export type IdMap = {old: any, new: any}
export type EntityMap = {[property_name: string]: Array<IdMap>};
export type ImportMap = {[entity_name: string]: EntityMap}

export class ImportMapping {
    
    maps: ImportMap = {}

    public newItem(tableName: string, map: {[property_name: string]: IdMap}): void {
        if (!this.maps[tableName]) {
            this.maps[tableName] = {};
        }

        for(let propertyName in map) {
            if (!this.maps[tableName][propertyName]) {
                this.maps[tableName][propertyName] = [];
            }

            const index: number = this.findIndexOfItem(tableName, propertyName, {old: map[propertyName].old});

            if( index < 0) {
                this.maps[tableName][propertyName].push({old: map[propertyName].old, new: map[propertyName].new});
            } else {
                this.maps[tableName][propertyName][index] = {old: map[propertyName].old, new: map[propertyName].new};
            }
        }

        return;
    }

    public findItem(tableName: string, propertyName: string, match: Partial<IdMap>): IdMap {
        if (this.maps[tableName] && this.maps[tableName][propertyName]) {
            
            const matches: Array<IdMap> = this.maps[tableName][propertyName].filter((element: IdMap) => {
                let found: boolean = true;
                
                if (match.new) {
                    if (match.new !== element.new) { found = false;}
                }

                if (match.old) {
                    if (match.old !== element.old) { found = false;}
                }

                return found;
            });

            return matches.length > 0 ? matches[0]: null;
        }

        return null;
    }

    public findIndexOfItem(tableName: string, propertyName: string, match: Partial<IdMap>): number {
        const element: IdMap = this.findItem(tableName, propertyName, match);

        if (element) {
            return this.maps[tableName] && this.maps[tableName][propertyName].indexOf(element);
        }

        return -1;
    }
}