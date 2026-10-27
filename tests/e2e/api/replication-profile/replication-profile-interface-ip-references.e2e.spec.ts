import * as fs from 'fs';
import request = require('supertest');
import { Application } from '../../../../src/Application';
import db from '../../../../src/database/database-manager';
import { Cluster } from '../../../../src/models/firewall/Cluster';
import { Firewall } from '../../../../src/models/firewall/Firewall';
import { FwCloud } from '../../../../src/models/fwcloud/FwCloud';
import { Interface } from '../../../../src/models/interface/Interface';
import { IPObj } from '../../../../src/models/ipobj/IPObj';
import { PolicyRule } from '../../../../src/models/policy/PolicyRule';
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

type TargetKind = 'firewall' | 'cluster';

describe(describeName('Replication profile interface IP rule references E2E Tests'), () => {
  let app: Application;
  let owner: User;
  let cookie: string;
  let sourceCloud: FwCloud;
  let otherCloud: FwCloud;
  let code: string;

  const manager = () => db.getSource().manager;
  const profiles = () => manager().getRepository(ReplicationProfile);
  const catalog = (cloud: FwCloud) => `/fwclouds/${cloud.id}/profiles`;
  const url = (cloud: FwCloud) => `${catalog(cloud)}/${code}/latest`;
  const start = new Date('2026-10-01T06:15:30Z');
  const end = new Date('2026-10-31T18:45:59Z');

  beforeEach(async () => {
    app = testSuite.app;
    owner = await createUser({ role: 1 });
    cookie = attachSession(generateSession(owner));
    code = `interface-ip-rules-${Date.now()}-${Math.round(Math.random() * 100000)}`;
    [sourceCloud, otherCloud] = await manager()
      .getRepository(FwCloud)
      .save([
        { name: `${code}-A`, locked: false },
        { name: `${code}-B`, locked: false },
      ]);
  });

  afterEach(async () => {
    for (const profile of await profiles().find({ where: { code, userId: owner.id } })) {
      removeReplicationProfileModel(profile);
      await profiles().delete(profile.id);
    }
  });

  async function makeTarget(kind: TargetKind, cloud: FwCloud, label: string) {
    const cluster =
      kind === 'cluster'
        ? await manager()
            .getRepository(Cluster)
            .save({ name: `${code}-${label}`, fwCloudId: cloud.id })
        : undefined;
    const firewall = await manager()
      .getRepository(Firewall)
      .save({
        name: `${code}-${label}-master`,
        fwCloudId: cloud.id,
        ...(cluster ? { clusterId: cluster.id, fwmaster: 1 } : {}),
      });
    if (cluster) {
      await manager()
        .getRepository(Firewall)
        .save({
          name: `${code}-${label}-backup`,
          fwCloudId: cloud.id,
          clusterId: cluster.id,
          fwmaster: 0,
        });
    }
    return { firewall, ref: { kind, id: cluster?.id ?? firewall.id } };
  }

  async function makeMappedInterfaces(firewall: Firewall) {
    await manager()
      .getRepository(Interface)
      .save(
        ['ens18', 'ens19'].map((name) => ({
          name,
          type: '10',
          interface_type: '10',
          firewallId: firewall.id,
        })),
      );
  }

  async function makeSource(kind: TargetKind) {
    const source = await makeTarget(kind, sourceCloud, 'source');
    const interfaces = await manager()
      .getRepository(Interface)
      .save(
        ['wan', 'lan'].map((role, index) => ({
          name: `eth${index}`,
          labelName: role,
          type: '10',
          interface_type: '10',
          firewallId: source.firewall.id,
        })),
      );
    const addresses = await manager()
      .getRepository(IPObj)
      .save(
        [
          {
            name: 'wan-primary4',
            address: '192.168.1.1',
            netmask: '/24',
            ip_version: 4,
            interfaceId: interfaces[0].id,
          },
          {
            name: 'wan-secondary4',
            address: '192.168.1.2',
            netmask: '/32',
            ip_version: 4,
            interfaceId: interfaces[0].id,
          },
          {
            name: 'wan-primary6',
            address: '2001:db8:1::1',
            netmask: '/64',
            ip_version: 6,
            interfaceId: interfaces[0].id,
          },
          {
            name: 'wan-secondary6',
            address: '2001:db8:1::2',
            netmask: '/128',
            ip_version: 6,
            interfaceId: interfaces[0].id,
          },
          // Identical IP values on distinct interfaces must retain their owning interface.
          {
            name: 'lan-shared4',
            address: '192.168.1.1',
            netmask: '/24',
            ip_version: 4,
            interfaceId: interfaces[1].id,
          },
          {
            name: 'lan-shared6',
            address: '2001:db8:1::1',
            netmask: '/64',
            ip_version: 6,
            interfaceId: interfaces[1].id,
          },
        ].map((address) => ({ ...address, ipObjTypeId: 5, fwCloudId: sourceCloud.id })),
      );
    const service = await manager().getRepository(IPObj).findOneByOrFail({ id: 20029 });
    expect(service).to.include({
      name: 'https',
      ipObjTypeId: 2,
      protocol: 6,
      source_port_start: 0,
      source_port_end: 0,
      destination_port_start: 443,
      destination_port_end: 443,
      fwCloudId: null,
    });
    const scenarios = [];
    for (const ipVersion of [4, 6] as const) {
      const [primary, secondary] = addresses.filter(
        (address) => address.interfaceId === interfaces[0].id && address.ip_version === ipVersion,
      );
      const shared = addresses.find(
        (address) => address.interfaceId === interfaces[1].id && address.ip_version === ipVersion,
      )!;
      const cases = [
        { label: 'source', source: [primary], destination: [] },
        { label: 'destination', source: [], destination: [secondary] },
        { label: 'both', source: [primary], destination: [secondary] },
        { label: 'with-in', source: [primary], destination: [secondary], inRole: 'lan' },
        { label: 'with-out', source: [secondary], destination: [primary], outRole: 'wan' },
        {
          label: 'with-both-interfaces',
          source: [primary, secondary],
          destination: [secondary],
          inRole: 'wan',
          outRole: 'lan',
        },
        {
          label: 'shared-value',
          source: [shared],
          destination: [primary],
          inRole: 'wan',
          outRole: 'lan',
        },
      ];
      for (const [index, entry] of cases.entries()) {
        const comment = `IPv${ipVersion}-${entry.label}`;
        const positions = getProvisionRulePositions(ipVersion, 'forward');
        const action = index === 1 ? 2 : 1;
        const negate = entry.source.length
          ? String(positions.source)
          : String(positions.destination);
        const id = await PolicyRule.insertPolicy_r({
          firewall: source.firewall.id,
          type: PolicyTypesMap.get(`IPv${ipVersion}:FORWARD`),
          rule_order: index + 1,
          comment,
          action,
          active: 1,
          special: 0,
          options: 6,
        });
        await manager().query(
          'UPDATE policy_r SET negate = ?, time_start = ?, time_end = ? WHERE id = ?',
          [negate, start, end, id],
        );
        for (const [position, objects] of [
          [positions.source, entry.source],
          [positions.destination, entry.destination],
          [positions.service, [service]],
        ] as const) {
          for (const [objectIndex, object] of objects.entries()) {
            await manager().query(
              'INSERT INTO policy_r__ipobj (rule, ipobj, ipobj_g, interface, position, position_order) VALUES (?, ?, -1, -1, ?, ?)',
              [id, object.id, position, objectIndex + 1],
            );
          }
        }
        for (const [role, position] of [
          [entry.inRole, positions.in],
          [entry.outRole, positions.out],
        ]) {
          if (role)
            await manager().query(
              'INSERT INTO policy_r__interface (rule, interface, position) VALUES (?, ?, ?)',
              [id, interfaces[role === 'wan' ? 0 : 1].id, position],
            );
        }
        scenarios.push({ ...entry, id, comment, ipVersion, positions, action, negate });
      }
    }
    return { ...source, interfaces, addresses, service, scenarios };
  }

  async function captureAndEdit(source: Awaited<ReturnType<typeof makeSource>>) {
    const capture = await request(app.express)
      .post(`${catalog(sourceCloud)}/from-source`)
      .set('Cookie', [cookie])
      .send({ source: source.ref, name: 'Interface IP policy', code, scope: 'generic' })
      .expect(201);
    expect(capture.body.data.warnings).to.deep.eq([]);
    let persisted = await profiles().findOneByOrFail({ code, versionSlot: 'latest' });
    const model = JSON.parse(
      fs.readFileSync(resolveReplicationProfileTemplatePath(persisted), 'utf8'),
    );
    // API references include destination-specific resolution information. Only these response
    // fields are transient; every rule, interface and saved reference field must round-trip.
    const storedContent = (responseModel) => {
      const result = JSON.parse(JSON.stringify(responseModel));
      if (Array.isArray(result.objectReferences)) {
        result.objectReferences = result.objectReferences.map((reference) =>
          Object.fromEntries(
            Object.entries(reference).filter(
              ([field]) =>
                ![
                  'resolved',
                  'currentObject',
                  'requiredFields',
                  'conflictingObjects',
                  'snapshotConflict',
                ].includes(field),
            ),
          ),
        );
      }
      return result;
    };
    expect(storedContent(capture.body.data.model)).to.deep.eq(model);
    for (const scenario of source.scenarios) {
      const rule = model.provision.rules.find((item) => item.comment === scenario.comment);
      expect(rule.inRole).to.eq(scenario.inRole);
      expect(rule.outRole).to.eq(scenario.outRole);
      for (const field of ['source', 'destination'] as const) {
        const expected = scenario[field];
        expect(rule[field] ?? []).to.have.length(expected.length);
        for (const [index, address] of expected.entries()) {
          const role = address.interfaceId === source.interfaces[0].id ? 'wan' : 'lan';
          const iface = model.provision.interfaces.find((item) => item.role === role);
          const addressIndex = iface.addresses.findIndex((item) => item.name === address.name);
          expect(rule[field][index]).to.deep.eq({
            kind: 'address',
            name: address.name,
            value: iface.addresses[addressIndex].value,
            interfaceRole: role,
            interfaceAddressIndex: addressIndex,
          });
        }
      }
    }
    expect(model.policyStructure.rules).to.deep.eq(model.provision.rules);
    expect(loadReplicationProfileModel(persisted)).to.deep.eq(model);
    const detail = await request(app.express)
      .get(url(otherCloud))
      .set('Cookie', [cookie])
      .expect(200);
    expect(storedContent(detail.body.data.model)).to.deep.eq(model);
    const edited = storedContent(detail.body.data.model);
    edited.options = { description: 'Unrelated edit retains rule reference types and locations' };
    await request(app.express)
      .post(`${catalog(otherCloud)}/${code}/versions`)
      .set('Cookie', [cookie])
      .send({
        name: 'Edited interface IP policy',
        targetKind: source.ref.kind,
        scope: 'generic',
        category: 'Custom',
        model: edited,
      })
      .expect(201);
    const saved = await request(app.express)
      .get(url(otherCloud))
      .set('Cookie', [cookie])
      .expect(200);
    expect(storedContent(saved.body.data.model)).to.deep.eq(edited);
    persisted = await profiles().findOneByOrFail({ code, versionSlot: 'latest' });
    expect(loadReplicationProfileModel(persisted)).to.deep.eq(edited);
    return { model: edited, persisted };
  }

  async function verifyPolicy(
    source: Awaited<ReturnType<typeof makeSource>>,
    target: Firewall,
    mappedNames = ['ens18', 'ens19'],
    selected?: Map<string, { name: string; value: string }>,
  ) {
    const rules = await manager().query(
      'SELECT id, type, comment, action, options, negate, time_start, time_end FROM policy_r WHERE firewall = ? AND special = 0 ORDER BY type, rule_order',
      [target.id],
    );
    expect(rules).to.have.length(source.scenarios.length);
    for (const scenario of source.scenarios) {
      const rule = rules.find((item) => item.comment === scenario.comment);
      expect(rule).to.include({
        type: PolicyTypesMap.get(`IPv${scenario.ipVersion}:FORWARD`),
        action: scenario.action,
        options: 6,
        negate: scenario.negate,
      });
      expect(rule.time_start).to.deep.eq(start);
      expect(rule.time_end).to.deep.eq(end);
      const interfaceRefs = await manager().query(
        'SELECT RI.position, I.name FROM policy_r__interface RI INNER JOIN interface I ON I.id = RI.interface WHERE RI.rule = ? ORDER BY RI.position',
        [rule.id],
      );
      const expectedInterfaces = [];
      if (scenario.inRole)
        expectedInterfaces.push({
          position: scenario.positions.in,
          name: mappedNames[scenario.inRole === 'wan' ? 0 : 1],
        });
      if (scenario.outRole)
        expectedInterfaces.push({
          position: scenario.positions.out,
          name: mappedNames[scenario.outRole === 'wan' ? 0 : 1],
        });
      expect(interfaceRefs, scenario.comment).to.deep.eq(
        expectedInterfaces.sort((a, b) => a.position - b.position),
      );
      const objects = await manager().query(
        `SELECT R.position, R.interface AS interfaceReference, O.id, O.type, O.name, O.address, O.netmask, O.ip_version, O.fwcloud, I.name AS owner
        FROM policy_r__ipobj R INNER JOIN ipobj O ON O.id = R.ipobj LEFT JOIN interface I ON I.id = O.interface
        WHERE R.rule = ? ORDER BY R.position, R.position_order`,
        [rule.id],
      );
      expect(objects).to.have.length(scenario.source.length + scenario.destination.length + 1);
      for (const field of ['source', 'destination'] as const) {
        const actual = objects.filter((item) => item.position === scenario.positions[field]);
        expect(actual, `${scenario.comment}: ${field}`).to.have.length(scenario[field].length);
        for (const [index, original] of scenario[field].entries()) {
          const mapped = selected?.get(original.name);
          const originalOwner = original.interfaceId === source.interfaces[0].id ? 0 : 1;
          const expectedAddress =
            mapped?.value.slice(0, mapped.value.lastIndexOf('/')) ?? original.address;
          const expectedMask =
            mapped?.value.slice(mapped.value.lastIndexOf('/')) ?? original.netmask;
          expect(actual[index]).to.include({
            interfaceReference: -1,
            type: 5,
            name: mapped?.name ?? original.name,
            address: expectedAddress,
            netmask: expectedMask,
            ip_version: scenario.ipVersion,
            fwcloud: target.fwCloudId,
            owner: mappedNames[originalOwner],
          });
          if (target.id !== source.firewall.id) expect(actual[index].id).not.to.eq(original.id);
        }
      }
      const [service] = objects.filter((item) => item.position === scenario.positions.service);
      expect(service).to.include({
        id: source.service.id,
        type: 2,
        name: source.service.name,
        fwcloud: null,
      });
    }
  }

  for (const sourceKind of ['firewall', 'cluster'] as const) {
    for (const targetKind of ['firewall', 'cluster'] as const) {
      for (const sameCloud of [false, true]) {
        it(`preserves IPv4/IPv6 source, destination and explicit In/Out from a ${sourceKind} to a ${targetKind} in ${sameCloud ? 'the original' : 'another'} FWCloud`, async () => {
          const source = await makeSource(sourceKind);
          const destinationCloud = sameCloud ? sourceCloud : otherCloud;
          const target = await makeTarget(targetKind, destinationCloud, 'target');
          await makeMappedInterfaces(target.firewall);
          const sourceBefore = await manager().query(
            'SELECT * FROM policy_r__ipobj WHERE rule IN (?) ORDER BY id_pi',
            [source.scenarios.map((scenario) => scenario.id)],
          );
          const { persisted } = await captureAndEdit(source);
          const file = resolveReplicationProfileTemplatePath(persisted);
          const jsonBefore = fs.readFileSync(file, 'utf8');
          const applied = await request(app.express)
            .post(`${url(destinationCloud)}/apply`)
            .set('Cookie', [cookie])
            .send({
              target: target.ref,
              mode: 'merge',
              interfaceNameMapping: { wan: 'ens18', lan: 'ens19' },
            })
            .expect((response) => expect(response.status, JSON.stringify(response.body)).to.eq(200))
            .expect(200);
          expect(applied.body.data.errors).to.deep.eq([]);
          expect(applied.body.data.applied).to.eq(true);
          expect(applied.body.data.createdRules).to.have.length(source.scenarios.length);
          await verifyPolicy(source, target.firewall);
          expect(
            await manager().query(
              'SELECT * FROM policy_r__ipobj WHERE rule IN (?) ORDER BY id_pi',
              [source.scenarios.map((scenario) => scenario.id)],
            ),
          ).to.deep.eq(sourceBefore);
          expect(fs.readFileSync(file, 'utf8')).to.eq(jsonBefore);
        });
      }
    }
  }

  for (const kind of ['firewall', 'cluster'] as const) {
    it(`applies to the original ${kind} without introducing interface restrictions or replacing its IP identities`, async () => {
      const source = await makeSource(kind);
      await captureAndEdit(source);
      const applied = await request(app.express)
        .post(`${url(sourceCloud)}/apply`)
        .set('Cookie', [cookie])
        .send({ target: source.ref, mode: 'merge' })
        .expect(200);
      expect(applied.body.data.errors).to.deep.eq([]);
      expect(applied.body.data.applied).to.eq(true);
      expect(applied.body.data.createdRules).to.deep.eq([]);
      await verifyPolicy(source, source.firewall, ['eth0', 'eth1']);
    });
  }

  it('resolves source and destination to the selected interface IP configurations independently of In/Out', async () => {
    const source = await makeSource('firewall');
    const target = await makeTarget('cluster', otherCloud, 'target');
    await makeMappedInterfaces(target.firewall);
    const { model } = await captureAndEdit(source);
    const selected = new Map<string, { name: string; value: string }>();
    const overrides = Object.fromEntries(
      model.provision.interfaces.map((iface) => [
        iface.role,
        iface.addresses.map((address, index) => {
          const value =
            address.ipVersion === 4
              ? `203.0.${iface.role === 'wan' ? 113 : 114}.${index + 10}/32`
              : `2001:db8:${iface.role === 'wan' ? '10' : '20'}::${index + 10}/128`;
          const chosen = { name: `selected-${address.name}`, value };
          selected.set(address.name, chosen);
          return chosen;
        }),
      ]),
    );
    const applied = await request(app.express)
      .post(`${url(otherCloud)}/apply`)
      .set('Cookie', [cookie])
      .send({
        target: target.ref,
        mode: 'merge',
        interfaceNameMapping: { wan: 'ens18', lan: 'ens19' },
        interfaceAddressOverrides: overrides,
      })
      .expect((response) => expect(response.status, JSON.stringify(response.body)).to.eq(200))
      .expect(200);
    expect(applied.body.data.errors).to.deep.eq([]);
    expect(applied.body.data.applied).to.eq(true);
    await verifyPolicy(source, target.firewall, ['ens18', 'ens19'], selected);
    const persisted = await profiles().findOneByOrFail({ code, versionSlot: 'latest' });
    expect(loadReplicationProfileModel(persisted)).to.deep.eq(model);
  });

  it('returns a controlled error for an ambiguous legacy interface IP without inserting a broader rule or an In/Out restriction', async () => {
    const source = await makeSource('firewall');
    const target = await makeTarget('firewall', otherCloud, 'ambiguous-target');
    const { model } = await captureAndEdit(source);
    const [wan, lan] = model.provision.interfaces;
    wan.addresses[0].name = 'ambiguous-ip';
    lan.addresses[0].name = 'ambiguous-ip';
    lan.addresses[0].value = { ...wan.addresses[0].value };
    model.provision.rules = [
      {
        chain: 'forward',
        ipVersion: 4,
        action: 'accept',
        source: [{ kind: 'address', value: { ...wan.addresses[0].value }, name: 'ambiguous-ip' }],
        inRole: 'lan',
        outRole: 'wan',
        comment: 'Ambiguous legacy address',
      },
    ];
    model.policyStructure = JSON.parse(JSON.stringify(model.provision));
    await request(app.express)
      .post(`${catalog(otherCloud)}/${code}/versions`)
      .set('Cookie', [cookie])
      .send({
        name: 'Ambiguous legacy address',
        targetKind: 'firewall',
        scope: 'generic',
        category: 'Custom',
        model,
      })
      .expect(201);
    const applied = await request(app.express)
      .post(`${url(otherCloud)}/apply`)
      .set('Cookie', [cookie])
      .send({ target: target.ref, mode: 'merge' })
      .expect(422);
    expect(applied.body.data.applied).to.eq(false);
    expect(applied.body.data.createdRules).to.deep.eq([]);
    expect(
      applied.body.data.errors.some((message) => message.includes('multiple interface IPs')),
    ).to.eq(true);
    expect(
      await manager().query('SELECT id FROM policy_r WHERE firewall = ?', [target.firewall.id]),
    ).to.deep.eq([]);
    expect(
      await manager().query(
        'SELECT R.rule FROM policy_r__interface R INNER JOIN interface I ON I.id = R.interface WHERE I.firewall = ?',
        [target.firewall.id],
      ),
    ).to.deep.eq([]);
  });
});
