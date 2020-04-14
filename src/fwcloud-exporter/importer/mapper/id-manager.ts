import Model from "../../../models/Model";
import { ColumnMetadataArgs } from "typeorm/metadata-args/ColumnMetadataArgs";
import { QueryRunner } from "typeorm";
import { JoinColumnMetadataArgs } from "typeorm/metadata-args/JoinColumnMetadataArgs";

type TableIdState = { [tableName: string]: { [propertyName: string]: number } };

export class IdManager {
    protected _ids: TableIdState

    protected constructor(ids: TableIdState) {
        this._ids = ids;
    }

    getNewId(tableName: string, propertyName: string): number {
        if (this._ids[tableName] && this._ids[tableName][propertyName]) {
            this._ids[tableName][propertyName]++;
            return this._ids[tableName][propertyName] - 1;
        }

        return null;
    }

    /**
     * Builds an IdManager getting the new ids through the database
     * 
     * @param queryRunner 
     * @param tableNameWithEntity 
     */
    public static async make(queryRunner: QueryRunner, tableNameWithEntity: Array<{ tableName: string, entityName: string }>): Promise<IdManager> {
        const ids: TableIdState = {};

        for (let i = 0; i < tableNameWithEntity.length; i++) {
            const tableName: string = tableNameWithEntity[i].tableName;
            const entityName: string = tableNameWithEntity[i].entityName;

            // If the tableName does not have a model, we consider it is a many to many "related-table" thus it does not have
            // a primary key (only foreign keys).
            if (entityName) {
                const model: typeof Model = Model.getEntitiyDefinition(tableName, entityName);
                const primaryKeys: Array<ColumnMetadataArgs> = model.getPrimaryKeys();
                
                for (let i = 0; i < primaryKeys.length; i++) {

                    if (!model.isJoinColumn(primaryKeys[i].propertyName)) {
                        const primaryKeyPropertyName: string = primaryKeys[i].propertyName;
                        // TypeORM might apply some kind of propertyName mapping. 
                        const originalColumnName: string = primaryKeys[i].options.name ? primaryKeys[i].options.name : primaryKeyPropertyName;

                        const queryBuilder = queryRunner.manager.createQueryBuilder(tableName, tableName).select(`MAX(${originalColumnName})`, "id");

                        // If the table is empty, the returned value is null. We set 0 because it will be incremented afterwards
                        const id = (await queryBuilder.execute())[0]['id'] || 0;

                        ids[tableName] = {};
                        ids[tableName][primaryKeyPropertyName] = id ? id + 1 : 1;
                    }
                }
            }
        }

        return new IdManager(ids);
    }
}