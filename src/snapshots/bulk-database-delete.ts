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

import { DatabaseService } from "../database/database.service";
import { app } from "../fonaments/abstract-application";
import { QueryRunner, getMetadataArgsStorage, DeepPartial, DeleteResult, Repository, EntityRepository } from "typeorm";
import { RepositoryService } from "../database/repository.service";
import Model from "../models/Model";
import { ExporterResultData } from "../fwcloud-exporter/exporter/exporter-result";

export class BulkDatabaseDelete {
    protected _data: ExporterResultData;
    protected _repositoryService: RepositoryService;
    protected _databaseService: DatabaseService;

    constructor(data: ExporterResultData) {
        this._data = data;
    }

    public async run(): Promise<void> {
        return new Promise(async (resolve, reject) => {
            this._databaseService = await app().getService<DatabaseService>(DatabaseService.name);
            this._repositoryService = await app().getService<RepositoryService>(RepositoryService.name);
            const qr: QueryRunner = this._databaseService.connection.createQueryRunner();

            await qr.startTransaction();

            try {
                await qr.query('SET FOREIGN_KEY_CHECKS = 0');

                for (let table in this._data) {
                    const entity: string = this._data[table].entity;
                    const rows: Array<object> = this._data[table].data;

                    if (entity) {
                        await this.processEntityRows(qr, table, entity, rows);
                    } else {
                        await this.processRows(qr, table, rows);
                    }
                }

                await qr.query('SET FOREIGN_KEY_CHECKS = 1');
                await qr.commitTransaction();
                await qr.release();
            } catch (e) {
                await qr.rollbackTransaction();
                await qr.query('SET FOREIGN_KEY_CHECKS = 1');
                qr.release();
                return reject(e);
            }

            resolve();
        });
    }

    protected async processEntityRows(queryRunner: QueryRunner, tableName: string, entityName: string, rows: Array<object>): Promise<void> {
        
        if (rows.length <= 0) {
            return;
        }

        let entity: typeof Model = Model.getEntitiyDefinition(tableName, entityName);

        let models: Array<Model> = [];

        for(let i = 0; i < rows.length; i++) {
            models.push(<any>rows[i])
        }

        await queryRunner.manager.getRepository(entity).remove(models);
    }

    protected async processRows(queryRunner: QueryRunner, table: string, rows: Array<object>): Promise<void> {
        for (let i = 0; i < rows.length; i++) {
            const row: object = rows[i];
            await queryRunner.manager.createQueryBuilder(table, "table").delete().where(row).execute();
        }
    }
}