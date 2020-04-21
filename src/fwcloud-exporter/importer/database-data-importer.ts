import { QueryRunner, Repository, DeepPartial } from "typeorm";
import { ExporterResult } from "../exporter/exporter-result";
import { FwCloud } from "../../models/fwcloud/FwCloud";
import Model from "../../models/Model";

export class DatabaseDataImporter {
    public static async import(queryRunner: QueryRunner, data: ExporterResult): Promise<FwCloud> {
        
        await queryRunner.startTransaction()
        try {
            
            await queryRunner.query('SET FOREIGN_KEY_CHECKS = 0');
            for(let tableName in data.getAll()) {
                const entityName: string = data.getAll()[tableName].entity;

                if (entityName) {
                    const entity: typeof Model = Model.getEntitiyDefinition(tableName, entityName);
                    await queryRunner.manager.getRepository(entity).save(data.getAll()[tableName].data, {chunk: 10000});
                } else {
                    for(let i = 0; i < data.getAll()[tableName].data.length; i++) {
                        const row: object = data.getAll()[tableName].data[i];
                        await queryRunner.manager.createQueryBuilder().insert().into(tableName).values(row).execute();
                    }
                }
            }
            await queryRunner.query('SET FOREIGN_KEY_CHECKS = 1');
            await queryRunner.commitTransaction();
            await queryRunner.release();
        } catch (e) {
            await queryRunner.rollbackTransaction();
            await queryRunner.release();
            throw e;
        }
        
        return null;
    }
}