import { describeName, testSuite, expect } from "../../../mocha/global-setup";
import { Application } from "../../../../src/Application";
import { RepositoryService } from "../../../../src/database/repository.service";
import { FwCloud } from "../../../../src/models/fwcloud/FwCloud";
import { FwCloudImporter } from "../../../../src/snapshots/importers/fwcloud-importer";
import { ImportMapping } from "../../../../src/snapshots/import-mapping";
import { User } from "../../../../src/models/user/User";

let app: Application;
let repositoryService: RepositoryService;
let importer: FwCloudImporter;
let mapper: ImportMapping;
let user: User;

describe(describeName('FwCloud Snapshot importer'), () => {
    beforeEach(async() => {
        app = testSuite.app;
        repositoryService = await app.getService<RepositoryService>(RepositoryService.name);
        importer = await FwCloudImporter.build();
        mapper = new ImportMapping();

        user = (await repositoryService.for(User).find({
            where: {
                'email': 'loggedUser@fwcloud.test'
            }
        }))[0];
    });

    it('import should import a fwcloud without id', async () => {
        let fwcloud: FwCloud = repositoryService.for(FwCloud).create({id: 100, name: 'imported_fwcloud'});

        await importer.import(fwcloud, mapper, user);

        expect(mapper.getItem(FwCloud, 100)).not.to.be.undefined;

        const new_fwcloud: FwCloud = await repositoryService.for(FwCloud).findOne(mapper.getItem(FwCloud, 100), {
            relations: ['users']
        });

        expect(new_fwcloud.name).to.be.deep.equal('imported_fwcloud');
        expect(new_fwcloud.name).to.be.deep.equal('imported_fwcloud');
        expect(new_fwcloud.users[0].id).to.be.deep.equal(user.id);
    });
});