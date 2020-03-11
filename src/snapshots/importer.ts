import { QueryRunner, DeepPartial } from "typeorm";
import { ImportMapping } from "./import-mapping";
import { SnapshotData } from "./snapshot-data";
import { app } from "../fonaments/abstract-application";
import { DatabaseService } from "../database/database.service";
import Model from "../models/Model";
import { FwCloudImporter } from "./importers/fwcloud-importer";
import { EntityImporter } from "./importers/entity-importer";
import { CaImporter } from "./importers/ca-importer";

const IMPORTERS: {[k: string]: typeof EntityImporter } = {
    FwCloud: FwCloudImporter,
    Ca: CaImporter
}

export class Importer {
    protected _queryRunner: QueryRunner;
    protected _mapper: ImportMapping;
    protected _databaseService: DatabaseService;

    constructor() {
        this._queryRunner = null;
        this._mapper = null;
        this._databaseService = null;
    }

    public async import(data: SnapshotData): Promise<void> {
        this._databaseService = await app().getService<DatabaseService>(DatabaseService.name);
        this._queryRunner = this._databaseService.connection.createQueryRunner();
        this._mapper = new ImportMapping();

        this._queryRunner.startTransaction();

        try {
            await this._queryRunner.query('SET FOREIGN_KEY_CHECKS = 0');
            
            for(let entity in data.data) {
                this.importEntity(entity, data.data[entity]);
            }
            
            await this._queryRunner.query('SET FOREIGN_KEY_CHECKS = 1');
            this._queryRunner.release();
        } catch(e) {
            this._queryRunner.rollbackTransaction();
            this._queryRunner.release();
            throw e;
        }
    }

    protected async importEntity(entityName: string, entities: Array<DeepPartial<Model>>): Promise<void> {
        if(IMPORTERS[entityName]) {
            const importer: EntityImporter = await IMPORTERS[entityName].build();

            for(let i = 0; i < entities.length; i++) {
                await importer.import(entities[i], this._mapper);
            }
        }
    }
}