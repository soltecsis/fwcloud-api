import { SnapshotData } from "../../snapshots/snapshot-data";
import { TableExporterResults } from "../exporter/table-exporter";
import { ImportMapping } from "./import-mapping";
import { TableMetadataArgs } from "typeorm/metadata-args/TableMetadataArgs";
import { getMetadataArgsStorage } from "typeorm";
import Model from "../../models/Model";
import { ColumnMetadataArgs } from "typeorm/metadata-args/ColumnMetadataArgs";

export class DatabaseDataImporter {
    protected _data: TableExporterResults;

    protected _refreshIds: boolean;

    constructor(data: SnapshotData, refreshIds: boolean) {
        this._data = data.data;
        this._refreshIds = refreshIds;
    }

    public async import(): Promise<FwCloud> {
        let data: TableExporterResults = this._data;
        
        if (this._refreshIds) {
            data = await this.processIdRefresh(this._data);
        }
    }

    protected async processIdRefresh(data: TableExporterResults): Promise<TableExporterResults> {
        const mapper: ImportMapping = new ImportMapping();
        const result: TableExporterResults = {};

        for(let tableName in data) {
            const entityName: string = data[tableName].entity;
            const rows: Array<object> = data[tableName].data;
            let rowsRefreshed: Array<Object> = [];
            
            if (entityName) {
                rowsRefreshed = await this.processTableIdRefreshWithEntity(mapper, tableName, entityName, rows);
            } else {
                rowsRefreshed = await this.processTableIdRefresh(mapper, tableName, rows);
            }
        }
    }

    protected async processTableIdRefreshWithEntity(mapper: ImportMapping, tableName: string, entityName: string, rows: Array<object>): Promise<Array<object>> {
        //In this case, we can get the primary and foreign keys from the entitiy metadata. First, get the entitiy definition
        const entity: typeof Model = this.getEntitiyDefinition(tableName, entityName);
        const sampleInstance: Model = new (entity as any)();
        const primaryKeys = sampleInstance.getPrimaryKeys();
        const foreignKeys = null;//sampleInstance.getForeignKeys();

        const result: Array<object> = [];

        for(let i = 0; i < rows.length; i++) {
            const row: object = rows[i];
            
            for(let attributeName in row) {
                if (this.belongsToGivenKeys(attributeName, primaryKeys)) {
                    // This attribute is a primary key and must be refreshed
                    row[attributeName] = mapper.refreshId(tableName, attributeName, row[attributeName]);
                }

                if (this.belongsToGivenKeys(attributeName, foreignKeys)) {
                    // This attribute contains a other table foreign key. We should refresh it too
                    // but in this case we should guess the foreign table first
                    const foreignTableName: string = this.getForeignData(tableName, attributeName).table;
                    const foreignPropertyName: string = this.getForeignData(tableName, attributeName).reference;

                    row[attributeName] = mapper.refreshId(foreignTableName, foreignPropertyName, row[attributeName]);
                }
            }
        }
        

    }

    protected async processTableIdRefresh(mapper: ImportMapping, tableName: string, rows: Array<object>): Promise<Array<object>> {

    }

    /**
     * Returns the model class definition for the given tableName and entityName
     * 
     * @param tableName 
     * @param entityName 
     */
    protected getEntitiyDefinition(tableName: string, entityName: string): typeof Model {
        const matches: Array<TableMetadataArgs> = getMetadataArgsStorage().tables.filter((item: TableMetadataArgs) => {
            const target = <any>item.target;
            return tableName === item.name && entityName === target.name;
        });

        return matches.length > 0 ? <any>matches[0].target : null;
    }

    protected belongsToGivenKeys(propertyName: string, keys: Array<ColumnMetadataArgs>): boolean {
        return keys.filter((item: ColumnMetadataArgs) => {
            item.propertyName === propertyName;
        }).length > 0;
    }

    protected getForeignData(tableName: string, propertyName: string): {table: string, reference: string} {
        return null;
    }
}