import { describeName, expect, testSuite } from "../../mocha/global-setup";
import { Application } from "../../../src/Application";
import { FwCloudExportService } from "../../../src/fwcloud-exporter/fwcloud-export.service";
import { FSHelper } from "../../../src/utils/fs-helper";
import { FwCloudExport } from "../../../src/fwcloud-exporter/fwcloud-export";
import { FwCloud } from "../../../src/models/fwcloud/FwCloud";
import { getRepository } from "typeorm";
import StringHelper from "../../../src/utils/string.helper";
import { User } from "../../../src/models/user/User";
import { createUser, sleep } from "../../utils/utils";

describe(describeName('FwCloudExportService Unit Tests'), () => {
    let app: Application;
    let service: FwCloudExportService;
    let fwCloud: FwCloud;
    let user: User;

    before(async() => {
        app = testSuite.app;
        service = await app.getService<FwCloudExportService>(FwCloudExportService.name);
        fwCloud = await getRepository(FwCloud).save(getRepository(FwCloud).create({
            name: StringHelper.randomize(10)
        }));

        user = await createUser({});
    });

    it('should be provided as a service', async () => {
        expect(await app.getService<FwCloudExportService>(FwCloudExportService.name)).to.be.instanceOf(FwCloudExportService);
    });

    describe('build()', () => {
        it('should create the export directory', async () => {
            FSHelper.rmDirectorySync(app.config.get('exporter').data_dir);

            await FwCloudExportService.make(app);

            expect(FSHelper.directoryExistsSync(app.config.get('exporter').data_dir)).to.be.true;
            expect(FSHelper.directoryExistsSync(app.config.get('exporter').upload_dir)).to.be.true;
        });
    });


    describe('create()', () => {
        it('should create an export file and metadata file', async () => {
            const fwCloudExport: FwCloudExport = await service.create(fwCloud, user);

            expect(fwCloudExport).to.be.instanceOf(FwCloudExport);
            expect(FSHelper.fileExistsSync(fwCloudExport.exportPath)).to.be.true;
            expect(FSHelper.fileExistsSync(fwCloudExport.metadataPath)).to.be.true;
        });

        it('should remove the export directory', async () => {
            const fwCloudExport: FwCloudExport = await service.create(fwCloud, user);

            expect(FSHelper.directoryExistsSync(fwCloudExport.path)).to.be.false;
        });

        it('should remove all generated files after ttl', async () => {
            const fwCloudExport: FwCloudExport = await service.create(fwCloud, user, 1);

            await sleep(4);
            expect(FSHelper.fileExistsSync(fwCloudExport.exportPath)).to.be.false;
            expect(FSHelper.fileExistsSync(fwCloudExport.metadataPath)).to.be.false;
        });

    })
});