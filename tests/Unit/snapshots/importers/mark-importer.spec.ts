import { describeName, testSuite, expect } from "../../../mocha/global-setup";
import { Application } from "../../../../src/Application";
import { RepositoryService } from "../../../../src/database/repository.service";
import { FwCloud } from "../../../../src/models/fwcloud/FwCloud";
import { ImportMapping } from "../../../../src/snapshots/import-mapping";
import { FwcTreeImporter } from "../../../../src/snapshots/importers/fwc-tree-importer";
import { FwcTree } from "../../../../src/models/tree/fwc-tree.model";
import { IPObjImporter } from "../../../../src/snapshots/importers/ip-obj-importer";
import { IPObj } from "../../../../src/models/ipobj/IPObj";
import { MarkImporter } from "../../../../src/snapshots/importers/mark-importer";
import { Mark } from "../../../../src/models/ipobj/Mark";

let app: Application;
let repositoryService: RepositoryService;
let importer: MarkImporter;
let mapper: ImportMapping;

describe(describeName('Mark Snapshot importer'), () => {
    beforeEach(async() => {
        app = testSuite.app;
        repositoryService = await app.getService<RepositoryService>(RepositoryService.name);
        importer = await MarkImporter.build();
        mapper = new ImportMapping();
    });

    it('import should import the entity', async () => {
        let fwCloud: FwCloud = repositoryService.for(FwCloud).create({name: 'test'});
        await repositoryService.for(FwCloud).save(fwCloud);

        mapper.newItem(FwCloud, 100, fwCloud.id)

        let item: Mark = repositoryService.for(Mark).create({id: 100, name: 'imported', code: 0, fwCloud: {id: 100}});

        await importer.import(item, mapper);

        expect(mapper.getItem(Mark, 100)).not.to.be.undefined;

        const new_item: Mark = await repositoryService.for(Mark).findOne(mapper.getItem(Mark, 100), { relations: ['fwCloud']});

        expect(new_item.fwCloud.id).to.be.deep.equal(fwCloud.id);
        expect(new_item.name).to.be.deep.equal('imported');
    });
});