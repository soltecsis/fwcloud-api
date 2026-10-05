import { randomBytes } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import bcrypt = require('bcryptjs');
import request = require('supertest');
import { User } from '../../src/models/user/User';
import { FwCloud } from '../../src/models/fwcloud/FwCloud';
import { Firewall } from '../../src/models/firewall/Firewall';
import { RoutingTable } from '../../src/models/routing/routing-table/routing-table.model';
import { Route } from '../../src/models/routing/route/route.model';
import db from '../../src/database/database-manager';
import { expect, testSuite } from '../mocha/global-setup';

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
  const username = `sec${randomBytes(8).toString('hex')}`;
  const password = randomBytes(18).toString('base64url');
  const user = await User.create({
    username,
    name: 'Synthetic security account',
    email: `${username}@fwcloud.test`,
    customerId: 1,
    password: await bcrypt.hash(`1${username}${password}`, 10),
    enabled: 1,
    role,
    confirmation_token: randomBytes(24).toString('hex'),
  }).save();
  return { user, password };
}

export function loginPayload(account: SecurityAccount) {
  return {
    customer: account.user.customerId,
    username: account.user.username,
    password: account.password,
    authCode: null,
    publicKey: 'synthetic-client-public-key',
  };
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
  const fwcloud = await FwCloud.create({ name, locked: false }).save();
  const firewall = await Firewall.create({
    name: `firewall-${name}`,
    fwCloudId: fwcloud.id,
  }).save();
  const table = await RoutingTable.create({
    firewallId: firewall.id,
    name: `table-${name}`,
    number: 100,
    comment: 'original',
  }).save();
  const route = await Route.create({
    routingTableId: table.id,
    active: true,
    comment: 'original',
    style: 'original',
    route_order: 1,
  }).save();
  return { fwcloud, firewall, table, route };
}

export async function assignClouds(account: SecurityAccount, clouds: FwCloud[]): Promise<void> {
  account.user.fwClouds = clouds;
  await db.getSource().getRepository(User).save(account.user);
}

export type SecurityResource = Awaited<ReturnType<typeof securityResource>>;

export function tableUrl(resource: SecurityResource): string {
  return `/fwclouds/${resource.fwcloud.id}/firewalls/${resource.firewall.id}/routingTables/${resource.table.id}`;
}
