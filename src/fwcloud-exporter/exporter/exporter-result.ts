import { SnapshotData } from "../../snapshots/snapshot-data";

export type ExporterTableResult = { entity: string, data: Array<object> };
export type ExporterResultData = { [tableName: string]: ExporterTableResult };

export class ExporterResult {
    protected _results: ExporterResultData;

    constructor() {
        this._results = {};
    }

    public getAll(): ExporterResultData {
        return this._results;
    }

    public fromSnapshotData(snapshotData: SnapshotData): this {
        this._results = snapshotData.data;
        return this;
    }

    public addTableData(tableName: string, entityName: string, data: Array<object>): this {
        if(this._results[tableName]) {
            throw new Error('Exporting a table which already has been exported');
        }

        this._results[tableName] = {
            entity: entityName,
            data: data
        }

        return this;
    }

    public getTableResults(tableName: string): ExporterTableResult {
        return this._results.hasOwnProperty(tableName) ? this._results[tableName] : null;
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