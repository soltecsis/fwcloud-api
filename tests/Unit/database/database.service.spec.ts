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

import { describeName, testSuite, expect } from "../../mocha/global-setup";
import { AbstractApplication } from "../../../src/fonaments/abstract-application";
import { DatabaseService } from "../../../src/database/database.service";
import { FwCloud } from "../../../src/models/fwcloud/FwCloud";
import { RepositoryService } from "../../../src/database/repository.service";
import { Repository } from "typeorm";

let app: AbstractApplication;
let databaseService: DatabaseService;

describe(describeName('Database Service tests'), () => {
    beforeEach(async() => {
        app = testSuite.app;
        databaseService = await app.getService<DatabaseService>(DatabaseService.name);
    });

    /**
     * Schema version is generated based on version.json value now. Thus, getDatabaseSchemaVersion() is deprecated. 
     * @deprecated
     */
    /*describe(describeName('getDatabaseSchemaVersion()'), () => {
        
        it('should return the same schema version after insert data', async() => {
            const versionBefore: string = await databaseService.getDatabaseSchemaVersion();

            const fwCloudRepository: Repository<FwCloud> = (await app.getService<RepositoryService>(RepositoryService.name)).for(FwCloud);
            const fwCloud: FwCloud = fwCloudRepository.create({name: 'test'});
            await fwCloudRepository.save(fwCloud);

            const versionAfter: string = await databaseService.getDatabaseSchemaVersion();

            expect(versionAfter).to.be.deep.eq(versionBefore);
        });
    })*/
});