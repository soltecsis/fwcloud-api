import { describeName, expect, testSuite } from '../../../mocha/global-setup';
import { Application } from '../../../../src/Application';
import db from '../../../../src/database/database-manager';
import { FwCloudFactory, FwCloudProduct } from '../../../utils/fwcloud-factory';
import {
  ReplicationTargetSide,
  makeReplicationTargetFirewall,
} from '../../../utils/replication-profile-fixtures';
import StringHelper from '../../../../src/utils/string.helper';
import { Cluster } from '../../../../src/models/firewall/Cluster';
import { Firewall } from '../../../../src/models/firewall/Firewall';
import { IPObj } from '../../../../src/models/ipobj/IPObj';
import { PolicyRule } from '../../../../src/models/policy/PolicyRule';
import { NotFoundException } from '../../../../src/fonaments/exceptions/not-found-exception';
import { ReplicationProfile } from '../../../../src/models/replication-profile/replication-profile.model';
import { ReplicationProfileSnapshotService } from '../../../../src/models/replication-profile/replication-profile-snapshot.service';
import { PolicyReplicationService } from '../../../../src/models/replication-profile/policy-replication.service';
import { getProfileProvisioning } from '../../../../src/models/replication-profile/policy-replication.types';

interface CapturedObject {
  kind: string;
  value?: unknown;
  role?: string;
  name?: string;
}

interface CapturedRule {
  chain: string;
  ipVersion: number;
  action: string;
  inRole?: string;
  outRole?: string;
  source?: CapturedObject[];
  destination?: CapturedObject[];
  services?: { protocol: string; port: unknown }[];
  comment?: string;
}

interface CapturedParameter {
  name: string;
  type: string;
  default: unknown;
}

describe(describeName('ReplicationProfileSnapshotService Unit Tests'), () => {
  let app: Application;
  let service: ReplicationProfileSnapshotService;
  let fwc: FwCloudProduct;
  let source: ReplicationTargetSide;

  before(async () => {
    app = testSuite.app;
    await testSuite.resetDatabaseData();
  });

  beforeEach(async () => {
    service = await app.getService<ReplicationProfileSnapshotService>(
      ReplicationProfileSnapshotService.name,
    );
    fwc = await new FwCloudFactory().make();
    source = await makeReplicationTargetFirewall(fwc);
  });

  async function insertForwardRule(
    firewallId: number,
    ruleOrder: number,
    overrides: Partial<{
      action: number;
      active: number;
      special: number;
      comment: string;
    }> = {},
  ): Promise<number> {
    return PolicyRule.insertPolicy_r({
      firewall: firewallId,
      type: 3, // IPv4 FORWARD
      rule_order: ruleOrder,
      action: overrides.action ?? 1,
      active: overrides.active ?? 1,
      options: 0,
      special: overrides.special ?? 0,
      comment: overrides.comment ?? null,
    });
  }

  function attachInterface(ruleId: number, interfaceId: number, position: number): Promise<void> {
    return db
      .getSource()
      .query(
        'INSERT INTO policy_r__interface (rule, interface, position, position_order) VALUES (?, ?, ?, 1)',
        [ruleId, interfaceId, position],
      );
  }

  function attachIpObj(ruleId: number, ipobjId: number, position: number): Promise<void> {
    return db
      .getSource()
      .query(
        'INSERT INTO policy_r__ipobj (rule, ipobj, ipobj_g, interface, position, position_order) VALUES (?, ?, -1, -1, ?, 1)',
        [ruleId, ipobjId, position],
      );
  }

  async function makeTcpService(port: number): Promise<IPObj> {
    return db
      .getSource()
      .manager.getRepository(IPObj)
      .save({
        name: `TCP/${port}`,
        ipObjTypeId: 2,
        protocol: 6,
        source_port_start: 0,
        source_port_end: 0,
        destination_port_start: port,
        destination_port_end: port,
        fwCloudId: fwc.fwcloud.id,
      });
  }

  function getProvision(profile: ReplicationProfile): {
    interfaces: Array<{ name: string; role: string; addresses: Array<{ value: unknown }> }>;
    rules: CapturedRule[];
  } {
    return profile.model.provision as {
      interfaces: Array<{ name: string; role: string; addresses: Array<{ value: unknown }> }>;
      rules: CapturedRule[];
    };
  }

  function getParameters(profile: ReplicationProfile): CapturedParameter[] {
    return (profile.model.parameters ?? []) as CapturedParameter[];
  }

  it('should be provided as an application service', () => {
    expect(service).to.be.instanceOf(ReplicationProfileSnapshotService);
  });

  describe('firewall snapshots', () => {
    it('should capture interfaces and expressible FORWARD rules into a custom profile', async () => {
      const httpService = await makeTcpService(8080);
      const acceptRuleId = await insertForwardRule(source.firewall.id, 100, {
        comment: 'Allow LAN to WAN web',
      });
      await attachInterface(acceptRuleId, source.lanInterface.id, 22); // In
      await attachInterface(acceptRuleId, source.wanInterface.id, 25); // Out
      await attachIpObj(acceptRuleId, httpService.id, 9); // Service

      const denyRuleId = await insertForwardRule(source.firewall.id, 101, {
        action: 2,
        comment: 'Block WAN to LAN',
      });
      await attachInterface(denyRuleId, source.wanInterface.id, 22);

      const { profile, warnings } = await service.createProfileFromSource(
        {
          source: { kind: 'firewall', id: source.firewall.id },
          name: 'Snapshot of edge firewall',
        },
        { fwCloudId: fwc.fwcloud.id },
      );

      expect(warnings).to.be.empty;
      expect(profile.targetKind).to.be.eq('firewall');
      expect(profile.scope).to.be.eq('fwcloud');
      expect(profile.isBuiltin).to.be.false;
      expect(profile.fwCloudId).to.be.eq(fwc.fwcloud.id);

      const provision = getProvision(profile);
      const roleByName = new Map(provision.interfaces.map((iface) => [iface.name, iface.role]));
      expect(roleByName.has('ens18')).to.be.true;
      expect(roleByName.has('ens19')).to.be.true;

      expect(provision.rules).to.have.length(2);
      const [acceptRule, denyRule] = provision.rules;
      expect(acceptRule.action).to.be.eq('accept');
      expect(acceptRule.inRole).to.be.eq(roleByName.get('ens19'));
      expect(acceptRule.outRole).to.be.eq(roleByName.get('ens18'));
      expect(acceptRule.services).to.have.length(1);
      expect(acceptRule.services[0].protocol).to.be.eq('tcp');
      // The captured port is exposed as a parameter defaulting to the original.
      const portParamName = (acceptRule.services[0].port as { param: string }).param;
      const portParameter = getParameters(profile).find(
        (parameter) => parameter.name === portParamName,
      );
      expect(portParameter).to.not.be.undefined;
      expect(portParameter.type).to.be.eq('port');
      expect(portParameter.default).to.be.eq(8080);
      expect(acceptRule.comment).to.be.eq('Allow LAN to WAN web');
      expect(denyRule.action).to.be.eq('deny');
      expect(denyRule.inRole).to.be.eq(roleByName.get('ens18'));
      expect(denyRule.services).to.be.undefined;

      const sourceRef = profile.model.sourceRef as Record<string, unknown>;
      expect(sourceRef.kind).to.be.eq('firewall');
      expect(sourceRef.id).to.be.eq(source.firewall.id);
      expect(sourceRef.name).to.be.eq(source.firewall.name);

      const compatibility = profile.model.compatibility as Record<string, unknown>;
      expect(compatibility.target_kinds).to.deep.eq(['firewall', 'cluster']);
    });

    it('should skip the default policy rules generated at firewall creation', async () => {
      const { profile, warnings } = await service.createProfileFromSource(
        {
          source: { kind: 'firewall', id: source.firewall.id },
          name: 'Snapshot without custom rules',
        },
        { fwCloudId: fwc.fwcloud.id },
      );

      expect(warnings).to.be.empty;
      expect(getProvision(profile).rules).to.be.empty;
    });

    it('should capture a source address as a profile parameter', async () => {
      const addressRuleId = await insertForwardRule(source.firewall.id, 100, {
        comment: 'Address based rule',
      });
      await attachIpObj(addressRuleId, fwc.ipobjs.get('address').id, 7);

      const { profile, warnings } = await service.createProfileFromSource(
        {
          source: { kind: 'firewall', id: source.firewall.id },
          name: 'Snapshot with a source object',
        },
        { fwCloudId: fwc.fwcloud.id },
      );

      expect(warnings).to.be.empty;

      const [rule] = getProvision(profile).rules;
      expect(rule.source).to.have.length(1);
      expect(rule.source[0].kind).to.be.oneOf(['address', 'network']);

      // The literal address is not baked into the rule: it is a parameter the
      // caller can re-point when applying the profile elsewhere.
      const paramName = (rule.source[0].value as { param: string }).param;
      expect(getParameters(profile).some((parameter) => parameter.name === paramName)).to.be.true;
    });

    it('should warn about rules that cannot be expressed in the template vocabulary', async () => {
      // Disabled rule.
      await insertForwardRule(source.firewall.id, 101, {
        active: 0,
        comment: 'Disabled rule',
      });

      // Unsupported action (REJECT).
      await insertForwardRule(source.firewall.id, 102, {
        action: 3,
        comment: 'Reject rule',
      });

      const { profile, warnings } = await service.createProfileFromSource(
        {
          source: { kind: 'firewall', id: source.firewall.id },
          name: 'Snapshot with warnings',
        },
        { fwCloudId: fwc.fwcloud.id },
      );

      expect(getProvision(profile).rules).to.be.empty;
      expect(warnings).to.have.length(2);
      expect(warnings.join(' ')).to.contain('Disabled rule');
      expect(warnings.join(' ')).to.contain('Reject rule');
    });

    it('should reject a firewall that belongs to another FWCloud', async () => {
      await expect(
        service.createProfileFromSource(
          {
            source: { kind: 'firewall', id: source.firewall.id },
            name: 'Cross-cloud snapshot',
          },
          { fwCloudId: fwc.fwcloud.id + 1 },
        ),
      ).to.be.rejectedWith(NotFoundException);
    });
  });

  describe('cluster snapshots', () => {
    let cluster: Cluster;

    beforeEach(async () => {
      const manager = db.getSource().manager;

      cluster = await manager.getRepository(Cluster).save(
        manager.getRepository(Cluster).create({
          name: StringHelper.randomize(10),
          fwCloudId: fwc.fwcloud.id,
        }),
      );

      source.firewall.clusterId = cluster.id;
      source.firewall.fwmaster = 1;
      await manager.getRepository(Firewall).save(source.firewall);

      await manager.getRepository(Firewall).save({
        name: `${cluster.name}-backup`,
        fwCloudId: fwc.fwcloud.id,
        clusterId: cluster.id,
        fwmaster: 0,
      });
    });

    it('should capture the master policy and the cluster topology', async () => {
      const ruleId = await insertForwardRule(source.firewall.id, 100, {
        comment: 'Cluster forward rule',
      });
      await attachInterface(ruleId, source.lanInterface.id, 22);

      const { profile, warnings } = await service.createProfileFromSource(
        {
          source: { kind: 'cluster', id: cluster.id },
          name: 'Snapshot of HA cluster',
        },
        { fwCloudId: fwc.fwcloud.id },
      );

      expect(warnings).to.be.empty;
      expect(profile.targetKind).to.be.eq('cluster');
      expect(getProvision(profile).rules).to.have.length(1);

      const topologyPreset = profile.model.topologyPreset as {
        nodes: Array<{ role: string; name: string; required: boolean }>;
      };
      expect(topologyPreset.nodes).to.have.length(2);
      expect(topologyPreset.nodes[0]).to.deep.eq({
        role: 'master',
        name: source.firewall.name,
        required: true,
        master: true,
      });
      expect(topologyPreset.nodes[1].role).to.be.eq('backup');
      expect(topologyPreset.nodes[1].required).to.be.false;

      const roleAssignments = profile.model.roleAssignments as Record<string, unknown>;
      expect(roleAssignments.nodeRoles).to.deep.eq(['master', 'backup']);

      const sourceRef = profile.model.sourceRef as Record<string, unknown>;
      expect(sourceRef.kind).to.be.eq('cluster');
      expect(sourceRef.name).to.be.eq(cluster.name);
    });

    it('should reject a cluster that belongs to another FWCloud', async () => {
      await expect(
        service.createProfileFromSource(
          {
            source: { kind: 'cluster', id: cluster.id },
            name: 'Cross-cloud cluster snapshot',
          },
          { fwCloudId: fwc.fwcloud.id + 1 },
        ),
      ).to.be.rejectedWith(NotFoundException);
    });
  });

  describe('NAT, predefined objects, routing and system', () => {
    it('should capture what a provisioned firewall holds back into the same vocabulary', async () => {
      const provisioning = await app.getService<PolicyReplicationService>(
        PolicyReplicationService.name,
      );
      const applied = await provisioning.provisionPolicyFromProfile(
        { kind: 'firewall', id: source.firewall.id },
        getProfileProvisioning({
          provision: {
            interfaces: [
              { name: 'ens18', role: 'wan' },
              { name: 'ens19', role: 'lan' },
            ],
            rules: [
              {
                chain: 'forward',
                source: [{ kind: 'stdGroup', id: 1 }],
                services: [{ kind: 'std', id: 20029 }],
              },
              {
                chain: 'dnat',
                inRole: 'wan',
                services: [{ protocol: 'tcp', port: 8443 }],
                translatedDestination: [{ kind: 'address', value: '192.168.70.20' }],
              },
            ],
            routing: {
              tables: [
                {
                  key: 'isp2',
                  number: 12,
                  name: 'ISP2',
                  routes: [
                    {
                      destination: [{ kind: 'std', id: 70003 }],
                      gateway: { kind: 'address', value: '203.0.113.1' },
                    },
                  ],
                },
              ],
              rules: [
                {
                  from: [{ kind: 'range', value: '192.168.70.100-192.168.70.110' }],
                  table: 'isp2',
                },
              ],
            },
            system: {
              dhcp: [
                {
                  network: { kind: 'network', value: '192.168.70.0/24' },
                  range: { kind: 'range', value: '192.168.70.100-192.168.70.200' },
                  router: { kind: 'address', value: '192.168.70.1' },
                  dns: [],
                  maxLease: 7200,
                },
              ],
            },
          },
        }),
        fwc.fwcloud.id,
        'replace_defaults',
        { interfaceNameMapping: { wan: 'ens18', lan: 'ens19' } },
      );
      expect(applied.errors).to.be.empty;

      const { profile, warnings } = await service.createProfileFromSource(
        { source: { kind: 'firewall', id: source.firewall.id }, name: 'Round trip' },
        { fwCloudId: fwc.fwcloud.id },
      );

      expect(warnings).to.be.empty;
      const provision = profile.model.provision as Record<string, any>;
      const forward = provision.rules.find((rule) => rule.chain === 'forward');
      expect(forward.source).to.deep.equal([{ kind: 'stdGroup', id: 1, name: 'rfc1918-nets' }]);
      expect(forward.services).to.deep.equal([{ kind: 'std', id: 20029, name: 'https' }]);
      const dnat = provision.rules.find((rule) => rule.chain === 'dnat');
      expect(dnat.inRole).to.equal('ens18');
      expect(dnat.translatedDestination[0].kind).to.equal('address');

      expect(provision.routing.tables).to.have.length(1);
      expect(provision.routing.tables[0]).to.include({ key: 'table_12', number: 12, name: 'ISP2' });
      expect(provision.routing.tables[0].routes[0].destination).to.deep.equal([
        { kind: 'std', id: 70003, name: 'net-10.0.0.0' },
      ]);
      expect(provision.routing.rules[0].table).to.equal('table_12');
      expect(provision.routing.rules[0].from[0].kind).to.equal('range');
      expect(provision.system.dhcp[0]).to.include({ maxLease: 7200 });
      expect(getParameters(profile).some((parameter) => parameter.type === 'range')).to.be.true;

      // The captured model is a valid provisioning profile again.
      const reparsed = getProfileProvisioning(profile.model);
      expect(reparsed.rules).to.have.length(2);
      expect(reparsed.routing.tables[0].routes).to.have.length(1);
      expect(reparsed.system.dhcp).to.have.length(1);
    });

    it('should warn about FWCloud groups, which are not predefined and cannot be templated', async () => {
      const [group] = await db
        .getSource()
        .query("INSERT INTO ipobj_g (name, type, fwcloud) VALUES ('Office nets', 20, ?)", [
          fwc.fwcloud.id,
        ])
        .then((result) => [result.insertId]);
      const ruleId = await insertForwardRule(source.firewall.id, 120, { comment: 'Group rule' });
      await db
        .getSource()
        .query(
          'INSERT INTO policy_r__ipobj (rule, ipobj, ipobj_g, interface, position, position_order) VALUES (?, -1, ?, -1, 7, 1)',
          [ruleId, group],
        );

      const { profile, warnings } = await service.createProfileFromSource(
        { source: { kind: 'firewall', id: source.firewall.id }, name: 'Group snapshot' },
        { fwCloudId: fwc.fwcloud.id },
      );

      expect(getProvision(profile).rules).to.be.empty;
      expect(warnings).to.have.length(1);
      expect(warnings[0]).to.contain('FORWARD IPv4 rule 120').and.to.contain('groups');
    });
  });

  describe('several interfaces per rule', () => {
    it('should capture every inbound interface of a rule as a list of roles', async () => {
      const ruleId = await insertForwardRule(source.firewall.id, 130, { comment: 'Two inbound' });
      await attachInterface(ruleId, source.lanInterface.id, 22);
      await db
        .getSource()
        .query(
          'INSERT INTO policy_r__interface (rule, interface, position, position_order) VALUES (?, ?, 22, 2)',
          [ruleId, source.wanInterface.id],
        );

      const { profile, warnings } = await service.createProfileFromSource(
        { source: { kind: 'firewall', id: source.firewall.id }, name: 'Two inbound snapshot' },
        { fwCloudId: fwc.fwcloud.id },
      );

      expect(warnings).to.be.empty;
      const [rule] = getProvision(profile).rules as unknown as Array<{ inRole: string[] }>;
      expect([...rule.inRole].sort()).to.deep.equal(['ens18', 'ens19']);
    });
  });
});
