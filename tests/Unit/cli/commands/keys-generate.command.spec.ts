import * as sinon from "sinon";
import { KeysGenerateCommand } from "../../../../src/cli/commands/keys-generate.command";
import * as fse from "fs-extra";
import { testSuite, expect } from "../../../mocha/global-setup";
import { Application } from "../../../../src/Application";
import * as path from "path";

const testEnvPath: string = "tests/playground/env";

function readTestEnvContent(): string {
    return fse.readFileSync(testEnvPath).toString();
}

describe.only('KeysGenerateCommand tests', () => {
    beforeEach(() => {
        const app: Application = testSuite.app;
        fse.copyFileSync(path.join(app.path, '.env.example'), path.join(app.path, testEnvPath));
    });

    it('GenerateKeyCommand should trow an exception is .env file does not exists', async () => {
        const stubVar = sinon.stub(KeysGenerateCommand, <any> 'ENV_FILENAME').value('tests/playground/env_invent');

        await expect(new KeysGenerateCommand().handler({
            $0: "key:generate",
            _: []
        })).to.eventually.be.rejectedWith(Error);
    });

    it('GenerateKeyCommand should generate a SESSION_SECRET random key in the .env file', async() => {
        const stubMethod = sinon.stub(KeysGenerateCommand, <any> 'generateRandomString').returns("key");
        const stubVar = sinon.stub(KeysGenerateCommand, <any> 'ENV_FILENAME').value(testEnvPath);

        
        const command = await new KeysGenerateCommand().handler({
            $0: "key:generate",
            _: []
        });

        const envContent: string = readTestEnvContent();

        expect(envContent).matches(new RegExp('SESSION_SECRET=key'));

        stubMethod.restore();
        stubVar.restore();
    });

    it('GenerateKeyCommand should not consider blank spaces', async() => {
        let envData: string = await fse.readFileSync(testEnvPath).toString()
        envData = envData.replace(new RegExp('^SESSION_SECRET=(.)*\n', 'm'), `SESSION_SECRET   =\n`);
        fse.writeFileSync(testEnvPath, envData);
        
        const stubMethod = sinon.stub(KeysGenerateCommand, <any> 'generateRandomString').returns("key");
        const stubVar = sinon.stub(KeysGenerateCommand, <any> 'ENV_FILENAME').value(testEnvPath);

        
        const command = await new KeysGenerateCommand().handler({
            $0: "key:generate",
            _: []
        });

        const envContent: string = readTestEnvContent();

        expect(envContent).matches(new RegExp('SESSION_SECRET=key'));

        stubMethod.restore();
        stubVar.restore();
    });

    it('GenerateKeyCommand should generate a CRYPT_SECRET random key in the .env file', async() => {
        const stubMethod = sinon.stub(KeysGenerateCommand, <any> 'generateRandomString').returns("key");
        const stubVar = sinon.stub(KeysGenerateCommand, <any> 'ENV_FILENAME').value(testEnvPath);

        const command = await new KeysGenerateCommand().handler({
            $0: "key:generate",
            _: []
        });

        const envContent: string = readTestEnvContent();

        expect(envContent).matches(new RegExp('CRYPT_SECRET=key'));

        stubMethod.restore();
        stubVar.restore();
    });

    it('GenerateKeyCommand should overwrite SESSION_SECRET if is defined', async () => {
        const stubVar = sinon.stub(KeysGenerateCommand, <any> 'ENV_FILENAME').value(testEnvPath);
        let envData: string = await fse.readFileSync(testEnvPath).toString()
        envData = envData.replace(new RegExp('^SESSION_SECRET=(.)*\n', 'm'), `SESSION_SECRET=test\n`);
        fse.writeFileSync(testEnvPath, envData);

        const command = await new KeysGenerateCommand().handler({
            $0: "key:generate",
            _: []
        });

        const envContent: string = readTestEnvContent();

        expect(envContent).not.matches(new RegExp('SESSION_SECRET=test'));
        stubVar.restore()
    });

    it('GenerateKeyCommand should overwrite CRYPT_SECRET if is defined', async () => {
        const stubVar = sinon.stub(KeysGenerateCommand, <any> 'ENV_FILENAME').value(testEnvPath);
        let envData: string = await fse.readFileSync(testEnvPath).toString()
        envData = envData.replace(new RegExp('^CRYPT_SECRET=(.)*\n', 'm'), `CRYPT_SECRET=test\n`);
        fse.writeFileSync(testEnvPath, envData);

        const command = await new KeysGenerateCommand().handler({
            $0: "keys:generate",
            _: []
        });

        const envContent: string = readTestEnvContent();

        expect(envContent).not.matches(new RegExp('CRYPT_SECRET=test'));
        stubVar.restore()
    });
});