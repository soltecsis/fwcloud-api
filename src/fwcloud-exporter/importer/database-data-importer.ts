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
import { JoinTableMetadataArgs } from "typeorm/metadata-args/JoinTableMetadataArgs";
import { RelationMetadataArgs } from "typeorm/metadata-args/RelationMetadataArgs";
import { PolicyRuleToIPObj } from "../../models/policy/PolicyRuleToIPObj";
import { Interface } from "../../models/interface/Interface";
import { IPObj } from "../../models/ipobj/IPObj";
import { IPObjGroup } from "../../models/ipobj/IPObjGroup";

export class DatabaseDataImporter {
    protected _data: ExporterResults;

    protected _customHandlers: {[id: string]: (mapper: ImportMapping, value: number) => number} = {}

    constructor(data: ExporterResults) {
        this._data = data;
        this._customHandlers = this.getCustomHandlers();
    }

    public async import(): Promise<FwCloud> {
        let data: ExporterResults = this._data;
        const queryRunner: QueryRunner = (await app().getService<DatabaseService>(DatabaseService.name)).connection.createQueryRunner();
        
        try {
            data = await this.terraformData(queryRunner, this._data);
        } catch (e) {
            console.error(e);
        }
        

        return null;
    }

    /**
     * Regenerate a new ExporterResult data with new ids in order to avoid id collisions.
     * 
     * @param queryRunner 
     * @param data 
     */
    protected async terraformData(queryRunner: QueryRunner, data: ExporterResults): Promise<ExporterResults> {
        const idManager: IdManager = await IdManager.make(queryRunner, data.getTableWithEntities())
        const mapper: ImportMapping = new ImportMapping(idManager, data);
        const result: ExporterResults = new ExporterResults();

        const exportResult: TableExporterResults = data.getAll();
        for(let tableName in exportResult) {
            const entityName: string = exportResult[tableName].entity;
            const rows: Array<object> = exportResult[tableName].data;
            
            let dataTerraformed: Array<Object> = [];
            
            if (entityName) {
                dataTerraformed = await this.terraformTableDataWithEntity(mapper, tableName, entityName, rows);
            } else {
                dataTerraformed = await this.terraformTableDataWithoutEntity(mapper, tableName, rows);
            }

            result.addResults(tableName, entityName, dataTerraformed);
        }

        return result;
    }

    protected async terraformTableDataWithEntity(mapper: ImportMapping, tableName: string, entityName: string, rows: Array<object>): Promise<Array<object>> {
        //In this case, we can get the primary and foreign keys from the entitiy metadata. First, get the entitiy definition
        const entity: typeof Model = this.getEntitiyDefinition(tableName, entityName);
        
        const result: Array<object> = [];

        for(let i = 0; i < rows.length; i++) {
            const row: object = rows[i];
            
            for(let attributeName in row) {
                if (this.hasCustomHandler(tableName, entityName, attributeName)) {
                    row[attributeName] = this._customHandlers[this.getHandlerId(tableName, entityName, attributeName)](mapper, row[attributeName]);
                } else {

                    if (entity.isPrimaryKey(attributeName) && !entity.isForeignKey(attributeName)) {
                        row[attributeName] = mapper.getMappedId(tableName, attributeName, row[attributeName]);
                    }

                    if (entity.isForeignKey(attributeName)) {
                        //We need to know which entitiy is referenced
                        const relation = entity.getRelationFromPropertyName(attributeName);
                        if(relation) {
                            const type: typeof Model = <typeof Model>(<any>relation.type)();
                            const relatedTableName: string = type._getTableName();
                            const primaryKey: ColumnMetadataArgs = type.getPrimaryKeys()[0];

                            row[attributeName] = mapper.getMappedId(relatedTableName, primaryKey.propertyName, row[attributeName]);
                        }
                    }
                }
            }
            result.push(row);
        }
        
        return result;
    }

    /**
     * Adapts data to import to the current database. Data without entity belongs to tables which are not mapped into a model (usually many-to-many relation tables)
     * This case is particular as typeORM can not provide direct metadata information about the table.
     * 
     * @param mapper 
     * @param tableName 
     * @param rows 
     */
    protected async terraformTableDataWithoutEntity(mapper: ImportMapping, tableName: string, rows: Array<object>): Promise<Array<object>> {
        const result: Array<object> = [];
        const joinTables: Array<JoinTableMetadataArgs> = getMetadataArgsStorage().joinTables.filter((item: JoinTableMetadataArgs) => {
            return item.name === tableName;
        });

        const joinTable: JoinTableMetadataArgs = joinTables.length > 0 ? joinTables[0]: null;

        if (joinTable) {
            const target: typeof Model = <any>joinTable.target;
            const relation: RelationMetadataArgs = target.getRelationFromPropertyName(joinTable.propertyName);
            const joinColumnName: string = joinTable.joinColumns[0].name;

            const relatedTarget: typeof Model = <typeof Model>(<any>relation.type)();
            const relatedColumnName: string = joinTable.inverseJoinColumns[0].name;

            for(let i = 0; i < rows.length; i++) {
                const row: object = rows[i];
                
                for(let attributeName in row) {
                    if (attributeName === joinColumnName) {
                        row[attributeName] = mapper.getMappedId(target._getTableName(), target.getPrimaryKeys()[0].propertyName, row[attributeName]);
                    }

                    if (attributeName === relatedColumnName) {
                        row[attributeName] = mapper.getMappedId(relatedTarget._getTableName(), relatedTarget.getPrimaryKeys()[0].propertyName, row[attributeName]);
                    }
                }
                result.push(row);
            }

            return result;
        }

        throw new Error('Join table metadata not found for ' + tableName);
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

    protected getHandlerId(tableName: string, entityName: string, attributeName: string) {
        return tableName + ":" + entityName + ":" + attributeName;
    }

    protected hasCustomHandler(tableName: string, entityName: string, attributeName: string) {
        return this._customHandlers.hasOwnProperty(this.getHandlerId(tableName, entityName, attributeName));
    }

    protected getCustomHandlers(): {[id: string]: (mapper: ImportMapping ,value: number) => number} {
        const result = {};

        const policyRuleToIpObj: PolicyRuleToIPObj = new PolicyRuleToIPObj;
        result[this.getHandlerId(policyRuleToIpObj.getTableName(), policyRuleToIpObj.constructor.name, 'interfaceId')] = (mapper: ImportMapping, value: number) => {
            return mapper.getMappedId(Interface._getTableName(), 'id', value);
        };

        result[this.getHandlerId(policyRuleToIpObj.getTableName(), policyRuleToIpObj.constructor.name, 'ipObjId')] = (mapper: ImportMapping, value: number) => {
            return mapper.getMappedId(IPObj._getTableName(), 'id', value);
        };

        result[this.getHandlerId(policyRuleToIpObj.getTableName(), policyRuleToIpObj.constructor.name, 'ipObjGroupId')] = (mapper: ImportMapping, value: number) => {
            return mapper.getMappedId(IPObjGroup._getTableName(), 'id', value);
        };

        const ipObjGroup: IPObjGroup = new IPObjGroup;
        result[this.getHandlerId(ipObjGroup.getTableName(), ipObjGroup.constructor.name, 'fwCloudId')] = (mapper: ImportMapping, value: number) => {
            return mapper.getMappedId(FwCloud._getTableName(), 'id', value);
        };

        return result;
    }
}