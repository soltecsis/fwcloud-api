import request = require('supertest');
import * as fs from 'fs';
import { Application } from '../../../../src/Application';
import db from '../../../../src/database/database-manager';
import { Cluster } from '../../../../src/models/firewall/Cluster';
import { Firewall } from '../../../../src/models/firewall/Firewall';
import { FwCloud } from '../../../../src/models/fwcloud/FwCloud';
import { ReplicationProfile } from '../../../../src/models/replication-profile/replication-profile.model';
import {
  loadReplicationProfileModel,
  removeReplicationProfileModel,
  resolveReplicationProfileTemplatePath,
} from '../../../../src/models/replication-profile/replication-profile-template';
import { User } from '../../../../src/models/user/User';
import { describeName, expect, testSuite } from '../../../mocha/global-setup';
import { attachSession, createUser, generateSession } from '../../../utils/utils';

describe(describeName('Replication profile topology conversion E2E Tests'), () => {
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
    code = `topology-${Date.now()}-${Math.round(Math.random() * 100000)}`;
    clouds = await manager()
      .getRepository(FwCloud)
      .save([
        { name: `${code}-source`, locked: false },
        { name: `${code}-destination`, locked: false },
      ]);
  });

  afterEach(async () => {
    for (const profile of await profiles().find({ where: { code, userId: owner.id } })) {
      removeReplicationProfileModel(profile);
      await profiles().delete(profile.id);
    }
  });

  async function target(kind: 'firewall' | 'cluster') {
    const cluster =
      kind === 'cluster'
        ? await manager()
            .getRepository(Cluster)
            .save({ name: `${code}-cluster`, fwCloudId: clouds[1].id })
        : undefined;
    const firewall = await manager()
      .getRepository(Firewall)
      .save({
        name: `${code}-firewall`,
        fwCloudId: clouds[1].id,
        ...(cluster ? { clusterId: cluster.id, fwmaster: 1 } : {}),
      });
    const backup = cluster
      ? await manager()
          .getRepository(Firewall)
          .save({
            name: `${code}-backup`,
            fwCloudId: clouds[1].id,
            clusterId: cluster.id,
            fwmaster: 0,
          })
      : undefined;
    return { firewall, backup, ref: { kind, id: cluster?.id ?? firewall.id } };
  }

  async function create(kind: 'firewall' | 'cluster', provision: Record<string, unknown>) {
    const model = {
      // Older templates recorded their preferred kind as the only compatible kind.
      compatibility: { target_kinds: [kind] },
      uiDefaults: { targetKind: kind, targetName: 'Preferred target' },
      ...(kind === 'cluster'
        ? {
            topologyPreset: {
              kind: 'cluster',
              nodes: [
                { role: 'master', name: 'Primary', master: true, required: true },
                { role: 'backup', name: 'Secondary', required: true },
              ],
            },
          }
        : {}),
      provision,
    };
    await request(app.express)
      .post(base(clouds[0]))
      .set('Cookie', [cookie])
      .send({ name: 'Topology conversion', code, scope: 'generic', targetKind: kind, model })
      .expect(201);
    const profile = await profiles().findOneByOrFail({ code, userId: owner.id });
    return {
      profile,
      model: loadReplicationProfileModel(profile),
      content: fs.readFileSync(resolveReplicationProfileTemplatePath(profile), 'utf8'),
    };
  }

  const apply = (destination: Awaited<ReturnType<typeof target>>, mode: 'dry_run' | 'merge') =>
    request(app.express)
      .post(`${base(clouds[1])}/${code}/latest/apply`)
      .set('Cookie', [cookie])
      .send({ target: destination.ref, mode });

  const rules = (firewall: Firewall, comment: string) =>
    manager().query(
      'SELECT id, firewall, fw_apply_to, comment FROM policy_r WHERE firewall = ? AND comment = ?',
      [firewall.id, comment],
    );

  it('previews and applies an existing firewall-only template to a cluster in another FWCloud', async () => {
    const saved = await create('firewall', {
      interfaces: [],
      rules: [{ chain: 'forward', action: 'accept', comment: 'Firewall policy on cluster' }],
    });
    const destination = await target('cluster');
    const preview = await apply(destination, 'dry_run').expect(200);
    expect(preview.body.data.applied).to.eq(false);
    expect(preview.body.data.errors).to.deep.eq([]);
    expect(await rules(destination.firewall, 'Firewall policy on cluster')).to.deep.eq([]);

    const result = await apply(destination, 'merge').expect(200);
    expect(result.body.data.applied).to.eq(true);
    expect(result.body.data.errors).to.deep.eq([]);
    const [created] = await rules(destination.firewall, 'Firewall policy on cluster');
    expect(created).to.include({ firewall: destination.firewall.id, fw_apply_to: null });
    expect(await rules(destination.backup, 'Firewall policy on cluster')).to.deep.eq([]);
    expect(loadReplicationProfileModel(saved.profile)).to.deep.eq(saved.model);
    expect(fs.readFileSync(resolveReplicationProfileTemplatePath(saved.profile), 'utf8')).to.eq(
      saved.content,
    );
  });

  it('converts cluster rules to a firewall without losing Keepalived or changing the stored template', async () => {
    const cfg =
      '# Keep original VRRP directives\r\nvrrp_instance VI_1 {\r\n  interface eth0\r\n}\r\n';
    const saved = await create('cluster', {
      interfaces: [],
      rules: [{ chain: 'forward', action: 'accept', nodeRole: 'backup', comment: 'Backup policy' }],
      system: {
        keepalived: [
          {
            rule_type: 2,
            active: false,
            style: 'native-style',
            cfg_text: cfg,
            nodeRole: 'backup',
            comment: 'Preserved VRRP',
          },
        ],
      },
    });
    const destination = await target('firewall');
    const preview = await apply(destination, 'dry_run').expect(200);
    expect(preview.body.data.errors).to.deep.eq([]);
    expect(preview.body.data.provisioned.keepalived).to.eq(1);
    expect(preview.body.data.warnings.join(' '))
      .to.include('cluster-node restrictions')
      .and.include('retained');
    expect(await rules(destination.firewall, 'Backup policy')).to.deep.eq([]);
    expect(
      await manager().query('SELECT id FROM keepalived_r WHERE firewall = ?', [
        destination.firewall.id,
      ]),
    ).to.deep.eq([]);

    const result = await apply(destination, 'merge').expect(200);
    expect(result.body.data.applied).to.eq(true);
    expect(result.body.data.errors).to.deep.eq([]);
    expect(result.body.data.provisioned.keepalived).to.eq(1);
    expect(result.body.data.warnings).to.deep.eq(
      preview.body.data.warnings.filter((warning: string) => !warning.startsWith('Dry run:')),
    );
    const [created] = await rules(destination.firewall, 'Backup policy');
    expect(created).to.include({ firewall: destination.firewall.id, fw_apply_to: null });
    const [keepalived] = await manager().query(
      'SELECT rule_type, active, style, cfg_text, comment, fw_apply_to FROM keepalived_r WHERE firewall = ?',
      [destination.firewall.id],
    );
    expect(keepalived).to.deep.eq({
      rule_type: 2,
      active: 0,
      style: 'native-style',
      cfg_text: cfg,
      comment: 'Preserved VRRP',
      fw_apply_to: null,
    });
    expect(loadReplicationProfileModel(saved.profile)).to.deep.eq(saved.model);
    expect(fs.readFileSync(resolveReplicationProfileTemplatePath(saved.profile), 'utf8')).to.eq(
      saved.content,
    );
  });
});
