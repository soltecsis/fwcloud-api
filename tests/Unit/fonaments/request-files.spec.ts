import { describeName, playgroundPath, expect } from "../../mocha/global-setup";
import { RequestFiles, FileInfo } from "../../../src/fonaments/http/request-files";
import * as fs from "fs";
import path from "path";

describe(describeName('RequestFiles Unit Test'), () => {
    let files: RequestFiles = new RequestFiles();

    describe('addFile()', () => {
        it('should add the file into files attribute', () => {
            const filePath: string = path.join(playgroundPath, 'test.txt');
            fs.writeFileSync(filePath, "");

            files.addFile("input", filePath);

            expect(files["_files"]).to.haveOwnProperty("input");
        });
    });

    describe('has()', () => {
        it('should return whether the file is present', () => {
            const filePath: string = path.join(playgroundPath, 'test.txt');
            fs.writeFileSync(filePath, "");

            files.addFile("input", filePath);

            expect(files.has("input")).to.be.true;
            expect(files.has("input2")).to.be.false;
        });
    });

    describe('get()', () => {
        it('should return the fileInfo if the file is present', () => {
            const filePath: string = path.join(playgroundPath, 'test.txt');
            fs.writeFileSync(filePath, "");

            files.addFile("input", filePath);

            expect(files.get("input")).to.be.instanceOf(FileInfo);
            expect(files.get("input").filepath).to.be.deep.eq(filePath);
        });
    });
});