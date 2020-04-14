import { SnapshotData } from "../../snapshots/snapshot-data";

export type TableExporterResults = { [tableName: string]: { entity: string, data: Array<object> } };

export class ExporterResults {
    protected _results: TableExporterResults;

    constructor() {
        this._results = {};
    }

    public getAll(): TableExporterResults {
        return this._results;
    }

    public fromSnapshotData(snapshotData: SnapshotData): this {
        this._results = snapshotData.data;
        return this;
    }

    public addResults(tableName: string, entityName: string, data: Array<object>): this {
        if(this._results[tableName]) {
            throw new Error('Exporting a table which already has been exported');
        }

        this._results[tableName] = {
            entity: entityName,
            data: data
        }

        return this;
    }

    public getTableWithEntities(): Array<{tableName: string, entityName: string}> {
        const names: Array<{tableName: string, entityName: string}> = [];


        for(let tableName in this._results) {
            names.push({
                tableName: tableName,
                entityName: this._results[tableName].entity
            });
        }
        return names;
    }
}