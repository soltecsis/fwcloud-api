import { MigrationCreateCommand } from "../../../../src/cli/commands/MigrationCreateCommand"
import * as path from 'path';
import * as fs from 'fs';
import { expect } from "../../../mocha/global-setup";

describe('MigrationCreateCommand tests', () => {
    const version: string = 'x.y.z';
    const migrationDirectory = path.join('tests', '.tmp');

    before(() => {
        try {
            fs.mkdirSync(path.join(process.cwd(), migrationDirectory), {recursive: true});
        } catch(e) {}
    });

    after(() => {
        const tmpDir: string = path.join(process.cwd(), migrationDirectory);
        const files = fs.readdirSync(path.join(tmpDir, version));

        files.forEach((file) => {
            fs.unlinkSync(path.join(tmpDir, version, file));
        });

        fs.rmdirSync(path.join(tmpDir, version));
        fs.rmdirSync(tmpDir);
    });
    
    it('should create a migration file in the version migration directory', async() => {
        const command = await new MigrationCreateCommand().handler({
            $0: "migration:run",
            d: migrationDirectory,
            dir: migrationDirectory,
            n: 'migration_test',
            name: 'migration_test',
            t: version,
            tag: version,
            _: []
        });

        const files = fs.readdirSync(path.join(process.cwd(), migrationDirectory, version));

        files.filter((item: string) => {
            new RegExp('\w{13}-migration_test', 'g').test(item);
        });

        expect(files.length).to.be.equal(1);
    });
});