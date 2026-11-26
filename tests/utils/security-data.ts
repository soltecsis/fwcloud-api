// Fixture primitives shared by Mocha and the live DAST laboratory. No test
// runner, database reset, sessions or application lifecycle is imported here.
import { randomBytes } from 'crypto';
import bcrypt = require('bcryptjs');
import { User } from '../../src/models/user/User';
import { FwCloud } from '../../src/models/fwcloud/FwCloud';
import { Firewall } from '../../src/models/firewall/Firewall';
import { RoutingTable } from '../../src/models/routing/routing-table/routing-table.model';
import { Route } from '../../src/models/routing/route/route.model';

export async function createSecurityAccount(customerId: number, role: 1 | 2) {
  const username = `sec${randomBytes(8).toString('hex')}`;
  const password = randomBytes(24).toString('base64url');
  const user = await User.create({
    username,
    name: 'Synthetic security account',
    email: `${username}@fwcloud.test`,
    customerId,
    password: await bcrypt.hash(`${customerId}${username}${password}`, 10),
    enabled: 1,
    role,
    confirmation_token: randomBytes(24).toString('hex'),
  }).save();
  return { user, password };
}

export function securityLoginPayload(
  account: { customer: number; username: string; password: string },
  authCode: string = null,
) {
  return {
    customer: account.customer,
    username: account.username,
    password: account.password,
    authCode,
    publicKey: 'synthetic-client-public-key',
  };
}

export async function createSecurityResource(name: string) {
  const fwcloud = await FwCloud.create({ name, locked: false }).save();
  const firewall = await Firewall.create({
    name: `firewall-${name}`,
    fwCloudId: fwcloud.id,
    install_apikey: null,
    install_user: '',
    install_pass: '',
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
