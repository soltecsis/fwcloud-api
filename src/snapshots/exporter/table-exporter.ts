import Model from "../../models/Model";
import { Connection, QueryBuilder, SelectQueryBuilder } from "typeorm";

export type TableExporterResults = { [tableName: string]: { entity: string, data: Array<object> } };

export class TableExporter {
    protected _entity: typeof Model;

    protected _results: TableExporterResults;

    constructor() {
        this._entity = this.getEntity();
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

    public async export(connection: Connection, fwCloudId: number): Promise<TableExporterResults> {
        this._results = {};
        this._results[this.getTableName()] = {
            entity: this.getEntityName(),
            data: []
        };
        
        this._results[this.getTableName()].data = await this.getRows(connection, fwCloudId);

        return this._results;
    }

    protected async getRows(connection: Connection, fwCloudId: number): Promise<Array<object>> {
        const qb: SelectQueryBuilder<any> = connection.createQueryBuilder(this._entity, this.getTableName());
        return await this.getFilterBuilder(qb, this.getTableName(), fwCloudId).getMany();
    }


    public getFilterBuilder(qb: SelectQueryBuilder<any>, alias: string, fwCloudId: number): SelectQueryBuilder<any> {
        throw new Error('QueryBuilder not implemented');
    }
}