import { describeName, expect, testSuite } from "../../mocha/global-setup"
import * as fs from "fs";
import { Application } from "../../../src/Application";
import { Snapshot, SnapshotData } from "../../../src/snapshots/snapshot";
import { RepositoryService } from "../../../src/database/repository.service";
import { Repository } from "typeorm";
import { FwCloud } from "../../../src/models/fwcloud/FwCloud";

let app: Application;
let fwCloud: FwCloud;
let fwcloudRepository: Repository<FwCloud>;

describe(describeName('Snapshot tests'), () => {
    beforeEach(async () => {
        app = testSuite.app;
        const repository: RepositoryService = await app.getService<RepositoryService>(RepositoryService.name);
        fwcloudRepository = repository.for(FwCloud);

        fwCloud = fwcloudRepository.create({
            name: 'testCloud'
        });

        fwCloud = await fwcloudRepository.save(fwCloud);

    });

    it('create should create the snapshot directory if it does not exist', async () => {
        expect(fs.existsSync(app.config.get('snapshot').data_dir)).to.be.false;

        await Snapshot.create(fwCloud, 'test');

        expect(fs.existsSync(app.config.get('snapshot').data_dir)).to.be.true;
    });

    it('create should generate an id to the snapshot file', async () => {
        const snapshot: Snapshot = await Snapshot.create(fwCloud, 'test');
        
        expect(snapshot.id).to.be.deep.eq(snapshot.date.valueOf());
    });

    it('create should generate a json file', async () => {
        const snapshot: Snapshot = await Snapshot.create(fwCloud, 'test');

        expect(fs.existsSync(snapshot.path)).to.be.true;
    });

    it('json file generated should include snapshot metadata', async() => {
        const snapshot: Snapshot = await Snapshot.create(fwCloud, 'test', 'comment');

        const snapshotData: any = JSON.parse(fs.readFileSync(snapshot.path).toString());

        expect(snapshotData.name).to.be.deep.equal(snapshot.data.name)
        expect(snapshotData.date).to.be.deep.equal(snapshot.date.valueOf())
        expect(snapshotData.fwcloud_id).to.be.deep.equal(snapshot.fwcloud.id)
        expect(snapshotData.comment).to.be.deep.equal(snapshot.data.comment)
        expect(snapshotData.version).to.be.deep.equal(snapshot.version)
    });

    it('load should load a snapshot from filesystem', async () => {
        const snapshot: Snapshot = await Snapshot.create(fwCloud, 'test');

        expect(await Snapshot.load(snapshot.path)).to.be.deep.equal(snapshot);
    });

    it('update should update a snapshot name and comment', async() => {
        let snapshot: Snapshot = await Snapshot.create(fwCloud, 'name', 'comment');

        const data: {name: string, comment: string} = {
            name: 'test',
            comment: 'test'
        };
        
        await snapshot.update(data);

        expect((await Snapshot.load(snapshot.path)).data.name).to.be.deep.equal('test');
        expect((await Snapshot.load(snapshot.path)).data.comment).to.be.deep.equal('test');
    });

    it('delete should remove the snapshot if it exists', async () => {
        const snapshot: Snapshot = await Snapshot.create(fwCloud, 'test');

        await snapshot.destroy();

        expect(fs.existsSync(snapshot.path)).to.be.false;
        expect(snapshot.exists).to.be.false;
    });
})