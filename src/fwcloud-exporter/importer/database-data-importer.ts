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

import { QueryRunner, Repository, DeepPartial } from "typeorm";
import { ExporterResult } from "../database-exporter/exporter-result";
import { FwCloud } from "../../models/fwcloud/FwCloud";
import Model from "../../models/Model";

export class DatabaseDataImporter {
    public static async import(queryRunner: QueryRunner, data: ExporterResult): Promise<FwCloud> {
        
        await queryRunner.startTransaction()
        try {
            
            await queryRunner.query('SET FOREIGN_KEY_CHECKS = 0');
            for(let tableName in data.getAll()) {
                const entity: typeof Model = Model.getEntitiyDefinition(tableName);

                if (entity) {
                    await queryRunner.manager.getRepository(entity).save(data.getAll()[tableName], {chunk: 10000});
                } else {
                    for(let i = 0; i < data.getAll()[tableName].length; i++) {
                        const row: object = data.getAll()[tableName][i];
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