import { describeName, testSuite, expect } from "../../mocha/global-setup";
import { AbstractApplication } from "../../../src/fonaments/abstract-application";
import { DatabaseService } from "../../../src/database/database.service";
import { FwCloud } from "../../../src/models/fwcloud/FwCloud";
import { RepositoryService } from "../../../src/database/repository.service";
import { Repository } from "typeorm";

let app: AbstractApplication;
let databaseService: DatabaseService;

describe(describeName('Database Service tests'), () => {
    beforeEach(async() => {
        app = testSuite.app;
        databaseService = await app.getService<DatabaseService>(DatabaseService.name);
    });

    describe(describeName('getDatabaseSchemaVersion()'), () => {
        
        it('should return the same schema version after insert data', async() => {
            const versionBefore: string = await databaseService.getDatabaseSchemaVersion();

            const fwCloudRepository: Repository<FwCloud> = (await app.getService<RepositoryService>(RepositoryService.name)).for(FwCloud);
            const fwCloud: FwCloud = fwCloudRepository.create({name: 'test'});
            await fwCloudRepository.save(fwCloud);

            const versionAfter: string = await databaseService.getDatabaseSchemaVersion();

            expect(versionAfter).to.be.deep.eq(versionBefore);
        });

    })
});