import { QueryRunner, getMetadataArgsStorage } from "typeorm";
import { ExporterResult, ExporterResultData, ExporterTableResult } from "../../exporter/exporter-result";
import { IdManager } from "./mapper/id-manager";
import { ImportMapping } from "./mapper/import-mapping";
import Model from "../../../models/Model";
import { ColumnMetadataArgs } from "typeorm/metadata-args/ColumnMetadataArgs";
import { JoinTableMetadataArgs } from "typeorm/metadata-args/JoinTableMetadataArgs";
import { RelationMetadataArgs } from "typeorm/metadata-args/RelationMetadataArgs";
import { PolicyRuleToIPObj } from "../../../models/policy/PolicyRuleToIPObj";
import { IPObj } from "../../../models/ipobj/IPObj";
import { IPObjGroup } from "../../../models/ipobj/IPObjGroup";
import { FwCloud } from "../../../models/fwcloud/FwCloud";
import { Interface } from "../../../models/interface/Interface";

export type TerraformHandler = (mapper: ImportMapping, value: number) => number;
export type TerraformHandlerCollection = {[id: string]: (mapper: ImportMapping, value: number) => number};
export class Terraformer {
    protected _queryRunner: QueryRunner;

    protected _customHandlers: TerraformHandlerCollection;

    constructor(queryRunner: QueryRunner) {
        this._queryRunner = queryRunner;
        this._customHandlers = this.getCustomHandlers();
    }
    
    /**
     * For a given exporter result, terraform will map the current ids exported for non used ids in the current database
     * 
     * @param exportResults 
     */
    public async terraform(exportResults: ExporterResult): Promise<ExporterResult> {
        const idManager: IdManager = await IdManager.make(this._queryRunner, exportResults.getTableWithEntities())
        const mapper: ImportMapping = new ImportMapping(idManager, exportResults);
        const result: ExporterResult = new ExporterResult();

        const data: ExporterResultData = exportResults.getAll();
        
        for(let tableName in data) {
            const entityName: string = data[tableName].entity;
            const terraformedData: Array<object> = await this.terraformTable(mapper, tableName, data[tableName]);
            result.addTableData(tableName, entityName, terraformedData);
        }

        return result;
    }

    /**
     * Terraforms a given table data
     * 
     * @param mapper 
     * @param tableName 
     * @param data 
     */
    public async terraformTable(mapper: ImportMapping, tableName: string, data: ExporterTableResult): Promise<Array<object>> {
        const entityName: string = data.entity;
        const rows: Array<object> = data.data;
            
        if (entityName) {
            return await this.terraformTableDataWithEntity(mapper, tableName, entityName, rows);
        } 
        
        return await this.terraformTableDataWithoutEntity(mapper, tableName, rows);
    }

    protected async terraformTableDataWithEntity(mapper: ImportMapping, tableName: string, entityName: string, rows: Array<object>): Promise<Array<object>> {
        //In this case, we can get the primary and foreign keys from the entitiy metadata. First, get the entitiy definition
        const entity: typeof Model = Model.getEntitiyDefinition(tableName, entityName);
        
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
     * Generates an id based on the propertyName, table and entitiy in order to get an specific handler
     * 
     * @param tableName 
     * @param entityName 
     * @param attributeName 
     */
    protected getHandlerId(tableName: string, entityName: string, attributeName: string) {
        return tableName + ":" + entityName + ":" + attributeName;
    }

    /**
     * Returns whether a given attribute, entity and table has a custom handler
     * 
     * @param tableName 
     * @param entityName 
     * @param attributeName 
     */
    protected hasCustomHandler(tableName: string, entityName: string, attributeName: string) {
        return this._customHandlers.hasOwnProperty(this.getHandlerId(tableName, entityName, attributeName));
    }

    /**
     * Returns the handlers
     */
    protected getCustomHandlers(): TerraformHandlerCollection {
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