import * as fse from "fs-extra";
import * as path from "path";
import * as crypto from "crypto";


const playgrounPath = path.join('./', 'tests', 'playground');

const md5 = crypto.createHash('MD5');

export function createTestDirectory(testPath: string) {
    md5.update(testPath);
    const playgroundTestPath: string = path.join(playgrounPath, md5.digest('hex'));

    beforeEach(async() => {
        fse.removeSync(playgroundTestPath);
        fse.mkdirSync(playgroundTestPath);
    });

    afterEach(async() => {
        fse.removeSync(playgroundTestPath);
    })

    return playgroundTestPath;
}