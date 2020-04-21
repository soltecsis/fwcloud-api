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
import { RepositoryService } from "../../../../src/database/repository.service";
import { FwCloud } from "../../../../src/models/fwcloud/FwCloud";
import { Ca } from "../../../../src/models/vpn/pki/Ca";
import { FSHelper } from "../../../../src/utils/fs-helper";
import * as path from "path";
import * as fs from "fs";
import { Snapshot } from "../../../../src/snapshots/snapshot";
import { SnapshotService } from "../../../../src/snapshots/snapshot.service";
import { Firewall } from "../../../../src/models/firewall/Firewall";

describe(describeName('Importer tests'), () => {
    let repositoryService: RepositoryService;
    let snapshotService: SnapshotService;
    
    beforeEach(async() => {
        repositoryService = await testSuite.app.getService<RepositoryService>(RepositoryService.name);
        snapshotService = await testSuite.app.getService<SnapshotService>(SnapshotService.name);
    });

    describe('import()', () => {
        it('should migrate the pki/CA directories from the snapshot into the DATA directory', async () => {
            const fwCloud: FwCloud = await repositoryService.for(FwCloud).save(repositoryService.for(FwCloud).create({
                name: 'test'
            }));

            const ca: Ca = await repositoryService.for(Ca).save(repositoryService.for(Ca).create({
                name: 'test',
                cn: 'test',
                days: 1,
                fwCloudId: fwCloud.id
            }));

            FSHelper.mkdirSync(path.join(fwCloud.getPkiDirectoryPath(), ca.id.toString()));
            fs.writeFileSync(path.join(fwCloud.getPkiDirectoryPath(), ca.id.toString(), 'test.txt'), "test");

            let snapshot: Snapshot = await Snapshot.create(snapshotService.config.data_dir, fwCloud);

            snapshot = await snapshot.restore();

            const newFwCloud: FwCloud = await repositoryService.for(FwCloud).findOne({name: 'test'});
            const newCA: Ca = await repositoryService.for(Ca).findOne({name: 'test', cn: 'test'});

            expect(FSHelper.directoryExistsSync(path.join(newFwCloud.getPkiDirectoryPath(), newCA.id.toString())));
        });

        it('should migrate the policy/firewall directories from the snapshot into the DATA directory', async () => {
            const fwCloud: FwCloud = await repositoryService.for(FwCloud).save(repositoryService.for(FwCloud).create({
                name: 'test'
            }));

            const firewall: Firewall = await repositoryService.for(Firewall).save(repositoryService.for(Firewall).create({
                name: 'test',
                fwCloudId: fwCloud.id
            }));

            FSHelper.mkdirSync(path.join(fwCloud.getPolicyDirectoryPath(), firewall.id.toString()));
            fs.writeFileSync(path.join(fwCloud.getPolicyDirectoryPath(), firewall.id.toString(), 'test.txt'), "test");

            let snapshot: Snapshot = await Snapshot.create(snapshotService.config.data_dir, fwCloud);

            snapshot = await snapshot.restore();

            const newFwCloud: FwCloud = await repositoryService.for(FwCloud).findOne({name: 'test'});
            const newFirewall: Firewall = await repositoryService.for(Firewall).findOne({name: 'test'});

            expect(FSHelper.directoryExistsSync(path.join(newFwCloud.getPolicyDirectoryPath(), newFirewall.id.toString())));
        });
    });
});