/*!
    Copyright 2019 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
    https://soltecsis.com
    info@soltecsis.com


    This file is part of FWCloud (https://fwcloud.net).

    FWCloud is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    FWCloud is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with FWCloud.  If not, see <https://www.gnu.org/licenses/>.
*/

import { describeName, playgroundPath, expect } from "../../mocha/global-setup";
import * as path from "path";
import * as fs from "fs";
import { FSHelper } from "../../../src/utils/fs-helper";

describe(describeName('FsHelper Unit Tests'), () => {
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

    describe('fileExistsSync()', () => {
        it('should return true if the file exists', () => {
            const filePath: string = path.join(playgroundPath, 'test', 'file.txt');
            FSHelper.mkdirSync(path.dirname(filePath));
            fs.writeFileSync(filePath, "");

            expect(FSHelper.fileExistsSync(filePath)).to.be.true;
        });

        it('should return false if the file does not exist', () => {
            const filePath: string = path.join(playgroundPath, 'test', 'file.txt');
            FSHelper.mkdirSync(path.dirname(filePath));

            expect(FSHelper.fileExistsSync(filePath)).to.be.false;
        });

        it('should return false if the file is a directory', () => {
            const filePath: string = path.join(playgroundPath, 'test', 'file.txt');
            FSHelper.mkdirSync(path.dirname(filePath));
            
            expect(FSHelper.fileExistsSync(path.dirname(filePath))).to.be.false;
        });
    })
})