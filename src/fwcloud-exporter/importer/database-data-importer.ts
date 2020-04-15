import { QueryRunner } from "typeorm";
import { app } from "../../fonaments/abstract-application";
import { DatabaseService } from "../../database/database.service";
import { ExporterResult } from "../exporter/exporter-result";
import { FwCloud } from "../../models/fwcloud/FwCloud";
import { Terraformer } from "./terraformer/terraformer";

export class DatabaseDataImporter {
    protected _data: ExporterResult;

    constructor(data: ExporterResult) {
        this._data = data;
    }

    public async import(): Promise<FwCloud> {
        let data: ExporterResult = this._data;
        const queryRunner: QueryRunner = (await app().getService<DatabaseService>(DatabaseService.name)).connection.createQueryRunner();
        
        try {
            const terraformedData: ExporterResult = await (new Terraformer(queryRunner)).terraform(data);

            console.log(terraformedData);
        } catch (e) {
            console.error(e);
        }
        
        return null;
    }
}