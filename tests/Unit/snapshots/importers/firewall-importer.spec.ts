import { describeName, testSuite, expect } from "../../../mocha/global-setup";
import { Application } from "../../../../src/Application";
import { RepositoryService } from "../../../../src/database/repository.service";
import { FwCloud } from "../../../../src/models/fwcloud/FwCloud";
import { ImportMapping } from "../../../../src/snapshots/import-mapping";
import { FirewallImporter } from "../../../../src/snapshots/importers/firewall-importer";
import { Firewall } from "../../../../src/models/firewall/Firewall";

let app: Application;
let repositoryService: RepositoryService;
let importer: FirewallImporter;
let mapper: ImportMapping;

describe(describeName('Firewall Snapshot importer'), () => {
    beforeEach(async() => {
        app = testSuite.app;
        repositoryService = await app.getService<RepositoryService>(RepositoryService.name);
        importer = await FirewallImporter.build();
        mapper = new ImportMapping();
    });

    it('import should import the entity', async () => {
        let fwCloud: FwCloud = repositoryService.for(FwCloud).create({name: 'test'});
        await repositoryService.for(FwCloud).save(fwCloud);

        mapper.newItem(FwCloud, 100, fwCloud.id)

        let item: Firewall = repositoryService.for(Firewall).create({id: 100, status: 1, name: 'imported_firewall', fwcloud: {id: 100}});

        await importer.import(item, mapper);

        expect(mapper.getItem(Firewall, 100)).not.to.be.undefined;

        const new_item: Firewall = await repositoryService.for(Firewall).findOne(mapper.getItem(Firewall, 100), { relations: ['fwcloud']});

        expect(new_item.fwcloud.id).to.be.deep.equal(fwCloud.id);
        expect(new_item.name).to.be.deep.equal('imported_firewall');
        expect(new_item.status).to.be.deep.equal(0);
    });
});