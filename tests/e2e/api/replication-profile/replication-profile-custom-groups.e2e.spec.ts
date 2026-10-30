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
import { IPObjGroup } from '../../../../src/models/ipobj/IPObjGroup';
import { PolicyRule, PolicyRuleOptMask } from '../../../../src/models/policy/PolicyRule';
import { getProvisionRulePositions } from '../../../../src/models/replication-profile/policy-replication.service';
import { ReplicationProfile } from '../../../../src/models/replication-profile/replication-profile.model';
import {
  loadReplicationProfileModel,
  resolveReplicationProfileTemplatePath,
  writeReplicationProfileModel,
} from '../../../../src/models/replication-profile/replication-profile-template';
import { User } from '../../../../src/models/user/User';
import { describeName, expect, testSuite } from '../../../mocha/global-setup';
import { attachSession, createUser, generateSession } from '../../../utils/utils';

describe(describeName('Replication profile custom group capture E2E Tests'), () => {
  let app: Application;
  let sessionId: string;
  let sourceCloud: FwCloud;
  let destinationCloud: FwCloud;
  let source: Firewall;
  let destination: Firewall;
  let prefix: string;
  let profiles: ReplicationProfile[];
  const positions = getProvisionRulePositions(4, 'forward');
  const manager = () => db.getSource().manager;
  const profileUrl = (profile: ReplicationProfile, cloud = destinationCloud.id) =>
    `/fwclouds/${cloud}/profiles/${profile.code}/${profile.versionSlot}`;

  beforeEach(async () => {
    app = testSuite.app;
    profiles = [];
    prefix = `rp-group-${Date.now()}-${Math.round(Math.random() * 10000)}-`;
    [sourceCloud, destinationCloud] = await manager()
      .getRepository(FwCloud)
      .save(
        ['source', 'destination'].map((name) => ({
          name: `${prefix}${name}`,
          locked: false,
          locked_by: null,
        })),
      );
    [source, destination] = await manager()
      .getRepository(Firewall)
      .save(
        [sourceCloud, destinationCloud].map((cloud) => ({
          name: `${prefix}${cloud.id}-firewall`,
          fwCloudId: cloud.id,
        })),
      );
    const user = await createUser({ role: 0 });
    user.fwClouds = [sourceCloud, destinationCloud];
    await manager().getRepository(User).save(user);
    sessionId = generateSession(user);
  });

  afterEach(async () => {
    for (const profile of profiles) {
      await manager().getRepository(ReplicationProfile).delete(profile.id);
    }
  });

  async function createGroup(
    name: string,
    type: number,
    members: IPObj[],
    fwCloudId = sourceCloud.id,
  ): Promise<IPObjGroup> {
    const group = await manager()
      .getRepository(IPObjGroup)
      .save({
        name,
        type,
        comment: `${name} configuration`,
        fwCloudId,
      });
    for (const member of members) {
      await manager().query('INSERT INTO ipobj__ipobjg (ipobj, ipobj_g) VALUES (?, ?)', [
        member.id,
        group.id,
      ]);
    }
    return group;
  }

  async function createGroups() {
    const addresses: IPObj[] = await manager()
      .getRepository(IPObj)
      .save([
        {
          name: `${prefix}OFFICE_LAN`,
          ipObjTypeId: 7,
          address: '10.219.37.0',
          netmask: '/24',
          ip_version: 4,
          comment: 'Office LAN',
          fwCloudId: sourceCloud.id,
        },
        {
          name: `${prefix}OFFICE_SERVER`,
          ipObjTypeId: 5,
          address: '192.168.3.20',
          netmask: '/32',
          ip_version: 4,
          fwCloudId: sourceCloud.id,
        },
        {
          name: `${prefix}OFFICE_POOL`,
          ipObjTypeId: 6,
          range_start: '192.168.2.10',
          range_end: '192.168.2.30',
          ip_version: 4,
          fwCloudId: sourceCloud.id,
        },
      ]);
    const services: IPObj[] = await manager()
      .getRepository(IPObj)
      .save(
        [
          { name: 'HTTP', ipObjTypeId: 2, protocol: 6, port: 80 },
          { name: 'DNS', ipObjTypeId: 4, protocol: 17, port: 53 },
        ].map(({ name, port, ...configuration }) => ({
          name: `${prefix}${name}`,
          ...configuration,
          source_port_start: 1024,
          source_port_end: 65535,
          destination_port_start: port,
          destination_port_end: port,
          options: '0',
          fwCloudId: sourceCloud.id,
        })),
      );
    const addressGroup = await createGroup(`${prefix}OFFICE_NETWORKS`, 20, addresses);
    const serviceGroup = await createGroup(`${prefix}OFFICE_SERVICES`, 21, services);
    return { addresses, services, addressGroup, serviceGroup };
  }

  async function addRule(
    order: number,
    addressGroup: IPObjGroup,
    serviceGroup: IPObjGroup,
  ): Promise<number> {
    const rule = await PolicyRule.insertPolicy_r({
      firewall: source.id,
      type: 3,
      rule_order: order,
      comment: `Office traffic ${order}`,
      action: 1,
      active: 1,
      special: 0,
      options: 0,
    });
    for (const [position, group] of [
      [positions.source, addressGroup],
      [positions.destination, addressGroup],
      [positions.service, serviceGroup],
    ] as const) {
      await manager().query(
        'INSERT INTO policy_r__ipobj (rule, ipobj, ipobj_g, interface, position, position_order) VALUES (?, -1, ?, -1, ?, 1)',
        [rule, group.id, position],
      );
    }
    return rule;
  }

  async function capture(kind: 'firewall' | 'cluster' = 'firewall', id = source.id) {
    const response = await request(app.express)
      .post(`/fwclouds/${sourceCloud.id}/profiles/from-source`)
      .set('Cookie', [attachSession(sessionId)])
      .send({ source: { kind, id }, name: 'Office group template', code: `${prefix}profile` })
      .expect(201);
    expect(response.body.data.warnings).to.deep.eq([]);
    const profile = await manager()
      .getRepository(ReplicationProfile)
      .findOneByOrFail({ id: response.body.data.id });
    profiles.push(profile);
    return profile;
  }

  async function clusterFor(firewall: Firewall) {
    const cluster = await manager()
      .getRepository(Cluster)
      .save({
        name: `${prefix}${firewall.id}-cluster`,
        fwCloudId: firewall.fwCloudId,
      });
    await manager().getRepository(Firewall).update(firewall.id, {
      clusterId: cluster.id,
      fwmaster: 1,
    });
    const backup = await manager()
      .getRepository(Firewall)
      .save({
        name: `${prefix}${firewall.id}-backup`,
        fwCloudId: firewall.fwCloudId,
        clusterId: cluster.id,
        fwmaster: 0,
      });
    return { cluster, backup };
  }

  async function members(groupId: number) {
    return manager().query(
      'SELECT O.* FROM ipobj__ipobjg R INNER JOIN ipobj O ON O.id = R.ipobj WHERE R.ipobj_g = ? ORDER BY O.name',
      [groupId],
    );
  }

  for (const kind of ['firewall', 'cluster'] as const) {
    it(`should capture shared custom address and service groups from a ${kind}, persist JSON and recreate complete policy in another FWCloud`, async () => {
      const { addresses, services, addressGroup, serviceGroup } = await createGroups();
      const sourceCluster = kind === 'cluster' ? await clusterFor(source) : undefined;
      const destinationCluster = kind === 'cluster' ? await clusterFor(destination) : undefined;
      const interfaces = await manager()
        .getRepository(Interface)
        .save(
          ['lan0', 'wan0'].map((name) => ({
            name,
            type: '10',
            interface_type: '10',
            firewallId: source.id,
          })),
        );
      const ruleId = await addRule(1, addressGroup, serviceGroup);
      await addRule(2, addressGroup, serviceGroup);
      const options = PolicyRuleOptMask.LOG | PolicyRuleOptMask.STATELESS;
      const negate = [positions.source, positions.destination, positions.service].join(' ');
      const timeStart = new Date('2026-10-01T06:15:30Z');
      const timeEnd = new Date('2026-10-31T18:45:59Z');
      await manager().query(
        'UPDATE policy_r SET options = ?, negate = ?, time_start = ?, time_end = ?, fw_apply_to = ? WHERE id = ?',
        [options, negate, timeStart, timeEnd, sourceCluster?.backup.id ?? null, ruleId],
      );
      for (const [index, iface] of interfaces.entries()) {
        await manager().query(
          'INSERT INTO policy_r__interface (rule, interface, position, position_order) VALUES (?, ?, ?, 1)',
          [ruleId, iface.id, [positions.in, positions.out][index]],
        );
      }
      const originalObjects = await manager().getRepository(IPObj).findBy({
        fwCloudId: sourceCloud.id,
      });
      const originalGroups = await manager().getRepository(IPObjGroup).findBy({
        fwCloudId: sourceCloud.id,
      });
      const originalMembers = await members(addressGroup.id);
      const profile = await capture(kind, sourceCluster?.cluster.id ?? source.id);
      const model = JSON.parse(JSON.stringify(loadReplicationProfileModel(profile)));
      expect(model.provision.rules).to.have.length(2);
      expect(model.policyStructure.rules).to.deep.eq(model.provision.rules);
      expect(model.objectReferences).to.have.length(2);
      for (const [group, objects, objectType] of [
        [addressGroup, addresses, 'group'],
        [serviceGroup, services, 'serviceGroup'],
      ] as const) {
        const reference = model.objectReferences.find((item) => item.objectType === objectType);
        expect(reference).to.include({ sourceName: group.name, sourceObjectId: group.id });
        expect(reference.snapshot).to.include({
          name: group.name,
          type: group.type,
          comment: group.comment,
        });
        expect(reference.snapshot.members).to.have.length(objects.length);
        for (const object of objects) {
          const member = reference.snapshot.members.find((item) => item.name === object.name);
          expect(member).to.include({ type: object.ipObjTypeId, name: object.name });
          const fields =
            object.ipObjTypeId === 6
              ? ['range_start', 'range_end', 'ip_version']
              : object.ipObjTypeId === 5 || object.ipObjTypeId === 7
                ? ['address', 'netmask', 'ip_version']
                : [
                    'protocol',
                    'source_port_start',
                    'source_port_end',
                    'destination_port_start',
                    'destination_port_end',
                  ];
          for (const field of fields)
            expect(member[field], `${object.name}.${field}`).to.eq(object[field]);
        }
        for (const rule of model.provision.rules) {
          const fields = objectType === 'group' ? ['source', 'destination'] : ['services'];
          for (const field of fields) {
            expect(rule[field]).to.deep.eq([
              { kind: 'external', referenceId: reference.referenceId },
            ]);
          }
        }
        expect(reference.locations).to.have.length(objectType === 'group' ? 4 : 2);
      }
      expect(model.provision.rules[0]).to.include({
        options,
        negate,
        inRole: 'lan0',
        outRole: 'wan0',
        time_start: timeStart.toISOString(),
        time_end: timeEnd.toISOString(),
        ...(sourceCluster ? { nodeRole: 'backup' } : {}),
      });
      writeReplicationProfileModel(profile, model);
      expect(loadReplicationProfileModel(profile)).to.deep.eq(model);
      const detail = await request(app.express)
        .get(profileUrl(profile, sourceCloud.id))
        .set('Cookie', [attachSession(sessionId)])
        .expect(200);
      const { objectReferences: detailReferences, ...detailBlocks } = detail.body.data.model;
      const { objectReferences: savedReferences, ...savedBlocks } = model;
      expect(detailBlocks).to.deep.eq(savedBlocks);
      expect(detailReferences).to.have.length(savedReferences.length);
      for (const reference of savedReferences) {
        // API details also expose live resolution status alongside the stored definition.
        expect(
          detailReferences.find((item) => item.referenceId === reference.referenceId),
        ).to.deep.include(reference);
      }
      const file = resolveReplicationProfileTemplatePath(profile);
      const jsonBeforeApply = fs.readFileSync(file, 'utf8');
      expect(
        await manager().query(
          'SELECT id, name, address, netmask, fwcloud FROM ipobj WHERE address = ? AND type = 7 AND (fwcloud IS NULL OR fwcloud = ?)',
          [addresses[0].address, destinationCloud.id],
        ),
      ).to.deep.eq([]);
      const applied = await request(app.express)
        .post(`${profileUrl(profile)}/apply`)
        .set('Cookie', [attachSession(sessionId)])
        .send({
          target: { kind, id: destinationCluster?.cluster.id ?? destination.id },
          mode: 'merge',
          ...(destinationCluster
            ? { nodeRoleMapping: { master: destination.id, backup: destinationCluster.backup.id } }
            : {}),
        })
        .expect((response) => {
          expect(
            response.status,
            JSON.stringify(response.body.data?.errors ?? response.body),
          ).to.eq(200);
        });
      expect(applied.body.data.applied).to.eq(true);
      expect(applied.body.data.errors).to.deep.eq([]);
      const copies = await manager()
        .getRepository(IPObj)
        .findBy({ fwCloudId: destinationCloud.id });
      const groups = await manager().getRepository(IPObjGroup).findBy({
        fwCloudId: destinationCloud.id,
      });
      expect(copies).to.have.length(addresses.length + services.length);
      expect(groups).to.have.length(2);
      for (const original of originalObjects) {
        const copy = copies.find((item) => item.name === original.name)!;
        const { id, fwCloudId, created_at, updated_at, ...configuration } = original;
        expect(copy.id).not.to.eq(id);
        expect(copy).to.include(configuration);
      }
      for (const original of [addressGroup, serviceGroup]) {
        const group = groups.find((item) => item.name === original.name)!;
        expect(group.id).not.to.eq(original.id);
        expect(group).to.include({ type: original.type, comment: original.comment });
        const originalNames = (await members(original.id)).map((item) => item.name);
        const recreatedMembers = await members(group.id);
        expect(recreatedMembers.map((item) => item.name)).to.deep.eq(originalNames);
        expect(recreatedMembers.every((item) => item.fwcloud === destinationCloud.id)).to.eq(true);
      }
      const rules = await manager().query(
        'SELECT * FROM policy_r WHERE firewall = ? AND special = 0 ORDER BY rule_order',
        [destination.id],
      );
      expect(rules).to.have.length(2);
      expect(rules[0]).to.include({
        action: 1,
        options,
        negate,
        fw_apply_to: destinationCluster?.backup.id ?? null,
      });
      expect(rules[0].time_start).to.deep.eq(timeStart);
      expect(rules[0].time_end).to.deep.eq(timeEnd);
      for (const rule of rules) {
        const references = await manager().query(
          'SELECT position, ipobj_g FROM policy_r__ipobj WHERE rule = ? ORDER BY position',
          [rule.id],
        );
        expect(references).to.deep.eq([
          { position: positions.source, ipobj_g: groups.find((item) => item.type === 20)!.id },
          { position: positions.destination, ipobj_g: groups.find((item) => item.type === 20)!.id },
          { position: positions.service, ipobj_g: groups.find((item) => item.type === 21)!.id },
        ]);
      }
      const interfaceRefs = await manager().query(
        'SELECT R.position, I.name, I.firewall FROM policy_r__interface R INNER JOIN interface I ON I.id = R.interface WHERE R.rule = ? ORDER BY R.position',
        [rules[0].id],
      );
      expect(interfaceRefs).to.deep.eq([
        { position: positions.in, name: 'lan0', firewall: destination.id },
        { position: positions.out, name: 'wan0', firewall: destination.id },
      ]);
      // Compare the expanded address and port expressions emitted for the actual policies.
      const expressions = (value: unknown) =>
        JSON.stringify(value).match(/(?:\d{1,3}\.){3}\d{1,3}(?:\/\d+)?|--(?:s|d)port [\d:]+/g) ??
        [];
      const compile = async (firewall: Firewall) =>
        PolicyCompiler.compile(
          'IPTables',
          await PolicyRule.getPolicyData(
            'compiler',
            db.getQuery(),
            firewall.fwCloudId,
            firewall.id,
            3,
            null,
            null,
          ),
        );
      const originalPolicy = await compile(source);
      const recreatedPolicy = await compile(destination);
      expect(recreatedPolicy).to.have.length(originalPolicy.length);
      for (const rule of recreatedPolicy) {
        const original = originalPolicy.find((item) => item.comment === rule.comment)!;
        expect(expressions(rule.cs)).to.deep.eq(expressions(original.cs));
        expect(expressions(rule.cs)).not.to.be.empty;
      }
      expect(await manager().getRepository(IPObj).findBy({ fwCloudId: sourceCloud.id })).to.deep.eq(
        originalObjects,
      );
      expect(
        await manager().getRepository(IPObjGroup).findBy({ fwCloudId: sourceCloud.id }),
      ).to.deep.eq(originalGroups);
      expect(await members(addressGroup.id)).to.deep.eq(originalMembers);
      expect(fs.readFileSync(file, 'utf8')).to.eq(jsonBeforeApply);
    });
  }

  it('should reuse equivalent destination groups and their members once for every rule reference', async () => {
    const { addresses, services, addressGroup, serviceGroup } = await createGroups();
    await addRule(1, addressGroup, serviceGroup);
    await addRule(2, addressGroup, serviceGroup);
    const profile = await capture();
    const copyObjects = async (objects: IPObj[]) => {
      const result: IPObj[] = [];
      for (const original of objects) {
        const { id, created_at, updated_at, ...data } = original;
        result.push(
          await manager()
            .getRepository(IPObj)
            .save({ ...data, fwCloudId: destinationCloud.id }),
        );
      }
      return result;
    };
    const existingAddressGroup = await createGroup(
      addressGroup.name,
      20,
      await copyObjects(addresses),
      destinationCloud.id,
    );
    const existingServiceGroup = await createGroup(
      serviceGroup.name,
      21,
      await copyObjects(services),
      destinationCloud.id,
    );
    await request(app.express)
      .post(`${profileUrl(profile)}/apply`)
      .set('Cookie', [attachSession(sessionId)])
      .send({ target: { kind: 'firewall', id: destination.id }, mode: 'merge' })
      .expect(200);
    expect(await manager().getRepository(IPObj).countBy({ fwCloudId: destinationCloud.id })).to.eq(
      5,
    );
    expect(
      await manager().getRepository(IPObjGroup).countBy({ fwCloudId: destinationCloud.id }),
    ).to.eq(2);
    const refs = await manager().query(
      'SELECT O.position, O.ipobj_g FROM policy_r__ipobj O INNER JOIN policy_r R ON R.id = O.rule WHERE R.firewall = ? ORDER BY R.rule_order, O.position',
      [destination.id],
    );
    expect(refs).to.deep.eq(
      [1, 2].flatMap(() => [
        { position: positions.source, ipobj_g: existingAddressGroup.id },
        { position: positions.destination, ipobj_g: existingAddressGroup.id },
        { position: positions.service, ipobj_g: existingServiceGroup.id },
      ]),
    );
  });

  it('should reject same-name destination groups with different membership before creating objects or policy', async () => {
    const { addressGroup, serviceGroup } = await createGroups();
    await addRule(1, addressGroup, serviceGroup);
    const profile = await capture();
    const incompatible = await createGroup(addressGroup.name, 20, [], destinationCloud.id);
    const incompatibleBefore = await manager()
      .getRepository(IPObjGroup)
      .findOneByOrFail({ id: incompatible.id });
    const response = await request(app.express)
      .post(`${profileUrl(profile)}/apply`)
      .set('Cookie', [attachSession(sessionId)])
      .send({ target: { kind: 'firewall', id: destination.id }, mode: 'merge' })
      .expect(422);
    expect(JSON.stringify(response.body)).to.include(addressGroup.name);
    expect(JSON.stringify(response.body)).to.include('conflict');
    expect(await manager().getRepository(IPObj).countBy({ fwCloudId: destinationCloud.id })).to.eq(
      0,
    );
    expect(
      await manager().getRepository(IPObjGroup).findBy({ fwCloudId: destinationCloud.id }),
    ).to.deep.eq([incompatibleBefore]);
    expect(await members(incompatible.id)).to.deep.eq([]);
    expect(await manager().getRepository(PolicyRule).countBy({ firewallId: destination.id })).to.eq(
      0,
    );
  });
});
