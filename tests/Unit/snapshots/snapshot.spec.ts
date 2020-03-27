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

    it('restore should restore a fwcloud as a new fwcloud', async () => {
        const snaphost: Snapshot = await Snapshot.create(service.config.data_dir, fwCloud, 'test');

        fwCloud.name = 'fwcloud';
        await fwcloudRepository.save(fwCloud);

        await snaphost.restore();
        
        const importedFwCloud: FwCloud = await fwcloudRepository.findOne(fwCloud.id)

        expect(importedFwCloud.name).not.to.be.deep.equal(fwCloud.name);
    });

    it('restore should throw an exception if the snapshot is not compatible', async () => {
        let snaphost: Snapshot = await Snapshot.create(service.config.data_dir, fwCloud, 'test');

        const metadata: SnapshotMetadata = JSON.parse(fs.readFileSync(path.join(snaphost.path, Snapshot.METADATA_FILENAME)).toString());
        metadata.schema = 'test';
        fs.writeFileSync(path.join(snaphost.path, Snapshot.METADATA_FILENAME), JSON.stringify(metadata, null, 2));

        snaphost = await Snapshot.load(snaphost.path);

        async function t() {
            return snaphost.restore();
        }
        
        await expect(t()).to.be.rejectedWith(SnapshotNotCompatibleException);
    });

    it.skip('restore should mark as uncompiled all fwcloud firewalls', async () => {
        let firewall: Firewall = repositoryService.for(Firewall).create({
            name: 'firewall_test',
            status: 1,
            fwCloudId: fwCloud.id
        });

        await repositoryService.for(Firewall).save(firewall);
        firewall = await repositoryService.for(Firewall).findOne(firewall.id);

        let snaphost: Snapshot = await Snapshot.create(service.config.data_dir, fwCloud, 'test');

        await snaphost.restore();

        firewall = await repositoryService.for(Firewall).findOne(firewall.id);

        expect(firewall.status).to.be.deep.eq(0);
        expect(firewall.compiled_at).to.be.null;
        expect(firewall.installed_at).to.be.null;
    });

})