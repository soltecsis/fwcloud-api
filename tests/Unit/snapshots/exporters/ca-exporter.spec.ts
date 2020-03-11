import { describeName, testSuite, expect } from "../../../mocha/global-setup";
import { FwCloud } from "../../../../src/models/fwcloud/FwCloud";
import { Application } from "../../../../src/Application";
import { RepositoryService } from "../../../../src/database/repository.service";
import { Ca } from "../../../../src/models/vpn/pki/Ca";
import { CaExporter } from "../../../../src/snapshots/exporters/ca-exporter";
import { SnapshotData } from "../../../../src/snapshots/snapshot-data";
import { Crt } from "../../../../src/models/vpn/pki/Crt";
import { CrtExporter } from "../../../../src/snapshots/exporters/crt-exporter";

let app: Application;
let repositoryService: RepositoryService;

describe.only(describeName('FwCloud exporter tests'), () => {
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

    it('export should export the fwcloud', async() => {
        const exporter = await new CaExporter(new SnapshotData, ca).export()
        
        expect(exporter.data.Ca[0]).to.be.deep.equal(new CaExporter(new SnapshotData, ca).exportToJSON())
    });

    it('export should include the crt referenced elements', async () => {
        let crt: Crt = repositoryService.for(Crt).create({
            ca: {id: ca.id},
            cn: 'test',
            days: 10,
            type: 1
        });

        crt = await repositoryService.for(Crt).save(crt);
        crt = await repositoryService.for(Crt).findOne(crt.id);

        expect((await new CaExporter(new SnapshotData, ca).export()).data.Crt[0])
            .to.be.deep.equal(new CrtExporter(new SnapshotData, crt).exportToJSON())
    });
});