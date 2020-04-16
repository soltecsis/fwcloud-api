import { QueryRunner, Repository, DeepPartial } from "typeorm";
import { app } from "../../fonaments/abstract-application";
import { DatabaseService } from "../../database/database.service";
import { ExporterResult } from "../exporter/exporter-result";
import { FwCloud } from "../../models/fwcloud/FwCloud";
import { Terraformer } from "./terraformer/terraformer";
import { RepositoryService } from "../../database/repository.service";
import Model from "../../models/Model";

export class DatabaseDataImporter {
    protected _data: ExporterResult;

    constructor(data: ExporterResult) {
        this._data = data;
    }

    public async import(): Promise<FwCloud> {
        let data: ExporterResult = this._data;
        const queryRunner: QueryRunner = (await app().getService<DatabaseService>(DatabaseService.name)).connection.createQueryRunner();
        const repositoryService: RepositoryService = await app().getService<RepositoryService>(RepositoryService.name);

        await queryRunner.startTransaction()
        try {
            const terraformedData: ExporterResult = await (new Terraformer(queryRunner)).terraform(data);

            await queryRunner.query('SET FOREIGN_KEY_CHECKS = 0');
            for(let tableName in terraformedData.getAll()) {
                const entityName: string = terraformedData.getAll()[tableName].entity;

                if (entityName) {
                    const entity: typeof Model = Model.getEntitiyDefinition(tableName, entityName);
                    await queryRunner.manager.getRepository(entity).save(terraformedData.getAll()[tableName].data)
                } else {
                    for(let i = 0; i < terraformedData.getAll()[tableName].data.length; i++) {
                        const row: object = terraformedData.getAll()[tableName].data[i];
                        await queryRunner.manager.createQueryBuilder().insert().into(tableName).values(row).execute();
                    }
                }
            }
            await queryRunner.query('SET FOREIGN_KEY_CHECKS = 1');
            await queryRunner.commitTransaction();
            await queryRunner.release();

            const fwcloud: FwCloud = await repositoryService.for(FwCloud).findOne((<DeepPartial<FwCloud>>terraformedData.getAll()[FwCloud._getTableName()].data[0]).id);

            return fwcloud;
        } catch (e) {
            await queryRunner.rollbackTransaction();
            await queryRunner.release();
            throw e;
        }
        
        return null;
    }
}