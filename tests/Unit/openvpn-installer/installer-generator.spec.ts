import { describeName, playgroundPath, testSuite } from "../../mocha/global-setup";
import path from "path";
import { FSHelper } from "../../../src/utils/fs-helper";
import { expect } from "chai";

describe(describeName('InstallerGenerator Unit Tests'), () => {
    beforeEach(async () => {
        await FSHelper.copy("lib/nsis", path.join(playgroundPath, "lib/nsis"));
    });

    describe.only('clean()', () => {
        it('true should be true', () => {
            expect(true).to.be.true;
        });
    })
});