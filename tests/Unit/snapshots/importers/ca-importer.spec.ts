import { describeName, testSuite, expect } from "../../../mocha/global-setup";
import { Application } from "../../../../src/Application";
import { RepositoryService } from "../../../../src/database/repository.service";
import { before } from "mocha";
import { FwCloud } from "../../../../src/models/fwcloud/FwCloud";
import { FwCloudImporter } from "../../../../src/snapshots/importers/fwcloud-importer";
import { ImportMapping } from "../../../../src/snapshots/import-mapping";
import { CaImporter } from "../../../../src/snapshots/importers/ca-importer";
import { Ca } from "../../../../src/models/vpn/pki/Ca";

let app: Application;
let repositoryService: RepositoryService;
let importer: CaImporter;
let mapper: ImportMapping;

describe(describeName('FwCloud Snapshot importer'), () => {
    beforeEach(async() => {
        app = testSuite.app;
        repositoryService = await app.getService<RepositoryService>(RepositoryService.name);
        importer = await CaImporter.build();
        mapper = new ImportMapping();
    });

    it('import should import a fwcloud without id', async () => {
        let fwCloud: FwCloud = repositoryService.for(FwCloud).create({name: 'test'});
        await repositoryService.for(FwCloud).save(fwCloud);

        mapper.newItem(FwCloud, 100, fwCloud.id)

        let ca: Ca = repositoryService.for(Ca).create({id: 100, cn: 'imported_ca', days: 10, fwcloud: {id: 100}});

        await importer.import(ca, mapper);

        expect(mapper.getItem(Ca, 100)).not.to.be.undefined;

        const new_ca: Ca = await repositoryService.for(Ca).findOne(mapper.getItem(Ca, 100), { relations: ['fwcloud']});

        expect(new_ca.fwcloud.id).to.be.deep.equal(fwCloud.id);
        expect(new_ca.cn).to.be.deep.equal(ca.cn);
    });
});