import { describeName, expect, playgroundPath } from "../../../../../mocha/global-setup";
import { Rule } from "../../../../../../src/fonaments/validation/rules/rule";
import { File } from "../../../../../../src/fonaments/validation/rules/file.rule";
import { FileInfo } from "../../../../../../src/fonaments/http/files/file-info";
import * as fs from "fs-extra";
import * as path from "path";

describe(describeName('File Rule Unit Test'), () => {
    let rule: Rule = new File();

    describe('passes()', () => {
        it('should return true if the value is null', async () => {
            expect(await rule.passes("input", undefined)).to.be.true;
        });

        it('should return true if the value is undefined', async () => {
            expect(await rule.passes("input", null)).to.be.true;
        })

        it('should return true if the value is FileInfo', async () => {
            fs.writeFileSync(path.join(playgroundPath, "test.txt"), "");
            expect(await rule.passes("input", new FileInfo(path.join(playgroundPath, "test.txt")))).to.be.true;
        });

        it('should return false if the value is not FileInfo', async () => {
            expect(await rule.passes("input", "oth")).to.be.false;
            expect(await rule.passes("input", 10)).to.be.false;
        });
    })
})