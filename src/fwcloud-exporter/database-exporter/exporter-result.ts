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

export type ExporterResultData = { [tableName: string]: Array<object> };

export class ExporterResult {
    protected _results: ExporterResultData;

    constructor(results: ExporterResultData = {}) {
        this._results = results
    }

    public getAll(): ExporterResultData {
        return this._results;
    }

    public addTableData(tableName: string, data: Array<object>): this {
        if(this._results[tableName]) {
            throw new Error('Exporting a table which already has been exported');
        }

        this._results[tableName] = data
        
        return this;
    }

    public getTableResults(tableName: string): Array<object> {
        return this._results.hasOwnProperty(tableName) ? this._results[tableName] : null;
    }

    public getTableNames(): Array<string> {
        const names: Array<string> = [];


        for(const tableName in this._results) {
            names.push(tableName);
        }
        return names;
    }
}