import { describeName, testSuite, expect } from "../../../mocha/global-setup";
import { Application } from "../../../../src/Application";
import { RepositoryService } from "../../../../src/database/repository.service";
import { FwCloud } from "../../../../src/models/fwcloud/FwCloud";
import { ImportMapping } from "../../../../src/snapshots/import-mapping";
import { Ca } from "../../../../src/models/vpn/pki/Ca";
import { CrtImporter } from "../../../../src/snapshots/importers/crt-importer";
import { Crt } from "../../../../src/models/vpn/pki/Crt";

let app: Application;
let repositoryService: RepositoryService;
let importer: CrtImporter;
let mapper: ImportMapping;

describe.only(describeName('Crt Snapshot importer'), () => {
    beforeEach(async() => {
        app = testSuite.app;
        repositoryService = await app.getService<RepositoryService>(RepositoryService.name);
        importer = await CrtImporter.build();
        mapper = new ImportMapping();
    });

    it('import should import a fwcloud without id', async () => {
        let fwCloud: FwCloud = repositoryService.for(FwCloud).create({name: 'test'});
        await repositoryService.for(FwCloud).save(fwCloud);

        let ca: Ca = repositoryService.for(Ca).create({cn: 'test', fwcloud: {id: fwCloud.id}, days: 10});
        await repositoryService.for(Ca).save(ca);

        mapper.newItem(FwCloud, 100, fwCloud.id)
        mapper.newItem(Ca, 100, ca.id)

        let crt: Crt = repositoryService.for(Crt).create({id: 100, cn: 'imported_crt', days: 10, type: 1, ca: {id: 100}});

        await importer.import(crt, mapper);

        expect(mapper.getItem(Crt, 100)).not.to.be.undefined;

        const new_item: Crt = await repositoryService.for(Crt).findOne(mapper.getItem(Crt, 100), { relations: ['ca']});

        expect(new_item.ca.id).to.be.deep.equal(ca.id);
        expect(new_item.cn).to.be.deep.equal(crt.cn);
    });
});