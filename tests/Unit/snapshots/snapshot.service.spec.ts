import { describeName, testSuite, expect } from "../../mocha/global-setup";
import { Snapshot } from "../../../src/snapshots/snapshot";
import { Application } from "../../../src/Application";
import { SnapshotService } from "../../../src/snapshots/snapshot.service";
import { FwCloud } from "../../../src/models/fwcloud/FwCloud";
import { RepositoryService } from "../../../src/database/repository.service";
import { FSHelper } from "../../../src/utils/fs-helper";

let app: Application;
let service: SnapshotService;
let fwCloud: FwCloud

describe(describeName('Snapshot Service tests'), () => {
    
    beforeEach(async() => {
        app = testSuite.app;

        service = await app.getService<SnapshotService>(SnapshotService.name);
        const repository: RepositoryService = await app.getService<RepositoryService>(RepositoryService.name);
        const fwcloudRepository = repository.for(FwCloud);

        fwCloud = fwcloudRepository.create({
            name: 'testCloud'
        });

        fwCloud = await fwcloudRepository.save(fwCloud);
    });

    it('service instance should generate the snapshots directory', async() => {
        await FSHelper.remove(service.config.data_dir); 

        expect(await FSHelper.directoryExists(service.config.data_dir)).to.be.false;

        await SnapshotService.make(app);

        expect(await FSHelper.directoryExists(service.config.data_dir)).to.be.true;
    });

    it('getAll should return all created snapshots', async () => {
        const s1: Snapshot = await Snapshot.create(service.config.data_dir, fwCloud, '1');
        const s2: Snapshot = await Snapshot.create(service.config.data_dir, fwCloud, '2');

        expect(await service.getAll()).to.be.deep.equal([s1, s2]);
    });

    it('findOne should return a snapshot if the given id exists', async () => {
        const s1: Snapshot = await Snapshot.create(service.config.data_dir, fwCloud, 'test');

        expect(await service.findOne(s1.id)).to.be.deep.eq(s1);
    });

    it('update should return an updated snapshot', async() => {
        const s1: Snapshot = await Snapshot.create(service.config.data_dir, fwCloud, 'test');

        expect((await service.update(s1, {name: 'name', comment: 'comment'})).name).to.be.deep.eq(s1.name);
        expect((await service.update(s1, {name: 'name', comment: 'comment'})).comment).to.be.deep.eq(s1.comment);
    });

    it('remove snapshot should remove the snapshot', async() => {
        const s1: Snapshot = await Snapshot.create(service.config.data_dir, fwCloud, 'test');
        
        expect((await service.destroy(s1)).exists).to.be.false;
    });
})