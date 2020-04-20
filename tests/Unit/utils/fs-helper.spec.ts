import { describeName, playgroundPath, expect } from "../../mocha/global-setup";
import * as path from "path";
import * as fs from "fs";
import { FSHelper } from "../../../src/utils/fs-helper";

describe(describeName(), () => {
    describe('moveDirectory()', () => {

        it('moveDirectory should copy the directory', async () => {
            const source: string = path.join(playgroundPath, 'test');
            const destination: string = path.join(playgroundPath, 'movedTest');
            fs.mkdirSync(source);
            fs.writeFileSync(path.join(source, 'test'), "test");

            await FSHelper.moveDirectory(source, destination);

            expect(fs.existsSync(path.join(destination))).to.be.true;
            expect(fs.existsSync(path.join(destination, 'test'))).to.be.true;
            expect(fs.existsSync(source)).to.be.false;
        });

    })
})