import { describeName, testSuite, expect } from "../../../mocha/global-setup"
import { Application } from "../../../../src/Application";
import { RepositoryService } from "../../../../src/database/repository.service";
import { FwCloud } from "../../../../src/models/fwcloud/FwCloud";
import { Ca } from "../../../../src/models/vpn/pki/Ca";
import { SnapshotData } from "../../../../src/snapshots/snapshot-data";
import { EntityExporter } from "../../../../src/snapshots/exporters/entity-exporter";

let app: Application;
let repositoryService: RepositoryService;

describe(describeName('Entity exporter tests'), () => {
    let fwcloud: FwCloud;
    let ca: Ca;

    beforeEach(async() => {
        app = testSuite.app;

        repositoryService = await app.getService<RepositoryService>(RepositoryService.name);
        const fwcloudRepository = repositoryService.for(FwCloud);

        fwcloud = fwcloudRepository.create({
            name: 'testCloud'
        });

        fwcloud = await fwcloudRepository.save(fwcloud);
        fwcloud = await fwcloudRepository.findOne(fwcloud.id);

        ca = repositoryService.for(Ca).create({
            fwcloud: { id: fwcloud.id },
            cn: 'test',
            days: 10
        });

        ca = await repositoryService.for(Ca).save(ca);
        ca = await repositoryService.for(Ca).findOne(ca.id);
    });

    it.only('export should export the fwcloud', async() => {
        const result = new SnapshotData;
        const exporter = await new EntityExporter(result, fwcloud).export()
        
        expect(result.data.fwcloud.FwCloud[0]).to.be.deep.equal(fwcloud.toJSON());
        expect(result.data.ca.Ca[0]).to.be.deep.equal(ca.toJSON());
    });
})