import sinon from 'sinon';
import { describeName, expect, testSuite } from '../../../mocha/global-setup';
import { Application } from '../../../../src/Application';
import db from '../../../../src/database/database-manager';
import { FwCloudFactory, FwCloudProduct } from '../../../utils/fwcloud-factory';
import {
  ReplicationProfileFixture,
  ReplicationTargetSide,
  makeReplicationProfileFixture,
  makeReplicationTargetFirewall,
} from '../../../utils/replication-profile-fixtures';
import { createUser } from '../../../utils/utils';
import { Firewall } from '../../../../src/models/firewall/Firewall';
import { Cluster } from '../../../../src/models/firewall/Cluster';
import { Interface } from '../../../../src/models/interface/Interface';
import { PolicyRule } from '../../../../src/models/policy/PolicyRule';
import { User } from '../../../../src/models/user/User';
import { FwCloud } from '../../../../src/models/fwcloud/FwCloud';
import { AuditLog } from '../../../../src/models/audit/AuditLog';
import { AuthorizationException } from '../../../../src/fonaments/exceptions/authorization-exception';
import { NotFoundException } from '../../../../src/fonaments/exceptions/not-found-exception';
import {
  PROFILE_APPLICATION_AUDIT_CALL,
  ProfileApplicationActor,
  ProfileApplicationRequest,
  ProfileApplicationScopeException,
  ProfileApplicationService,
} from '../../../../src/models/replication-profile/profile-application.service';
import { PolicyReplicationRequest } from '../../../../src/models/replication-profile/policy-replication.types';
import { ReplicationProfile } from '../../../../src/models/replication-profile/replication-profile.model';
import { resolveReplicationProfileTemplatePath } from '../../../../src/models/replication-profile/replication-profile-template';
import StringHelper from '../../../../src/utils/string.helper';
import * as fs from 'fs';

describe(describeName('ProfileApplicationService Unit Tests'), () => {
  let app: Application;
  let service: ProfileApplicationService;
  let fwc: FwCloudProduct;
  let profile: ReplicationProfile;
  let authorizedUser: User;

  let sourceWanInterface: Interface;
  let sourceLanInterface: Interface;
  let customRuleId: number;
  let profileCounter = 0;

  const ACTOR_SESSION_ID = 4242;

  before(async () => {
    app = testSuite.app;
    await testSuite.resetDatabaseData();
  });

  beforeEach(async () => {
    service = await app.getService<ProfileApplicationService>(ProfileApplicationService.name);
    fwc = await new FwCloudFactory().make();

    await db
      .getSource()
      .manager.getRepository(AuditLog)
      .delete({ call: PROFILE_APPLICATION_AUDIT_CALL });

    authorizedUser = await createUser({ role: 0 });
    authorizedUser.fwClouds = [fwc.fwcloud];
    await db.getSource().manager.getRepository(User).save(authorizedUser);

    profile = await makeProfile();

    sourceWanInterface = fwc.interfaces.get('firewall-interface1');
    sourceLanInterface = await db.getSource().manager.getRepository(Interface).save({
      name: 'eth-lan',
      type: '10',
      interface_type: '10',
      firewallId: fwc.firewall.id,
    });

    // Source template policy: stateful + one custom rule + catch-all (INPUT IPv4).
    await PolicyRule.insertPolicy_r({
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

    await PolicyRule.insertPolicy_r({
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

  function makeProfile(
    overrides: Partial<ReplicationProfileFixture> = {},
  ): Promise<ReplicationProfile> {
    const repository = db.getSource().manager.getRepository(ReplicationProfile);

    return repository.save(
      makeReplicationProfileFixture({
        code: `profile-app-${Date.now()}-${++profileCounter}`,
        name: 'Profile application test profile',
        userId: authorizedUser.id,
        model: {
          compatibility: { targetKinds: ['firewall', 'cluster'] },
          replicate: {},
          options: {},
        },
        ...overrides,
      }),
    );
  }

  const makeTargetFirewall = (): Promise<ReplicationTargetSide> =>
    makeReplicationTargetFirewall(fwc);

  function actor(user: User): ProfileApplicationActor {
    return { user, sessionId: ACTOR_SESSION_ID, sourceIp: '127.0.0.1' };
  }

  function makeApplyRequest(
    target: ReplicationTargetSide,
    mode: PolicyReplicationRequest['mode'],
    overrides: Partial<ProfileApplicationRequest> = {},
    replicationOverrides: Partial<PolicyReplicationRequest> = {},
  ): ProfileApplicationRequest {
    return {
      fwCloudId: fwc.fwcloud.id,
      profileCode: profile.code,
      profileVersion: profile.version,
      replication: {
        sourceProfile: {
          firewallId: fwc.firewall.id,
          interfaceRoles: { wan: sourceWanInterface.id, lan: sourceLanInterface.id },
        },
        target: { kind: 'firewall', id: target.firewall.id },
        interfaceRoleMapping: { wan: target.wanInterface.id, lan: target.lanInterface.id },
        mode,
        ...replicationOverrides,
      },
      ...overrides,
    };
  }

  function countTargetRules(firewallId: number): Promise<number> {
    return db
      .getSource()
      .query('SELECT COUNT(*) AS n FROM policy_r WHERE firewall = ?', [firewallId])
      .then((rows) => Number(rows[0].n));
  }

  function getAuditEntries(): Promise<AuditLog[]> {
    return db
      .getSource()
      .manager.getRepository(AuditLog)
      .find({ where: { call: PROFILE_APPLICATION_AUDIT_CALL } });
  }

  it('should be provided as an application service', async () => {
    expect(service).to.be.instanceOf(ProfileApplicationService);
  });

  describe('happy path: simple firewall target', () => {
    it('should apply the profile and create usable rules resolved to the target', async () => {
      const target = await makeTargetFirewall();

      const result = await service.apply(
        actor(authorizedUser),
        makeApplyRequest(target, 'replace_defaults'),
      );

      expect(result.applied).to.be.true;
      expect(result.errors).to.be.empty;
      expect(result.createdRules).to.have.length(3);
      expect(result.createdRules.every((rule) => rule.targetRuleId !== null)).to.be.true;
      expect(await countTargetRules(target.firewall.id)).to.be.eq(3);

      // Created rules are active and the interface references resolve to the target.
      const activeRules = await db
        .getSource()
        .query('SELECT COUNT(*) AS n FROM policy_r WHERE firewall = ? AND active = 1', [
          target.firewall.id,
        ]);
      expect(Number(activeRules[0].n)).to.be.eq(3);

      const interfaceRefs = await db.getSource().query(
        `SELECT R.interface FROM policy_r__interface R
            INNER JOIN policy_r P ON P.id = R.rule WHERE P.firewall = ?`,
        [target.firewall.id],
      );
      expect(interfaceRefs).to.have.length(1);
      expect(interfaceRefs[0].interface).to.be.eq(target.wanInterface.id);

      expect(
        result.resolvedReferences.some(
          (reference) =>
            reference.kind === 'interface' &&
            reference.role === 'wan' &&
            reference.sourceId === sourceWanInterface.id &&
            reference.targetId === target.wanInterface.id,
        ),
      ).to.be.true;
    });

    it('should create an audit log entry recording who applied which profile to which target', async () => {
      const target = await makeTargetFirewall();

      await service.apply(actor(authorizedUser), makeApplyRequest(target, 'replace_defaults'));

      const entries = await getAuditEntries();
      expect(entries).to.have.length(1);

      const entry = entries[0];
      expect(entry.userId).to.be.eq(authorizedUser.id);
      expect(entry.userName).to.be.eq(authorizedUser.username);
      expect(entry.sessionId).to.be.eq(ACTOR_SESSION_ID);
      expect(entry.fwCloudId).to.be.eq(fwc.fwcloud.id);
      expect(entry.firewallId).to.be.eq(target.firewall.id);
      expect(entry.status).to.be.eq(200);

      const data = JSON.parse(entry.data) as Record<string, any>;
      expect(data).to.deep.include({
        profileId: profile.id,
        profileCode: profile.code,
        profileVersion: profile.version,
        profileName: profile.name,
        targetKind: 'firewall',
        targetId: target.firewall.id,
        targetName: target.firewall.name,
        fwCloudId: fwc.fwcloud.id,
        mode: 'replace_defaults',
        status: 'success',
        applied: true,
        error: null,
      });
      expect(data.summary).to.deep.include({
        createdRules: 3,
        createdGroups: 0,
      });
      expect(data.summary.resolvedReferences).to.be.greaterThan(0);
    });

    it('should audit dry runs without writing any change', async () => {
      const target = await makeTargetFirewall();
      const rulesBefore = await countTargetRules(target.firewall.id);

      const result = await service.apply(
        actor(authorizedUser),
        makeApplyRequest(target, 'dry_run'),
      );

      expect(result.applied).to.be.false;
      expect(await countTargetRules(target.firewall.id)).to.be.eq(rulesBefore);

      const entries = await getAuditEntries();
      expect(entries).to.have.length(1);
      const data = JSON.parse(entries[0].data) as Record<string, any>;
      expect(data.mode).to.be.eq('dry_run');
      expect(data.status).to.be.eq('success');
      expect(data.applied).to.be.false;
    });
  });

  describe('declarative topology conversion', () => {
    it('applies a historical firewall-only template to a cluster', async () => {
      profile = await makeProfile({
        targetKind: 'firewall',
        model: {
          compatibility: { target_kinds: ['firewall'] },
          provision: {
            interfaces: [{ name: 'WAN', role: 'wan' }],
            rules: [{ chain: 'input', inRole: 'wan', comment: 'Converted firewall policy' }],
          },
        },
      });
      const target = await makeTargetFirewall();
      const cluster = await db
        .getSource()
        .manager.getRepository(Cluster)
        .save({ name: 'Converted target', fwCloudId: fwc.fwcloud.id });
      await db
        .getSource()
        .manager.getRepository(Firewall)
        .update(target.firewall.id, { clusterId: cluster.id, fwmaster: 1 });
      const request = makeApplyRequest(
        target,
        'dry_run',
        { interfaceNameMapping: { wan: target.wanInterface.name } },
        {
          target: { kind: 'cluster', id: cluster.id },
          sourceProfile: undefined,
          interfaceRoleMapping: undefined,
        },
      );
      const preview = await service.apply(actor(authorizedUser), request);
      expect(preview.errors).to.be.empty;
      const applied = await service.apply(actor(authorizedUser), {
        ...request,
        replication: { ...request.replication, mode: 'replace_defaults' },
      });
      expect(applied.errors).to.be.empty;
      expect(applied.applied).to.equal(true);
      expect(applied.createdRules).to.have.length(1);
      const [rule] = await db
        .getSource()
        .query('SELECT fw_apply_to FROM policy_r WHERE id = ?', [
          applied.createdRules[0].targetRuleId,
        ]);
      expect(rule.fw_apply_to).to.equal(null);
    });

    it('converts a cluster template to a firewall without losing Keepalived or changing the source file', async () => {
      profile = await makeProfile({
        targetKind: 'cluster',
        model: {
          compatibility: { target_kinds: ['cluster'] },
          topologyPreset: {
            kind: 'cluster',
            nodes: [
              { role: 'master', name: 'Master', master: true, required: true },
              { role: 'backup', name: 'Backup', required: true },
            ],
          },
          provision: {
            interfaces: [{ name: 'WAN', role: 'wan' }],
            rules: [{ chain: 'input', inRole: 'wan', nodeRole: 'backup', comment: 'Only backup' }],
            system: {
              keepalived: [
                {
                  interfaceRole: 'wan',
                  virtualIps: [{ kind: 'address', value: '203.0.113.254' }],
                  masterNode: 'backup',
                  nodeRole: 'backup',
                  active: true,
                  style: 'HA-style',
                  comment: 'Structured VRRP',
                },
                {
                  rule_type: 2,
                  cfg_text: '# Native VRRP\r\n',
                  nodeRole: 'master',
                  active: false,
                  comment: 'Manual VRRP',
                },
              ],
            },
          },
        },
      });
      const file = resolveReplicationProfileTemplatePath(profile);
      const original = fs.readFileSync(file, 'utf8');
      const target = await makeTargetFirewall();
      await db
        .getSource()
        .manager.getRepository(Interface)
        .update(target.wanInterface.id, { mac: '02:00:00:00:00:01' });
      const request = makeApplyRequest(
        target,
        'dry_run',
        { interfaceNameMapping: { wan: target.wanInterface.name } },
        { sourceProfile: undefined, interfaceRoleMapping: undefined },
      );
      const preview = await service.apply(actor(authorizedUser), request);
      expect(preview.errors).to.be.empty;
      expect(preview.provisioned.keepalived).to.equal(2);
      expect(preview.warnings.join(' '))
        .to.include('removed cluster-node restrictions')
        .and.include('retained')
        .and.include('only for clusters');
      const applied = await service.apply(actor(authorizedUser), {
        ...request,
        replication: { ...request.replication, mode: 'replace_defaults' },
      });
      expect(applied.errors).to.be.empty;
      expect(applied.applied).to.equal(true);
      expect(applied.provisioned.keepalived).to.equal(2);
      const [rule] = await db
        .getSource()
        .query('SELECT fw_apply_to FROM policy_r WHERE id = ?', [
          applied.createdRules[0].targetRuleId,
        ]);
      expect(rule.fw_apply_to).to.equal(null);
      const keepalived = await db
        .getSource()
        .query(
          'SELECT rule_type, master_node, fw_apply_to, active, style, cfg_text FROM keepalived_r WHERE firewall = ? ORDER BY rule_order',
          [target.firewall.id],
        );
      expect(keepalived).to.have.length(2);
      expect(keepalived[0]).to.include({
        master_node: target.firewall.id,
        fw_apply_to: null,
        active: 1,
        style: 'HA-style',
      });
      expect(keepalived[1]).to.include({
        rule_type: 2,
        cfg_text: '# Native VRRP\r\n',
        fw_apply_to: null,
        active: 0,
      });
      expect(fs.readFileSync(file, 'utf8')).to.equal(original);
    });

    it('validates source node restrictions before converting instead of widening malformed rules', async () => {
      profile = await makeProfile({
        targetKind: 'cluster',
        model: {
          compatibility: { target_kinds: ['cluster'] },
          topologyPreset: {
            kind: 'cluster',
            nodes: [{ role: 'master', name: 'Master', master: true, required: true }],
          },
          provision: {
            rules: [{ chain: 'input', nodeRole: 'master' }],
            system: {
              keepalived: [{ rule_type: 2, cfg_text: '# Native VRRP', nodeRole: 'master' }],
            },
          },
        },
      });
      const file = resolveReplicationProfileTemplatePath(profile);
      const original = fs.readFileSync(file, 'utf8');
      const target = await makeTargetFirewall();
      const request = makeApplyRequest(
        target,
        'dry_run',
        {},
        { sourceProfile: undefined, interfaceRoleMapping: undefined },
      );
      try {
        for (const side of ['rules', 'keepalived']) {
          const invalid = JSON.parse(original);
          const entries =
            side === 'rules' ? invalid.provision.rules : invalid.provision.system.keepalived;
          entries[0].nodeRole = 'unknown-node';
          fs.writeFileSync(file, JSON.stringify(invalid));
          await expect(service.apply(actor(authorizedUser), request)).to.be.rejected;
        }
      } finally {
        fs.writeFileSync(file, original);
      }
      expect(
        await db
          .getSource()
          .query('SELECT id FROM keepalived_r WHERE firewall = ?', [target.firewall.id]),
      ).to.be.empty;
    });

    it('still reports required Keepalived interface data when converting a cluster template', async () => {
      profile = await makeProfile({
        targetKind: 'cluster',
        model: {
          compatibility: { target_kinds: ['cluster'] },
          topologyPreset: {
            kind: 'cluster',
            nodes: [{ role: 'master', name: 'Master', master: true, required: true }],
          },
          provision: {
            interfaces: [{ name: 'WAN', role: 'wan' }],
            system: {
              keepalived: [
                {
                  interfaceRole: 'wan',
                  masterNode: 'master',
                  virtualIps: [{ kind: 'address', value: '203.0.113.254' }],
                },
              ],
            },
          },
        },
      });
      const target = await makeTargetFirewall();
      for (const mode of ['dry_run', 'replace_defaults'] as const) {
        const result = await service.apply(
          actor(authorizedUser),
          makeApplyRequest(
            target,
            mode,
            { interfaceNameMapping: { wan: target.wanInterface.name } },
            { sourceProfile: undefined, interfaceRoleMapping: undefined },
          ),
        );
        expect(result.applied).to.equal(false);
        expect(result.errors.join(' ')).to.include('Keepalived 1').and.include('MAC');
        expect(result.provisioned.keepalived).to.equal(0);
      }
      expect(
        await db
          .getSource()
          .query('SELECT id FROM keepalived_r WHERE firewall = ?', [target.firewall.id]),
      ).to.be.empty;
    });
  });

  describe('declarative cluster profile', () => {
    it('previews a sync cluster profile without a source firewall or database writes', async () => {
      profile = await makeProfile({
        targetKind: 'cluster',
        model: {
          compatibility: { target_kinds: ['cluster'] },
          provision: {
            interfaces: [
              { name: 'LAN', role: 'lan' },
              { name: 'WAN', role: 'wan' },
              { name: 'SYNC', role: 'sync' },
            ],
            rules: [
              { chain: 'forward', action: 'accept', inRole: 'lan', outRole: 'wan' },
              { chain: 'forward', action: 'accept', inRole: 'sync', outRole: 'sync' },
            ],
          },
        },
      });

      const manager = db.getSource().manager;
      const targetCluster = await manager
        .getRepository(Cluster)
        .save({ name: StringHelper.randomize(10), fwCloudId: fwc.fwcloud.id });
      const target = await makeTargetFirewall();
      await manager
        .getRepository(Firewall)
        .update(target.firewall.id, { clusterId: targetCluster.id, fwmaster: 1 });

      const rulesBefore = await countTargetRules(target.firewall.id);
      const interfacesBefore = await manager
        .getRepository(Interface)
        .count({ where: { firewallId: target.firewall.id } });
      const applyRequest = makeApplyRequest(
        target,
        'dry_run',
        {},
        {
          sourceProfile: undefined,
          interfaceRoleMapping: undefined,
          target: { kind: 'cluster', id: targetCluster.id },
        },
      );

      const result = await service.apply(actor(authorizedUser), applyRequest);

      expect(result.mode).to.equal('dry_run');
      expect(result.applied).to.be.false;
      expect(result.errors).to.be.empty;
      expect(result.createdRules).to.have.length(2);
      expect(result.createdRules.every((rule) => rule.targetRuleId === null)).to.be.true;
      expect(await countTargetRules(target.firewall.id)).to.equal(rulesBefore);
      expect(
        await manager.getRepository(Interface).count({ where: { firewallId: target.firewall.id } }),
      ).to.equal(interfacesBefore);
    });
  });

  describe('happy path: cluster target', () => {
    it('should apply the profile to the cluster master and audit the cluster target', async () => {
      const manager = db.getSource().manager;

      const targetCluster = await manager
        .getRepository(Cluster)
        .save({ name: StringHelper.randomize(10), fwCloudId: fwc.fwcloud.id });
      const target = await makeTargetFirewall();
      await manager
        .getRepository(Firewall)
        .update(target.firewall.id, { clusterId: targetCluster.id, fwmaster: 1 });

      const result = await service.apply(
        actor(authorizedUser),
        makeApplyRequest(
          target,
          'replace_defaults',
          {},
          {
            target: { kind: 'cluster', id: targetCluster.id },
          },
        ),
      );

      expect(result.applied).to.be.true;
      expect(result.errors).to.be.empty;
      expect(await countTargetRules(target.firewall.id)).to.be.eq(3);

      const entries = await getAuditEntries();
      expect(entries).to.have.length(1);
      expect(entries[0].clusterId).to.be.eq(targetCluster.id);
      expect(entries[0].status).to.be.eq(200);

      const data = JSON.parse(entries[0].data) as Record<string, any>;
      expect(data).to.deep.include({
        targetKind: 'cluster',
        targetId: targetCluster.id,
        targetName: targetCluster.name,
        status: 'success',
        applied: true,
      });
    });
  });

  describe('failure path', () => {
    it('should roll back all partial changes and audit the failure when a write fails half way', async () => {
      const target = await makeTargetFirewall();
      const rulesBefore = await countTargetRules(target.firewall.id);

      const dataSource = db.getSource();
      const originalCreateQueryRunner = dataSource.createQueryRunner.bind(dataSource);
      const stub = sinon.stub(dataSource, 'createQueryRunner').callsFake(() => {
        const queryRunner = originalCreateQueryRunner();
        const originalQuery = queryRunner.query.bind(queryRunner);
        let ruleInserts = 0;
        sinon
          .stub(queryRunner, 'query')
          .callsFake(async (sql: string, params?: any[], useStructuredResult?: boolean) => {
            if (/^\s*INSERT INTO policy_r\s/.test(sql) && ++ruleInserts === 2) {
              throw new Error('Forced write failure');
            }
            return originalQuery(sql, params, useStructuredResult);
          });
        return queryRunner;
      });

      try {
        await expect(
          service.apply(actor(authorizedUser), makeApplyRequest(target, 'replace_defaults')),
        ).to.be.rejectedWith('Forced write failure');
      } finally {
        stub.restore();
      }

      // Nothing was committed: the default rules are still in place.
      expect(await countTargetRules(target.firewall.id)).to.be.eq(rulesBefore);

      const entries = await getAuditEntries();
      expect(entries).to.have.length(1);
      expect(entries[0].status).to.be.eq(500);

      const data = JSON.parse(entries[0].data) as Record<string, any>;
      expect(data.status).to.be.eq('failed');
      expect(data.applied).to.be.false;
      expect(data.error).to.contain('Forced write failure');
    });

    it('should fail with a readable error and audit it when an interface role mapping is missing', async () => {
      const target = await makeTargetFirewall();
      const rulesBefore = await countTargetRules(target.firewall.id);

      const result = await service.apply(
        actor(authorizedUser),
        makeApplyRequest(
          target,
          'replace_defaults',
          {},
          {
            interfaceRoleMapping: { lan: target.lanInterface.id },
          },
        ),
      );

      expect(result.applied).to.be.false;
      expect(
        result.errors.some((error) => /Missing interface role mapping for role "wan"/.test(error)),
      ).to.be.true;
      expect(await countTargetRules(target.firewall.id)).to.be.eq(rulesBefore);

      const entries = await getAuditEntries();
      expect(entries).to.have.length(1);
      expect(entries[0].status).to.be.eq(422);

      const data = JSON.parse(entries[0].data) as Record<string, any>;
      expect(data.status).to.be.eq('failed');
      expect(data.error).to.contain('Missing interface role mapping for role "wan"');
    });

    it('should fail with a readable error when a node role mapping is missing', async () => {
      const manager = db.getSource().manager;

      // Source cluster with one extra node referenced through fw_apply_to.
      const sourceCluster = await manager
        .getRepository(Cluster)
        .save({ name: StringHelper.randomize(10), fwCloudId: fwc.fwcloud.id });
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
        .save({ name: StringHelper.randomize(10), fwCloudId: fwc.fwcloud.id });
      const target = await makeTargetFirewall();
      await manager
        .getRepository(Firewall)
        .update(target.firewall.id, { clusterId: targetCluster.id, fwmaster: 1 });

      const request = makeApplyRequest(
        target,
        'replace_defaults',
        {},
        {
          target: { kind: 'cluster', id: targetCluster.id },
        },
      );
      request.replication.sourceProfile.nodeRoles = { primary: sourceNode.id };

      const result = await service.apply(actor(authorizedUser), request);

      expect(result.applied).to.be.false;
      expect(
        result.errors.some((error) => /Missing node role mapping for role "primary"/.test(error)),
      ).to.be.true;
      expect(await countTargetRules(target.firewall.id)).to.be.eq(12);
    });
  });

  describe('permissions', () => {
    it('should reject a user without access to the FWCloud before writing changes', async () => {
      const target = await makeTargetFirewall();
      const rulesBefore = await countTargetRules(target.firewall.id);
      const unauthorizedUser = await createUser({ role: 0 });

      await expect(
        service.apply(actor(unauthorizedUser), makeApplyRequest(target, 'replace_defaults')),
      ).to.be.rejectedWith(AuthorizationException);

      expect(await countTargetRules(target.firewall.id)).to.be.eq(rulesBefore);

      const entries = await getAuditEntries();
      expect(entries).to.have.length(1);
      expect(entries[0].status).to.be.eq(401);
      expect(entries[0].userId).to.be.eq(unauthorizedUser.id);

      const data = JSON.parse(entries[0].data) as Record<string, any>;
      expect(data.status).to.be.eq('failed');
    });

    it('should reject the owner of a profile in a FWCloud they cannot access', async () => {
      const target = await makeTargetFirewall();
      const rulesBefore = await countTargetRules(target.firewall.id);
      const unauthorizedOwner = await createUser({ role: 0 });
      const ownedProfile = await makeProfile({ userId: unauthorizedOwner.id });

      await expect(
        service.apply(
          actor(unauthorizedOwner),
          makeApplyRequest(target, 'replace_defaults', { profileCode: ownedProfile.code }),
        ),
      ).to.be.rejectedWith(AuthorizationException);

      expect(await countTargetRules(target.firewall.id)).to.be.eq(rulesBefore);
    });

    it('should allow an administrator without explicit FWCloud assignment', async () => {
      const target = await makeTargetFirewall();
      const adminUser = await createUser({ role: 1 });
      const adminProfile = await makeProfile({ userId: adminUser.id });

      const result = await service.apply(
        actor(adminUser),
        makeApplyRequest(target, 'dry_run', { profileCode: adminProfile.code }),
      );

      expect(result.errors).to.be.empty;
    });
  });

  describe('scope validation', () => {
    it('should reject an unknown profile', async () => {
      const target = await makeTargetFirewall();

      await expect(
        service.apply(
          actor(authorizedUser),
          makeApplyRequest(target, 'replace_defaults', { profileCode: 'does-not-exist' }),
        ),
      ).to.be.rejectedWith(NotFoundException);

      const entries = await getAuditEntries();
      expect(entries).to.have.length(1);
      expect(entries[0].status).to.be.eq(404);
    });

    it('should apply a custom profile of the user that was created from another FWCloud', async () => {
      const target = await makeTargetFirewall();
      const otherFwCloud = await db
        .getSource()
        .manager.getRepository(FwCloud)
        .save({ name: StringHelper.randomize(10) });
      const reusedProfile = await makeProfile({ fwCloudId: otherFwCloud.id });

      const result = await service.apply(
        actor(authorizedUser),
        makeApplyRequest(target, 'replace_defaults', { profileCode: reusedProfile.code }),
      );

      expect(result.applied).to.be.true;
      expect(result.errors).to.be.empty;
      expect(await countTargetRules(target.firewall.id)).to.be.eq(3);
    });

    it('should reject custom profiles owned by another user with access to the same FWCloud', async () => {
      const target = await makeTargetFirewall();
      const rulesBefore = await countTargetRules(target.firewall.id);
      const otherUser = await createUser({ role: 0 });
      otherUser.fwClouds = [fwc.fwcloud];
      await db.getSource().manager.getRepository(User).save(otherUser);
      const foreignProfile = await makeProfile({
        fwCloudId: fwc.fwcloud.id,
        userId: otherUser.id,
      });

      await expect(
        service.apply(
          actor(authorizedUser),
          makeApplyRequest(target, 'replace_defaults', { profileCode: foreignProfile.code }),
        ),
      ).to.be.rejectedWith(NotFoundException);

      expect(await countTargetRules(target.firewall.id)).to.be.eq(rulesBefore);
    });

    it('should reject the custom profiles of another user for an administrator too', async () => {
      const target = await makeTargetFirewall();
      const adminUser = await createUser({ role: 1 });

      await expect(
        service.apply(actor(adminUser), makeApplyRequest(target, 'dry_run')),
      ).to.be.rejectedWith(NotFoundException);
    });

    it('should reject disabled profiles', async () => {
      const target = await makeTargetFirewall();
      const disabledProfile = await makeProfile({ isActive: false });

      await expect(
        service.apply(
          actor(authorizedUser),
          makeApplyRequest(target, 'replace_defaults', { profileCode: disabledProfile.code }),
        ),
      ).to.be.rejectedWith(ProfileApplicationScopeException, /disabled/);
    });

    it('should reject deprecated profiles', async () => {
      const target = await makeTargetFirewall();
      const deprecatedProfile = await makeProfile({ isDeprecated: true });

      await expect(
        service.apply(
          actor(authorizedUser),
          makeApplyRequest(target, 'replace_defaults', { profileCode: deprecatedProfile.code }),
        ),
      ).to.be.rejectedWith(ProfileApplicationScopeException, /deprecated/);
    });

    it('should reject cross-scope usage when an expected scope is given', async () => {
      const target = await makeTargetFirewall();
      const rulesBefore = await countTargetRules(target.firewall.id);

      await expect(
        service.apply(
          actor(authorizedUser),
          makeApplyRequest(target, 'replace_defaults', { expectedScope: 'datacenter' }),
        ),
      ).to.be.rejectedWith(ProfileApplicationScopeException, /scope/);

      // Invalid scope fails before writing changes.
      expect(await countTargetRules(target.firewall.id)).to.be.eq(rulesBefore);

      const entries = await getAuditEntries();
      expect(entries).to.have.length(1);
      expect(entries[0].status).to.be.eq(422);
      expect(JSON.parse(entries[0].data).status).to.be.eq('failed');
    });

    it('should reject profiles not compatible with the requested target kind', async () => {
      const target = await makeTargetFirewall();
      const firewallOnlyProfile = await makeProfile({
        model: { compatibility: { targetKinds: ['firewall'] }, replicate: {}, options: {} },
      });
      const targetCluster = await db
        .getSource()
        .manager.getRepository(Cluster)
        .save({ name: StringHelper.randomize(10), fwCloudId: fwc.fwcloud.id });
      await db
        .getSource()
        .manager.getRepository(Firewall)
        .update(target.firewall.id, { clusterId: targetCluster.id, fwmaster: 1 });

      await expect(
        service.apply(
          actor(authorizedUser),
          makeApplyRequest(
            target,
            'replace_defaults',
            { profileCode: firewallOnlyProfile.code },
            {
              target: { kind: 'cluster', id: targetCluster.id },
            },
          ),
        ),
      ).to.be.rejectedWith(ProfileApplicationScopeException, /not compatible with target kind/);
    });

    it('should reject targets that do not belong to the request FWCloud', async () => {
      const target = await makeTargetFirewall();
      const otherFwCloud = await db
        .getSource()
        .manager.getRepository(FwCloud)
        .save({ name: StringHelper.randomize(10) });
      const foreignFirewall = await db
        .getSource()
        .manager.getRepository(Firewall)
        .save({ name: StringHelper.randomize(10), fwCloudId: otherFwCloud.id });

      authorizedUser.fwClouds = [fwc.fwcloud, otherFwCloud];
      await db.getSource().manager.getRepository(User).save(authorizedUser);

      await expect(
        service.apply(
          actor(authorizedUser),
          makeApplyRequest(
            target,
            'replace_defaults',
            {},
            {
              target: { kind: 'firewall', id: foreignFirewall.id },
            },
          ),
        ),
      ).to.be.rejectedWith(ProfileApplicationScopeException, /does not belong to FWCloud/);
    });

    it('should reject cluster member firewalls targeted as standalone firewalls', async () => {
      const manager = db.getSource().manager;
      const targetCluster = await manager
        .getRepository(Cluster)
        .save({ name: StringHelper.randomize(10), fwCloudId: fwc.fwcloud.id });
      const target = await makeTargetFirewall();
      await manager
        .getRepository(Firewall)
        .update(target.firewall.id, { clusterId: targetCluster.id, fwmaster: 1 });

      await expect(
        service.apply(actor(authorizedUser), makeApplyRequest(target, 'replace_defaults')),
      ).to.be.rejectedWith(ProfileApplicationScopeException, /apply the profile to the cluster/);
    });

    it('should reject source firewalls that do not belong to the request FWCloud', async () => {
      const target = await makeTargetFirewall();
      const otherFwCloud = await db
        .getSource()
        .manager.getRepository(FwCloud)
        .save({ name: StringHelper.randomize(10) });
      const foreignFirewall = await db
        .getSource()
        .manager.getRepository(Firewall)
        .save({ name: StringHelper.randomize(10), fwCloudId: otherFwCloud.id });

      const request = makeApplyRequest(target, 'replace_defaults');
      request.replication.sourceProfile.firewallId = foreignFirewall.id;

      await expect(service.apply(actor(authorizedUser), request)).to.be.rejectedWith(
        ProfileApplicationScopeException,
        /Source firewall .* does not belong to FWCloud/,
      );
    });
  });

  describe('secret persistence', () => {
    it('should not persist transient wizard credentials after execution', async () => {
      const target = await makeTargetFirewall();
      const secretMarker = `wizard-secret-${Date.now()}`;

      const result = await service.apply(
        actor(authorizedUser),
        makeApplyRequest(target, 'replace_defaults', {
          credentials: {
            username: 'root',
            password: secretMarker,
            sshKey: `${secretMarker}-private-key`,
          },
        }),
      );

      expect(result.applied).to.be.true;

      const auditRows = await db
        .getSource()
        .query('SELECT COUNT(*) AS n FROM audit_logs WHERE data LIKE ? OR `desc` LIKE ?', [
          `%${secretMarker}%`,
          `%${secretMarker}%`,
        ]);
      expect(Number(auditRows[0].n)).to.be.eq(0);

      const template = fs.readFileSync(resolveReplicationProfileTemplatePath(profile), 'utf8');
      expect(template).not.to.contain(secretMarker);
    });

    it('should build the audit payload only from allow-listed fields', async () => {
      const target = await makeTargetFirewall();

      await service.apply(
        actor(authorizedUser),
        makeApplyRequest(target, 'replace_defaults', {
          credentials: { password: 'runtime-only' },
        }),
      );

      const entries = await getAuditEntries();
      expect(entries).to.have.length(1);

      const data = JSON.parse(entries[0].data) as Record<string, any>;
      expect(data).not.to.have.property('credentials');
      expect(data).not.to.have.property('password');
      expect(Object.keys(data).sort()).to.deep.eq(
        [
          'applied',
          'durationMs',
          'error',
          'fwCloudId',
          'mode',
          'profileCode',
          'profileId',
          'profileName',
          'profileScope',
          'profileVersion',
          'status',
          'summary',
          'targetId',
          'targetKind',
          'targetName',
        ].sort(),
      );
    });
  });
});
