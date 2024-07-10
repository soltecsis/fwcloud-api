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

import * as sinon from 'sinon';
import { KeysGenerateCommand } from '../../../../src/cli/commands/keys-generate.command';
import * as fse from 'fs-extra';
import { testSuite, expect, describeName } from '../../../mocha/global-setup';
import { Application } from '../../../../src/Application';
import * as path from 'path';
import { runCLICommandIsolated } from '../../../utils/utils';

const testEnvPath: string = 'tests/playground/env';

function readTestEnvContent(): string {
  return fse.readFileSync(testEnvPath).toString();
}

describe(describeName('KeysGenerateCommand tests'), () => {
  beforeEach(() => {
    const app: Application = testSuite.app;
    fse.copyFileSync(path.join(app.path, '.env.example'), path.join(app.path, testEnvPath));
  });

  it('should trow an exception is .env file does not exists', async () => {
    sinon.stub(KeysGenerateCommand, <any>'ENV_FILENAME').value('tests/playground/env_invent');

    await expect(
      runCLICommandIsolated(testSuite, async () => {
        return new KeysGenerateCommand().safeHandle({
          $0: 'key:generate',
          _: [],
        });
      }),
    ).to.eventually.be.rejectedWith(Error);
  });

  it('should generate a SESSION_SECRET random key in the .env file', async () => {
    const stubMethod = sinon
      .stub(KeysGenerateCommand.prototype, <any>'generateRandomString')
      .returns('key');
    const stubVar = sinon.stub(KeysGenerateCommand, <any>'ENV_FILENAME').value(testEnvPath);

    await runCLICommandIsolated(testSuite, async () => {
      return new KeysGenerateCommand().safeHandle({
        $0: 'key:generate',
        _: [],
      });
    });

    const envContent: string = readTestEnvContent();

    expect(envContent).matches(new RegExp('SESSION_SECRET=key'));

    stubMethod.restore();
    stubVar.restore();
  });

  it('should not consider blank spaces', async () => {
    let envData: string = fse.readFileSync(testEnvPath).toString();
    envData = envData.replace(new RegExp('^SESSION_SECRET=(.)*\\n', 'm'), `SESSION_SECRET   =\n`);
    fse.writeFileSync(testEnvPath, envData);

    const stubMethod = sinon
      .stub(KeysGenerateCommand.prototype, <any>'generateRandomString')
      .returns('key');
    const stubVar = sinon.stub(KeysGenerateCommand, <any>'ENV_FILENAME').value(testEnvPath);

    await runCLICommandIsolated(testSuite, async () => {
      return new KeysGenerateCommand().safeHandle({
        $0: 'key:generate',
        _: [],
      });
    });

    const envContent: string = readTestEnvContent();

    expect(envContent).matches(new RegExp('SESSION_SECRET=key'));

    stubMethod.restore();
    stubVar.restore();
  });

  it('should generate a CRYPT_SECRET random key in the .env file', async () => {
    const stubMethod = sinon
      .stub(KeysGenerateCommand.prototype, <any>'generateRandomString')
      .returns('key');
    const stubVar = sinon.stub(KeysGenerateCommand, <any>'ENV_FILENAME').value(testEnvPath);

    await runCLICommandIsolated(testSuite, async () => {
      return new KeysGenerateCommand().safeHandle({
        $0: 'key:generate',
        _: [],
      });
    });

    const envContent: string = readTestEnvContent();

    expect(envContent).matches(new RegExp('CRYPT_SECRET=key'));

    stubMethod.restore();
    stubVar.restore();
  });

  it('should not overwrite SESSION_SECRET if is defined', async () => {
    const stubVar = sinon.stub(KeysGenerateCommand, <any>'ENV_FILENAME').value(testEnvPath);
    let envData: string = fse.readFileSync(testEnvPath).toString();
    envData = envData.replace(new RegExp('^SESSION_SECRET=(.)*\\n', 'm'), `SESSION_SECRET=test\n`);
    fse.writeFileSync(testEnvPath, envData);

    await runCLICommandIsolated(testSuite, async () => {
      return new KeysGenerateCommand().safeHandle({
        $0: 'key:generate',
        _: [],
      });
    });

    const envContent: string = readTestEnvContent();

    expect(envContent).matches(new RegExp('SESSION_SECRET=test'));
    stubVar.restore();
  });

  it('should overwrite SESSION_SECRET if force option is defined', async () => {
    const stubVar = sinon.stub(KeysGenerateCommand, <any>'ENV_FILENAME').value(testEnvPath);
    let envData: string = fse.readFileSync(testEnvPath).toString();
    envData = envData.replace(new RegExp('^SESSION_SECRET=(.)*\\n', 'm'), `SESSION_SECRET=test\n`);
    fse.writeFileSync(testEnvPath, envData);

    await runCLICommandIsolated(testSuite, async () => {
      return new KeysGenerateCommand().safeHandle({
        $0: 'key:generate',
        force: true,
        _: [],
      });
    });

    const envContent: string = readTestEnvContent();

    expect(envContent).not.matches(new RegExp('SESSION_SECRET=test'));
    stubVar.restore();
  });

  it('should not overwrite CRYPT_SECRET if is defined', async () => {
    const stubVar = sinon.stub(KeysGenerateCommand, <any>'ENV_FILENAME').value(testEnvPath);
    let envData: string = fse.readFileSync(testEnvPath).toString();
    envData = envData.replace(new RegExp('^CRYPT_SECRET=(.)*\\n', 'm'), `CRYPT_SECRET=test\n`);
    fse.writeFileSync(testEnvPath, envData);

    await runCLICommandIsolated(testSuite, async () => {
      return new KeysGenerateCommand().safeHandle({
        $0: 'keys:generate',
        _: [],
      });
    });

    const envContent: string = readTestEnvContent();

    expect(envContent).matches(new RegExp('CRYPT_SECRET=test'));
    stubVar.restore();
  });

  it('should overwrite CRYPT_SECRET if force option is defined', async () => {
    const stubVar = sinon.stub(KeysGenerateCommand, <any>'ENV_FILENAME').value(testEnvPath);
    let envData: string = fse.readFileSync(testEnvPath).toString();
    envData = envData.replace(new RegExp('^CRYPT_SECRET=(.)*\\n', 'm'), `CRYPT_SECRET=test\n`);
    fse.writeFileSync(testEnvPath, envData);

    await runCLICommandIsolated(testSuite, async () => {
      return new KeysGenerateCommand().safeHandle({
        $0: 'keys:generate',
        force: true,
        _: [],
      });
    });

    const envContent: string = readTestEnvContent();

    expect(envContent).not.matches(new RegExp('CRYPT_SECRET=test'));
    stubVar.restore();
  });
});
