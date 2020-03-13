import { describeName, testSuite, expect } from "../../mocha/global-setup";
import { SnapshotData } from "../../../src/snapshots/snapshot-data";
import { RepositoryService } from "../../../src/database/repository.service";
import { Application } from "../../../src/Application";
import { FwCloud } from "../../../src/models/fwcloud/FwCloud";
import { DeepPartial } from "typeorm";
import { Ca } from "../../../src/models/vpn/pki/Ca";

let app: Application;
let repositoryService: RepositoryService;

describe(describeName('Snapshot data tests'), () => {
    beforeEach(async() => {
        app = testSuite.app;
        repositoryService = await app.getService<RepositoryService>(RepositoryService.name);
    });


    it('merge should include the resources from both instances', () => {
        const s1: SnapshotData = new SnapshotData();
        const s2: SnapshotData = new SnapshotData();

        const fwClouds: Array<DeepPartial<FwCloud>> = [
            repositoryService.for(FwCloud).create({name: "test1"}),
            repositoryService.for(FwCloud).create({name: "test2"})
        ];

        const cas: Array<DeepPartial<Ca>> = [
            repositoryService.for(Ca).create({}),
            repositoryService.for(Ca).create({})
        ];

        s1.data = {
            fwcloud: {
                FwCloud: fwClouds
            }
        }

        s2.data = {
            ca: {
                Ca: cas
            }
        }

        expect(s1.merge(s2).data).to.be.deep.eq({
            FwCloud: fwClouds,
            Ca: cas
        });
    });
});