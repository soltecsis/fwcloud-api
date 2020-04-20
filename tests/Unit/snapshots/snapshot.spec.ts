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

import { describeName, expect, testSuite } from "../../mocha/global-setup"
import * as fs from "fs";
import * as path from "path";
import { Application } from "../../../src/Application";
import { Snapshot, SnapshotMetadata } from "../../../src/snapshots/snapshot";
import { RepositoryService } from "../../../src/database/repository.service";
import { Repository } from "typeorm";
import { FwCloud } from "../../../src/models/fwcloud/FwCloud";
import { SnapshotService } from "../../../src/snapshots/snapshot.service";
import { FSHelper } from "../../../src/utils/fs-helper";
import { SnapshotNotCompatibleException } from "../../../src/snapshots/exceptions/snapshot-not-compatible.exception";
import { utc } from "moment";
import { Firewall } from "../../../src/models/firewall/Firewall";

let app: Application;
let fwCloud: FwCloud;
let fwcloudRepository: Repository<FwCloud>;
let service: SnapshotService;
let repositoryService: RepositoryService;

describe(describeName('Snapshot tests'), () => {
    beforeEach(async () => {
        app = testSuite.app;
        service = await app.getService<SnapshotService>(SnapshotService.name);
        repositoryService = await app.getService<RepositoryService>(RepositoryService.name);
        fwcloudRepository = repositoryService.for(FwCloud);

        fwCloud = fwcloudRepository.create({
            name: 'testCloud'
        });

        fwCloud = await fwcloudRepository.save(fwCloud);
        fwCloud = await fwcloudRepository.findOne(fwCloud.id);

    });

    it('create should create the fwcloud snapshot directory if it does not exists', async () => {
        const snapshot: Snapshot = await Snapshot.create(service.config.data_dir, fwCloud, 'test');

        expect(fs.statSync(path.join(service.config.data_dir, fwCloud.id.toString())).isDirectory()).to.be.true;
    })

    it('create should create the snapshot directory', async () => {
        const snapshot: Snapshot = await Snapshot.create(service.config.data_dir, fwCloud, 'test');

        expect(fs.statSync(snapshot.path).isDirectory()).to.be.true;
        expect(fs.statSync(path.join(snapshot.path, Snapshot.METADATA_FILENAME)).isFile()).to.be.true;

        expect(JSON.parse(fs.readFileSync(path.join(snapshot.path, Snapshot.METADATA_FILENAME)).toString())).to.be.deep.equal({
            timestamp: snapshot.date.valueOf(),
            name: snapshot.name,
            schema: snapshot.schema,
            comment: snapshot.comment,
            version: snapshot.version,
            fwcloud_id: snapshot.fwCloud.id,
        });
    });

    it('create should copy the pki fwcloud directory if it exists', async () => {
        if (FSHelper.directoryExists(app.config.get('pki').data_dir)) {
            await FSHelper.mkdir(path.join(app.config.get('pki').data_dir, fwCloud.id.toString()))
        }

        fs.writeFileSync(path.join(fwCloud.getPkiDirectoryPath(), 'test.txt'), "test file content");

        const snapshot: Snapshot = await Snapshot.create(service.config.data_dir, fwCloud, 'test');

        expect(fs.statSync(path.join(snapshot.path, Snapshot.PKI_DIRECTORY, 'test.txt')).isFile());
        expect(fs.readFileSync(path.join(snapshot.path, Snapshot.PKI_DIRECTORY, 'test.txt')).toString()).to.be.deep.eq('test file content');
    });

    it('create should export the fwcloud into the data file', async () => {
        const snaphost: Snapshot = await Snapshot.create(service.config.data_dir, fwCloud, 'test');

        expect(fs.statSync(path.join(snaphost.path, Snapshot.DATA_FILENAME)).isFile()).to.be.true;
    })

    it('create with an empty name should use the date as a name', async () => {
        const snapshot: Snapshot = await Snapshot.create(service.config.data_dir, fwCloud);

        expect(snapshot.name).to.be.deep.equal(snapshot.date.utc().format());
    })

    it('snaphost id should be the snapshot directory name which is the date timestamp', async () => {
        const snapshot: Snapshot = await Snapshot.create(service.config.data_dir, fwCloud, 'test');

        expect(snapshot.id).to.be.deep.equal(parseInt(path.basename(snapshot.path)));
        expect(snapshot.id).to.be.deep.equal(snapshot.date.valueOf());
    })

    it('load should load a snapshot from filesystem', async () => {
        const snapshot: Snapshot = await Snapshot.create(service.config.data_dir, fwCloud, 'test');

        expect(await Snapshot.load(snapshot.path)).to.be.deep.equal(snapshot);
    });

    it('update should update a snapshot name and comment', async () => {
        let snapshot: Snapshot = await Snapshot.create(service.config.data_dir, fwCloud, 'name', 'comment');

        const data: { name: string, comment: string } = {
            name: 'test',
            comment: 'test'
        };

        await snapshot.update(data);

        expect((await Snapshot.load(snapshot.path)).name).to.be.deep.equal('test');
        expect((await Snapshot.load(snapshot.path)).comment).to.be.deep.equal('test');
    });

    it('delete should remove the snapshot if it exists', async () => {
        const snapshot: Snapshot = await Snapshot.create(service.config.data_dir, fwCloud, 'test');

        await snapshot.destroy();

        expect(fs.existsSync(snapshot.path)).to.be.false;
        expect(snapshot.exists).to.be.false;
    });

    describe('restore()', () => {

        it('restore should restore a fwcloud as a new fwcloud', async () => {
            const snaphost: Snapshot = await Snapshot.create(service.config.data_dir, fwCloud, 'test');

            await snaphost.restore();
            
            const importedFwCloud: FwCloud = await fwcloudRepository.findOne(fwCloud.id + 1)

            expect(importedFwCloud.name).to.be.deep.equal(fwCloud.name);
        });

        it('restore should throw an exception if the snapshot is not compatible', async () => {
            let snaphost: Snapshot = await Snapshot.create(service.config.data_dir, fwCloud, 'test');

            const metadata: SnapshotMetadata = JSON.parse(fs.readFileSync(path.join(snaphost.path, Snapshot.METADATA_FILENAME)).toString());
            metadata.schema = '0.0.0';
            fs.writeFileSync(path.join(snaphost.path, Snapshot.METADATA_FILENAME), JSON.stringify(metadata, null, 2));

            snaphost = await Snapshot.load(snaphost.path);

            async function t() {
                return snaphost.restore();
            }
            
            await expect(t()).to.be.rejectedWith(SnapshotNotCompatibleException);
        });

        it('restore should mark as uncompiled all fwcloud firewalls', async () => {
            let firewall: Firewall = repositoryService.for(Firewall).create({
                name: 'firewall_test',
                status: 1,
                fwCloudId: fwCloud.id
            });

            let firewall2: Firewall = repositoryService.for(Firewall).create({
                name: 'firewall_test2',
                status: 1,
                fwCloudId: fwCloud.id
            });

            await repositoryService.for(Firewall).save([firewall, firewall2]);
            firewall = await repositoryService.for(Firewall).findOne(firewall.id);
            firewall2 = await repositoryService.for(Firewall).findOne(firewall2.id);

            let snaphost: Snapshot = await Snapshot.create(service.config.data_dir, fwCloud, 'test');

            await snaphost.restore();

            const newFwCloud: FwCloud = await repositoryService.for(FwCloud).findOne(fwCloud.id + 1);

            firewall = (await repositoryService.for(Firewall).find({fwCloudId: newFwCloud.id}))[0];
            firewall2 = (await repositoryService.for(Firewall).find({fwCloudId: newFwCloud.id}))[1];

            expect(firewall.status).to.be.deep.eq(3);
            expect(firewall.compiled_at).to.be.null;
            expect(firewall.installed_at).to.be.null;

            expect(firewall2.status).to.be.deep.eq(3);
            expect(firewall2.compiled_at).to.be.null;
            expect(firewall2.installed_at).to.be.null;
        });

        it('restore should migrate snapshot from the old fwcloud to the new one', async () => {
            const snapshotService: SnapshotService = await app.getService<SnapshotService>(SnapshotService.name);
            const repositoryService: RepositoryService = await app.getService<RepositoryService>(RepositoryService.name);
            const fwCloudRepository: Repository<FwCloud> = repositoryService.for(FwCloud);

            let snaphost1: Snapshot = await Snapshot.create(service.config.data_dir, fwCloud, 'test');
            let snaphost2: Snapshot = await Snapshot.create(service.config.data_dir, fwCloud, 'test');

            await snaphost2.restore();

            const newFwCloud: FwCloud = await fwCloudRepository.findOne(fwCloud.id + 1);

            expect(fs.existsSync(snaphost1.path)).to.be.false;
            expect(fs.existsSync(snaphost2.path)).to.be.false;
            expect(fs.existsSync(path.join(snapshotService.config.data_dir, newFwCloud.id.toString()))).to.be.true;
        });
    });

})