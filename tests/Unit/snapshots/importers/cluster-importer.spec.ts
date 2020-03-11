import { describeName, testSuite, expect } from "../../../mocha/global-setup";
import { Application } from "../../../../src/Application";
import { RepositoryService } from "../../../../src/database/repository.service";
import { FwCloud } from "../../../../src/models/fwcloud/FwCloud";
import { ImportMapping } from "../../../../src/snapshots/import-mapping";
import { ClusterImporter } from "../../../../src/snapshots/importers/cluster-importer";
import { Cluster } from "../../../../src/models/firewall/Cluster";

let app: Application;
let repositoryService: RepositoryService;
let importer: ClusterImporter;
let mapper: ImportMapping;

describe.only(describeName('Cluster Snapshot importer'), () => {
    beforeEach(async() => {
        app = testSuite.app;
        repositoryService = await app.getService<RepositoryService>(RepositoryService.name);
        importer = await ClusterImporter.build();
        mapper = new ImportMapping();
    });

    it('import should import the entity', async () => {
        let fwCloud: FwCloud = repositoryService.for(FwCloud).create({name: 'test'});
        await repositoryService.for(FwCloud).save(fwCloud);

        mapper.newItem(FwCloud, 100, fwCloud.id)

        let item: Cluster = repositoryService.for(Cluster).create({id: 100, name: 'imported_cluster', fwcloud: {id: 100}});

        await importer.import(item, mapper);

        expect(mapper.getItem(Cluster, 100)).not.to.be.undefined;

        const new_item: Cluster = await repositoryService.for(Cluster).findOne(mapper.getItem(Cluster, 100), { relations: ['fwcloud']});

        expect(new_item.fwcloud.id).to.be.deep.equal(fwCloud.id);
        expect(new_item.name).to.be.deep.equal('imported_cluster');
    });
});