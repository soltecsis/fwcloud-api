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

import { describeName, testSuite, expect } from "../../../mocha/global-setup";
import { IdManager } from "../../../../src/fwcloud-exporter/importer/terraformer/mapper/id-manager";
import { DatabaseService } from "../../../../src/database/database.service";
import { RepositoryService } from "../../../../src/database/repository.service";
import { FwCloud } from "../../../../src/models/fwcloud/FwCloud";

let databaseService: DatabaseService;
let repositoryService: RepositoryService;

describe(describeName('IdManager Unit tests'), () => {
    beforeEach(async () => {
        databaseService = await testSuite.app.getService<DatabaseService>(DatabaseService.name);
        repositoryService = await testSuite.app.getService<RepositoryService>(RepositoryService.name);
    });

    describe('make()', () => {
        it('should set the next id = 1 if the table is empty', async () => {
            const idManger: IdManager = await IdManager.make(databaseService.connection.createQueryRunner(), ['fwcloud']);

            expect(idManger["_ids"]).to.be.deep.equal({
                'fwcloud': {
                    id: 1
                }
            });
        });

        it('should set the next id = MAX()+1 if the table is not empty', async () => {
            await repositoryService.for(FwCloud).save({ id: 100, name: 'test' });

            const idManger: IdManager = await IdManager.make(databaseService.connection.createQueryRunner(), ['fwcloud']);

            expect(idManger["_ids"]).to.be.deep.equal({
                'fwcloud': {
                    id: 101
                }
            });
        });

        it('should ignore tables without entity', async () => {
            // tableWithoutEntitiy does not exists thus there is not an entity for this table
            const idManger: IdManager = await IdManager.make(databaseService.connection.createQueryRunner(), ['tableWithoutEntity']);

            expect(idManger["_ids"]).to.be.deep.equal({});
        });
    });

    describe('getNewId()', () => {
        it('should return the new id', async () => {
            await repositoryService.for(FwCloud).save({ id: 100, name: 'test' });

            const idManger: IdManager = await IdManager.make(databaseService.connection.createQueryRunner(), ['fwcloud']);

            expect(idManger.getNewId('fwcloud', 'id')).to.be.deep.equal(101);
        });

        it('should increment the id', async () => {
            await repositoryService.for(FwCloud).save({ id: 100, name: 'test' });

            const idManger: IdManager = await IdManager.make(databaseService.connection.createQueryRunner(), ['fwcloud']);

            idManger.getNewId('fwcloud', 'id');

            expect(idManger["_ids"]).to.be.deep.equal({
                'fwcloud': {
                    id: 102
                }
            });
        });
    });
})