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
import { Snapshot } from "../../../src/snapshots/snapshot";
import { Application } from "../../../src/Application";
import { SnapshotService } from "../../../src/snapshots/snapshot.service";
import { FwCloud } from "../../../src/models/fwcloud/FwCloud";
import { FSHelper } from "../../../src/utils/fs-helper";

let app: Application;
let service: SnapshotService;
let fwCloud: FwCloud
let fwCloud2: FwCloud;

describe(describeName('SnapshotService Unit Tests'), () => {

    before(async () => {
        app = testSuite.app;

        service = await app.getService<SnapshotService>(SnapshotService.name);
        
        fwCloud = await FwCloud.save(FwCloud.create({
            name: 'testCloud'
        }));

        fwCloud2 = await FwCloud.save(FwCloud.create({
            name: 'testCloud2'
        }));
    });

    describe('make()', () => {
        it('should generate the snapshots directory', async () => {
            await FSHelper.rmDirectory(service.config.data_dir);

            expect(await FSHelper.directoryExists(service.config.data_dir)).to.be.false;

            await SnapshotService.make(app);

            expect(await FSHelper.directoryExists(service.config.data_dir)).to.be.true;
        });
    });

    describe('getAll()', () => {

        it('should return all created snapshots belonging to the fwcloud', async () => {
            let s1: Snapshot = await Snapshot.create(service.config.data_dir, fwCloud, '1');
            let s2: Snapshot = await Snapshot.create(service.config.data_dir, fwCloud, '2');
            let s3: Snapshot = await Snapshot.create(service.config.data_dir, fwCloud2, '3');

            const expected = await service.getAll(fwCloud);

            expect(await service.getAll(fwCloud)).to.be.deep.equal([s2, s1]);
        });

        it('should return an empty list if the fwcloud snapshot directory does not exists', async () => {
            expect(await service.getAll(fwCloud)).to.be.deep.equal([]);
        });
    });

    describe('findOne()', () => {

        it('should return a snapshot if the given id exists', async () => {
            let s1: Snapshot = await Snapshot.create(service.config.data_dir, fwCloud, 'test');

            expect(await service.findOne(fwCloud, s1.id)).to.be.deep.eq(s1);
        });
    });

    describe('update()', () => {

        it('should updated the name and the comment', async () => {
            const s1: Snapshot = await Snapshot.create(service.config.data_dir, fwCloud, 'test');

            expect((await service.update(s1, { name: 'name', comment: 'comment' })).name).to.be.deep.eq(s1.name);
            expect((await service.update(s1, { name: 'name', comment: 'comment' })).comment).to.be.deep.eq(s1.comment);
        });
    });

    describe('remove()', () => {

        it('should remove the snapshot', async () => {
            const s1: Snapshot = await Snapshot.create(service.config.data_dir, fwCloud, 'test');

            expect((await service.destroy(s1)).exists).to.be.false;
        });
    });
})