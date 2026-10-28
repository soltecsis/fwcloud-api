import request = require('supertest');
import * as sinon from 'sinon';
import { Application } from '../../../../src/Application';
import db from '../../../../src/database/database-manager';
import { AuditLog } from '../../../../src/models/audit/AuditLog';
import { Cluster } from '../../../../src/models/firewall/Cluster';
import { Firewall } from '../../../../src/models/firewall/Firewall';
import { FwCloud } from '../../../../src/models/fwcloud/FwCloud';
import { Interface } from '../../../../src/models/interface/Interface';
import { IPObj } from '../../../../src/models/ipobj/IPObj';
import { PROFILE_APPLICATION_AUDIT_CALL } from '../../../../src/models/replication-profile/profile-application.service';
import { ReplicationProfile } from '../../../../src/models/replication-profile/replication-profile.model';
import { removeReplicationProfileModel } from '../../../../src/models/replication-profile/replication-profile-template';
import { KeepalivedRuleService } from '../../../../src/models/system/keepalived/keepalived_r/keepalived_r.service';
import { User } from '../../../../src/models/user/User';
import { describeName, expect, testSuite } from '../../../mocha/global-setup';
import { attachSession, createUser, generateSession } from '../../../utils/utils';

describe(describeName('Replication profile Keepalived dependencies E2E Tests'), () => {
  let app: Application;
  let owner: User;
  let cookie: string;
  let sourceCloud: FwCloud;
  let targetCloud: FwCloud;
  let code: string;
  const manager = () => db.getSource().manager;
  const catalog = (cloud: FwCloud) => `/fwclouds/${cloud.id}/profiles`;

  beforeEach(async () => {
    app = testSuite.app;
    owner = await createUser({ role: 1 });
    cookie = attachSession(generateSession(owner));
    code = `keepalived-${Date.now()}-${Math.round(Math.random() * 100000)}`;
    [sourceCloud, targetCloud] = await manager()
      .getRepository(FwCloud)
      .save([
        { name: `${code}-source`, locked: false },
        { name: `${code}-target`, locked: false },
      ]);
  });

  afterEach(async () => {
    sinon.restore();
    const repository = manager().getRepository(ReplicationProfile);
    for (const profile of await repository.find({ where: { code, userId: owner.id } })) {
      removeReplicationProfileModel(profile);
      await repository.delete(profile.id);
    }
  });

  async function cluster(cloud: FwCloud) {
    const created = await manager()
      .getRepository(Cluster)
      .save({ name: `${code}-${cloud.id}`, fwCloudId: cloud.id });
    const [master, backup] = await manager()
      .getRepository(Firewall)
      .save([
        {
          name: `${code}-${cloud.id}-master`,
          fwCloudId: cloud.id,
          clusterId: created.id,
          fwmaster: 1,
        },
        {
          name: `${code}-${cloud.id}-backup`,
          fwCloudId: cloud.id,
          clusterId: created.id,
          fwmaster: 0,
        },
      ]);
    return { master, backup, ref: { kind: 'cluster', id: created.id } };
  }

  async function capture() {
    const source = await cluster(sourceCloud);
    const [iface] = await manager()
      .getRepository(Interface)
      .save([
        {
          name: 'eth0',
          labelName: 'wan',
          type: '10',
          interface_type: '10',
          mac: '02:00:00:00:00:01',
          firewallId: source.master.id,
        },
        {
          name: 'eth1',
          labelName: 'lan',
          type: '10',
          interface_type: '10',
          firewallId: source.master.id,
        },
      ]);
    const address = await manager().getRepository(IPObj).save({
      name: 'wan-address',
      address: '192.0.2.1',
      netmask: '/24',
      ipObjTypeId: 5,
      ip_version: 4,
      interfaceId: iface.id,
      fwCloudId: sourceCloud.id,
    });
    const vip = await manager().getRepository(IPObj).save({
      name: 'cluster-vip',
      address: '192.0.2.254',
      netmask: '/32',
      ipObjTypeId: 5,
      ip_version: 4,
      fwCloudId: sourceCloud.id,
    });
    const service = await app.getService<KeepalivedRuleService>(KeepalivedRuleService.name);
    const rule = await service.store({
      firewallId: source.master.id,
      interfaceId: iface.id,
      masterNodeId: source.backup.id,
      rule_type: 1,
      active: false,
      style: 'vrrp-style',
      comment: 'WAN VRRP failover',
      virtualIpsIds: [{ id: vip.id, order: 1 }],
    });
    const response = await request(app.express)
      .post(`${catalog(sourceCloud)}/from-source`)
      .set('Cookie', [cookie])
      .send({ source: source.ref, name: 'Cluster VRRP', code, scope: 'generic' })
      .expect(201);
    expect(response.body.data.warnings).to.deep.eq([]);
    const entries = response.body.data.model.provision.system.keepalived;
    expect(entries).to.have.length(1);
    expect(entries[0]).to.include({
      interfaceRole: 'wan',
      masterNode: 'backup',
      active: false,
      style: 'vrrp-style',
      comment: 'WAN VRRP failover',
    });
    expect(entries[0]).not.to.have.property('interfaceId');
    return { source, iface, address, vip, rule };
  }

  const apply = (
    target: Awaited<ReturnType<typeof cluster>>,
    mode: 'dry_run' | 'merge',
    mapping: Record<string, string> = {},
  ) =>
    request(app.express)
      .post(`${catalog(targetCloud)}/${code}/latest/apply`)
      .set('Cookie', [cookie])
      .send({
        target: target.ref,
        mode,
        interfaceNameMapping: mapping,
        nodeRoleMapping: { master: target.master.id, backup: target.backup.id },
      });

  const readRules = (firewallId: number) =>
    manager().query('SELECT * FROM keepalived_r WHERE firewall = ? ORDER BY rule_order', [
      firewallId,
    ]);

  async function discover(target: Awaited<ReturnType<typeof cluster>>, mac?: string) {
    // The wizard discovers/assigns destination NICs before applying the profile.
    return manager()
      .getRepository(Interface)
      .save({
        name: 'ens18',
        type: '10',
        interface_type: '10',
        firewallId: target.master.id,
        ...(mac ? { mac } : {}),
      });
  }

  it('blocks preview and application for a new NIC without MAC, then applies in another FWCloud after destination discovery', async () => {
    const original = await capture();
    const target = await cluster(targetCloud);
    for (const mode of ['dry_run', 'merge'] as const) {
      const response = await apply(target, mode).expect(422);
      expect(response.body.data.applied).to.eq(false);
      expect(response.body.data.errors.join(' '))
        .to.include('Keepalived 1')
        .and.include('wan')
        .and.include('eth0')
        .and.match(/MAC/i);
      expect(await readRules(target.master.id)).to.deep.eq([]);
      expect(
        await manager()
          .getRepository(Interface)
          .find({ where: { firewallId: target.master.id } }),
      ).to.deep.eq([]);
    }

    const destination = await discover(target, '02:00:00:00:00:18');
    const preview = await apply(target, 'dry_run', { wan: destination.name }).expect(200);
    expect(preview.body.data.errors).to.deep.eq([]);
    expect(preview.body.data.provisioned.keepalived).to.eq(1);
    expect(await readRules(target.master.id)).to.deep.eq([]);
    // Preview leaves the second interface and all of the interface addressing uncreated.
    expect(
      await manager().getRepository(Interface).countBy({ firewallId: target.master.id }),
    ).to.eq(1);

    const service = await app.getService<KeepalivedRuleService>(KeepalivedRuleService.name);
    const store = service.store.bind(service);
    const creation = sinon.stub(service, 'store').callsFake(async (data) => {
      expect(data.interfaceId).to.eq(destination.id);
      expect(data.masterNodeId).to.eq(target.backup.id);
      expect(
        await manager().getRepository(Interface).countBy({ firewallId: target.master.id }),
      ).to.eq(2);
      expect(await manager().getRepository(IPObj).countBy({ interfaceId: destination.id })).to.eq(
        1,
      );
      return store(data);
    });
    const applied = await apply(target, 'merge', { wan: destination.name }).expect(200);
    expect(creation.calledOnce).to.eq(true);
    expect(applied.body.data.applied).to.eq(true);
    expect(applied.body.data.errors).to.deep.eq([]);
    expect(applied.body.data.provisioned.keepalived).to.eq(
      preview.body.data.provisioned.keepalived,
    );
    const [created] = await readRules(target.master.id);
    expect(created).to.include({
      interface: destination.id,
      master_node: target.backup.id,
      rule_type: 1,
      active: 0,
      style: 'vrrp-style',
      comment: 'WAN VRRP failover',
    });
    expect(created.id).not.to.eq(original.rule.id);
    expect(created.interface).not.to.eq(original.iface.id);
    const [vip] = await manager().query(
      'SELECT O.id, O.address, O.netmask, O.fwcloud FROM keepalived_r__ipobj R INNER JOIN ipobj O ON O.id = R.ipobj WHERE R.rule = ?',
      [created.id],
    );
    expect(vip).to.include({ address: '192.0.2.254', netmask: '/32', fwcloud: targetCloud.id });
    expect(vip.id).not.to.eq(original.vip.id);
    expect(
      (await manager().getRepository(Interface).findOneByOrFail({ id: destination.id })).mac,
    ).to.eq('02:00:00:00:00:18');
    expect(await readRules(original.source.master.id)).to.have.length(1);
  });

  it('rejects an existing mapped NIC without a MAC consistently in preview and application', async () => {
    await capture();
    const target = await cluster(targetCloud);
    const destination = await discover(target);
    let previewErrors: string[];
    for (const mode of ['dry_run', 'merge'] as const) {
      const response = await apply(target, mode, { wan: destination.name }).expect(422);
      const errors = response.body.data.errors;
      expect(errors.join(' ')).to.include('Keepalived 1').and.include('ens18').and.match(/MAC/i);
      if (mode === 'dry_run') previewErrors = errors;
      else expect(errors).to.deep.eq(previewErrors);
      expect(response.body.data.applied).to.eq(false);
      expect(await readRules(target.master.id)).to.deep.eq([]);
      expect(
        await manager().getRepository(Interface).countBy({ firewallId: target.master.id }),
      ).to.eq(1);
    }
  });

  it('reports a Keepalived service failure, audits the failed step and preserves the actual partial application', async () => {
    await capture();
    const target = await cluster(targetCloud);
    const destination = await discover(target, '02:00:00:00:00:18');
    const preview = await apply(target, 'dry_run', { wan: destination.name }).expect(200);
    expect(preview.body.data.provisioned.keepalived).to.eq(1);
    const service = await app.getService<KeepalivedRuleService>(KeepalivedRuleService.name);
    sinon.stub(service, 'store').rejects(new Error('Keepalived backend unavailable'));

    const response = await apply(target, 'merge', { wan: destination.name }).expect(422);
    expect(response.body.data.applied).to.eq(false);
    expect(response.body.data.errors.join(' '))
      .to.include('Keepalived 1')
      .and.include('ens18')
      .and.include('Keepalived backend unavailable');
    expect(response.body.data.provisioned.keepalived).to.eq(0);
    expect(await readRules(target.master.id)).to.deep.eq([]);
    expect(
      await manager().getRepository(Interface).countBy({ firewallId: target.master.id }),
    ).to.eq(2);
    expect(await manager().getRepository(IPObj).countBy({ interfaceId: destination.id })).to.eq(1);
    const entry = await manager()
      .getRepository(AuditLog)
      .findOneOrFail({
        where: { call: PROFILE_APPLICATION_AUDIT_CALL, clusterId: target.ref.id },
        order: { id: 'DESC' },
      });
    const audit = JSON.parse(entry.data);
    expect(entry.status).to.eq(422);
    expect(audit).to.include({ applied: false, status: 'failed' });
    expect(audit.summary.errors).to.deep.eq(response.body.data.errors);
    expect(audit.summary.provisioned.keepalived).to.eq(0);
  });

  it('reports mandatory interface information lost after preview instead of silently omitting Keepalived', async () => {
    await capture();
    const target = await cluster(targetCloud);
    const destination = await discover(target, '02:00:00:00:00:18');
    const preview = await apply(target, 'dry_run', { wan: destination.name }).expect(200);
    expect(preview.body.data.provisioned.keepalived).to.eq(1);
    const service = await app.getService<KeepalivedRuleService>(KeepalivedRuleService.name);
    const store = service.store.bind(service);
    sinon.stub(service, 'store').callsFake(async (data) => {
      // Another interface assignment may change after preflight. The normal service
      // must still validate the dependency when it creates the configuration.
      await manager().getRepository(Interface).update(destination.id, { mac: '' });
      return store(data);
    });

    const response = await apply(target, 'merge', { wan: destination.name }).expect(422);
    expect(response.body.data.applied).to.eq(false);
    expect(response.body.data.errors.join(' '))
      .to.include('Keepalived 1')
      .and.include('ens18')
      .and.match(/MAC/i);
    expect(response.body.data.provisioned.keepalived).to.eq(0);
    expect(await readRules(target.master.id)).to.deep.eq([]);
    expect(
      await manager().getRepository(Interface).countBy({ firewallId: target.master.id }),
    ).to.eq(2);
  });
});
