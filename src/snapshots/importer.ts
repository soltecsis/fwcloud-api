import { QueryRunner, DeepPartial } from "typeorm";
import { ImportMapping } from "./import-mapping";
import { DatabaseService } from "../database/database.service";
import Model from "../models/Model";
import { EntityImporter } from "./importers/entity-importer";
import { Snapshot } from "./snapshot";
import { FwCloudImporter } from "./importers/fwcloud-importer";

const IMPORTERS: {[entity_name: string]: any} = {
    FwCloud: FwCloudImporter
};

export class Importer {
    protected _queryRunner: QueryRunner;
    protected _mapper: ImportMapping;
    protected _databaseService: DatabaseService;
    protected _snapshot: Snapshot;

    constructor() {
        this._queryRunner = null;
        this._mapper = null;
        this._databaseService = null;
        this._snapshot = null;
    }

    public async import(snapshot: Snapshot): Promise<void> {
        this._mapper = new ImportMapping();
        this._snapshot = snapshot;

        try {
            for(let tableName in this._snapshot.data.data) {
                for(let entityName in this._snapshot.data.data[tableName]) {
                    await this.importEntity(tableName, entityName, this._snapshot.data.data[tableName][entityName]);
                }
            }
        } catch(e) {
            throw e;
        }
    }

    protected async importEntity(tableName: string, entityName: string, entities: Array<DeepPartial<Model>>): Promise<void> {
        let importer: any;

        if(IMPORTERS[entityName]) {
            importer = new IMPORTERS[entityName](this._snapshot);
        } else {
            importer = new EntityImporter(this._snapshot);
        }

        for(let i = 0; i < entities.length; i++) {
            await importer.import(tableName, entityName, entities[i], this._mapper);
        }
    }
}