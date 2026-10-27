import * as fs from 'fs';
import request = require('supertest');
import { Application } from '../../../../src/Application';
import { PolicyCompiler } from '../../../../src/compiler/policy/PolicyCompiler';
import db from '../../../../src/database/database-manager';
import { Cluster } from '../../../../src/models/firewall/Cluster';
import { Firewall } from '../../../../src/models/firewall/Firewall';
import { FwCloud } from '../../../../src/models/fwcloud/FwCloud';
import { Interface } from '../../../../src/models/interface/Interface';
import { IPObj } from '../../../../src/models/ipobj/IPObj';
import { PolicyRule, PolicyRuleOptMask } from '../../../../src/models/policy/PolicyRule';
import { PolicyTypesMap } from '../../../../src/models/policy/PolicyType';
import { getProvisionRulePositions } from '../../../../src/models/replication-profile/policy-replication.service';
import { ReplicationProfile } from '../../../../src/models/replication-profile/replication-profile.model';
import {
  loadReplicationProfileModel,
  removeReplicationProfileModel,
  resolveReplicationProfileTemplatePath,
} from '../../../../src/models/replication-profile/replication-profile-template';
import { User } from '../../../../src/models/user/User';
import { describeName, expect, testSuite } from '../../../mocha/global-setup';
import { attachSession, createUser, generateSession } from '../../../utils/utils';

interface ClusterSide {
  cluster: Cluster;
  /** Master first, as FWCloud orders a cluster's nodes. */
  nodes: Firewall[];
}

const FORWARD = PolicyTypesMap.get('IPv4:FORWARD');
const POSITIONS = getProvisionRulePositions(4, 'forward');
const HTTPS_SERVICE_ID = 20029;
const START = new Date('2026-10-01T06:15:30Z');
const END = new Date('2026-10-31T18:45:59Z');

/** One rule per node selection, each with its own combination of the other rule settings. */
const RULES = [
  {
    comment: 'HTTPS on node A only',
    node: 0,
    nodeRole: 'master',
    action: 1,
    options: PolicyRuleOptMask.LOG | PolicyRuleOptMask.STATELESS,
    negate: String(POSITIONS.source),
    out: true,
    period: false,
  },
  {
    comment: 'HTTPS on node B only',
    node: 1,
    nodeRole: 'backup',
    action: 2,
    options: 0,
    negate: null,
    out: false,
    period: true,
  },
  {
    comment: 'HTTPS on every node',
    node: null,
    nodeRole: undefined,
    action: 1,
    options: PolicyRuleOptMask.LOG,
    negate: null,
    out: true,
    period: false,
  },
] as const;

describe(describeName('Replication profile cluster node selection E2E Tests'), () => {
  let app: Application;
  let owner: User;
  let importer: User;
  let ownerCookie: string;
  let importerCookie: string;
  let sourceCloud: FwCloud;
  let otherCloud: FwCloud;
  let code: string;

  const manager = () => db.getSource().manager;
  const profiles = () => manager().getRepository(ReplicationProfile);
  const catalog = (cloud: FwCloud) => `/fwclouds/${cloud.id}/profiles`;
  const nodeNames = (label: string) => ['a', 'b', 'c'].map((node) => `${code}-${label}-${node}`);
  const nodeRolesOf = (rules: { comment: string; nodeRole?: string }[]) =>
    rules.map((rule) => ({ comment: rule.comment, nodeRole: rule.nodeRole }));
  const EXPECTED_NODE_ROLES = RULES.map((rule) => ({
    comment: rule.comment,
    nodeRole: rule.nodeRole,
  }));

  beforeEach(async () => {
    app = testSuite.app;
    owner = await createUser({ role: 1 });
    importer = await createUser({ role: 1 });
    ownerCookie = attachSession(generateSession(owner));
    importerCookie = attachSession(generateSession(importer));
    code = `node-selection-${Date.now()}-${Math.round(Math.random() * 100000)}`;
    [sourceCloud, otherCloud] = await manager()
      .getRepository(FwCloud)
      .save([
        { name: `${code}-A`, locked: false },
        { name: `${code}-B`, locked: false },
      ]);
  });

  afterEach(async () => {
    for (const profile of await profiles().find({
      where: [{ userId: owner.id }, { userId: importer.id }],
    })) {
      removeReplicationProfileModel(profile);
      await profiles().delete(profile.id);
    }
  });

  async function makeCluster(
    cloud: FwCloud,
    names: string[],
    interfaces: { name: string; labelName?: string }[],
  ): Promise<ClusterSide> {
    const cluster = await manager()
      .getRepository(Cluster)
      .save({ name: `${names[0]}-cluster`, fwCloudId: cloud.id });
    const nodes: Firewall[] = [];
    for (const [index, name] of names.entries()) {
      nodes.push(
        await manager()
          .getRepository(Firewall)
          .save({
            name,
            fwCloudId: cloud.id,
            clusterId: cluster.id,
            fwmaster: index === 0 ? 1 : 0,
          }),
      );
    }
    await manager()
      .getRepository(Interface)
      .save(
        interfaces.map((iface) => ({
          ...iface,
          type: '10',
          interface_type: '10',
          firewallId: nodes[0].id,
        })),
      );
    return { cluster, nodes };
  }

  /** A three-node cluster whose policy, kept by its master, restricts two rules to one node each. */
  async function makeSource(): Promise<ClusterSide> {
    const source = await makeCluster(sourceCloud, nodeNames('source'), [
      { name: 'eth0', labelName: 'wan' },
      { name: 'eth1', labelName: 'lan' },
    ]);
    const [wan, lan] = await manager()
      .getRepository(Interface)
      .find({ where: { firewallId: source.nodes[0].id }, order: { name: 'ASC' } });
    const network = await manager().getRepository(IPObj).save({
      name: 'office-lan',
      address: '192.168.10.0',
      netmask: '/24',
      ipObjTypeId: 7,
      ip_version: 4,
      fwCloudId: sourceCloud.id,
    });
    for (const [index, rule] of RULES.entries()) {
      const id = await PolicyRule.insertPolicy_r({
        firewall: source.nodes[0].id,
        type: FORWARD,
        rule_order: index + 1,
        action: rule.action,
        active: 1,
        special: 0,
        options: rule.options,
        negate: rule.negate,
        comment: rule.comment,
        fw_apply_to: rule.node === null ? null : source.nodes[rule.node].id,
        ...(rule.period ? { time_start: START, time_end: END } : {}),
      });
      const interfaceRefs = [
        [lan.id, POSITIONS.in],
        ...(rule.out ? [[wan.id, POSITIONS.out]] : []),
      ];
      for (const [interfaceId, position] of interfaceRefs) {
        await manager().query(
          'INSERT INTO policy_r__interface (rule, interface, position, position_order) VALUES (?, ?, ?, 1)',
          [id, interfaceId, position],
        );
      }
      for (const [ipobjId, position] of [
        [network.id, POSITIONS.source],
        [HTTPS_SERVICE_ID, POSITIONS.service],
      ]) {
        await manager().query(
          'INSERT INTO policy_r__ipobj (rule, ipobj, ipobj_g, interface, position, position_order) VALUES (?, ?, -1, -1, ?, 1)',
          [id, ipobjId, position],
        );
      }
    }
    return source;
  }

  /** Captures the source, edits the template through the API and imports its export as another user. */
  async function captureEditExportAndImport(source: ClusterSide): Promise<Record<string, any>> {
    const capture = await request(app.express)
      .post(`${catalog(sourceCloud)}/from-source`)
      .set('Cookie', [ownerCookie])
      .send({
        source: { kind: 'cluster', id: source.cluster.id },
        name: 'Cluster node selection',
        code,
        scope: 'generic',
      })
      .expect(201);
    expect(capture.body.data.warnings).to.deep.eq([]);

    const latest = (userId: number) =>
      profiles().findOneByOrFail({ code, userId, versionSlot: 'latest' });
    const stored = JSON.parse(
      fs.readFileSync(resolveReplicationProfileTemplatePath(await latest(owner.id)), 'utf8'),
    );
    expect(nodeRolesOf(stored.provision.rules)).to.deep.eq(EXPECTED_NODE_ROLES);
    expect(stored.provision.rules[2]).not.to.have.property('nodeRole');
    expect(stored.policyStructure.rules).to.deep.eq(stored.provision.rules);
    // Node roles, never database ids, identify the nodes in the template.
    expect(
      stored.topologyPreset.nodes.map(({ role, name, required }) => ({ role, name, required })),
    ).to.deep.eq([
      { role: 'master', name: source.nodes[0].name, required: true },
      { role: 'backup', name: source.nodes[1].name, required: true },
      { role: 'backup2', name: source.nodes[2].name, required: false },
    ]);

    const detail = await request(app.express)
      .get(`${catalog(otherCloud)}/${code}/latest`)
      .set('Cookie', [ownerCookie])
      .expect(200);
    const edited = detail.body.data.model;
    edited.options = { description: 'An unrelated edit keeps every node restriction' };
    await request(app.express)
      .post(`${catalog(otherCloud)}/${code}/versions`)
      .set('Cookie', [ownerCookie])
      .send({
        name: 'Cluster node selection',
        targetKind: 'cluster',
        scope: 'generic',
        category: 'Custom',
        model: edited,
      })
      .expect(201);
    const saved = loadReplicationProfileModel(await latest(owner.id));
    expect(saved.provision).to.deep.eq(stored.provision);
    expect(saved.policyStructure).to.deep.eq(stored.policyStructure);

    const exported = await request(app.express)
      .get(`${catalog(otherCloud)}/${code}/export`)
      .set('Cookie', [ownerCookie])
      .expect(200);
    expect(nodeRolesOf(exported.body.versions.latest.model.provision.rules)).to.deep.eq(
      EXPECTED_NODE_ROLES,
    );
    await request(app.express)
      .post(`${catalog(otherCloud)}/import`)
      .set('Cookie', [importerCookie])
      .send(exported.body)
      .expect(201);
    const imported = loadReplicationProfileModel(await latest(importer.id));
    expect(imported.provision).to.deep.eq(stored.provision);
    return imported;
  }

  const apply = (
    target: ClusterSide,
    nodeRoleMapping: Record<string, number>,
    interfaceNameMapping: Record<string, string>,
  ) =>
    request(app.express)
      .post(`${catalog(otherCloud)}/${code}/latest/apply`)
      .set('Cookie', [importerCookie])
      .send({
        target: { kind: 'cluster', id: target.cluster.id },
        mode: 'replace_defaults',
        interfaceNameMapping,
        nodeRoleMapping,
      });

  const mappingOf = (target: ClusterSide) => ({
    master: target.nodes[0].id,
    backup: target.nodes[1].id,
    backup2: target.nodes[2].id,
  });

  const forwardRules = (master: Firewall) =>
    manager().query(
      'SELECT id, comment, action, options, negate, time_start, time_end, fw_apply_to FROM policy_r WHERE firewall = ? AND type = ? AND special = 0 ORDER BY rule_order',
      [master.id, FORWARD],
    );

  /** Compiled FORWARD rules by comment, with the ids that differ between firewalls normalized. */
  async function compiledForward(cloud: FwCloud, master: Firewall): Promise<Map<string, string>> {
    const rules = await PolicyRule.getPolicyData(
      'compiler',
      db.getQuery(),
      cloud.id,
      master.id,
      FORWARD,
      null,
      null,
    );
    const compiled = await PolicyCompiler.compile(
      'IPTables',
      (rules as { comment: string }[]).filter((rule) =>
        RULES.some(({ comment }) => comment === rule.comment),
      ),
    );
    return new Map(
      compiled.map((rule) => [
        rule.comment,
        rule.cs.replace(/FWCRULE\d+/g, 'FWCRULE<ID>').replace(/RULE ID \d+/g, 'RULE ID <ID>'),
      ]),
    );
  }

  async function verifyPolicy(
    target: ClusterSide,
    interfaceNames: { wan: string; lan: string },
  ): Promise<void> {
    const rules = await forwardRules(target.nodes[0]);
    expect(rules.map((rule) => rule.comment)).to.deep.eq(RULES.map((rule) => rule.comment));
    for (const [index, expected] of RULES.entries()) {
      const rule = rules[index];
      expect(rule.fw_apply_to, expected.comment).to.eq(
        expected.node === null ? null : target.nodes[expected.node].id,
      );
      // The node restriction leaves every other rule setting as it was.
      expect(rule, expected.comment).to.include({
        action: expected.action,
        options: expected.options,
        negate: expected.negate,
      });
      expect(rule.time_start, expected.comment).to.deep.eq(expected.period ? START : null);
      expect(rule.time_end, expected.comment).to.deep.eq(expected.period ? END : null);
      expect(
        await manager().query(
          'SELECT RI.position, I.name FROM policy_r__interface RI INNER JOIN interface I ON I.id = RI.interface WHERE RI.rule = ? ORDER BY RI.position',
          [rule.id],
        ),
        expected.comment,
      ).to.deep.eq([
        { position: POSITIONS.in, name: interfaceNames.lan },
        ...(expected.out ? [{ position: POSITIONS.out, name: interfaceNames.wan }] : []),
      ]);
      expect(
        await manager().query(
          'SELECT R.position, O.id, O.type, O.address, O.netmask FROM policy_r__ipobj R INNER JOIN ipobj O ON O.id = R.ipobj WHERE R.rule = ? ORDER BY R.position',
          [rule.id],
        ),
        expected.comment,
      ).to.deep.include.members([
        {
          position: POSITIONS.service,
          id: HTTPS_SERVICE_ID,
          type: 2,
          address: null,
          netmask: null,
        },
      ]);
      const [network] = await manager().query(
        'SELECT O.type, O.address, O.netmask, O.fwcloud FROM policy_r__ipobj R INNER JOIN ipobj O ON O.id = R.ipobj WHERE R.rule = ? AND R.position = ?',
        [rule.id, POSITIONS.source],
      );
      expect(network, expected.comment).to.deep.eq({
        type: 7,
        address: '192.168.10.0',
        netmask: '/24',
        fwcloud: otherCloud.id,
      });
    }
  }

  it('applies node-restricted rules to the corresponding nodes of another cluster with other node ids', async () => {
    const source = await makeSource();
    await captureEditExportAndImport(source);
    const target = await makeCluster(otherCloud, nodeNames('target'), [
      { name: 'ens18' },
      { name: 'ens19' },
    ]);
    expect(target.nodes.map((node) => node.id)).not.to.include.members(
      source.nodes.map((node) => node.id),
    );

    const applied = await apply(target, mappingOf(target), { wan: 'ens18', lan: 'ens19' })
      .expect((response) => expect(response.status, JSON.stringify(response.body)).to.eq(200))
      .expect(200);

    expect(applied.body.data.errors).to.deep.eq([]);
    expect(applied.body.data.applied).to.eq(true);
    await verifyPolicy(target, { wan: 'ens18', lan: 'ens19' });
    const scripts = await compiledForward(otherCloud, target.nodes[0]);
    expect(scripts.get(RULES[0].comment)).to.match(
      new RegExp(`^if \\[ "\\$HOSTNAME" = "${target.nodes[0].name}" \\]; then\n`),
    );
    expect(scripts.get(RULES[1].comment)).to.match(
      new RegExp(`^if \\[ "\\$HOSTNAME" = "${target.nodes[1].name}" \\]; then\n`),
    );
    expect(scripts.get(RULES[2].comment)).not.to.include('$HOSTNAME');

    // Capturing the new cluster gives back the same node selection.
    const recaptured = await request(app.express)
      .post(`${catalog(otherCloud)}/from-source`)
      .set('Cookie', [importerCookie])
      .send({
        source: { kind: 'cluster', id: target.cluster.id },
        name: 'Recaptured cluster node selection',
        code: `${code}-recaptured`,
        scope: 'generic',
      })
      .expect(201);
    expect(recaptured.body.data.warnings).to.deep.eq([]);
    expect(nodeRolesOf(recaptured.body.data.model.provision.rules)).to.deep.eq(EXPECTED_NODE_ROLES);
  });

  it('reproduces the original node-specific firewall script on a new cluster with the same nodes', async () => {
    const source = await makeSource();
    await captureEditExportAndImport(source);
    const target = await makeCluster(otherCloud, nodeNames('source'), [
      { name: 'eth0' },
      { name: 'eth1' },
    ]);

    const applied = await apply(target, mappingOf(target), { wan: 'eth0', lan: 'eth1' }).expect(
      200,
    );

    expect(applied.body.data.errors).to.deep.eq([]);
    await verifyPolicy(target, { wan: 'eth0', lan: 'eth1' });
    const original = await compiledForward(sourceCloud, source.nodes[0]);
    expect(original.get(RULES[0].comment)).to.include(`"$HOSTNAME" = "${source.nodes[0].name}"`);
    expect(await compiledForward(otherCloud, target.nodes[0])).to.deep.eq(original);
  });

  for (const scenario of [
    {
      title: 'a node role without a destination node',
      mapping: (target: ClusterSide) => ({ master: target.nodes[0].id }),
      error:
        'Rule 2 node: cluster node role "backup" is not assigned to a node of the target cluster.',
    },
    {
      title: 'two node roles assigned to the same destination node',
      mapping: (target: ClusterSide) => ({ ...mappingOf(target), backup: target.nodes[0].id }),
      error:
        'Rule 1 node: cluster node roles "master" and "backup" are assigned to the same node; each role needs a node of its own.',
    },
  ]) {
    it(`rejects ${scenario.title} without writing a broader rule`, async () => {
      const source = await makeSource();
      await captureEditExportAndImport(source);
      const target = await makeCluster(otherCloud, nodeNames('target'), [
        { name: 'ens18' },
        { name: 'ens19' },
      ]);

      const applied = await apply(target, scenario.mapping(target), {
        wan: 'ens18',
        lan: 'ens19',
      }).expect(422);

      expect(applied.body.data.applied).to.eq(false);
      expect(applied.body.data.createdRules).to.deep.eq([]);
      expect(applied.body.data.errors).to.include(scenario.error);
      expect(await forwardRules(target.nodes[0])).to.deep.eq([]);
    });
  }
});
