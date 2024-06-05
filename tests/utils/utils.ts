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

import { User } from '../../src/models/user/User';
import * as path from 'path';
import * as fs from 'fs';
import moment from 'moment';
import cookie from 'cookie';
import signature from 'cookie-signature';
import { DeepPartial, getRepository } from 'typeorm';
import { testSuite, TestSuite } from '../mocha/global-setup';
import StringHelper from '../../src/utils/string.helper';
import { Channel } from '../../src/sockets/channels/channel';
import { WebSocketService } from '../../src/sockets/web-socket.service';
import { EventEmitter } from 'typeorm/platform/PlatformTools';

export async function createUser(user: DeepPartial<User>): Promise<User> {
  const result: User = getRepository(User).create({
    username: user.username ? user.username : StringHelper.randomize(10),
    email: StringHelper.randomize(10) + '@fwcloud.test',
    password: StringHelper.randomize(10),
    customer: { id: 1 },
    role: user.role ? user.role : 0,
    enabled: 1,
    confirmation_token: StringHelper.randomize(10),
  });

  return await getRepository(User).save(result);
}

export function generateSession(user: User): string {
  const _app = testSuite.app;
  const session_id: string = StringHelper.randomize(10);
  const session_path: string = path.join(
    _app.config.get('session').files_path,
    session_id + '.json',
  );

  fs.writeFileSync(
    session_path,
    JSON.stringify({
      cookie: {
        originalMaxAge: 899998,
        expires: moment().add(1, 'd').utc(),
        secure: false,
        httpOnly: false,
        path: '/',
      },
      customer_id: user.customer,
      user_id: user.id,
      username: user.username,
      __lastAccess: moment().valueOf(),
    }),
  );

  return session_id;
}

export function attachSession(id: string): string {
  const _app = testSuite.app;
  return cookie.serialize(
    _app.config.get('session').name,
    signature.sign(id, _app.config.get('crypt').secret),
    {},
  );
}

export async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
  return;
}

/**
 * Run a FwCloud CLI Command and reload the application after call it. Notice CLI commands closes application
 *
 * @param testSuite
 * @param fn
 */
export async function runCLICommandIsolated(
  testSuite: TestSuite,
  fn: () => Promise<number>,
): Promise<void> {
  return new Promise(async (resolve, reject) => {
    try {
      const _f = await fn();
      await testSuite.runApplication();
      return resolve();
    } catch (e) {
      return reject(e);
    }
  });
}

/**
 * Generate random integer between min and max, included.
 *
 * @param min
 * @param max
 */
export function ramdomInteger(min: number, max: number): number {
  max++;
  return Math.floor(Math.random() * (max - min)) + min;
}
