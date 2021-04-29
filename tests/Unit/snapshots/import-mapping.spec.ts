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

import { describeName, expect, testSuite } from "../../mocha/global-setup";
import { ImportMapping } from "../../../src/fwcloud-exporter/database-importer/terraformer/mapper/import-mapping";
import { IdManager } from "../../../src/fwcloud-exporter/database-importer/terraformer/mapper/id-manager";
import { DatabaseService } from "../../../src/database/database.service";
import { ExporterResult } from "../../../src/fwcloud-exporter/database-exporter/exporter-result";
import { Repository, QueryRunner, SelectQueryBuilder } from "typeorm";
import { FwCloud } from "../../../src/models/fwcloud/FwCloud";
import StringHelper from "../../../src/utils/string.helper";

let databaseService: DatabaseService;

describe(describeName('Import mapping tests'), () => {

    describe('newId()', () => {

        before(async () => {
            databaseService = await testSuite.app.getService<DatabaseService>(DatabaseService.name);
        });

        it('should map the old id with a new id', async () => {
            const queryRunner: QueryRunner = databaseService.connection.createQueryRunner();
            const queryBuilder: SelectQueryBuilder<unknown> = databaseService.connection.createQueryBuilder('fwcloud', 'fwcloud').select('MAX(id)', 'id');

            await FwCloud.save(FwCloud.create({name: StringHelper.randomize(10)}));
            const maxId : any = (await queryBuilder.execute())[0].id;
            
            const results: ExporterResult = new ExporterResult();
            results.addTableData('fwcloud', [{ id: 0 }])
            const mapper = new ImportMapping(await IdManager.make(queryRunner, [
                'fwcloud'
            ]), results);
            await queryRunner.release()

            const newId: number = mapper.getMappedId('fwcloud', 'id', 0);

            expect(newId).to.be.deep.eq(maxId + 1);
        });

        it('should not map a new id if the id is not exported', async () => {
            const results: ExporterResult = new ExporterResult();
            results.addTableData('fwcloud', [{ id: 0 }])
            const mapper = new ImportMapping(await IdManager.make(databaseService.connection.createQueryRunner(), [
                'fwcloud'
            ]), results);

            const newId: number = mapper.getMappedId('fwcloud', 'id', 1);

            expect(newId).to.be.deep.eq(1);
        });

        it('should not map a new id if the table is not exported', async () => {
            const results: ExporterResult = new ExporterResult();

            const mapper = new ImportMapping(await IdManager.make(databaseService.connection.createQueryRunner(), []), results);

            const newId: number = mapper.getMappedId('fwcloud', 'id', 1);

            expect(newId).to.be.deep.eq(1);
        });
    });
});