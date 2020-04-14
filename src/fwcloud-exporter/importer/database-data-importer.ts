import { SnapshotData } from "../../snapshots/snapshot-data";
import { ImportMapping } from "./mapper/import-mapping";
import { TableMetadataArgs } from "typeorm/metadata-args/TableMetadataArgs";
import { getMetadataArgsStorage, QueryRunner } from "typeorm";
import Model from "../../models/Model";
import { ColumnMetadataArgs } from "typeorm/metadata-args/ColumnMetadataArgs";
import { app } from "../../fonaments/abstract-application";
import { DatabaseService } from "../../database/database.service";
import { ExporterResults, TableExporterResults } from "../exporter/exporter-results";
import { FwCloud } from "../../models/fwcloud/FwCloud";
import { IdManager } from "./mapper/id-manager";
import { JoinColumnMetadataArgs } from "typeorm/metadata-args/JoinColumnMetadataArgs";

export class DatabaseDataImporter {
    protected _data: ExporterResults;

    constructor(data: ExporterResults) {
        this._data = data;
    }

    public async import(): Promise<FwCloud> {
        let data: ExporterResults = this._data;
        const queryRunner: QueryRunner = (await app().getService<DatabaseService>(DatabaseService.name)).connection.createQueryRunner();
        
        data = await this.processIdRefresh(queryRunner, this._data);

        return null;
    }

    protected async processIdRefresh(queryRunner: QueryRunner, data: ExporterResults): Promise<ExporterResults> {
        const idManager: IdManager = await IdManager.make(queryRunner, data.getTableWithEntities())
        const mapper: ImportMapping = new ImportMapping(idManager);
        const result: ExporterResults = new ExporterResults();

        const exportResult: TableExporterResults = data.getAll();
        for(let tableName in exportResult) {
            const entityName: string = exportResult[tableName].entity;
            const rows: Array<object> = exportResult[tableName].data;
            let rowsRefreshed: Array<Object> = [];
            
            if (entityName) {
                try {
                    rowsRefreshed = await this.processTableIdRefreshWithEntity(mapper, tableName, entityName, rows);
                } catch (e) {
                    console.error(e);
                }
            } else {
                //rowsRefreshed = await this.processTableIdRefresh(mapper, tableName, rows);
            }

            result.addResults(tableName, entityName, rowsRefreshed);
        }

        return result;
    }

    protected async processTableIdRefreshWithEntity(mapper: ImportMapping, tableName: string, entityName: string, rows: Array<object>): Promise<Array<object>> {
        //In this case, we can get the primary and foreign keys from the entitiy metadata. First, get the entitiy definition
        const entity: typeof Model = this.getEntitiyDefinition(tableName, entityName);
        const sampleInstance: Model = new (entity as any)();
        const primaryKeys = sampleInstance.getPrimaryKeys();
        
        const result: Array<object> = [];

        for(let i = 0; i < rows.length; i++) {
            const row: object = rows[i];
            
            for(let attributeName in row) {
                if (this.belongsToGivenKeys(attributeName, primaryKeys) && !sampleInstance.isForeignKey(attributeName)) {
                    row[attributeName] = mapper.getMappedId(tableName, attributeName, row[attributeName]);
                }

                if (sampleInstance.isForeignKey(attributeName)) {
                    //We need to know which entitiy is referenced
                    const relation = sampleInstance.getRelationFromPropertyName(attributeName);
                    if(relation) {
                        const type: any = relation.type;
                        const relatedEntity: Model = <any>new (type())()
                        const relatedTableName: string = relatedEntity.getTableName();
                        const primaryKey: ColumnMetadataArgs = relatedEntity.getPrimaryKeys()[0];

                        row[attributeName] = mapper.getMappedId(relatedTableName, primaryKey.propertyName, row[attributeName]);
                    }
                }
            }
            result.push(row);
        }
        
        return result;
    }

    protected async processTableIdRefresh(mapper: ImportMapping, tableName: string, rows: Array<object>): Promise<Array<object>> {
        return null;
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

    protected belongsToGivenKeys(propertyName: string, keys: Array<ColumnMetadataArgs | JoinColumnMetadataArgs>): boolean {
        return keys.filter((item: ColumnMetadataArgs) => {
            return item.propertyName === propertyName;
        }).length > 0;
    }

    protected getForeignData(tableName: string, propertyName: string): {table: string, reference: string} {
        return null;
    }
}