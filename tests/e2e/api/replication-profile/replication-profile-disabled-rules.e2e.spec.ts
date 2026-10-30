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
import { PolicyRuleService } from '../../../../src/policy-rule/policy-rule.service';
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

interface Side {
  /** The firewall, or the cluster, a template is captured from or applied to. */
  id: number;
  /** The firewall holding the policy: the cluster master for a cluster. */
  master: Firewall;
  backup?: Firewall;
}

const FORWARD = PolicyTypesMap.get('IPv4:FORWARD');
const POSITIONS = getProvisionRulePositions(4, 'forward');
const STD_HTTP = 20028;
const STD_HTTPS = 20029;
const OPTIONS = PolicyRuleOptMask.LOG | PolicyRuleOptMask.STATELESS;
const NEGATE = String(POSITIONS.source);
const START = new Date('2026-10-01T06:15:30Z');
const END = new Date('2026-10-31T18:45:59Z');
/** The policy of the issue: SSH, disabled between HTTP and HTTPS, from the LAN to the WAN. */
const EXPECTED = [
  ['Allow HTTP', true],
  ['Allow SSH', false],
  ['Allow HTTPS', true],
];

describe(describeName('Replication profile disabled rules E2E Tests'), () => {
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
  const states = (rules: { comment: string; active?: boolean }[]) =>
    rules.map((rule) => [rule.comment, rule.active]);
  const latest = (userId: number) =>
    profiles().findOneByOrFail({ code, userId, versionSlot: 'latest' });
  const forwardRules = (firewall: Firewall) =>
    manager().query(
      'SELECT id, comment, action, active, options, negate, time_start, time_end, fw_apply_to FROM policy_r WHERE firewall = ? AND type = ? AND special = 0 ORDER BY rule_order',
      [firewall.id, FORWARD],
    );

  beforeEach(async () => {
    app = testSuite.app;
    owner = await createUser({ role: 1 });
    importer = await createUser({ role: 1 });
    ownerCookie = attachSession(generateSession(owner));
    importerCookie = attachSession(generateSession(importer));
    code = `disabled-rules-${Date.now()}-${Math.round(Math.random() * 100000)}`;
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

  async function makeSide(
    cloud: FwCloud,
    kind: 'firewall' | 'cluster',
    label: string,
  ): Promise<Side> {
    const cluster =
      kind === 'cluster'
        ? await manager()
            .getRepository(Cluster)
            .save({ name: `${code}-${label}-cluster`, fwCloudId: cloud.id })
        : undefined;
    const master = await manager()
      .getRepository(Firewall)
      .save({
        name: `${code}-${label}-a`,
        fwCloudId: cloud.id,
        ...(cluster ? { clusterId: cluster.id, fwmaster: 1 } : {}),
      });
    const backup = cluster
      ? await manager()
          .getRepository(Firewall)
          .save({
            name: `${code}-${label}-b`,
            fwCloudId: cloud.id,
            clusterId: cluster.id,
            fwmaster: 0,
          })
      : undefined;
    return { id: cluster?.id ?? master.id, master, backup };
  }

  /** The issue's policy; only the disabled SSH rule uses the custom SSH service. */
  async function makeSourcePolicy(source: Side): Promise<IPObj> {
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
    const [lanNetwork, wanNetwork] = await manager()
      .getRepository(IPObj)
      .save(
        [
          ['LAN', '192.168.10.0'],
          ['WAN', '198.51.100.0'],
        ].map(([name, address]) => ({
          name: `${code}-${name}`,
          address,
          netmask: '/24',
          ipObjTypeId: 7,
          ip_version: 4,
          fwCloudId: sourceCloud.id,
        })),
      );
    const ssh = await manager()
      .getRepository(IPObj)
      .save({
        name: `${code}-SSH`,
        ipObjTypeId: 2,
        protocol: 6,
        source_port_start: 0,
        source_port_end: 0,
        destination_port_start: 22,
        destination_port_end: 22,
        options: '0',
        fwCloudId: sourceCloud.id,
      });
    for (const [index, service] of [STD_HTTP, ssh.id, STD_HTTPS].entries()) {
      const disabled = service === ssh.id;
      const id = await PolicyRule.insertPolicy_r({
        firewall: source.master.id,
        type: FORWARD,
        rule_order: index + 1,
        action: 1,
        active: disabled ? 0 : 1,
        special: 0,
        options: disabled ? OPTIONS : 0,
        negate: disabled ? NEGATE : null,
        comment: EXPECTED[index][0],
        fw_apply_to: disabled ? (source.backup?.id ?? null) : null,
        ...(disabled ? { time_start: START, time_end: END } : {}),
      });
      for (const [interfaceId, position] of [
        [lan.id, POSITIONS.in],
        [wan.id, POSITIONS.out],
      ]) {
        await manager().query(
          'INSERT INTO policy_r__interface (rule, interface, position, position_order) VALUES (?, ?, ?, 1)',
          [id, interfaceId, position],
        );
      }
      for (const [ipobjId, position] of [
        [lanNetwork.id, POSITIONS.source],
        [wanNetwork.id, POSITIONS.destination],
        [service, POSITIONS.service],
      ]) {
        await manager().query(
          'INSERT INTO policy_r__ipobj (rule, ipobj, ipobj_g, interface, position, position_order) VALUES (?, ?, -1, -1, ?, 1)',
          [id, ipobjId, position],
        );
      }
    }
    return ssh;
  }

  /** Compiled rules by comment, with the ids that differ between firewalls normalized. */
  async function compiledForward(cloud: FwCloud, firewall: Firewall) {
    const rules = await PolicyRule.getPolicyData(
      'compiler',
      db.getQuery(),
      cloud.id,
      firewall.id,
      FORWARD,
      null,
      null,
    );
    const compiled = await PolicyCompiler.compile('IPTables', rules);
    return new Map(
      compiled.map((rule) => [
        rule.comment,
        {
          active: !!rule.active,
          cs: rule.cs.replace(/FWCRULE\d+/g, 'FWCRULE<ID>').replace(/RULE ID \d+/g, 'RULE ID <ID>'),
        },
      ]),
    );
  }

  for (const sourceKind of ['firewall', 'cluster'] as const) {
    for (const targetKind of ['firewall', 'cluster'] as const) {
      it(`should capture enabled and disabled rules from a ${sourceKind} of FWCloud A and recreate every rule with its state on a ${targetKind} of FWCloud B`, async () => {
        const source = await makeSide(sourceCloud, sourceKind, 'source');
        const ssh = await makeSourcePolicy(source);
        const sourceRulesBefore = await forwardRules(source.master);
        const keepsNode = sourceKind === 'cluster' && targetKind === 'cluster';

        // Capture: every rule is kept, in order, with its state and the disabled rule's settings.
        const captured = await request(app.express)
          .post(`${catalog(sourceCloud)}/from-source`)
          .set('Cookie', [ownerCookie])
          .send({
            source: { kind: sourceKind, id: source.id },
            name: 'Disabled rules',
            code,
            scope: 'generic',
          })
          .expect(201);
        expect(captured.body.data.warnings).to.deep.eq([]);
        const file = resolveReplicationProfileTemplatePath(await latest(owner.id));
        const stored = JSON.parse(fs.readFileSync(file, 'utf8'));
        expect(states(stored.provision.rules)).to.deep.eq(EXPECTED);
        expect(stored.policyStructure.rules).to.deep.eq(stored.provision.rules);
        const sshReference = stored.objectReferences.find(
          (reference) => reference.sourceObjectId === ssh.id,
        );
        expect(sshReference).to.include({ objectType: 'tcp', sourceName: ssh.name });
        expect(stored.provision.rules[1]).to.deep.include({
          action: 'accept',
          active: false,
          options: OPTIONS,
          negate: NEGATE,
          inRole: 'lan',
          outRole: 'wan',
          time_start: START.toISOString(),
          time_end: END.toISOString(),
          services: [{ kind: 'external', referenceId: sshReference.referenceId }],
          ...(sourceKind === 'cluster' ? { nodeRole: 'backup' } : {}),
        });
        for (const index of [0, 2]) {
          expect(stored.provision.rules[index]).to.deep.include({ active: true, options: 0 });
          expect(stored.provision.rules[index]).not.to.have.any.keys(
            'negate',
            'time_start',
            'time_end',
            'nodeRole',
          );
        }

        // The editor loads the template and saves it again; another user imports its export.
        const detail = await request(app.express)
          .get(`${catalog(destinationCloud)}/${code}/latest`)
          .set('Cookie', [ownerCookie])
          .expect(200);
        expect(states(detail.body.data.model.provision.rules)).to.deep.eq(EXPECTED);
        expect(states(detail.body.data.model.policyStructure.rules)).to.deep.eq(EXPECTED);
        await request(app.express)
          .post(`${catalog(destinationCloud)}/${code}/versions`)
          .set('Cookie', [ownerCookie])
          .send({
            name: 'Disabled rules',
            targetKind: sourceKind,
            scope: 'generic',
            category: 'Custom',
            model: { ...detail.body.data.model, options: { description: 'Edited' } },
          })
          .expect(201);
        const saved = loadReplicationProfileModel(await latest(owner.id));
        expect(saved.provision).to.deep.eq(stored.provision);
        expect(saved.policyStructure).to.deep.eq(stored.policyStructure);
        const exported = await request(app.express)
          .get(`${catalog(destinationCloud)}/${code}/export`)
          .set('Cookie', [ownerCookie])
          .expect(200);
        expect(states(exported.body.versions.latest.model.provision.rules)).to.deep.eq(EXPECTED);
        await request(app.express)
          .post(`${catalog(destinationCloud)}/import`)
          .set('Cookie', [importerCookie])
          .send(exported.body)
          .expect(201);
        expect(loadReplicationProfileModel(await latest(importer.id)).provision).to.deep.eq(
          stored.provision,
        );

        // The preview plans every rule with its state and writes nothing.
        const importedFile = resolveReplicationProfileTemplatePath(await latest(importer.id));
        const jsonBeforeApply = fs.readFileSync(importedFile, 'utf8');
        const destination = await makeSide(destinationCloud, targetKind, 'destination');
        const apply = (mode: 'dry_run' | 'replace_defaults') =>
          request(app.express)
            .post(`${catalog(destinationCloud)}/${code}/latest/apply`)
            .set('Cookie', [importerCookie])
            .send({
              target: { kind: targetKind, id: destination.id },
              mode,
              ...(keepsNode
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
        const preview = await apply('dry_run');
        expect(preview.body.data.errors).to.deep.eq([]);
        expect(states(preview.body.data.createdRules)).to.deep.eq(EXPECTED);
        expect(await forwardRules(destination.master)).to.deep.eq([]);

        // The application recreates every rule, in order, with its state and settings.
        const applied = await apply('replace_defaults');
        expect(applied.body.data.errors).to.deep.eq([]);
        expect(applied.body.data.applied).to.eq(true);
        expect(states(applied.body.data.createdRules)).to.deep.eq(EXPECTED);
        const rules = await forwardRules(destination.master);
        expect(rules.map((rule) => [rule.comment, rule.active === 1])).to.deep.eq(EXPECTED);
        expect(rules[1]).to.include({
          action: 1,
          options: OPTIONS,
          negate: NEGATE,
          fw_apply_to: keepsNode ? destination.backup!.id : null,
        });
        expect(rules[1].time_start).to.deep.eq(START);
        expect(rules[1].time_end).to.deep.eq(END);
        for (const index of [0, 2]) {
          expect(rules[index]).to.include({
            action: 1,
            options: 0,
            negate: null,
            fw_apply_to: null,
          });
        }
        // The service only the disabled rule uses is recreated in FWCloud B and referenced.
        const sshCopy = await manager()
          .getRepository(IPObj)
          .findOneByOrFail({ name: ssh.name, fwCloudId: destinationCloud.id });
        expect(sshCopy.id).not.to.eq(ssh.id);
        expect(sshCopy).to.include({
          protocol: 6,
          destination_port_start: 22,
          destination_port_end: 22,
        });
        expect(
          await manager().query(
            'SELECT ipobj FROM policy_r__ipobj WHERE rule = ? AND position = ?',
            [rules[1].id, POSITIONS.service],
          ),
        ).to.deep.eq([{ ipobj: sshCopy.id }]);

        // The disabled rule remains out of the compiled policy and the firewall script.
        const original = await compiledForward(sourceCloud, source.master);
        const recreated = await compiledForward(destinationCloud, destination.master);
        expect([...recreated.keys()]).to.deep.eq(EXPECTED.map(([comment]) => comment));
        for (const [comment, enabled] of EXPECTED) {
          const rule = recreated.get(comment as string)!;
          expect(rule.active, comment as string).to.eq(enabled);
          expect(rule.cs === '', comment as string).to.eq(!enabled);
          expect(rule.cs, comment as string).to.eq(original.get(comment as string)!.cs);
        }
        const policyRules = await app.getService<PolicyRuleService>(PolicyRuleService.name);
        await policyRules.compile(destinationCloud.id, destination.master.id);
        const script = await policyRules.content(destinationCloud.id, destination.master.id);
        expect(script).to.include(`(ID: ${rules[0].id})"`);
        expect(script).to.include(`(ID: ${rules[1].id}) [DISABLED]"`);
        expect(script).to.include(`(ID: ${rules[2].id})"`);
        expect(script).to.match(/--dport 80\b/);
        expect(script).to.match(/--dport 443\b/);
        expect(script).not.to.match(/--dport 22\b/);

        // Neither the source policy nor the applied template changed.
        expect(await forwardRules(source.master)).to.deep.eq(sourceRulesBefore);
        expect(fs.readFileSync(importedFile, 'utf8')).to.eq(jsonBeforeApply);
      });
    }
  }
});
