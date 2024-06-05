import { describeName, testSuite, expect } from '../../mocha/global-setup';
import { LogService } from '../../../src/logs/log.service';
import { FSHelper } from '../../../src/utils/fs-helper';
import { Application } from '../../../src/Application';
import winston from 'winston';

describe(describeName('LogService Unit Tests'), () => {
    let app: Application;
    let service: LogService;

    beforeEach(async() => {
        app = testSuite.app;
        service = await app.getService<LogService>(LogService.name);
    });

    it('should be provided as a service', async () => {
        expect(await app.getService<LogService>(LogService.name)).to.be.instanceOf(LogService);
    });

    describe('build()', () => {
        it('should create the logs directory', async () => {
            FSHelper.rmDirectorySync(app.config.get('log').directory);

            await LogService.make(app);

            expect(FSHelper.directoryExistsSync(app.config.get('log').directory)).to.be.true;
        });

        it('should instance the logger', async () => {
            const _service: LogService = await LogService.make(app);

            expect(_service.getLogger()).not.to.be.undefined;
        });
    });
});