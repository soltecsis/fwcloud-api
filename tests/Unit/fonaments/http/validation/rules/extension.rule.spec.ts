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

import { describeName, expect, playgroundPath } from "../../../../../mocha/global-setup";
import { FileInfo } from "../../../../../../src/fonaments/http/files/file-info";
import * as fs from "fs-extra";
import * as path from "path";
import { ValidationArguments, ValidatorConstraintInterface } from "class-validator";
import { HasExtension } from "../../../../../../src/fonaments/validation/rules/extension.validation";

describe(describeName('File Rule Unit Test'), () => {
    let rule: ValidatorConstraintInterface;

    describe('passes()', () => {
        beforeEach(async () => {
            rule = new HasExtension();
        });

        it('should return true if the value is null', async () => {
            expect(await rule.validate(undefined, {constraints: ['txt']} as ValidationArguments)).to.be.true;
        });

        it('should return true if the value is undefined', async () => {
            expect(await rule.validate(null, {constraints: ['txt']} as ValidationArguments)).to.be.true;
        });

        it('should return true if the value is not FileInfo', async () => {
            expect(await rule.validate("oth", {constraints: ['txt']} as ValidationArguments)).to.be.true;
            expect(await rule.validate(10, {constraints: ['txt']} as ValidationArguments)).to.be.true;
        });

        it('should return true if the value is FileInfo and its extension is equal to the rule extension', async () => {
            fs.writeFileSync(path.join(playgroundPath, "test.txt"), "");
            expect(await rule.validate(new FileInfo(path.join(playgroundPath, "test.txt")), {constraints: ['txt']} as ValidationArguments)).to.be.true;
        });

        it('should return false if the value is FileInfo and its extension is not equal to the rule extension', async () => {
            fs.writeFileSync(path.join(playgroundPath, "test.other"), "");
            expect(await rule.validate(new FileInfo(path.join(playgroundPath, "test.other")), {constraints: ['txt']} as ValidationArguments)).to.be.false;
        });
    })
})