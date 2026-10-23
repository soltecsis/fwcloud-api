import * as fs from 'fs';
import request = require('supertest');
import { Application } from '../../../../src/Application';
import db from '../../../../src/database/database-manager';
import { Cluster } from '../../../../src/models/firewall/Cluster';
import { Firewall } from '../../../../src/models/firewall/Firewall';
import { FwCloud } from '../../../../src/models/fwcloud/FwCloud';
import { Interface } from '../../../../src/models/interface/Interface';
import { IPObj } from '../../../../src/models/ipobj/IPObj';
import { ReplicationProfile } from '../../../../src/models/replication-profile/replication-profile.model';
import {
  loadReplicationProfileModel,
  removeReplicationProfileModel,
  resolveReplicationProfileTemplatePath,
} from '../../../../src/models/replication-profile/replication-profile-template';
import { User } from '../../../../src/models/user/User';
import { describeName, expect, testSuite } from '../../../mocha/global-setup';
import { attachSession, createUser, generateSession } from '../../../utils/utils';

describe(describeName('Replication profile interface address preservation E2E Tests'), () => {
  let app: Application;
  let owner: User;
  let cookie: string;
  let sourceCloud: FwCloud;
  let targetCloud: FwCloud;
  let code: string;

  const manager = () => db.getSource().manager;
  const profiles = () => manager().getRepository(ReplicationProfile);
  const catalogUrl = (cloud: FwCloud) => `/fwclouds/${cloud.id}/profiles`;
  const profileUrl = (cloud: FwCloud) => `${catalogUrl(cloud)}/${code}/latest`;

  beforeEach(async () => {
    app = testSuite.app;
    owner = await createUser({ role: 1 });
    cookie = attachSession(generateSession(owner));
    code = `ip-preservation-${Date.now()}-${Math.round(Math.random() * 100000)}`;
    [sourceCloud, targetCloud] = await manager()
      .getRepository(FwCloud)
      .save([
        { name: `${code}-source`, locked: false },
        { name: `${code}-target`, locked: false },
      ]);
  });

  afterEach(async () => {
    for (const profile of await profiles().find({ where: { code, userId: owner.id } })) {
      removeReplicationProfileModel(profile);
      await profiles().delete(profile.id);
    }
  });

  async function makeTarget(kind: 'firewall' | 'cluster', cloud: FwCloud) {
    const cluster =
      kind === 'cluster'
        ? await manager()
            .getRepository(Cluster)
            .save({ name: `${code}-${cloud.id}-cluster`, fwCloudId: cloud.id })
        : undefined;
    const firewall = await manager()
      .getRepository(Firewall)
      .save({
        name: `${code}-${cloud.id}-master`,
        fwCloudId: cloud.id,
        ...(cluster ? { clusterId: cluster.id, fwmaster: 1 } : {}),
      });
    if (cluster) {
      await manager()
        .getRepository(Firewall)
        .save({
          name: `${code}-${cloud.id}-backup`,
          fwCloudId: cloud.id,
          clusterId: cluster.id,
          fwmaster: 0,
        });
    }
    return { firewall, ref: { kind, id: cluster?.id ?? firewall.id } };
  }

  async function readAddresses(firewallId: number) {
    return manager().query(
      `SELECT I.id AS interfaceId, I.name AS interfaceName, O.name, O.address, O.netmask,
              O.ip_version, O.type, O.comment, O.diff_serv, O.options, O.fwcloud
       FROM interface I INNER JOIN ipobj O ON O.interface = I.id
       WHERE I.firewall = ? ORDER BY I.id, O.id`,
      [firewallId],
    );
  }

  for (const kind of ['firewall', 'cluster'] as const) {
    it(`captures every ${kind} interface address through JSON, editing and application to another FWCloud`, async () => {
      const source = await makeTarget(kind, sourceCloud);
      const target = await makeTarget(kind, targetCloud);
      const sourceInterfaces = await manager()
        .getRepository(Interface)
        .save(
          [
            { name: 'eth0', labelName: 'wan' },
            { name: 'eth1', labelName: 'lan' },
            { name: 'eth2', labelName: 'ipv6' },
          ].map((iface) => ({
            ...iface,
            type: '10',
            interface_type: '10',
            comment: `${iface.name} source settings`,
            firewallId: source.firewall.id,
          })),
        );
      const original = [
        { iface: 0, name: 'wan-ip4', address: '192.168.1.10', netmask: '/24', ip_version: 4 },
        {
          iface: 0,
          name: 'wan-ip4-secondary',
          address: '192.168.1.11',
          netmask: '/32',
          ip_version: 4,
        },
        { iface: 0, name: 'wan-ip6', address: '2001:db8:1::10', netmask: '/64', ip_version: 6 },
        {
          iface: 0,
          name: 'wan-ip6-secondary',
          address: '2001:0DB8:0001:0000:0000:0000:0000:0011',
          netmask: '/96',
          ip_version: 6,
        },
        { iface: 1, name: 'lan-ip4', address: '198.51.100.10', netmask: '/25', ip_version: 4 },
        {
          iface: 2,
          name: 'ipv6-primary',
          address: '2001:db8:2::10',
          netmask: '/127',
          ip_version: 6,
        },
        {
          iface: 2,
          name: 'ipv6-secondary',
          address: '2001:db8:2::11',
          netmask: '/128',
          ip_version: 6,
        },
        {
          iface: 2,
          name: 'ipv6-zero-prefix',
          address: '2001:db8:3::10',
          netmask: '/0',
          ip_version: 6,
        },
        {
          iface: 2,
          name: 'ipv6-shared-literal',
          address: '2001:db8:1::10',
          netmask: '/64',
          ip_version: 6,
        },
      ];
      await manager()
        .getRepository(IPObj)
        .save(
          original.map(({ iface, ...address }) => ({
            ...address,
            ipObjTypeId: 5,
            interfaceId: sourceInterfaces[iface].id,
            fwCloudId: sourceCloud.id,
            comment: `${address.name} original comment`,
            diff_serv: 12,
            options: '0',
          })),
        );
      const sourceBefore = await readAddresses(source.firewall.id);
      const interfaceSettingsBefore = await manager()
        .getRepository(Interface)
        .find({ where: { firewallId: source.firewall.id }, order: { id: 'ASC' } });

      // Explicit mappings exercise role assignment separately from matching interface names.
      await manager()
        .getRepository(Interface)
        .save(
          ['ens18', 'ens19'].map((name) => ({
            name,
            type: '10',
            interface_type: '10',
            labelName: `${name}-existing-role`,
            comment: `${name} destination settings`,
            mac: name === 'ens18' ? '02:00:00:00:00:18' : '02:00:00:00:00:19',
            firewallId: target.firewall.id,
          })),
        );
      const mappedSettingsBefore = await manager()
        .getRepository(Interface)
        .find({ where: { firewallId: target.firewall.id }, order: { id: 'ASC' } });

      const captured = await request(app.express)
        .post(`${catalogUrl(sourceCloud)}/from-source`)
        .set('Cookie', [cookie])
        .send({ source: source.ref, name: 'Captured interface addresses', code, scope: 'generic' })
        .expect(201);
      expect(captured.body.data.warnings).to.deep.eq([]);
      const model = captured.body.data.model;
      expect(model.provision.interfaces.map(({ name, role }) => ({ name, role }))).to.deep.eq([
        { name: 'eth0', role: 'wan' },
        { name: 'eth1', role: 'lan' },
        { name: 'eth2', role: 'ipv6' },
      ]);
      for (const [index, iface] of model.provision.interfaces.entries()) {
        const expected = original.filter((address) => address.iface === index);
        expect(iface.addresses).to.have.length(expected.length);
        for (const [addressIndex, declared] of iface.addresses.entries()) {
          const address = expected[addressIndex];
          const parameter = model.parameters.find((entry) => entry.name === declared.value.param);
          expect(declared).to.include({
            name: address.name,
            ipVersion: address.ip_version,
            comment: `${address.name} original comment`,
            diff_serv: 12,
          });
          expect(Number(declared.options)).to.eq(0);
          expect(parameter).to.include({
            ipVersion: address.ip_version,
            default: `${address.address}${address.netmask}`,
          });
        }
      }
      expect(model.policyStructure.interfaces).to.deep.eq(model.provision.interfaces);

      const persisted = await profiles().findOneByOrFail({ code, versionSlot: 'latest' });
      const diskJson = JSON.parse(
        fs.readFileSync(resolveReplicationProfileTemplatePath(persisted), 'utf8'),
      );
      expect(diskJson).to.deep.eq(model);
      expect(loadReplicationProfileModel(persisted)).to.deep.eq(model);
      const detail = await request(app.express)
        .get(profileUrl(targetCloud))
        .set('Cookie', [cookie])
        .expect(200);
      expect(detail.body.data.model).to.deep.eq(model);

      // Saving an unrelated template edit must not discard or normalize any address.
      const editedModel = JSON.parse(JSON.stringify(detail.body.data.model));
      editedModel.options = { description: 'Edited without changing interface configuration' };
      await request(app.express)
        .post(`${catalogUrl(targetCloud)}/${code}/versions`)
        .set('Cookie', [cookie])
        .send({
          name: 'Edited interface template',
          description: 'Edited description',
          targetKind: kind,
          scope: 'generic',
          category: 'Custom',
          model: editedModel,
        })
        .expect(201);
      const saved = await request(app.express)
        .get(profileUrl(targetCloud))
        .set('Cookie', [cookie])
        .expect(200);
      expect(saved.body.data.model).to.deep.eq(editedModel);
      const latest = await profiles().findOneByOrFail({ code, versionSlot: 'latest' });
      expect(loadReplicationProfileModel(latest)).to.deep.eq(editedModel);

      const applied = await request(app.express)
        .post(`${profileUrl(targetCloud)}/apply`)
        .set('Cookie', [cookie])
        .send({
          target: target.ref,
          mode: 'merge',
          interfaceNameMapping: { wan: 'ens18', lan: 'ens19' },
        })
        .expect(200);
      expect(applied.body.data.errors).to.deep.eq([]);
      expect(applied.body.data.applied).to.eq(true);

      const recreated = await readAddresses(target.firewall.id);
      expect(recreated).to.have.length(original.length);
      const targetNames = ['ens18', 'ens19', 'eth2'];
      for (const address of original) {
        const recreatedAddress = recreated.find((entry) => entry.name === address.name);
        expect(recreatedAddress).to.include({
          interfaceName: targetNames[address.iface],
          address: address.address,
          netmask: address.netmask,
          ip_version: address.ip_version,
          type: 5,
          comment: `${address.name} original comment`,
          diff_serv: 12,
          options: '0',
          fwcloud: targetCloud.id,
        });
      }
      for (const iface of mappedSettingsBefore) {
        expect(
          await manager().getRepository(Interface).findOneByOrFail({ id: iface.id }),
        ).to.deep.eq(iface);
      }
      expect(await readAddresses(source.firewall.id)).to.deep.eq(sourceBefore);
      expect(
        await manager()
          .getRepository(Interface)
          .find({ where: { firewallId: source.firewall.id }, order: { id: 'ASC' } }),
      ).to.deep.eq(interfaceSettingsBefore);
    });
  }

  for (const configuration of [
    {
      label: 'invalid IPv6 address',
      address: '2001:db8::invalid',
      netmask: '/64',
      ip_version: 6,
      ipObjTypeId: 5,
    },
    {
      label: 'invalid IPv6 prefix',
      address: '2001:db8::10',
      netmask: '/129',
      ip_version: 6,
      ipObjTypeId: 5,
    },
    {
      label: 'unsupported address family',
      address: '2001:db8::10',
      netmask: '/64',
      ip_version: 5,
      ipObjTypeId: 5,
    },
    {
      label: 'unsupported interface object',
      address: '2001:db8::',
      netmask: '/64',
      ip_version: 6,
      ipObjTypeId: 7,
    },
  ]) {
    it(`rejects an ${configuration.label} with the affected interface and configuration before saving a profile`, async () => {
      const source = await makeTarget('firewall', sourceCloud);
      const iface = await manager().getRepository(Interface).save({
        name: 'eth-bad',
        labelName: 'wan',
        type: '10',
        interface_type: '10',
        firewallId: source.firewall.id,
      });
      const { label: _label, ...address } = configuration;
      await manager()
        .getRepository(IPObj)
        .save({
          ...address,
          name: 'uncapturable-ipv6',
          interfaceId: iface.id,
          fwCloudId: sourceCloud.id,
        });

      const response = await request(app.express)
        .post(`${catalogUrl(sourceCloud)}/from-source`)
        .set('Cookie', [cookie])
        .send({ source: source.ref, name: 'Incomplete template', code })
        .expect(422);
      expect(response.body.message).to.include('eth-bad');
      expect(response.body.message).to.include('uncapturable-ipv6');
      expect(response.body.message).to.include(configuration.address);
      expect(response.body.message).to.include(configuration.netmask);
      expect(await profiles().find({ where: { code, userId: owner.id } })).to.deep.eq([]);
    });
  }
});
