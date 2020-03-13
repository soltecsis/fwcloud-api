import { QueryRunner, DeepPartial } from "typeorm";
import { ImportMapping } from "./import-mapping";
import { SnapshotData } from "./snapshot-data";
import { app } from "../fonaments/abstract-application";
import { DatabaseService } from "../database/database.service";
import Model from "../models/Model";
import { EntityImporter } from "./importers/entity-importer";

const IMPORTERS: {[entity_name: string]: typeof EntityImporter} = {};

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
        this._mapper = new ImportMapping();

        try {
            for(let tableName in data.data) {
                for(let entityName in data.data[tableName]) {
                    await this.importEntity(tableName, entityName, data.data[tableName][entityName]);
                }
            }
        } catch(e) {
            throw e;
        }
    }

    protected async importEntity(tableName: string, entityName: string, entities: Array<DeepPartial<Model>>): Promise<void> {
        let importer: any;

        if(IMPORTERS[entityName]) {
            importer = new IMPORTERS[entityName]();
        } else {
            importer = new EntityImporter();
        }

        for(let i = 0; i < entities.length; i++) {
            await importer.import(tableName, entityName, entities[i], this._mapper);
        }
    }
}