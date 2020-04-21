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

    });

    describe('directories()', () => {
        it('directories should return an array of directory paths', async () => {
            const directoryTest: string = path.join(playgroundPath, 'test');
            const directory1 = path.join(directoryTest, 'test1');
            const directory2 = path.join(directoryTest, 'test2');

            fs.mkdirSync(directoryTest);
            fs.mkdirSync(directory1);
            fs.mkdirSync(directory2);

            expect(await FSHelper.directories(directoryTest)).to.be.deep.eq([
                directory1,
                directory2
            ]);
        });
    });
})