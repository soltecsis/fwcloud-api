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
import { TableExporterResults } from "../fwcloud-exporter/exporter/table-exporter";

export class SnapshotData {
    data: TableExporterResults;

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

    addResults(results: TableExporterResults): SnapshotData {
        this.data = <TableExporterResults>ObjectHelpers.merge(this.data, results);
        return this;
    }
}