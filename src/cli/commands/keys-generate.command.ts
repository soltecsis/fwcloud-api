/*
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

import * as yargs from 'yargs';
import * as path from 'path';
import { promises as fs, Stats } from 'fs';
import * as crypto from 'crypto';
import { Command, Option } from '../command';
/**
 * Runs migration command.
 */
export class KeysGenerateCommand extends Command {
  static ENV_FILENAME: string = '.env';
  static KEY_LENGTH: number = 30;
  static SESSION_SECRET_ENV_VARIABLE = 'SESSION_SECRET';
  static CRYPT_SECRET_ENV_VARIABLE = 'CRYPT_SECRET';

  public name: string = 'keys:generate';
  public description: string = 'Generates random keys';

  async handle(args: yargs.Arguments) {
    const forceFlag: boolean = (args.force ?? false) as boolean;
    const envFilePath: string = path.join(
      this._app.path,
      KeysGenerateCommand.ENV_FILENAME,
    );
    const stat: Stats = await fs.stat(envFilePath);

    if (stat && !stat.isFile()) {
      throw new Error('File ' + envFilePath + ' does not exists');
    }

    let envContent: string = (await fs.readFile(envFilePath)).toString();

    if (
      forceFlag ||
      new RegExp('^SESSION_SECRET\\s*=\\s*\n', 'm').test(envContent)
    ) {
      const session_secret = await this.generateRandomString();
      envContent = envContent.replace(
        new RegExp('^SESSION_SECRET\\s*=.*\n', 'm'),
        `SESSION_SECRET=${session_secret.toString()}\n`,
      );
      this.output.success(`SESSION_SECRET key generated.`);
    } else {
      this.output.warn(`SESSION_SECRET already defined.`);
    }

    if (
      forceFlag ||
      new RegExp('^CRYPT_SECRET\\s*=\\s*\n', 'm').test(envContent)
    ) {
      const crypt_secret = await this.generateRandomString();
      envContent = envContent.replace(
        new RegExp('^CRYPT_SECRET\\s*=.*\n', 'm'),
        `CRYPT_SECRET=${crypt_secret.toString()}\n`,
      );
      this.output.success(`CRYPT_SECRET key generated.`);
    } else {
      this.output.warn(`CRYPT_SECRET already defined.`);
    }

    await fs.writeFile(envFilePath, envContent);

    return;
  }

  public getOptions(): Option[] {
    return [
      {
        name: 'force',
        alias: null,
        type: 'boolean',
        description: 'Force key generation even when they are already defined',
        required: false,
      },
    ];
  }

  protected async generateRandomString(): Promise<String> {
    return new Promise((resolve, reject) => {
      crypto.randomBytes(
        KeysGenerateCommand.KEY_LENGTH,
        (err: Error, buff: Buffer) => {
          if (err) {
            throw err;
          }

          resolve(buff.toString('hex'));
        },
      );
    });
  }
}
