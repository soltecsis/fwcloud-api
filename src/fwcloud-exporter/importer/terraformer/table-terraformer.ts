import { ImportMapping } from "./mapper/import-mapping";
import Model from "../../../models/Model";
import { ColumnMetadataArgs } from "typeorm/metadata-args/ColumnMetadataArgs";
import { JoinTableMetadataArgs } from "typeorm/metadata-args/JoinTableMetadataArgs";
import { getMetadataArgsStorage, QueryRunner } from "typeorm";
import { RelationMetadataArgs } from "typeorm/metadata-args/RelationMetadataArgs";

export type TerraformHandler = (mapper: ImportMapping, row: object, value: any) => number;

export type TerraformHandlerCollection = {[id: string]: TerraformHandler};

export class TableTerraformer {
    protected _mapper: ImportMapping;
    protected _customHandlers: TerraformHandlerCollection;

    protected constructor(mapper: ImportMapping) {
        this._mapper = mapper;
        this._customHandlers = this.getCustomHandlers();
    }

    public static async make(mapper: ImportMapping, queryRunner: QueryRunner): Promise<TableTerraformer> {
        const terraformer: TableTerraformer = new TableTerraformer(mapper);
        return terraformer;
    }

    /**
     * For a given exporter result, terraform will map the current ids exported for non used ids in the current database
     * 
     * @param exportResults 
     */
    public async terraform(tableName: string, entityName: string, rows: Array<object>): Promise<Array<object>> {
        if (entityName) {
            return await this.terraformTableDataWithEntity(this._mapper, tableName, entityName, rows);
        } 
        
        return await this.terraformTableDataWithoutEntity(this._mapper, tableName, rows);
    }

    /**
     * Terraforms a table which is modelized by an entity
     * 
     * @param mapper 
     * @param tableName 
     * @param entityName 
     * @param rows 
     */
    protected async terraformTableDataWithEntity(mapper: ImportMapping, tableName: string, entityName: string, rows: Array<object>): Promise<Array<object>> {
        const entity: typeof Model = Model.getEntitiyDefinition(tableName, entityName);
        
        const result: Array<object> = [];

        for(let i = 0; i < rows.length; i++) {
            const row: object = rows[i];
            
            for(let attributeName in row) {
                if (this.hasCustomHandler(attributeName)) {
                    row[attributeName] = this._customHandlers[attributeName](mapper, row, row[attributeName]);
                } else {

                    if (entity.isPrimaryKey(attributeName) && !entity.isForeignKey(attributeName)) {
                        // If the attribute is a primary key, it must be terraformed
                        row[attributeName] = mapper.getMappedId(tableName, attributeName, row[attributeName]);
                    }

                    if (entity.isForeignKey(attributeName)) {
                        //If the attribute is constrained by a foreign key, the attribute value must be terraformed
                        // based on the table which it references

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
     * Adapts data to import to the current database. Data without entity belongs to tables which are not mapped 
     * into a model (usually many-to-many relation tables as an entity is not required for this kind of tables and
     * the TypeORM metadata is limited).
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
     * Returns whether a given attribute has a custom handler
     * 
     * @param tableName 
     * @param entityName 
     * @param attributeName 
     */
    protected hasCustomHandler(attributeName: string) {
        return this._customHandlers.hasOwnProperty(attributeName);
    }

    /**
     * Returns custom handler for a given table attribute
     */
    protected getCustomHandlers(): TerraformHandlerCollection {
        return {};
    }
}