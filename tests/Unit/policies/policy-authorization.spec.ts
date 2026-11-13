import * as chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinon from 'sinon';
import { DataSource } from 'typeorm';
import db from '../../../src/database/database-manager';
import { User } from '../../../src/models/user/User';
import { Firewall } from '../../../src/models/firewall/Firewall';
import { FwCloud } from '../../../src/models/fwcloud/FwCloud';
import { RoutingTable } from '../../../src/models/routing/routing-table/routing-table.model';
import { RoutingRule } from '../../../src/models/routing/routing-rule/routing-rule.model';
import { Route } from '../../../src/models/routing/route/route.model';
import { RouteGroup } from '../../../src/models/routing/route-group/route-group.model';
import { RoutingGroup } from '../../../src/models/routing/routing-group/routing-group.model';
import { DHCPRule } from '../../../src/models/system/dhcp/dhcp_r/dhcp_r.model';
import { KeepalivedRule } from '../../../src/models/system/keepalived/keepalived_r/keepalived_r.model';
import { OpenVPN } from '../../../src/models/vpn/openvpn/OpenVPN';
import { IPSec } from '../../../src/models/vpn/ipsec/IPSec';
import { WireGuard } from '../../../src/models/vpn/wireguard/WireGuard';
import { FirewallPolicy } from '../../../src/policies/firewall.policy';
import { PolicyRulePolicy } from '../../../src/policies/policy-rule.policy';
import { RoutingTablePolicy } from '../../../src/policies/routing-table.policy';
import { RoutingRulePolicy } from '../../../src/policies/routing-rule.policy';
import { RoutePolicy } from '../../../src/policies/route.policy';
import { RouteGroupPolicy } from '../../../src/policies/route-group.policy';
import { RoutingGroupPolicy } from '../../../src/policies/routing-group.policy';
import { DhcpPolicy } from '../../../src/policies/dhcp.policy';
import { KeepalivedPolicy } from '../../../src/policies/keepalived.policy';
import { DHCPGroupPolicy } from '../../../src/policies/dhcp-group.policy';
import { KeepalivedGroupPolicy } from '../../../src/policies/keepalived-group.policy';
import { HAProxyPolicy } from '../../../src/policies/haproxy.policy';
import { HAProxyGroupPolicy } from '../../../src/policies/haproxy-group.policy';
import { OpenVPNPolicy } from '../../../src/policies/openvpn.policy';
import { IPSecPolicy } from '../../../src/policies/ipsec.policy';
import { WireGuardPolicy } from '../../../src/policies/wireguard.policy';
import { SnapshotPolicy } from '../../../src/policies/snapshot.policy';
import { authorizeCloudMembership } from '../../../src/policies/policy-authorization';

chai.use(chaiAsPromised);
const { expect } = chai;

interface PolicyCase {
  policy: any;
  actions: string[];
  resource: any;
  entity?: any;
  lookup?: 'findOne' | 'findOneOrFail';
  adminLoadsResource?: boolean;
}

describe('Policy authorization regression tests', () => {
  const sandbox = sinon.createSandbox();
  const cloud = { id: 10 } as FwCloud;
  const firewall = { id: 20, fwCloudId: cloud.id, fwCloud: cloud } as Firewall;
  const table = { id: 30, firewall } as RoutingTable;
  const resourceId = 40;
  const idOnly = { id: resourceId };
  const firewallReference = { id: firewall.id };
  const tableReference = { id: table.id };
  const groupReference = { id: resourceId, firewallId: firewall.id };
  let user: User;
  let repositories: Map<any, { findOne: sinon.SinonStub; findOneOrFail: sinon.SinonStub }>;
  let userLookup: sinon.SinonStub;

  const cases: PolicyCase[] = [
    { policy: FirewallPolicy, actions: ['compile', 'install'], resource: firewall },
    { policy: FirewallPolicy, actions: ['ping', 'info'], resource: cloud },
    {
      policy: PolicyRulePolicy,
      actions: ['read', 'download'],
      resource: firewallReference,
      entity: Firewall,
      adminLoadsResource: true,
    },
    {
      policy: RoutingTablePolicy,
      actions: ['create', 'index'],
      resource: firewallReference,
      entity: Firewall,
      adminLoadsResource: true,
    },
    {
      policy: RoutingTablePolicy,
      actions: ['show', 'update', 'delete'],
      resource: tableReference,
      entity: RoutingTable,
      adminLoadsResource: true,
    },
    {
      policy: RoutingRulePolicy,
      actions: ['create', 'index'],
      resource: firewallReference,
      entity: Firewall,
      adminLoadsResource: true,
    },
    {
      policy: RoutingRulePolicy,
      actions: ['show', 'update', 'delete'],
      resource: idOnly,
      entity: RoutingRule,
      adminLoadsResource: true,
    },
    {
      policy: RoutePolicy,
      actions: ['create', 'index'],
      resource: tableReference,
      entity: RoutingTable,
      lookup: 'findOne',
    },
    {
      policy: RoutePolicy,
      actions: ['show', 'update', 'delete'],
      resource: idOnly,
      entity: Route,
      lookup: 'findOne',
    },
    {
      policy: RouteGroupPolicy,
      actions: ['create', 'index'],
      resource: firewallReference,
      entity: Firewall,
      lookup: 'findOne',
      adminLoadsResource: true,
    },
    {
      policy: RouteGroupPolicy,
      actions: ['show', 'update', 'remove'],
      resource: idOnly,
      entity: RouteGroup,
      lookup: 'findOne',
    },
    {
      policy: RoutingGroupPolicy,
      actions: ['create', 'index'],
      resource: firewallReference,
      entity: Firewall,
      lookup: 'findOne',
      adminLoadsResource: true,
    },
    {
      policy: RoutingGroupPolicy,
      actions: ['show', 'update', 'remove'],
      resource: idOnly,
      entity: RoutingGroup,
      lookup: 'findOne',
    },
    {
      policy: DhcpPolicy,
      actions: ['index', 'create', 'move'],
      resource: firewallReference,
      entity: Firewall,
      adminLoadsResource: true,
    },
    {
      policy: DhcpPolicy,
      actions: ['show', 'copy', 'update', 'delete'],
      resource: idOnly,
      entity: DHCPRule,
    },
    {
      policy: KeepalivedPolicy,
      actions: ['index', 'create', 'move'],
      resource: firewallReference,
      entity: Firewall,
      adminLoadsResource: true,
    },
    {
      policy: KeepalivedPolicy,
      actions: ['show', 'copy', 'update', 'delete'],
      resource: idOnly,
      entity: KeepalivedRule,
    },
    {
      policy: DHCPGroupPolicy,
      actions: ['index', 'create'],
      resource: firewallReference,
      entity: Firewall,
      lookup: 'findOne',
      adminLoadsResource: true,
    },
    {
      policy: DHCPGroupPolicy,
      actions: ['show', 'update', 'remove'],
      resource: groupReference,
      entity: Firewall,
      lookup: 'findOne',
      adminLoadsResource: true,
    },
    {
      policy: KeepalivedGroupPolicy,
      actions: ['index', 'create'],
      resource: firewallReference,
      entity: Firewall,
      lookup: 'findOne',
      adminLoadsResource: true,
    },
    {
      policy: KeepalivedGroupPolicy,
      actions: ['show', 'update', 'remove'],
      resource: groupReference,
      entity: Firewall,
      lookup: 'findOne',
      adminLoadsResource: true,
    },
    {
      policy: HAProxyPolicy,
      actions: ['create'],
      resource: firewallReference,
      entity: Firewall,
      adminLoadsResource: true,
    },
    {
      policy: HAProxyPolicy,
      actions: ['show'],
      resource: groupReference,
      entity: Firewall,
      adminLoadsResource: true,
    },
    {
      policy: HAProxyGroupPolicy,
      actions: ['create'],
      resource: firewallReference,
      entity: Firewall,
      adminLoadsResource: true,
    },
    {
      policy: HAProxyGroupPolicy,
      actions: ['show'],
      resource: groupReference,
      entity: Firewall,
      adminLoadsResource: true,
    },
    {
      policy: OpenVPNPolicy,
      actions: ['installer', 'history'],
      resource: idOnly,
      entity: OpenVPN,
      adminLoadsResource: true,
    },
    {
      policy: IPSecPolicy,
      actions: ['installer', 'history'],
      resource: idOnly,
      entity: IPSec,
      adminLoadsResource: true,
    },
    {
      policy: WireGuardPolicy,
      actions: ['installer', 'history'],
      resource: idOnly,
      entity: WireGuard,
      adminLoadsResource: true,
    },
    {
      policy: SnapshotPolicy,
      actions: ['read', 'update', 'restore', 'destroy'],
      resource: { fwCloud: cloud },
    },
    { policy: SnapshotPolicy, actions: ['create'], resource: cloud },
  ];

  beforeEach(() => {
    user = { id: 1, role: 2, fwClouds: [cloud] } as User;
    userLookup = sandbox.stub().callsFake(async () => user);
    const records = new Map<any, any>([
      [Firewall, firewall],
      [RoutingTable, table],
      [RoutingRule, { id: resourceId, routingTable: table }],
      [Route, { id: resourceId, routingTable: table }],
      ...[RouteGroup, RoutingGroup, DHCPRule, KeepalivedRule, OpenVPN, IPSec, WireGuard].map(
        (entity) => [entity, { id: resourceId, firewall }] as const,
      ),
    ]);
    repositories = new Map();
    for (const [entity, record] of records) {
      repositories.set(entity, {
        findOne: sandbox.stub().resolves(record),
        findOneOrFail: sandbox.stub().resolves(record),
      });
    }
    repositories.set(User, { findOne: userLookup, findOneOrFail: userLookup });
    sandbox.stub(db, 'getSource').returns({
      manager: { getRepository: (entity: any) => repositories.get(entity) },
    } as unknown as DataSource);
    sandbox.stub(User, 'findOneOrFail').callsFake(userLookup);
  });

  afterEach(() => sandbox.restore());

  for (const entry of cases) {
    for (const action of entry.actions) {
      describe(`${entry.policy.name}.${action}`, () => {
        const invoke = () => entry.policy[action](entry.resource, { id: 1, role: 1 });

        for (const scenario of [
          { name: 'administrator without clouds', role: 1, clouds: [], allowed: true },
          { name: 'member of the resource cloud', role: 2, clouds: [cloud], allowed: true },
          { name: 'member of a different cloud', role: 2, clouds: [{ id: 99 }], allowed: false },
          { name: 'user without clouds', role: 2, clouds: [], allowed: false },
        ]) {
          it(`checks persisted permissions for ${scenario.name}`, async () => {
            user.role = scenario.role;
            user.fwClouds = scenario.clouds as FwCloud[];
            const authorization = await invoke();
            expect(authorization.can()).to.eq(scenario.allowed);
            expect(
              userLookup.calledOnceWithExactly({
                where: { id: user.id },
                relations: { fwClouds: true },
              }),
            ).to.eq(true);
            if (entry.entity) {
              const lookup = repositories.get(entry.entity)[entry.lookup ?? 'findOneOrFail'];
              const loadsResource = user.role !== 1 || !!entry.adminLoadsResource;
              expect(lookup.callCount).to.eq(loadsResource ? 1 : 0);
              if (loadsResource) {
                const expectedId = entry.entity === Firewall ? firewall.id : entry.resource.id;
                expect(lookup.firstCall.args[0].where).to.deep.eq({ id: expectedId });
                const relations =
                  entry.entity === Firewall
                    ? { fwCloud: true }
                    : [Route, RoutingRule].includes(entry.entity)
                      ? { routingTable: { firewall: { fwCloud: true } } }
                      : [DHCPRule, KeepalivedRule].includes(entry.entity)
                        ? { group: true, firewall: { fwCloud: true } }
                        : [OpenVPN, IPSec, WireGuard].includes(entry.entity)
                          ? { firewall: true }
                          : { firewall: { fwCloud: true } };
                expect(lookup.firstCall.args[0].relations).to.deep.eq(relations);
                expect(userLookup.calledBefore(lookup)).to.eq(true);
              }
            }
          });
        }

        it('propagates a missing persisted user', async () => {
          const error = new Error('user not found');
          userLookup.rejects(error);
          await expect(invoke()).to.be.rejectedWith(error);
          for (const [entity, repository] of repositories) {
            if (entity !== User) {
              expect(repository.findOne.called || repository.findOneOrFail.called).to.eq(false);
            }
          }
        });

        if (entry.entity) {
          it('preserves missing-resource behavior for a non-administrator', async () => {
            const lookup = repositories.get(entry.entity)[entry.lookup ?? 'findOneOrFail'];
            if (entry.lookup === 'findOne') {
              lookup.resolves(null);
              await expect(invoke()).to.be.rejectedWith(TypeError);
            } else {
              const error = new Error('resource not found');
              lookup.rejects(error);
              await expect(invoke()).to.be.rejectedWith(error);
            }
          });

          it('preserves resource validation relative to the administrator bypass', async () => {
            user.role = 1;
            const lookup = repositories.get(entry.entity)[entry.lookup ?? 'findOneOrFail'];
            const error = new Error('resource lookup failed');
            lookup.rejects(error);
            if (entry.adminLoadsResource) {
              await expect(invoke()).to.be.rejectedWith(error);
            } else {
              expect((await invoke()).can()).to.eq(true);
              expect(lookup.called).to.eq(false);
            }
          });

          if (entry.lookup === 'findOne') {
            it('preserves the administrator bypass when findOne returns null', async () => {
              user.role = 1;
              repositories.get(entry.entity).findOne.resolves(null);
              expect((await invoke()).can()).to.eq(true);
            });
          }
        }
      });
    }
  }

  for (const [policy, entity] of [
    [OpenVPNPolicy, OpenVPN],
    [IPSecPolicy, IPSec],
    [WireGuardPolicy, WireGuard],
  ]) {
    for (const action of ['installer', 'history']) {
      it(`${policy.name}.${action} denies a VPN without a firewall except for administrators`, async () => {
        repositories.get(entity).findOneOrFail.resolves({ id: resourceId, firewall: null });
        expect((await policy[action](idOnly, user)).can()).to.eq(false);
        user.role = 1;
        expect((await policy[action](idOnly, user)).can()).to.eq(true);
        expect(repositories.get(Firewall).findOneOrFail.called).to.eq(false);
      });

      it(`${policy.name}.${action} validates the VPN before its firewall`, async () => {
        const vpnLookup = repositories.get(entity).findOneOrFail;
        const firewallLookup = repositories.get(Firewall).findOneOrFail;
        const error = new Error('firewall not found');
        firewallLookup.rejects(error);
        await expect(policy[action](idOnly, user)).to.be.rejectedWith(error);
        expect(vpnLookup.calledBefore(firewallLookup)).to.eq(true);
        expect(firewallLookup.firstCall.args[0]).to.deep.eq({
          where: { id: firewall.id },
          relations: { fwCloud: true },
        });
        user.role = 1;
        expect((await policy[action](idOnly, user)).can()).to.eq(true);
        expect(firewallLookup.callCount).to.eq(1);
      });
    }
  }

  for (const action of ['compile', 'install']) {
    it(`FirewallPolicy.${action} denies an absent cloud except for administrators`, async () => {
      expect((await FirewallPolicy[action]({ id: 20 }, user)).can()).to.eq(false);
      user.role = 1;
      expect((await FirewallPolicy[action]({ id: 20 }, user)).can()).to.eq(true);
    });
  }

  for (const action of ['ping', 'info']) {
    it(`FirewallPolicy.${action} keeps the administrator bypass before reading the cloud`, async () => {
      await expect(FirewallPolicy[action](null, user)).to.be.rejectedWith(TypeError);
      user.role = 1;
      expect((await FirewallPolicy[action](null, user)).can()).to.eq(true);
    });
  }

  for (const action of ['read', 'update', 'restore', 'destroy']) {
    it(`SnapshotPolicy.${action} denies an absent cloud except for administrators`, async () => {
      expect((await SnapshotPolicy[action]({}, user)).can()).to.eq(false);
      user.role = 1;
      expect((await SnapshotPolicy[action]({}, user)).can()).to.eq(true);
    });
  }

  for (const scenario of [
    { role: 1, clouds: [], allowed: true },
    { role: 2, clouds: [cloud], allowed: true },
    { role: 2, clouds: [{ id: 99 }], allowed: true },
    { role: 2, clouds: [], allowed: false },
  ]) {
    it(`preserves WireGuard checkPermission for role ${scenario.role} and ${scenario.clouds.length} clouds`, async () => {
      user.role = scenario.role;
      user.fwClouds = scenario.clouds as FwCloud[];
      expect((await WireGuardPolicy.checkPermission({ id: user.id } as User)).can()).to.eq(
        scenario.allowed,
      );
    });
  }

  it('returns an authorization object that enforces a denied membership', () => {
    const authorization = authorizeCloudMembership(user, 99);
    expect(authorization.can()).to.eq(false);
    expect(() => authorization.authorize()).to.throw();
    expect(() => authorizeCloudMembership(user, cloud.id).authorize()).not.to.throw();
  });

  for (const policy of [HAProxyPolicy, HAProxyGroupPolicy]) {
    it(`${policy.name}.show uses the persisted firewall rather than a stale relation`, async () => {
      const resource = {
        ...groupReference,
        firewall: { id: firewall.id, fwCloud: { id: 99 } },
      };
      expect((await policy.show(resource as any, user)).can()).to.eq(true);
      repositories.get(Firewall).findOneOrFail.resolves({
        ...firewall,
        fwCloudId: 99,
        fwCloud: { id: 99 },
      });
      resource.firewall.fwCloud = cloud;
      expect((await policy.show(resource as any, user)).can()).to.eq(false);
    });
  }
});
