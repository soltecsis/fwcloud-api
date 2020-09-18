import { describeName, testSuite, expect } from "../../../mocha/global-setup";
import { AbstractApplication } from "../../../../src/fonaments/abstract-application";
import { FwCloud } from "../../../../src/models/fwcloud/FwCloud";
import { Repository, getRepository } from "typeorm";
import { FSHelper } from "../../../../src/utils/fs-helper";
import * as fs from "fs";
import * as path from "path";
import sinon from "sinon";
import StringHelper from "../../../../src/utils/string.helper";
import { FwcTree } from "../../../../src/models/tree/fwc-tree.model";
import { Tree } from "../../../../src/models/tree/Tree";
import db from "../../../../src/database/database-manager";


let app: AbstractApplication;

describe(describeName('FwCloud Unit Tests'), () => {
    
    before(async () => {
        app = testSuite.app;
    });

    describe('removeDataDirectories()', () => {
        it('should remove fwcloud pki directory if it exists', async () => {
            const fwCloud: FwCloud = await FwCloud.save(FwCloud.create({ name: 'test' }));
            
            FSHelper.mkdirSync(fwCloud.getPkiDirectoryPath());
            fs.writeFileSync(path.join(fwCloud.getPkiDirectoryPath(), 'test'), 'test');

            fwCloud.removeDataDirectories();

            expect(FSHelper.directoryExistsSync(fwCloud.getPkiDirectoryPath())).to.be.false;
        });

        it('should remove fwcloud policy directory if it exists', async () => {
            const fwCloud: FwCloud = await FwCloud.save(FwCloud.create({ name: 'test' }));
            
            FSHelper.mkdirSync(fwCloud.getPolicyDirectoryPath());
            fs.writeFileSync(path.join(fwCloud.getPolicyDirectoryPath(), 'test'), 'test');

            fwCloud.removeDataDirectories();

            expect(FSHelper.directoryExistsSync(fwCloud.getPolicyDirectoryPath())).to.be.false;
        });

        it('should not remove data directories if they do not exist', async () => {
            const fwCloud: FwCloud = await FwCloud.save(FwCloud.create({ name: 'test' }));
            
            fwCloud.removeDataDirectories();

            expect(FSHelper.directoryExistsSync(fwCloud.getPolicyDirectoryPath())).to.be.false;
            expect(FSHelper.directoryExistsSync(fwCloud.getPkiDirectoryPath())).to.be.false;
        });

        it('should be called before remove', async () => {
            const fwCloud: FwCloud = await FwCloud.save(FwCloud.create({ name: 'test' }));
            
            const spy = sinon.spy(FwCloud.prototype, "removeDataDirectories");

            await fwCloud.remove();

            expect(spy.calledOnce).to.be.true;
        });
    });

    describe('create event', () => {
        it('should create the fwcloud data directories', async () => {
            const fwCloud: FwCloud = await FwCloud.save(FwCloud.create({
                name: StringHelper.randomize(10)
            }));

            expect(fs.existsSync(fwCloud.getPolicyDirectoryPath())).to.be.true;
            expect(fs.existsSync(fwCloud.getPkiDirectoryPath())).to.be.true;
        });
    });
});