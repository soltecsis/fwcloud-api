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

import { DatabaseService } from '../database/database.service';
import { app } from '../fonaments/abstract-application';
import {
  QueryRunner,
  getMetadataArgsStorage,
  DeepPartial,
  DeleteResult,
  Repository,
  EntityRepository,
} from 'typeorm';
import Model from '../models/Model';
import { ExporterResultData } from '../fwcloud-exporter/database-exporter/exporter-result';

export class BulkDatabaseDelete {
  protected _data: ExporterResultData;
  protected _databaseService: DatabaseService;

  constructor(data: ExporterResultData) {
    this._data = data;
  }

  public async run(): Promise<void> {
    let qr: QueryRunner | undefined;

    try {
      this._databaseService = await app().getService<DatabaseService>(
        DatabaseService.name,
      );
      qr = this._databaseService.connection.createQueryRunner();
      await qr.startTransaction();
      await qr.query('SET FOREIGN_KEY_CHECKS = 0');

      for (const tableName in this._data) {
        const entity: typeof Model = Model.getEntitiyDefinition(tableName);
        const rows: Array<object> = this._data[tableName];

        if (entity) {
          await this.processEntityRows(qr, tableName, entity, rows);
        } else {
          await this.processRows(qr, tableName, rows);
        }
      }

      await qr.query('SET FOREIGN_KEY_CHECKS = 1');
      await qr.commitTransaction();
      await qr.release();
    } catch (error) {
      if (qr) {
        try {
          await qr.rollbackTransaction();
          await qr.query('SET FOREIGN_KEY_CHECKS = 1');
          await qr.release();
        } catch (rollbackError) {
          console.error('Error rolling back transaction:', rollbackError);
        }
      }
      throw error;
    }
  }

  protected async processEntityRows(
    queryRunner: QueryRunner,
    tableName: string,
    entity: typeof Model,
    rows: Array<object>,
  ): Promise<void> {
    if (rows.length <= 0) {
      return;
    }

    await queryRunner.manager.getRepository(entity).remove(<Array<Model>>rows);
  }

  protected async processRows(
    queryRunner: QueryRunner,
    table: string,
    rows: Array<object>,
  ): Promise<void> {
    for (let i = 0; i < rows.length; i++) {
      const row: object = rows[i];
      await queryRunner.manager
        .createQueryBuilder(table, 'table')
        .delete()
        .where(row)
        .execute();
    }
  }
}
