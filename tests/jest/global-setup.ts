import * as fse from "fs-extra";
import * as path from "path";

const playgroundPath: string = path.join(process.cwd(), 'tests', 'playground');

module.exports = async() => {
    fse.removeSync(playgroundPath);
    fse.mkdirSync(playgroundPath);
}