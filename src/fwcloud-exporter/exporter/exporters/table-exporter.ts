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

import Model from "../../../models/Model";
import { Connection, SelectQueryBuilder } from "typeorm";
import { ExporterResult } from "../exporter-result";

export class TableExporter {
    protected _entity: typeof Model;

    constructor() {
        this._entity = this.getEntity();
    }

    public async bootstrap(connection: Connection, fwCloudId: number): Promise<void> {
        return
    }

    public getTableName(): string {
        if (this._entity === null) {
            throw new Error('getTableName with custom table not implemented');
        }

        const instance: Model = new (<any>this._entity)();
        return instance.getTableName();
    }

    public getEntityName(): string {
        return this._entity === null ? null : this._entity.name;
    }

    protected getEntity(): typeof Model {
        throw new Error('getEntity() not implemented for ' + this.constructor.name);
    }

    public async export(results: ExporterResult, connection: Connection, fwCloudId: number): Promise<ExporterResult> {
        results.addTableData(this.getTableName(), await this.getRows(connection, fwCloudId));

        return results;
    }

    protected async getRows(connection: Connection, fwCloudId: number): Promise<Array<object>> {
        const qb: SelectQueryBuilder<any> = connection.createQueryBuilder(this._entity, this.getTableName());
        return await this.getFilterBuilder(qb, this.getTableName(), fwCloudId).getMany();
    }


    public getFilterBuilder(qb: SelectQueryBuilder<any>, alias: string, fwCloudId: number): SelectQueryBuilder<any> {
        throw new Error('QueryBuilder not implemented');
    }
}