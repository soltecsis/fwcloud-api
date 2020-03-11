import { describeName, testSuite, expect } from "../../../mocha/global-setup";
import { Application } from "../../../../src/Application";
import { RepositoryService } from "../../../../src/database/repository.service";
import { FwCloud } from "../../../../src/models/fwcloud/FwCloud";
import { ImportMapping } from "../../../../src/snapshots/import-mapping";
import { FwcTreeImporter } from "../../../../src/snapshots/importers/fwc-tree-importer";
import { FwcTree } from "../../../../src/models/tree/fwc-tree.model";

let app: Application;
let repositoryService: RepositoryService;
let importer: FwcTreeImporter;
let mapper: ImportMapping;

describe(describeName('Fwc Tree Snapshot importer'), () => {
    beforeEach(async() => {
        app = testSuite.app;
        repositoryService = await app.getService<RepositoryService>(RepositoryService.name);
        importer = await FwcTreeImporter.build();
        mapper = new ImportMapping();
    });

    it('import should import the entity', async () => {
        let fwCloud: FwCloud = repositoryService.for(FwCloud).create({name: 'test'});
        await repositoryService.for(FwCloud).save(fwCloud);

        mapper.newItem(FwCloud, 100, fwCloud.id)

        let item: FwcTree = repositoryService.for(FwcTree).create({id: 100, name: 'imported', fwCloud: {id: 100}});

        await importer.import(item, mapper);

        expect(mapper.getItem(FwcTree, 100)).not.to.be.undefined;

        const new_item: FwcTree = await repositoryService.for(FwcTree).findOne(mapper.getItem(FwcTree, 100), { relations: ['fwCloud']});

        expect(new_item.fwCloud.id).to.be.deep.equal(fwCloud.id);
        expect(new_item.name).to.be.deep.equal('imported');
    });
});