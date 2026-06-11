import sinon from 'sinon';
import { describeName, expect, testSuite } from '../../../mocha/global-setup';
import { Application } from '../../../../src/Application';
import db from '../../../../src/database/database-manager';
import { FwCloudFactory, FwCloudProduct } from '../../../utils/fwcloud-factory';
import { Firewall, FireWallOptMask } from '../../../../src/models/firewall/Firewall';
import { Cluster } from '../../../../src/models/firewall/Cluster';
import { Interface } from '../../../../src/models/interface/Interface';
import { IPObj } from '../../../../src/models/ipobj/IPObj';
import { PolicyRule } from '../../../../src/models/policy/PolicyRule';
import { PolicyReplicationService } from '../../../../src/models/replication-profile/policy-replication.service';
import { PolicyReplicationRequest } from '../../../../src/models/replication-profile/policy-replication.types';
import StringHelper from '../../../../src/utils/string.helper';

interface TargetSide {
  firewall: Firewall;
  wanInterface: Interface;
  lanInterface: Interface;
  wanAddress: IPObj;
}

describe(describeName('PolicyReplicationService Unit Tests'), () => {
  let app: Application;
  let service: PolicyReplicationService;
  let fwc: FwCloudProduct;

  let sourceWanInterface: Interface;
  let sourceLanInterface: Interface;
  let sourceWanAddress: IPObj;
  let sourceGroupId: number;
  let statefulRuleId: number;
  let customRuleId: number;
  let catchAllRuleId: number;

  before(async () => {
    app = testSuite.app;
    await testSuite.resetDatabaseData();
  });

  beforeEach(async () => {
    service = await app.getService<PolicyReplicationService>(PolicyReplicationService.name);
    fwc = await new FwCloudFactory().make();

    sourceWanInterface = fwc.interfaces.get('firewall-interface1');
    sourceLanInterface = await db.getSource().manager.getRepository(Interface).save({
      name: 'eth-lan',
      type: '10',
      interface_type: '10',
      firewallId: fwc.firewall.id,
    });

    sourceWanAddress = await db.getSource().manager.getRepository(IPObj).save({
      name: 'src-wan-addr',
      address: '192.0.2.1',
      ipObjTypeId: 5,
      ip_version: 4,
      interfaceId: sourceWanInterface.id,
      fwCloudId: fwc.fwcloud.id,
    });

    sourceGroupId = (
      await db
        .getSource()
        .query('INSERT INTO policy_g (firewall, name, comment) VALUES (?, ?, ?)', [
          fwc.firewall.id,
          'mgmt rules',
          'replication test group',
        ])
    ).insertId;

    // Source template policy: stateful + one custom rule + catch-all (INPUT IPv4).
    statefulRuleId = await PolicyRule.insertPolicy_r({
      firewall: fwc.firewall.id,
      type: 1,
      rule_order: 1,
      action: 1,
      active: 1,
      options: 1,
      special: 1,
      comment: 'Stateful firewall rule.',
    });

    customRuleId = await PolicyRule.insertPolicy_r({
      firewall: fwc.firewall.id,
      idgroup: sourceGroupId,
      type: 1,
      rule_order: 2,
      action: 1,
      active: 1,
      options: 0,
      special: 0,
      comment: 'Allow management traffic.',
    });
    await db
      .getSource()
      .query(
        'INSERT INTO policy_r__interface (rule, interface, position, position_order) VALUES (?, ?, ?, ?)',
        [customRuleId, sourceWanInterface.id, 20, 1],
      );
    await db
      .getSource()
      .query(
        'INSERT INTO policy_r__ipobj (rule, ipobj, ipobj_g, interface, position, position_order) VALUES (?, ?, -1, -1, ?, ?)',
        [customRuleId, fwc.ipobjs.get('address').id, 1, 1],
      );
    await db
      .getSource()
      .query(
        'INSERT INTO policy_r__ipobj (rule, ipobj, ipobj_g, interface, position, position_order) VALUES (?, ?, -1, -1, ?, ?)',
        [customRuleId, sourceWanAddress.id, 2, 1],
      );

    catchAllRuleId = await PolicyRule.insertPolicy_r({
      firewall: fwc.firewall.id,
      type: 1,
      rule_order: 3,
      action: 2,
      active: 1,
      options: 2,
      special: 2,
      comment: 'Catch-all rule.',
    });
  });

  async function makeTargetFirewall(withWanAddress: boolean = true): Promise<TargetSide> {
    const manager = db.getSource().manager;

    const firewall = await manager.getRepository(Firewall).save({
      name: StringHelper.randomize(10),
      fwCloudId: fwc.fwcloud.id,
    });

    const wanInterface = await manager.getRepository(Interface).save({
      name: 'ens18',
      type: '10',
      interface_type: '10',
      firewallId: firewall.id,
    });

    const lanInterface = await manager.getRepository(Interface).save({
      name: 'ens19',
      type: '10',
      interface_type: '10',
      firewallId: firewall.id,
    });

    let wanAddress: IPObj = null;
    if (withWanAddress) {
      wanAddress = await manager.getRepository(IPObj).save({
        name: 'tgt-wan-addr',
        address: '203.0.113.10',
        ipObjTypeId: 5,
        ip_version: 4,
        interfaceId: wanInterface.id,
        fwCloudId: fwc.fwcloud.id,
      });
    }

    await PolicyRule.insertDefaultPolicy(firewall.id, null, FireWallOptMask.STATEFUL);

    return { firewall, wanInterface, lanInterface, wanAddress };
  }

  function makeRequest(
    target: TargetSide,
    mode: PolicyReplicationRequest['mode'],
    overrides: Partial<PolicyReplicationRequest> = {},
  ): PolicyReplicationRequest {
    return {
      sourceProfile: {
        firewallId: fwc.firewall.id,
        interfaceRoles: { wan: sourceWanInterface.id, lan: sourceLanInterface.id },
      },
      target: { kind: 'firewall', id: target.firewall.id },
      interfaceRoleMapping: { wan: target.wanInterface.id, lan: target.lanInterface.id },
      mode,
      ...overrides,
    };
  }

  function countTargetRules(firewallId: number): Promise<number> {
    return db
      .getSource()
      .query('SELECT COUNT(*) AS n FROM policy_r WHERE firewall = ?', [firewallId])
      .then((rows) => Number(rows[0].n));
  }

  it('should be provided as an application service', async () => {
    expect(service).to.be.instanceOf(PolicyReplicationService);
  });

  describe('replace_defaults mode', () => {
    it('should remove the generated default rules and insert the profile rules', async () => {
      const target = await makeTargetFirewall();
      const defaultRulesBefore = await countTargetRules(target.firewall.id);
      expect(defaultRulesBefore).to.be.eq(12); // stateful + catch-all for 6 chain types

      const result = await service.replicatePolicyFromProfile(
        makeRequest(target, 'replace_defaults'),
      );

      expect(result.applied).to.be.true;
      expect(result.errors).to.be.empty;
      expect(result.removedDefaultRules).to.have.length(12);
      expect(result.createdRules).to.have.length(3);
      expect(result.createdRules.every((rule) => rule.targetRuleId !== null)).to.be.true;

      // No duplicated default/base rules: only the three replicated rules remain.
      expect(await countTargetRules(target.firewall.id)).to.be.eq(3);
      const specials = await db
        .getSource()
        .query('SELECT special, COUNT(*) AS n FROM policy_r WHERE firewall = ? GROUP BY special', [
          target.firewall.id,
        ]);
      for (const row of specials) {
        expect(Number(row.n)).to.be.at.most(1, `special ${row.special} duplicated`);
      }
    });

    it('should resolve interface and interface address references through roles', async () => {
      const target = await makeTargetFirewall();
      const result = await service.replicatePolicyFromProfile(
        makeRequest(target, 'replace_defaults'),
      );

      expect(result.applied).to.be.true;

      const newCustomRuleId = result.createdRules.find(
        (rule) => rule.sourceRuleId === customRuleId,
      ).targetRuleId;

      const interfaceRefs = await db
        .getSource()
        .query('SELECT interface FROM policy_r__interface WHERE rule = ?', [newCustomRuleId]);
      expect(interfaceRefs).to.have.length(1);
      expect(interfaceRefs[0].interface).to.be.eq(target.wanInterface.id);

      const ipobjRefs = await db
        .getSource()
        .query('SELECT ipobj, position FROM policy_r__ipobj WHERE rule = ? ORDER BY position', [
          newCustomRuleId,
        ]);
      expect(ipobjRefs).to.have.length(2);
      // Shared FWCloud object kept as is.
      expect(ipobjRefs[0].ipobj).to.be.eq(fwc.ipobjs.get('address').id);
      // Source interface address remapped to the target wan interface address.
      expect(ipobjRefs[1].ipobj).to.be.eq(target.wanAddress.id);

      expect(
        result.resolvedReferences.some(
          (reference) =>
            reference.kind === 'interface' &&
            reference.role === 'wan' &&
            reference.sourceId === sourceWanInterface.id &&
            reference.targetId === target.wanInterface.id,
        ),
      ).to.be.true;

      // No reference of the new rules may point to a source firewall interface.
      const brokenRefs = await db.getSource().query(
        `SELECT COUNT(*) AS n FROM policy_r__interface R
            INNER JOIN policy_r P ON P.id = R.rule
            INNER JOIN interface I ON I.id = R.interface
            WHERE P.firewall = ? AND I.firewall = ?`,
        [target.firewall.id, fwc.firewall.id],
      );
      expect(Number(brokenRefs[0].n)).to.be.eq(0);
    });

    it('should replicate the policy groups referenced by the replicated rules', async () => {
      const target = await makeTargetFirewall();
      const result = await service.replicatePolicyFromProfile(
        makeRequest(target, 'replace_defaults'),
      );

      expect(result.createdGroups).to.have.length(1);
      expect(result.createdGroups[0].name).to.be.eq('mgmt rules');
      expect(result.createdGroups[0].targetGroupId).not.to.be.null;

      const newCustomRuleId = result.createdRules.find(
        (rule) => rule.sourceRuleId === customRuleId,
      ).targetRuleId;
      const rows = await db
        .getSource()
        .query('SELECT idgroup FROM policy_r WHERE id = ?', [newCustomRuleId]);
      expect(rows[0].idgroup).to.be.eq(result.createdGroups[0].targetGroupId);
    });
  });

  describe('cluster target', () => {
    it('should replicate into the cluster master resolving node roles', async () => {
      const manager = db.getSource().manager;

      // Turn the source firewall into a cluster master with one extra node.
      const sourceCluster = await manager
        .getRepository(Cluster)
        .save({ name: 'src-cluster', fwCloudId: fwc.fwcloud.id });
      await manager
        .getRepository(Firewall)
        .update(fwc.firewall.id, { clusterId: sourceCluster.id, fwmaster: 1 });
      const sourceNode = await manager.getRepository(Firewall).save({
        name: 'src-node-2',
        fwCloudId: fwc.fwcloud.id,
        clusterId: sourceCluster.id,
        fwmaster: 0,
      });
      await db
        .getSource()
        .query('UPDATE policy_r SET fw_apply_to = ? WHERE id = ?', [sourceNode.id, customRuleId]);

      // Target cluster with its own master and node.
      const targetCluster = await manager
        .getRepository(Cluster)
        .save({ name: 'tgt-cluster', fwCloudId: fwc.fwcloud.id });
      const target = await makeTargetFirewall();
      await manager
        .getRepository(Firewall)
        .update(target.firewall.id, { clusterId: targetCluster.id, fwmaster: 1 });
      const targetNode = await manager.getRepository(Firewall).save({
        name: 'tgt-node-2',
        fwCloudId: fwc.fwcloud.id,
        clusterId: targetCluster.id,
        fwmaster: 0,
      });

      const request = makeRequest(target, 'replace_defaults', {
        target: { kind: 'cluster', id: targetCluster.id },
        nodeRoleMapping: { backup: targetNode.id },
      });
      request.sourceProfile.nodeRoles = { backup: sourceNode.id };

      const result = await service.replicatePolicyFromProfile(request);

      expect(result.applied).to.be.true;
      expect(result.errors).to.be.empty;

      const newCustomRuleId = result.createdRules.find(
        (rule) => rule.sourceRuleId === customRuleId,
      ).targetRuleId;
      const rows = await db
        .getSource()
        .query('SELECT firewall, fw_apply_to FROM policy_r WHERE id = ?', [newCustomRuleId]);
      expect(rows[0].firewall).to.be.eq(target.firewall.id);
      expect(rows[0].fw_apply_to).to.be.eq(targetNode.id);

      expect(
        result.resolvedReferences.some(
          (reference) =>
            reference.kind === 'node' &&
            reference.role === 'backup' &&
            reference.targetId === targetNode.id,
        ),
      ).to.be.true;
    });

    it('should fail with a readable error when a node role mapping is missing', async () => {
      const manager = db.getSource().manager;

      const sourceCluster = await manager
        .getRepository(Cluster)
        .save({ name: 'src-cluster', fwCloudId: fwc.fwcloud.id });
      await manager
        .getRepository(Firewall)
        .update(fwc.firewall.id, { clusterId: sourceCluster.id, fwmaster: 1 });
      const sourceNode = await manager.getRepository(Firewall).save({
        name: 'src-node-2',
        fwCloudId: fwc.fwcloud.id,
        clusterId: sourceCluster.id,
        fwmaster: 0,
      });
      await db
        .getSource()
        .query('UPDATE policy_r SET fw_apply_to = ? WHERE id = ?', [sourceNode.id, customRuleId]);

      const targetCluster = await manager
        .getRepository(Cluster)
        .save({ name: 'tgt-cluster', fwCloudId: fwc.fwcloud.id });
      const target = await makeTargetFirewall();
      await manager
        .getRepository(Firewall)
        .update(target.firewall.id, { clusterId: targetCluster.id, fwmaster: 1 });

      const request = makeRequest(target, 'replace_defaults', {
        target: { kind: 'cluster', id: targetCluster.id },
      });
      request.sourceProfile.nodeRoles = { backup: sourceNode.id };

      const rulesBefore = await countTargetRules(target.firewall.id);
      const result = await service.replicatePolicyFromProfile(request);

      expect(result.applied).to.be.false;
      expect(
        result.errors.some((error) => /Missing node role mapping for role "backup"/.test(error)),
      ).to.be.true;
      expect(await countTargetRules(target.firewall.id)).to.be.eq(rulesBefore);
    });
  });

  describe('merge mode', () => {
    it('should keep existing rules and report collisions without writing', async () => {
      const target = await makeTargetFirewall();
      const rulesBefore = await countTargetRules(target.firewall.id);

      // Make the source catch-all differ from the target one so that it
      // collides on ordering instead of being an exact duplicate.
      await db.getSource().query('UPDATE policy_r SET action = 1 WHERE id = ?', [catchAllRuleId]);

      // The source stateful and catch-all rules collide with the target defaults.
      const result = await service.replicatePolicyFromProfile(makeRequest(target, 'merge'));

      expect(result.applied).to.be.false;
      expect(result.conflicts).not.to.be.empty;
      // Identical special rule -> duplicated rule collision.
      expect(result.conflicts.some((conflict) => conflict.type === 'duplicated_rule')).to.be.true;
      // Different catch-all -> two catch-all rules cannot be ordered safely.
      expect(result.conflicts.some((conflict) => conflict.type === 'incompatible_rule_order')).to.be
        .true;
      expect(await countTargetRules(target.firewall.id)).to.be.eq(rulesBefore);
    });

    it('should merge non-colliding rules before the target catch-all rule', async () => {
      // Remove the colliding special rules from the source template.
      await db
        .getSource()
        .query('DELETE FROM policy_r WHERE id IN (?, ?)', [statefulRuleId, catchAllRuleId]);

      const target = await makeTargetFirewall();
      const rulesBefore = await countTargetRules(target.firewall.id);

      const result = await service.replicatePolicyFromProfile(makeRequest(target, 'merge'));

      expect(result.applied).to.be.true;
      expect(result.conflicts).to.be.empty;
      expect(result.createdRules).to.have.length(1);
      expect(await countTargetRules(target.firewall.id)).to.be.eq(rulesBefore + 1);

      const rows = await db
        .getSource()
        .query(
          'SELECT id, rule_order, special FROM policy_r WHERE firewall = ? AND type = 1 ORDER BY rule_order',
          [target.firewall.id],
        );
      const newRule = rows.find((row) => row.id === result.createdRules[0].targetRuleId);
      const catchAll = rows.find((row) => row.special === 2);
      expect(newRule.rule_order).to.be.lessThan(catchAll.rule_order);
    });

    it('should report duplicated rules when merging the same profile twice', async () => {
      await db
        .getSource()
        .query('DELETE FROM policy_r WHERE id IN (?, ?)', [statefulRuleId, catchAllRuleId]);

      const target = await makeTargetFirewall();

      const first = await service.replicatePolicyFromProfile(makeRequest(target, 'merge'));
      expect(first.applied).to.be.true;

      const rulesBefore = await countTargetRules(target.firewall.id);
      const second = await service.replicatePolicyFromProfile(makeRequest(target, 'merge'));

      expect(second.applied).to.be.false;
      expect(second.conflicts.some((conflict) => conflict.type === 'duplicated_rule')).to.be.true;
      expect(second.conflicts.some((conflict) => conflict.type === 'duplicated_group')).to.be.true;
      expect(await countTargetRules(target.firewall.id)).to.be.eq(rulesBefore);
    });
  });

  describe('dry_run mode', () => {
    it('should return a complete preview without modifying the database', async () => {
      const target = await makeTargetFirewall();
      const rulesBefore = await countTargetRules(target.firewall.id);
      const groupsBefore = await db
        .getSource()
        .query('SELECT COUNT(*) AS n FROM policy_g WHERE firewall = ?', [target.firewall.id]);

      const result = await service.replicatePolicyFromProfile(makeRequest(target, 'dry_run'));

      expect(result.applied).to.be.false;
      expect(result.createdRules).to.have.length(3);
      expect(result.createdRules.every((rule) => rule.targetRuleId === null)).to.be.true;
      expect(result.createdGroups).to.have.length(1);
      expect(result.createdGroups[0].targetGroupId).to.be.null;
      expect(result.removedDefaultRules).to.have.length(12);
      expect(result.resolvedReferences).not.to.be.empty;
      // The preview also includes the collisions a merge would report.
      expect(
        result.conflicts.some(
          (conflict) =>
            conflict.type === 'duplicated_rule' || conflict.type === 'incompatible_rule_order',
        ),
      ).to.be.true;

      expect(await countTargetRules(target.firewall.id)).to.be.eq(rulesBefore);
      const groupsAfter = await db
        .getSource()
        .query('SELECT COUNT(*) AS n FROM policy_g WHERE firewall = ?', [target.firewall.id]);
      expect(Number(groupsAfter[0].n)).to.be.eq(Number(groupsBefore[0].n));
    });
  });

  describe('role mapping validation', () => {
    it('should fail with a readable error when an interface role mapping is missing', async () => {
      const target = await makeTargetFirewall();
      const rulesBefore = await countTargetRules(target.firewall.id);

      const request = makeRequest(target, 'replace_defaults', { interfaceRoleMapping: {} });
      const result = await service.replicatePolicyFromProfile(request);

      expect(result.applied).to.be.false;
      expect(
        result.errors.some((error) => /Missing interface role mapping for role "wan"/.test(error)),
      ).to.be.true;
      expect(await countTargetRules(target.firewall.id)).to.be.eq(rulesBefore);
    });

    it('should fail when a referenced source interface has no role assigned', async () => {
      const target = await makeTargetFirewall();

      const request = makeRequest(target, 'replace_defaults');
      request.sourceProfile.interfaceRoles = { lan: sourceLanInterface.id };

      const result = await service.replicatePolicyFromProfile(request);

      expect(result.applied).to.be.false;
      expect(result.errors.some((error) => /has no role assigned/.test(error))).to.be.true;
    });

    it('should reject a target interface mapped to more than one role', async () => {
      const target = await makeTargetFirewall();

      const request = makeRequest(target, 'replace_defaults', {
        interfaceRoleMapping: { wan: target.wanInterface.id, lan: target.wanInterface.id },
      });
      const result = await service.replicatePolicyFromProfile(request);

      expect(result.applied).to.be.false;
      expect(
        result.conflicts.some((conflict) => conflict.type === 'duplicated_interface_reference'),
      ).to.be.true;
    });
  });

  describe('broken and unsupported references', () => {
    it('should skip rules with interface addresses that cannot be resolved on the target', async () => {
      // Target wan interface has no addresses: the source wan address cannot be remapped.
      const target = await makeTargetFirewall(false);

      const result = await service.replicatePolicyFromProfile(
        makeRequest(target, 'replace_defaults'),
      );

      expect(result.applied).to.be.true;
      expect(result.skippedRules).to.deep.eq([customRuleId]);
      expect(result.conflicts.some((conflict) => conflict.type === 'broken_ipobj_reference')).to.be
        .true;
      // The other rules are still replicated and no broken reference is written.
      expect(result.createdRules.map((rule) => rule.sourceRuleId)).to.have.members([
        statefulRuleId,
        catchAllRuleId,
      ]);
      const rows = await db.getSource().query(
        `SELECT COUNT(*) AS n FROM policy_r__ipobj R INNER JOIN policy_r P ON P.id = R.rule
            WHERE P.firewall = ?`,
        [target.firewall.id],
      );
      expect(Number(rows[0].n)).to.be.eq(0);
    });

    it('should report VPN references that belong to the source firewall as unsupported', async () => {
      const vpnRuleId = await PolicyRule.insertPolicy_r({
        firewall: fwc.firewall.id,
        type: 1,
        rule_order: 3,
        action: 1,
        active: 1,
        options: 0,
        special: 0,
        comment: 'VPN rule.',
      });
      await db
        .getSource()
        .query(
          'INSERT INTO policy_r__openvpn (rule, openvpn, position, position_order) VALUES (?, ?, ?, ?)',
          [vpnRuleId, fwc.openvpnServer.id, 1, 1],
        );

      const target = await makeTargetFirewall();
      const result = await service.replicatePolicyFromProfile(
        makeRequest(target, 'replace_defaults'),
      );

      expect(result.applied).to.be.true;
      expect(result.skippedRules).to.include(vpnRuleId);
      expect(
        result.conflicts.some(
          (conflict) =>
            conflict.type === 'unsupported_vpn_reference' && conflict.sourceRuleId === vpnRuleId,
        ),
      ).to.be.true;

      const rows = await db.getSource().query(
        `SELECT COUNT(*) AS n FROM policy_r__openvpn R INNER JOIN policy_r P ON P.id = R.rule
            WHERE P.firewall = ?`,
        [target.firewall.id],
      );
      expect(Number(rows[0].n)).to.be.eq(0);
    });
  });

  describe('transactionality', () => {
    it('should rollback all changes when a write fails half way', async () => {
      const target = await makeTargetFirewall();
      const rulesBefore = await countTargetRules(target.firewall.id);

      const dataSource = db.getSource();
      const originalCreateQueryRunner = dataSource.createQueryRunner.bind(dataSource);
      const stub = sinon.stub(dataSource, 'createQueryRunner').callsFake(() => {
        const queryRunner = originalCreateQueryRunner();
        const originalQuery = queryRunner.query.bind(queryRunner);
        let ruleInserts = 0;
        sinon.stub(queryRunner, 'query').callsFake(async (sql: string, params?: any[]) => {
          if (/^\s*INSERT INTO policy_r\s/.test(sql) && ++ruleInserts === 2) {
            throw new Error('Forced write failure');
          }
          return originalQuery(sql, params);
        });
        return queryRunner;
      });

      try {
        await expect(
          service.replicatePolicyFromProfile(makeRequest(target, 'replace_defaults')),
        ).to.be.rejectedWith('Forced write failure');
      } finally {
        stub.restore();
      }

      // Nothing was committed: the default rules are still in place.
      expect(await countTargetRules(target.firewall.id)).to.be.eq(rulesBefore);
      const specials = await db
        .getSource()
        .query('SELECT COUNT(*) AS n FROM policy_r WHERE firewall = ? AND special IN (1, 2)', [
          target.firewall.id,
        ]);
      expect(Number(specials[0].n)).to.be.eq(12);
    });
  });
});
