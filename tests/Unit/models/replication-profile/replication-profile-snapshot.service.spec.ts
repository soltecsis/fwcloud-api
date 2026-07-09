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

interface CapturedRule {
  chain: string;
  action: string;
  inRole?: string;
  outRole?: string;
  service?: { protocol: string; port: number };
  comment?: string;
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
    interfaces: Array<{ name: string; role: string }>;
    rules: CapturedRule[];
  } {
    return profile.model.provision as {
      interfaces: Array<{ name: string; role: string }>;
      rules: CapturedRule[];
    };
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
      expect(acceptRule.service).to.deep.eq({ protocol: 'tcp', port: 8080 });
      expect(acceptRule.comment).to.be.eq('Allow LAN to WAN web');
      expect(denyRule.action).to.be.eq('deny');
      expect(denyRule.inRole).to.be.eq(roleByName.get('ens18'));
      expect(denyRule.service).to.be.undefined;

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

    it('should warn about rules that cannot be expressed in the template vocabulary', async () => {
      // Rule with a source address reference (position 7): not templateable.
      const addressRuleId = await insertForwardRule(source.firewall.id, 100, {
        comment: 'Address based rule',
      });
      await attachIpObj(addressRuleId, fwc.ipobjs.get('address').id, 7);

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
      expect(warnings).to.have.length(3);
      expect(warnings.join(' ')).to.contain('Address based rule');
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
});
