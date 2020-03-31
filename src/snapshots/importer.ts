/*!
    Copyright 2019 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
    https://soltecsis.com
    info@soltecsis.com


    This file is part of FWCloud (https://fwcloud.net).

    FWCloud is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    FWCloud is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with FWCloud.  If not, see <https://www.gnu.org/licenses/>.
*/

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