import * as fs from 'fs';
import request = require('supertest');
import { Application } from '../../../../src/Application';
import { PolicyCompiler } from '../../../../src/compiler/policy/PolicyCompiler';
import db from '../../../../src/database/database-manager';
import { Firewall, FireWallOptMask } from '../../../../src/models/firewall/Firewall';
import { FwCloud } from '../../../../src/models/fwcloud/FwCloud';
import { Interface } from '../../../../src/models/interface/Interface';
import { PolicyRule, PolicyRuleOptMask } from '../../../../src/models/policy/PolicyRule';
import { PolicyTypesMap } from '../../../../src/models/policy/PolicyType';
import { getProvisionRulePositions } from '../../../../src/models/replication-profile/policy-replication.service';
import type { PolicyReplicationCatchAllRuleChange } from '../../../../src/models/replication-profile/policy-replication.types';
import { ReplicationProfile } from '../../../../src/models/replication-profile/replication-profile.model';
import {
  loadReplicationProfileModel,
  removeReplicationProfileModel,
  resolveReplicationProfileTemplatePath,
} from '../../../../src/models/replication-profile/replication-profile-template';
import { User } from '../../../../src/models/user/User';
import { describeName, expect, testSuite } from '../../../mocha/global-setup';
import {
  makeReplicationSide,
  type ReplicationSide,
} from '../../../utils/replication-profile-fixtures';
import { attachSession, createUser, generateSession } from '../../../utils/utils';

interface CatchAllRow {
  id: number;
  type: number;
  action: number;
  active: number;
  options: number;
}

const OUTPUT4 = PolicyTypesMap.get('IPv4:OUTPUT');
const FORWARD4 = PolicyTypesMap.get('IPv4:FORWARD');
const INPUT6 = PolicyTypesMap.get('IPv6:INPUT');
const FILTER_POLICIES = ['IPv4', 'IPv6'].flatMap((family) =>
  ['INPUT', 'OUTPUT', 'FORWARD'].map((chain) => PolicyTypesMap.get(`${family}:${chain}`)),
);
/**
 * FWCloud A's final actions: OUTPUT drops, FORWARD rejects and logs, and the IPv6 INPUT accepts.
 * The rest keep FWCloud's defaults, FWCloud B's own: OUTPUT accepts, INPUT and FORWARD drop.
 */
const SOURCE_ACTIONS: [number, Partial<CatchAllRow>][] = [
  [OUTPUT4, { action: 2 }],
  [FORWARD4, { action: 3, options: PolicyRuleOptMask.LOG }],
  [INPUT6, { action: 1 }],
];
const EXPECTED = [
  { chain: 'input', ipVersion: 4, action: 'deny', active: true, options: 0 },
  { chain: 'output', ipVersion: 4, action: 'deny', active: true, options: 2 },
  { chain: 'forward', ipVersion: 4, action: 'reject', active: true, options: 4 },
  { chain: 'input', ipVersion: 6, action: 'accept', active: true, options: 0 },
  { chain: 'output', ipVersion: 6, action: 'accept', active: true, options: 2 },
  { chain: 'forward', ipVersion: 6, action: 'deny', active: true, options: 0 },
].map((rule) => ({ ...rule, comment: 'Catch-all rule.' }));
const CHANGES = [
  'Catch-all rule of OUTPUT IPv4: action ACCEPT -> DENY.',
  'Catch-all rule of FORWARD IPv4: action DENY -> REJECT, options 0 -> 4.',
  'Catch-all rule of INPUT IPv6: action DENY -> ACCEPT.',
];

describe(describeName('Replication profile catch-all rules E2E Tests'), () => {
  let app: Application;
  let owner: User;
  let importer: User;
  let ownerCookie: string;
  let importerCookie: string;
  let sourceCloud: FwCloud;
  let destinationCloud: FwCloud;
  let code: string;

  const manager = () => db.getSource().manager;
  const profiles = () => manager().getRepository(ReplicationProfile);
  const catalog = (cloud: FwCloud) => `/fwclouds/${cloud.id}/profiles`;
  const latest = (userId: number) =>
    profiles().findOneByOrFail({ code, userId, versionSlot: 'latest' });
  const catchAlls = (firewall: Firewall): Promise<CatchAllRow[]> =>
    manager().query(
      'SELECT id, type, action, active, options FROM policy_r WHERE firewall = ? AND special = 2 ORDER BY type, id',
      [firewall.id],
    );
  const forwardPolicy = async (firewall: Firewall) =>
    (
      await manager().query(
        'SELECT special, comment FROM policy_r WHERE firewall = ? AND type = ? ORDER BY rule_order',
        [firewall.id, FORWARD4],
      )
    ).map((row: { special: number; comment: string }) => [Number(row.special), row.comment]);

  beforeEach(async () => {
    app = testSuite.app;
    owner = await createUser({ role: 1 });
    importer = await createUser({ role: 1 });
    ownerCookie = attachSession(generateSession(owner));
    importerCookie = attachSession(generateSession(importer));
    code = `catch-all-${Date.now()}-${Math.round(Math.random() * 100000)}`;
    [sourceCloud, destinationCloud] = await manager()
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

  /** A firewall or cluster with FWCloud's default policy, as FWCloud creates it. */
  /** A firewall or cluster with FWCloud's default policy, as FWCloud creates it. */
  async function makeSide(
    cloud: FwCloud,
    kind: 'firewall' | 'cluster',
    label: string,
  ): Promise<ReplicationSide> {
    const side = await makeReplicationSide(cloud.id, kind, `${code}-${label}`);
    await PolicyRule.insertDefaultPolicy(side.master.id, null, FireWallOptMask.STATEFUL);
    return side;
  }

  /** FWCloud A's final actions and one FORWARD rule, from the LAN to the WAN, above them. */
  async function makeSourcePolicy(source: ReplicationSide): Promise<void> {
    const [wan, lan] = await manager()
      .getRepository(Interface)
      .save(
        [
          { name: 'eth0', labelName: 'wan' },
          { name: 'eth1', labelName: 'lan' },
        ].map((iface) => ({
          ...iface,
          type: '10',
          interface_type: '10',
          firewallId: source.master.id,
        })),
      );
    const positions = getProvisionRulePositions(4, 'forward');
    const id = await PolicyRule.insertPolicy_r({
      firewall: source.master.id,
      type: FORWARD4,
      rule_order: 2,
      action: 1,
      active: 1,
      options: 0,
      special: 0,
      comment: 'LAN out',
    });
    for (const [interfaceId, position] of [
      [lan.id, positions.in],
      [wan.id, positions.out],
    ]) {
      await manager().query(
        'INSERT INTO policy_r__interface (rule, interface, position, position_order) VALUES (?, ?, ?, 1)',
        [id, interfaceId, position],
      );
    }
    await manager().query(
      'UPDATE policy_r SET rule_order = 3 WHERE firewall = ? AND type = ? AND special = 2',
      [source.master.id, FORWARD4],
    );
    for (const [type, values] of SOURCE_ACTIONS) {
      const fields = Object.keys(values);
      await manager().query(
        `UPDATE policy_r SET ${fields.map((field) => `${field} = ?`).join(', ')} WHERE firewall = ? AND type = ? AND special = 2`,
        [...fields.map((field) => values[field]), source.master.id, type],
      );
    }
  }

  /** The compiled catch-all rule of a policy, with the ids that differ between firewalls normalized. */
  async function compiledCatchAll(cloud: FwCloud, firewall: Firewall, type: number) {
    const rules = await PolicyRule.getPolicyData(
      'compiler',
      db.getQuery(),
      cloud.id,
      firewall.id,
      type,
      null,
      null,
    );
    const compiled = await PolicyCompiler.compile('IPTables', rules);
    const catchAll = compiled.filter((rule) => rule.comment === 'Catch-all rule.');
    expect(catchAll).to.have.length(1);
    return catchAll[0].cs
      .replace(/FWCRULE\d+/g, 'FWCRULE<ID>')
      .replace(/RULE ID \d+/g, 'RULE ID <ID>');
  }

  for (const sourceKind of ['firewall', 'cluster'] as const) {
    for (const targetKind of ['firewall', 'cluster'] as const) {
      it(`should reproduce the final actions of a ${sourceKind} of FWCloud A on a ${targetKind} of FWCloud B whose defaults differ`, async () => {
        const source = await makeSide(sourceCloud, sourceKind, 'source');
        await makeSourcePolicy(source);
        const sourceCatchAllsBefore = await catchAlls(source.master);

        // Capture: the final action of every filter policy is kept, for each family on its own.
        const captured = await request(app.express)
          .post(`${catalog(sourceCloud)}/from-source`)
          .set('Cookie', [ownerCookie])
          .send({
            source: { kind: sourceKind, id: source.id },
            name: 'Catch-all rules',
            code,
            scope: 'generic',
          })
          .expect(201);
        expect(captured.body.data.warnings).to.deep.eq([]);
        const stored = JSON.parse(
          fs.readFileSync(resolveReplicationProfileTemplatePath(await latest(owner.id)), 'utf8'),
        );
        expect(stored.provision.catchAllRules).to.deep.eq(EXPECTED);
        expect(stored.policyStructure.catchAllRules).to.deep.eq(EXPECTED);
        expect(stored.provision.rules.map((rule) => rule.comment)).to.deep.eq(['LAN out']);

        // The editor loads the template and saves it again; another user imports its export.
        const detail = await request(app.express)
          .get(`${catalog(destinationCloud)}/${code}/latest`)
          .set('Cookie', [ownerCookie])
          .expect(200);
        expect(detail.body.data.model.provision.catchAllRules).to.deep.eq(EXPECTED);
        await request(app.express)
          .post(`${catalog(destinationCloud)}/${code}/versions`)
          .set('Cookie', [ownerCookie])
          .send({
            name: 'Catch-all rules',
            targetKind: sourceKind,
            scope: 'generic',
            category: 'Custom',
            model: detail.body.data.model,
          })
          .expect(201);
        expect(loadReplicationProfileModel(await latest(owner.id)).provision).to.deep.eq(
          stored.provision,
        );
        const exported = await request(app.express)
          .get(`${catalog(destinationCloud)}/${code}/export`)
          .set('Cookie', [ownerCookie])
          .expect(200);
        await request(app.express)
          .post(`${catalog(destinationCloud)}/import`)
          .set('Cookie', [importerCookie])
          .send(exported.body)
          .expect(201);
        expect(loadReplicationProfileModel(await latest(importer.id)).provision).to.deep.eq(
          stored.provision,
        );

        // FWCloud B: OUTPUT accepts, as FWCloud creates it.
        const destination = await makeSide(destinationCloud, targetKind, 'destination');
        const destinationBefore = await catchAlls(destination.master);
        expect(destinationBefore.find((row) => row.type === OUTPUT4)).to.include({ action: 1 });
        const apply = (mode: 'dry_run' | 'replace_defaults') =>
          request(app.express)
            .post(`${catalog(destinationCloud)}/${code}/latest/apply`)
            .set('Cookie', [importerCookie])
            .send({
              target: { kind: targetKind, id: destination.id },
              mode,
              ...(sourceKind === 'cluster' && targetKind === 'cluster'
                ? {
                    nodeRoleMapping: {
                      master: destination.master.id,
                      backup: destination.backup!.id,
                    },
                  }
                : {}),
            })
            .expect((response) => {
              expect(response.status, JSON.stringify(response.body)).to.eq(200);
            });
        const changes = (body: { catchAllRules: PolicyReplicationCatchAllRuleChange[] }) =>
          body.catchAllRules.map(({ chain, ipVersion, changed, previous, next }) => ({
            policy: `${chain.toUpperCase()} IPv${ipVersion}`,
            changed,
            from: previous.action,
            to: next.action,
          }));

        // The preview shows every final action that changes, and writes nothing.
        const preview = await apply('dry_run');
        expect(preview.body.data.errors).to.deep.eq([]);
        expect(changes(preview.body.data).filter((change) => change.changed)).to.deep.eq([
          { policy: 'OUTPUT IPv4', changed: true, from: 'accept', to: 'deny' },
          { policy: 'FORWARD IPv4', changed: true, from: 'deny', to: 'reject' },
          { policy: 'INPUT IPv6', changed: true, from: 'deny', to: 'accept' },
        ]);
        expect(preview.body.data.warnings).to.include.members(CHANGES);
        expect(await catchAlls(destination.master)).to.deep.eq(destinationBefore);

        // The application sets FWCloud B's own catch-all rules: OUTPUT now drops.
        const applied = await apply('replace_defaults');
        expect(applied.body.data.errors).to.deep.eq([]);
        expect(applied.body.data.applied).to.eq(true);
        expect(applied.body.data.catchAllRules).to.deep.eq(preview.body.data.catchAllRules);
        expect(applied.body.data.warnings).to.include.members(CHANGES);
        const after = await catchAlls(destination.master);
        // One catch-all rule per policy, the same ones, none duplicated or removed.
        expect(after.map((row) => [row.id, row.type])).to.deep.eq(
          destinationBefore.map((row) => [row.id, row.type]),
        );
        expect(after.map((row) => row.type)).to.have.members(FILTER_POLICIES);
        expect(
          after.map(({ type, action, active, options }) => [type, action, active, options]),
        ).to.deep.eq(
          sourceCatchAllsBefore.map(({ type, action, active, options }) => [
            type,
            action,
            active,
            options,
          ]),
        );
        expect(after.find((row) => row.type === OUTPUT4)).to.include({ action: 2 });
        expect(await forwardPolicy(destination.master)).to.deep.eq([
          [1, 'Stateful firewall rule.'],
          [0, 'LAN out'],
          [2, 'Catch-all rule.'],
        ]);

        // The compiled final rules match FWCloud A's: OUTPUT drops, FORWARD logs and rejects.
        for (const type of [OUTPUT4, FORWARD4, INPUT6]) {
          expect(await compiledCatchAll(destinationCloud, destination.master, type)).to.eq(
            await compiledCatchAll(sourceCloud, source.master, type),
          );
        }
        expect(await compiledCatchAll(destinationCloud, destination.master, OUTPUT4)).to.match(
          /-j DROP\b/,
        );
        expect(await compiledCatchAll(destinationCloud, destination.master, FORWARD4)).to.contain(
          'REJECT',
        );

        // The source policy did not change.
        expect(await catchAlls(source.master)).to.deep.eq(sourceCatchAllsBefore);
      });
    }
  }
});
