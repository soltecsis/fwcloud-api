import * as fs from 'fs';
import request = require('supertest');
import { Application } from '../../../../src/Application';
import db from '../../../../src/database/database-manager';
import { Firewall } from '../../../../src/models/firewall/Firewall';
import { Cluster } from '../../../../src/models/firewall/Cluster';
import { FwCloud } from '../../../../src/models/fwcloud/FwCloud';
import { HAProxyRuleService } from '../../../../src/models/system/haproxy/haproxy_r/haproxy_r.service';
import { HAProxyCompiler } from '../../../../src/compiler/system/haproxy/HAProxyCompiler';
import { HAProxyRuleItemForCompiler } from '../../../../src/models/system/haproxy/shared';
import { ReplicationProfile } from '../../../../src/models/replication-profile/replication-profile.model';
import { PolicyReplicationService } from '../../../../src/models/replication-profile/policy-replication.service';
import { getProfileProvisioning } from '../../../../src/models/replication-profile/policy-replication.types';
import {
  loadReplicationProfileModel,
  removeReplicationProfileModel,
  resolveReplicationProfileTemplatePath,
} from '../../../../src/models/replication-profile/replication-profile-template';
import { User } from '../../../../src/models/user/User';
import { expect, testSuite } from '../../../mocha/global-setup';
import { attachSession, createUser, generateSession } from '../../../utils/utils';
import { MANUAL_HAPROXY } from '../../../utils/manual-haproxy';

describe('Replication profiles manual HAProxy capture and application E2E', () => {
  let app: Application;
  let owner: User;
  let cookie: string;
  let clouds: FwCloud[];
  let code: string;
  const manager = () => db.getSource().manager;
  const profiles = () => manager().getRepository(ReplicationProfile);
  const base = (cloud: FwCloud) => `/fwclouds/${cloud.id}/profiles`;

  beforeEach(async () => {
    app = testSuite.app;
    owner = await createUser({ role: 1 });
    cookie = attachSession(generateSession(owner));
    code = `manual-ha-${Date.now()}-${Math.round(Math.random() * 100000)}`;
    clouds = await manager()
      .getRepository(FwCloud)
      .save([
        { name: `${code}-A`, locked: false },
        { name: `${code}-B`, locked: false },
      ]);
  });

  afterEach(async () => {
    for (const profile of await profiles().find({ where: { code } })) {
      removeReplicationProfileModel(profile);
      await profiles().delete(profile.id);
    }
  });

  async function target(kind: 'firewall' | 'cluster', cloud: FwCloud) {
    const cluster =
      kind === 'cluster'
        ? await manager()
            .getRepository(Cluster)
            .save({ name: `${code}-cluster`, fwCloudId: cloud.id })
        : undefined;
    const firewall = await manager()
      .getRepository(Firewall)
      .save({
        name: `${code}-fw`,
        fwCloudId: cloud.id,
        ...(cluster ? { clusterId: cluster.id, fwmaster: 1 } : {}),
      });
    const backup = cluster
      ? await manager()
          .getRepository(Firewall)
          .save({ name: `${code}-backup`, fwCloudId: cloud.id, clusterId: cluster.id, fwmaster: 0 })
      : undefined;
    return { firewall, backup, ref: { kind, id: cluster?.id ?? firewall.id } };
  }

  async function manual(firewall: Firewall, overrides: Record<string, unknown> = {}) {
    const service = await app.getService<HAProxyRuleService>(HAProxyRuleService.name);
    return service.store({
      firewallId: firewall.id,
      rule_type: 2,
      cfg_text: MANUAL_HAPROXY,
      active: true,
      style: 'manual-style',
      comment: 'Manual multi-block config',
      ...overrides,
    });
  }

  for (const sourceKind of ['firewall', 'cluster'] as const) {
    for (const destinationKind of ['firewall', 'cluster'] as const) {
      it(`captures, saves, reopens, edits and applies manual HAProxy from a ${sourceKind} in FWCloud A to a ${destinationKind} in FWCloud B`, async () => {
        const source = await target(sourceKind, clouds[0]);
        const destination = await target(destinationKind, clouds[1]);
        const original = await manual(source.firewall);
        await manual(source.firewall, {
          active: false,
          cfg_text: '# Disabled config\nfrontend disabled\n\tbind *:9999\n',
        });
        const capture = await request(app.express)
          .post(`${base(clouds[0])}/from-source`)
          .set('Cookie', [cookie])
          .send({ source: source.ref, name: 'Manual HAProxy', code, scope: 'generic' })
          .expect(201);
        expect(capture.body.data.warnings).to.deep.eq([]);
        const profile = await profiles().findOneByOrFail({ code, versionSlot: 'latest' });
        const saved = JSON.parse(
          fs.readFileSync(resolveReplicationProfileTemplatePath(profile), 'utf8'),
        );
        expect(saved.provision.system.haproxy[0]).to.deep.eq({
          rule_type: 2,
          cfg_text: MANUAL_HAPROXY,
          active: true,
          style: 'manual-style',
          comment: 'Manual multi-block config',
        });
        expect(saved.policyStructure.system.haproxy).to.deep.eq(saved.provision.system.haproxy);
        expect(loadReplicationProfileModel(profile)).to.deep.eq(saved);
        const detail = await request(app.express)
          .get(`${base(clouds[1])}/${code}/latest`)
          .set('Cookie', [cookie])
          .expect(200);
        const edited = detail.body.data.model;
        edited.options = { description: 'Unrelated edit' };
        await request(app.express)
          .post(`${base(clouds[1])}/${code}/versions`)
          .set('Cookie', [cookie])
          .send({
            name: 'Edited manual HAProxy',
            targetKind: sourceKind,
            scope: 'generic',
            model: edited,
          })
          .expect(201);
        const reopened = await request(app.express)
          .get(`${base(clouds[1])}/${code}/latest`)
          .set('Cookie', [cookie])
          .expect(200);
        expect(reopened.body.data.model.provision.system.haproxy).to.deep.eq(
          saved.provision.system.haproxy,
        );
        for (const mode of ['dry_run', 'merge']) {
          const response = await request(app.express)
            .post(`${base(clouds[1])}/${code}/latest/apply`)
            .set('Cookie', [cookie])
            .send({ target: destination.ref, mode })
            .expect((res) => expect(res.status, JSON.stringify(res.body)).to.eq(200));
          expect(response.body.data.errors).to.deep.eq([]);
          const rows = await manager().query(
            'SELECT * FROM haproxy_r WHERE firewall = ? ORDER BY rule_order',
            [destination.firewall.id],
          );
          if (mode === 'dry_run') {
            expect(rows).to.deep.eq([]);
            continue;
          }
          expect(response.body.data.applied).to.eq(true);
          expect(rows).to.have.length(2);
          expect(rows[0]).to.include({
            rule_type: 2,
            cfg_text: MANUAL_HAPROXY,
            active: 1,
            style: 'manual-style',
            fw_apply_to: null,
            frontend_ip: null,
            frontend_port: null,
            backend_port: null,
          });
          expect(rows[1]).to.include({
            rule_type: 2,
            active: 0,
            cfg_text: saved.provision.system.haproxy[1].cfg_text,
          });
          expect(rows[0].id).not.to.eq(original.id);
          const service = await app.getService<HAProxyRuleService>(HAProxyRuleService.name);
          const data = await service.getHAProxyRulesData<HAProxyRuleItemForCompiler>(
            'compiler',
            clouds[1].id,
            destination.firewall.id,
          );
          expect(
            new HAProxyCompiler().compile(data).find((item) => item.id === rows[0].id).cs,
          ).to.eq(MANUAL_HAPROXY);
        }
        expect(
          (await manager().query('SELECT cfg_text FROM haproxy_r WHERE id = ?', [original.id]))[0]
            .cfg_text,
        ).to.eq(MANUAL_HAPROXY);
      });
    }
  }

  it('captures structured and manual entries independently without changing legacy structured validation', async () => {
    const source = await target('firewall', clouds[0]);
    await manual(source.firewall);
    const service = await app.getService<PolicyReplicationService>(PolicyReplicationService.name);
    const structured = {
      frontendIp: { kind: 'address', value: '198.51.100.10' },
      frontendService: { protocol: 'tcp', port: 443 },
      backendIps: [{ kind: 'address', value: '192.168.60.20' }],
      backendService: { protocol: 'tcp', port: 8443 },
    };
    const result = await service.provisionPolicyFromProfile(
      source.ref,
      getProfileProvisioning({ provision: { system: { haproxy: [structured] } } }),
      clouds[0].id,
    );
    expect(result.errors).to.deep.eq([]);
    const capture = await request(app.express)
      .post(`${base(clouds[0])}/from-source`)
      .set('Cookie', [cookie])
      .send({ source: source.ref, name: 'Mixed HAProxy', code })
      .expect(201);
    expect(capture.body.data.warnings).to.deep.eq([]);
    const entries = capture.body.data.model.provision.system.haproxy;
    expect(entries.map((entry) => entry.rule_type)).to.deep.eq([2, 1]);
    expect(entries[0].cfg_text).to.eq(MANUAL_HAPROXY);
    expect(entries[1]).not.to.have.property('cfg_text');
    expect(entries[1].frontendIp).to.be.an('object');
    expect(entries[1].backendIps).to.have.length(1);
    for (const rule_type of [undefined, 1]) {
      const invalid = await service.provisionPolicyFromProfile(
        source.ref,
        getProfileProvisioning({ provision: { system: { haproxy: [{ rule_type }] } } }),
        clouds[0].id,
      );
      expect(invalid.errors[0]).to.include('frontend IP is required');
    }
  });

  it('exports and imports the complete manual model for another user before applying in FWCloud B', async () => {
    const source = await target('firewall', clouds[0]);
    const destination = await target('cluster', clouds[1]);
    await manual(source.firewall);
    await request(app.express)
      .post(`${base(clouds[0])}/from-source`)
      .set('Cookie', [cookie])
      .send({ source: source.ref, name: 'Portable HAProxy', code, scope: 'generic' })
      .expect(201);
    const exported = await request(app.express)
      .get(`${base(clouds[0])}/${code}/export`)
      .set('Cookie', [cookie])
      .expect(200);
    const importerCookie = attachSession(generateSession(await createUser({ role: 1 })));
    await request(app.express)
      .post(`${base(clouds[1])}/import`)
      .set('Cookie', [importerCookie])
      .send(JSON.parse(JSON.stringify(exported.body)))
      .expect(201);
    const detail = await request(app.express)
      .get(`${base(clouds[1])}/${code}/latest`)
      .set('Cookie', [importerCookie])
      .expect(200);
    expect(detail.body.data.model.provision.system.haproxy[0].cfg_text).to.eq(MANUAL_HAPROXY);
    const applied = await request(app.express)
      .post(`${base(clouds[1])}/${code}/latest/apply`)
      .set('Cookie', [importerCookie])
      .send({ target: destination.ref, mode: 'merge' })
      .expect(200);
    expect(applied.body.data.errors).to.deep.eq([]);
    expect(applied.body.data.applied).to.eq(true);
    const [rule] = await manager().query(
      'SELECT rule_type, cfg_text, firewall FROM haproxy_r WHERE firewall = ?',
      [destination.firewall.id],
    );
    expect(rule).to.deep.eq({
      rule_type: 2,
      cfg_text: MANUAL_HAPROXY,
      firewall: destination.firewall.id,
    });
  });

  for (const overrides of [
    { cfg_text: '' },
    { cfg_text: null },
    { rule_type: 99 },
    { cfg_text: 'frontend\0bad' },
  ]) {
    it(`rejects incomplete or unsupported capture ${JSON.stringify(overrides)}`, async () => {
      const source = await target('firewall', clouds[0]);
      const rule = await manual(source.firewall, overrides);
      const response = await request(app.express)
        .post(`${base(clouds[0])}/from-source`)
        .set('Cookie', [cookie])
        .send({ source: source.ref, name: 'Invalid', code })
        .expect(422);
      expect(JSON.stringify(response.body))
        .to.include('HAProxy rule 1')
        .and.include(`ID ${rule.id}`);
      expect(await profiles().count({ where: { code } })).to.eq(0);
    });
  }

  it('explicitly rejects node-restricted and node-local manual capture instead of losing content', async () => {
    const source = await target('cluster', clouds[0]);
    const rule = await manual(source.firewall, { fw_apply_to: source.backup.id });
    const capture = () =>
      request(app.express)
        .post(`${base(clouds[0])}/from-source`)
        .set('Cookie', [cookie])
        .send({ source: source.ref, name: 'Unsupported', code });
    const restricted = await capture().expect(422);
    expect(JSON.stringify(restricted.body)).to.include('node-restricted');
    await manager().query('DELETE FROM haproxy_r WHERE id = ?', [rule.id]);
    const local = await manual(source.backup);
    const response = await capture().expect(422);
    expect(JSON.stringify(response.body))
      .to.include(`configuration ${local.id}`)
      .and.include('node-local');
    expect(await profiles().count({ where: { code } })).to.eq(0);
  });

  it('rejects invalid manual application before creating interfaces or HAProxy entries', async () => {
    const destination = await target('firewall', clouds[1]);
    const service = await app.getService<PolicyReplicationService>(PolicyReplicationService.name);
    for (const entry of [{ rule_type: 2 }, { rule_type: 9 }, { cfg_text: MANUAL_HAPROXY }]) {
      const result = await service.provisionPolicyFromProfile(
        destination.ref,
        getProfileProvisioning({
          provision: { interfaces: [{ name: 'must-not-exist' }], system: { haproxy: [entry] } },
        }),
        clouds[1].id,
      );
      expect(result.errors[0]).to.include('HAProxy 1');
      expect(
        await manager().query('SELECT id FROM interface WHERE firewall = ?', [
          destination.firewall.id,
        ]),
      ).to.deep.eq([]);
      expect(
        await manager().query('SELECT id FROM haproxy_r WHERE firewall = ?', [
          destination.firewall.id,
        ]),
      ).to.deep.eq([]);
    }
  });
});
