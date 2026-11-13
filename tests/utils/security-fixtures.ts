import * as fs from 'fs';
import * as path from 'path';
import request = require('supertest');
import { User } from '../../src/models/user/User';
import { FwCloud } from '../../src/models/fwcloud/FwCloud';
import db from '../../src/database/database-manager';
import { expect, testSuite } from '../mocha/global-setup';
import {
  createSecurityAccount,
  createSecurityResource,
  securityLoginPayload,
} from './security-data';

export interface SecurityAccount {
  user: User;
  password: string;
}

export interface SecuritySession {
  cookie: string;
  id: string;
  publicKey: string;
}

export async function securityAccount(role: 1 | 2): Promise<SecurityAccount> {
  return createSecurityAccount(1, role);
}

export function loginPayload(account: SecurityAccount) {
  return securityLoginPayload({
    customer: account.user.customerId,
    username: account.user.username,
    password: account.password,
  });
}

export async function securityLogin(account: SecurityAccount): Promise<SecuritySession> {
  const response = await request(testSuite.app.express)
    .post('/user/login')
    .send(loginPayload(account));
  expect(response.status, 'fixture login must succeed').to.eq(200);
  const cookies = response.headers['set-cookie'] as unknown as string[];
  const cookie = cookies?.find((item) =>
    item.startsWith(`${testSuite.app.config.get('session').name}=`),
  );
  expect(Boolean(cookie), 'login must issue a session cookie').to.eq(true);
  const pair = cookie.split(';')[0];
  const value = decodeURIComponent(pair.slice(pair.indexOf('=') + 1));
  expect(value.startsWith('s:'), 'cookie must be signed by express-session').to.eq(true);
  return {
    cookie: pair,
    id: value.slice(2, value.lastIndexOf('.')),
    publicKey: response.body.publicKey,
  };
}

export function sessionFile(session: SecuritySession): string {
  return path.join(testSuite.app.config.get('session').files_path, `${session.id}.json`);
}

export function changeSession(session: SecuritySession, change: (data: any) => void): void {
  const filename = sessionFile(session);
  const data = JSON.parse(fs.readFileSync(filename, 'utf8'));
  change(data);
  fs.writeFileSync(filename, JSON.stringify(data));
}

export async function securityResource(name: string) {
  return createSecurityResource(name);
}

export async function assignClouds(account: SecurityAccount, clouds: FwCloud[]): Promise<void> {
  account.user.fwClouds = clouds;
  await db.getSource().getRepository(User).save(account.user);
}

export type SecurityResource = Awaited<ReturnType<typeof securityResource>>;

export function tableUrl(resource: SecurityResource): string {
  return `/fwclouds/${resource.fwcloud.id}/firewalls/${resource.firewall.id}/routingTables/${resource.table.id}`;
}
