import * as fs from 'fs';
import request = require('supertest');
import { Application } from '../../../../src/Application';
import db from '../../../../src/database/database-manager';
import { Firewall } from '../../../../src/models/firewall/Firewall';
import { FwCloud } from '../../../../src/models/fwcloud/FwCloud';
import { IPObj } from '../../../../src/models/ipobj/IPObj';
import { IPObjGroup } from '../../../../src/models/ipobj/IPObjGroup';
import { PolicyRule } from '../../../../src/models/policy/PolicyRule';
import {
  PROFILE_REFERENCE_OBJECT_TYPES,
  ProfileReferenceObjectType,
} from '../../../../src/models/replication-profile/replication-profile-object-reference';
import { ReplicationProfile } from '../../../../src/models/replication-profile/replication-profile.model';
import {
  loadReplicationProfileModel,
  resolveReplicationProfileTemplatePath,
} from '../../../../src/models/replication-profile/replication-profile-template';
import { User } from '../../../../src/models/user/User';
import { describeName, expect, testSuite } from '../../../mocha/global-setup';
import { makeCustomReplicationProfilePayload } from '../../../utils/replication-profile-fixtures';
import { attachSession, createUser, generateSession } from '../../../utils/utils';

describe(describeName('Replication profile external object automatic recreation E2E Tests'), () => {
  let app: Application;
  let user: User;
  let sessionId: string;
  let fwCloud: FwCloud;
  let target: Firewall;
  let prefix: string;
  let createdProfiles: ReplicationProfile[];

  const usage = (referenceId = 'selected-object') => ({ kind: 'external', referenceId });
  const isService = (objectType: ProfileReferenceObjectType) =>
    ['tcp', 'udp', 'icmp', 'ipProtocol', 'serviceGroup'].includes(objectType);
  const modelUsing = (objectType: ProfileReferenceObjectType, sourceObjectId: number) => ({
    compatibility: { targetKinds: ['firewall'] },
    objectReferences: [{ referenceId: 'selected-object', objectType, sourceObjectId }],
    provision: {
      interfaces: [],
      rules: [
        {
          chain: 'forward',
          action: 'accept',
          [isService(objectType) ? 'service' : 'source']: [usage()],
          comment: 'First external object usage',
        },
        {
          chain: 'forward',
          action: 'accept',
          [isService(objectType) ? 'service' : 'destination']: [usage()],
          comment: 'Second external object usage',
        },
      ],
    },
  });

  const profileUrl = (profile: ReplicationProfile, fwCloudId = fwCloud.id) =>
    `/fwclouds/${fwCloudId}/profiles/${profile.code}/${profile.version}`;
  const applyPayload = (firewall = target, mode = 'merge') => ({
    target: { kind: 'firewall', id: firewall.id },
    mode,
  });
  const objectsNamed = (name: string, fwCloudId = fwCloud.id) =>
    db.getSource().manager.getRepository(IPObj).findBy({ name, fwCloudId });
  const ruleReferences = async (firewallId = target.id, group = false): Promise<number[]> => {
    const rows = await db.getSource().query(
      `SELECT O.${group ? 'ipobj_g' : 'ipobj'} AS object_id FROM policy_r__ipobj O
       INNER JOIN policy_r R ON R.id = O.rule
       WHERE R.firewall = ? ORDER BY O.id_pi`,
      [firewallId],
    );
    return rows.map((row) => Number(row.object_id)).filter((id) => id > 0);
  };

  beforeEach(async () => {
    app = testSuite.app;
    prefix = `rp-objects-e2e-${Date.now()}-${Math.round(Math.random() * 100000)}-`;
    createdProfiles = [];
    user = await createUser({ role: 1 });
    sessionId = generateSession(user);
    fwCloud = await db
      .getSource()
      .manager.getRepository(FwCloud)
      .save({
        name: `${prefix}cloud`,
        locked: false,
        locked_by: null,
      });
    target = await db
      .getSource()
      .manager.getRepository(Firewall)
      .save({
        name: `${prefix}target`,
        fwCloudId: fwCloud.id,
      });
  });

  afterEach(async () => {
    for (const profile of createdProfiles) {
      await db.getSource().manager.getRepository(ReplicationProfile).delete(profile.id);
    }
  });

  const createObject = (
    objectType: ProfileReferenceObjectType,
    configuration: Record<string, unknown>,
  ): Promise<IPObj> =>
    db
      .getSource()
      .manager.getRepository(IPObj)
      .save({
        name: `${prefix}${objectType}`,
        ipObjTypeId: PROFILE_REFERENCE_OBJECT_TYPES[objectType],
        fwCloudId: fwCloud.id,
        ...configuration,
      });

  async function saveProfile(model: Record<string, unknown>): Promise<ReplicationProfile> {
    const response = await request(app.express)
      .post(`/fwclouds/${fwCloud.id}/profiles`)
      .set('Cookie', [attachSession(sessionId)])
      .send(makeCustomReplicationProfilePayload(prefix, { code: `${prefix}profile`, model }))
      .expect(201);
    const profile = await db
      .getSource()
      .manager.getRepository(ReplicationProfile)
      .findOneByOrFail({ id: response.body.data.id });
    createdProfiles.push(profile);
    return profile;
  }

  async function createDestinationTarget(): Promise<Firewall> {
    const destination = await db
      .getSource()
      .manager.getRepository(FwCloud)
      .save({
        name: `${prefix}destination`,
        locked: false,
        locked_by: null,
      });
    user = await createUser({ role: 0 });
    user.fwClouds = [fwCloud, destination];
    await db.getSource().manager.getRepository(User).save(user);
    sessionId = generateSession(user);

    return db
      .getSource()
      .manager.getRepository(Firewall)
      .save({
        name: `${prefix}destination-target`,
        fwCloudId: destination.id,
      });
  }

  const valueObjects: {
    objectType: ProfileReferenceObjectType;
    configuration: Record<string, unknown>;
  }[] = [
    {
      objectType: 'network',
      configuration: {
        address: '198.51.100.0',
        netmask: '/24',
        ip_version: 4,
        comment: 'An independently created network',
      },
    },
    {
      objectType: 'range',
      configuration: {
        range_start: '198.51.100.10',
        range_end: '198.51.100.30',
        ip_version: 4,
        comment: 'An independently created range',
      },
    },
    {
      objectType: 'tcp',
      configuration: {
        protocol: 6,
        source_port_start: 1024,
        source_port_end: 65000,
        destination_port_start: 8443,
        destination_port_end: 8444,
        tcp_flags_mask: 2,
        tcp_flags_settings: 2,
        options: 0,
        diff_serv: 8,
        comment: 'An independently created TCP service',
      },
    },
    {
      objectType: 'udp',
      configuration: {
        protocol: 17,
        source_port_start: 0,
        source_port_end: 65535,
        destination_port_start: 5353,
        destination_port_end: 5353,
        comment: 'An independently created UDP service',
      },
    },
  ];

  for (const { objectType, configuration } of valueObjects) {
    it(`should preserve and automatically recreate a deleted external ${objectType} object once`, async () => {
      const object = await createObject(objectType, configuration);
      const profile = await saveProfile(modelUsing(objectType, object.id));
      const file = resolveReplicationProfileTemplatePath(profile);
      const template = fs.readFileSync(file, 'utf8');
      const stored = loadReplicationProfileModel(profile) as Record<string, any>;

      expect(stored.objectReferences[0].snapshot).to.include(configuration);
      await createObject('address', {
        name: `${prefix}later-object`,
        address: '192.0.2.250',
        netmask: '/32',
        ip_version: 4,
      });
      await db.getSource().manager.getRepository(IPObj).delete(object.id);

      const preview = await request(app.express)
        .post(`${profileUrl(profile)}/apply`)
        .set('Cookie', [attachSession(sessionId)])
        .send(applyPayload(target, 'dry_run'))
        .expect(200);
      expect(preview.body.data.applied).to.eq(false);
      expect(preview.body.data.errors).to.deep.eq([]);
      expect(await objectsNamed(object.name)).to.be.empty;
      expect(await ruleReferences()).to.be.empty;

      const applied = await request(app.express)
        .post(`${profileUrl(profile)}/apply`)
        .set('Cookie', [attachSession(sessionId)])
        .send(applyPayload())
        .expect(200);
      const [recreated] = await objectsNamed(object.name);

      expect(applied.body.data.applied).to.eq(true);
      expect(recreated.id).to.be.greaterThan(0);
      expect(recreated.id).not.to.eq(object.id);
      expect(recreated).to.include({
        ...configuration,
        ...(typeof configuration.options === 'number'
          ? { options: String(configuration.options) }
          : {}),
      });
      expect(recreated.ipObjTypeId).to.eq(PROFILE_REFERENCE_OBJECT_TYPES[objectType]);
      expect(await ruleReferences()).to.deep.eq([recreated.id, recreated.id]);
      expect(applied.body.data.objectReferences[0].currentObject.id).to.eq(recreated.id);

      await request(app.express)
        .post(`${profileUrl(profile)}/apply`)
        .set('Cookie', [attachSession(sessionId)])
        .send(applyPayload())
        .expect(200);
      expect(await objectsNamed(object.name)).to.have.length(1);
      expect(fs.readFileSync(file, 'utf8')).to.eq(template);
    });
  }

  for (const { objectType, configuration } of valueObjects.filter(({ objectType }) =>
    ['range', 'tcp'].includes(objectType),
  )) {
    it(`should reuse a compatible destination ${objectType} with a different comment without changing either object`, async () => {
      const destinationTarget = await createDestinationTarget();
      const object = await createObject(objectType, configuration);
      const profile = await saveProfile(modelUsing(objectType, object.id));
      const file = resolveReplicationProfileTemplatePath(profile);
      const template = fs.readFileSync(file, 'utf8');
      const existing = await createObject(objectType, {
        ...configuration,
        name: object.name,
        fwCloudId: destinationTarget.fwCloudId,
        comment: 'The destination keeps its own description',
      });
      const objectRepository = db.getSource().manager.getRepository(IPObj);
      const originalSource = await objectRepository.findOneByOrFail({ id: object.id });
      const originalDestination = await objectRepository.findOneByOrFail({ id: existing.id });
      expect(existing.id).not.to.eq(object.id);

      const preview = await request(app.express)
        .post(`${profileUrl(profile, destinationTarget.fwCloudId)}/apply`)
        .set('Cookie', [attachSession(sessionId)])
        .send(applyPayload(destinationTarget, 'dry_run'))
        .expect(200);
      expect(preview.body.data.applied).to.eq(false);
      expect(preview.body.data.errors).to.deep.eq([]);
      expect(preview.body.data.objectReferences[0].currentObject.id).to.eq(existing.id);
      expect(await ruleReferences(destinationTarget.id)).to.be.empty;
      expect(await objectsNamed(object.name, destinationTarget.fwCloudId)).to.deep.eq([
        originalDestination,
      ]);

      for (let application = 0; application < 2; application++) {
        const applied = await request(app.express)
          .post(`${profileUrl(profile, destinationTarget.fwCloudId)}/apply`)
          .set('Cookie', [attachSession(sessionId)])
          .send(applyPayload(destinationTarget))
          .expect(200);
        expect(applied.body.data.applied).to.eq(true);
        expect(applied.body.data.errors).to.deep.eq([]);
        expect(applied.body.data.objectReferences[0].currentObject.id).to.eq(existing.id);
        expect(await ruleReferences(destinationTarget.id)).to.deep.eq([existing.id, existing.id]);
        expect(await objectsNamed(object.name, destinationTarget.fwCloudId)).to.deep.eq([
          originalDestination,
        ]);
        expect(await objectRepository.countBy({ fwCloudId: destinationTarget.fwCloudId })).to.eq(1);
      }

      expect(await objectRepository.findOneByOrFail({ id: object.id })).to.deep.eq(originalSource);
      expect(fs.readFileSync(file, 'utf8')).to.eq(template);
    });
  }

  it('should reuse a compatible destination group whose descriptions and member order differ', async () => {
    const destinationTarget = await createDestinationTarget();
    const members = await Promise.all(
      ['192.0.2.10', '192.0.2.20'].map((address, index) =>
        createObject('address', {
          name: `${prefix}group-member-${index}`,
          address,
          netmask: '/32',
          ip_version: 4,
          comment: `Source member ${index}`,
        }),
      ),
    );
    const objectRepository = db.getSource().manager.getRepository(IPObj);
    const groupRepository = db.getSource().manager.getRepository(IPObjGroup);
    const group = await groupRepository.save({
      name: `${prefix}group`,
      type: PROFILE_REFERENCE_OBJECT_TYPES.group,
      comment: 'Source group description',
      fwCloudId: fwCloud.id,
    });
    await db
      .getSource()
      .query('INSERT INTO ipobj__ipobjg (ipobj, ipobj_g) VALUES (?, ?), (?, ?)', [
        members[0].id,
        group.id,
        members[1].id,
        group.id,
      ]);
    const profile = await saveProfile(modelUsing('group', group.id));
    const file = resolveReplicationProfileTemplatePath(profile);
    const template = fs.readFileSync(file, 'utf8');
    const stored = loadReplicationProfileModel(profile) as Record<string, any>;
    expect(stored.objectReferences[0].snapshot.members.map((member) => member.id)).to.deep.eq(
      members.map((member) => member.id),
    );
    const existingMembers = await Promise.all(
      members.map((member, index) =>
        createObject('address', {
          name: member.name,
          address: member.address,
          netmask: member.netmask,
          ip_version: member.ip_version,
          fwCloudId: destinationTarget.fwCloudId,
          comment: `Destination member ${index}`,
        }),
      ),
    );
    const existingGroup = await groupRepository.save({
      name: group.name,
      type: group.type,
      comment: 'Destination group description',
      fwCloudId: destinationTarget.fwCloudId,
    });
    await db
      .getSource()
      .query('INSERT INTO ipobj__ipobjg (ipobj, ipobj_g) VALUES (?, ?), (?, ?)', [
        existingMembers[1].id,
        existingGroup.id,
        existingMembers[0].id,
        existingGroup.id,
      ]);
    const originalGroup = await groupRepository.findOneByOrFail({ id: group.id });
    const originalExistingGroup = await groupRepository.findOneByOrFail({ id: existingGroup.id });
    const originalMembers = await objectRepository.findBy({ fwCloudId: fwCloud.id });
    const originalExistingMembers = await objectRepository.findBy({
      fwCloudId: destinationTarget.fwCloudId,
    });
    const groupMembers = (groupId: number) =>
      db
        .getSource()
        .query('SELECT ipobj FROM ipobj__ipobjg WHERE ipobj_g = ? ORDER BY id_gi', [groupId]);
    const originalMembership = await groupMembers(group.id);
    const originalExistingMembership = await groupMembers(existingGroup.id);
    expect(existingGroup.id).not.to.eq(group.id);
    expect(originalExistingMembership.map((member) => Number(member.ipobj))).to.deep.eq([
      existingMembers[1].id,
      existingMembers[0].id,
    ]);

    const preview = await request(app.express)
      .post(`${profileUrl(profile, destinationTarget.fwCloudId)}/apply`)
      .set('Cookie', [attachSession(sessionId)])
      .send(applyPayload(destinationTarget, 'dry_run'))
      .expect(200);
    expect(preview.body.data.applied).to.eq(false);
    expect(preview.body.data.errors).to.deep.eq([]);
    expect(preview.body.data.objectReferences[0].currentObject.id).to.eq(existingGroup.id);
    expect(await ruleReferences(destinationTarget.id, true)).to.be.empty;

    for (let application = 0; application < 2; application++) {
      const applied = await request(app.express)
        .post(`${profileUrl(profile, destinationTarget.fwCloudId)}/apply`)
        .set('Cookie', [attachSession(sessionId)])
        .send(applyPayload(destinationTarget))
        .expect(200);
      expect(applied.body.data.applied).to.eq(true);
      expect(applied.body.data.errors).to.deep.eq([]);
      expect(applied.body.data.objectReferences[0].currentObject.id).to.eq(existingGroup.id);
      expect(await ruleReferences(destinationTarget.id, true)).to.deep.eq([
        existingGroup.id,
        existingGroup.id,
      ]);
      expect(await groupRepository.countBy({ fwCloudId: destinationTarget.fwCloudId })).to.eq(1);
      expect(await objectRepository.findBy({ fwCloudId: destinationTarget.fwCloudId })).to.deep.eq(
        originalExistingMembers,
      );
      expect(await groupRepository.findOneByOrFail({ id: existingGroup.id })).to.deep.eq(
        originalExistingGroup,
      );
      expect(await groupMembers(existingGroup.id)).to.deep.eq(originalExistingMembership);
    }

    expect(await groupRepository.findOneByOrFail({ id: group.id })).to.deep.eq(originalGroup);
    expect(await objectRepository.findBy({ fwCloudId: fwCloud.id })).to.deep.eq(originalMembers);
    expect(await groupMembers(group.id)).to.deep.eq(originalMembership);
    expect(fs.readFileSync(file, 'utf8')).to.eq(template);
  });

  for (const objectType of ['group', 'serviceGroup'] as const) {
    it(`should recreate a deleted ${objectType} and its deleted dependency with the saved relationship`, async () => {
      const memberType = objectType === 'group' ? 'address' : 'tcp';
      const configuration =
        memberType === 'address'
          ? { address: '203.0.113.7', netmask: '/32', ip_version: 4 }
          : {
              protocol: 6,
              source_port_start: 0,
              source_port_end: 65535,
              destination_port_start: 8443,
              destination_port_end: 8443,
            };
      const member = await createObject(memberType, configuration);
      const group = await db
        .getSource()
        .manager.getRepository(IPObjGroup)
        .save({
          name: `${prefix}${objectType}`,
          type: PROFILE_REFERENCE_OBJECT_TYPES[objectType],
          comment: 'An external group with an external dependency',
          fwCloudId: fwCloud.id,
        });
      await db
        .getSource()
        .query('INSERT INTO ipobj__ipobjg (ipobj, ipobj_g) VALUES (?, ?)', [member.id, group.id]);
      const model = modelUsing(objectType, group.id);
      model.objectReferences.push({
        referenceId: 'group-member',
        objectType: memberType,
        sourceObjectId: member.id,
      });
      model.provision.rules.push({
        chain: 'forward',
        action: 'accept',
        [isService(memberType) ? 'service' : 'source']: [usage('group-member')],
        comment: 'The group dependency is also used directly',
      });
      const profile = await saveProfile(model);
      const file = resolveReplicationProfileTemplatePath(profile);
      const template = fs.readFileSync(file, 'utf8');
      const stored = loadReplicationProfileModel(profile) as Record<string, any>;
      expect(stored.objectReferences[0].snapshot.members).to.have.length(1);
      expect(stored.objectReferences[0].snapshot.members[0]).to.include(configuration);

      await createObject('address', {
        name: `${prefix}later-object`,
        address: '192.0.2.250',
        netmask: '/32',
        ip_version: 4,
      });
      await db
        .getSource()
        .manager.getRepository(IPObjGroup)
        .save({
          name: `${prefix}later-group`,
          type: PROFILE_REFERENCE_OBJECT_TYPES[objectType],
          fwCloudId: fwCloud.id,
        });

      await db.getSource().query('DELETE FROM ipobj__ipobjg WHERE ipobj_g = ?', [group.id]);
      await db.getSource().manager.getRepository(IPObjGroup).delete(group.id);
      await db.getSource().manager.getRepository(IPObj).delete(member.id);

      const preview = await request(app.express)
        .post(`${profileUrl(profile)}/apply`)
        .set('Cookie', [attachSession(sessionId)])
        .send(applyPayload(target, 'dry_run'))
        .expect(200);
      expect(preview.body.data.errors).to.deep.eq([]);
      expect(await objectsNamed(member.name)).to.be.empty;
      expect(
        await db.getSource().manager.getRepository(IPObjGroup).countBy({
          name: group.name,
          fwCloudId: fwCloud.id,
        }),
      ).to.eq(0);

      const applied = await request(app.express)
        .post(`${profileUrl(profile)}/apply`)
        .set('Cookie', [attachSession(sessionId)])
        .send(applyPayload())
        .expect(200);
      const recreatedGroup = await db
        .getSource()
        .manager.getRepository(IPObjGroup)
        .findOneByOrFail({
          name: group.name,
          fwCloudId: fwCloud.id,
        });
      const [recreatedMember] = await objectsNamed(member.name);
      const members = await db
        .getSource()
        .query('SELECT ipobj FROM ipobj__ipobjg WHERE ipobj_g = ?', [recreatedGroup.id]);

      expect(applied.body.data.applied).to.eq(true);
      expect(recreatedGroup.id).not.to.eq(group.id);
      expect(recreatedGroup.comment).to.eq(group.comment);
      expect(recreatedMember.id).not.to.eq(member.id);
      expect(recreatedMember).to.include(configuration);
      expect(await objectsNamed(member.name)).to.have.length(1);
      expect(members.map((row) => Number(row.ipobj))).to.deep.eq([recreatedMember.id]);
      expect(await ruleReferences()).to.deep.eq([recreatedMember.id]);
      expect(await ruleReferences(target.id, true)).to.deep.eq([
        recreatedGroup.id,
        recreatedGroup.id,
      ]);
      expect(fs.readFileSync(file, 'utf8')).to.eq(template);
    });
  }

  it('should create no external object when loading, validating, previewing or awaiting application confirmation', async () => {
    const object = await createObject('address', {
      address: '192.0.2.55',
      netmask: '/32',
      ip_version: 4,
    });
    const profile = await saveProfile(modelUsing('address', object.id));
    const stored = loadReplicationProfileModel(profile);
    await db.getSource().manager.getRepository(IPObj).delete(object.id);

    await request(app.express)
      .get(profileUrl(profile))
      .set('Cookie', [attachSession(sessionId)])
      .expect(200);
    const validated = await request(app.express)
      .post(`/fwclouds/${fwCloud.id}/profiles/validate`)
      .set('Cookie', [attachSession(sessionId)])
      .send(makeCustomReplicationProfilePayload(prefix, { model: stored }))
      .expect(200);
    expect(validated.body.data.valid).to.eq(true);
    await request(app.express)
      .post(`${profileUrl(profile)}/apply`)
      .set('Cookie', [attachSession(sessionId)])
      .send(applyPayload(target, 'dry_run'))
      .expect(200);
    expect(await objectsNamed(object.name)).to.be.empty;

    const previousConfirmationTokenSetting = app.config.get('confirmation_token');
    app.config.set('confirmation_token', true);
    try {
      const confirmation = await request(app.express)
        .post(`${profileUrl(profile)}/apply`)
        .set('Cookie', [attachSession(sessionId)])
        .send(applyPayload())
        .expect(403);
      expect(confirmation.body.fwc_confirm_token).to.be.a('string');
      expect(await objectsNamed(object.name)).to.be.empty;
      expect(
        await db.getSource().manager.getRepository(PolicyRule).countBy({ firewallId: target.id }),
      ).to.eq(0);

      await request(app.express)
        .post(`${profileUrl(profile)}/apply`)
        .set('Cookie', [attachSession(sessionId)])
        .set('x-fwc-confirm-token', confirmation.body.fwc_confirm_token)
        .send(applyPayload())
        .expect(200);
      expect(await objectsNamed(object.name)).to.have.length(1);
    } finally {
      app.config.set('confirmation_token', previousConfirmationTokenSetting);
    }
  });

  it('should reuse the source object locally and recreate it in each destination FWCloud without modifying the source', async () => {
    user = await createUser({ role: 0 });
    user.fwClouds = [fwCloud];
    await db.getSource().manager.getRepository(User).save(user);
    sessionId = generateSession(user);
    const object = await createObject('address', {
      address: '192.0.2.75',
      netmask: '/32',
      ip_version: 4,
      comment: 'The original must remain unchanged',
    });
    const profile = await saveProfile(modelUsing('address', object.id));
    const file = resolveReplicationProfileTemplatePath(profile);
    const template = fs.readFileSync(file, 'utf8');
    const original = await db
      .getSource()
      .manager.getRepository(IPObj)
      .findOneByOrFail({ id: object.id });

    await db
      .getSource()
      .query('UPDATE fwcloud SET locked = 0, locked_by = NULL WHERE id = ?', [fwCloud.id]);

    await request(app.express)
      .post(`${profileUrl(profile)}/apply`)
      .set('Cookie', [attachSession(sessionId)])
      .send(applyPayload())
      .expect(200);
    expect(await ruleReferences()).to.deep.eq([object.id, object.id]);
    expect(await objectsNamed(object.name)).to.have.length(1);

    for (let index = 0; index < 2; index++) {
      const destination = await db
        .getSource()
        .manager.getRepository(FwCloud)
        .save({
          name: `${prefix}destination-${index}`,
          locked: false,
          locked_by: null,
        });
      user.fwClouds.push(destination);
      await db.getSource().manager.getRepository(User).save(user);
      sessionId = generateSession(user);
      const destinationTarget = await db
        .getSource()
        .manager.getRepository(Firewall)
        .save({
          name: `${prefix}destination-target-${index}`,
          fwCloudId: destination.id,
        });
      const loaded = await request(app.express)
        .get(profileUrl(profile, destination.id))
        .set('Cookie', [attachSession(sessionId)])
        .expect(200);
      expect(loaded.body.data.model.objectReferences[0].resolved).to.eq(false);

      const applied = await request(app.express)
        .post(`${profileUrl(profile, destination.id)}/apply`)
        .set('Cookie', [attachSession(sessionId)])
        .send(applyPayload(destinationTarget))
        .expect(200);
      const [recreated] = await objectsNamed(object.name, destination.id);
      expect(applied.body.data.applied).to.eq(true);
      expect(recreated.id).not.to.eq(object.id);
      expect(recreated).to.include({ address: object.address, fwCloudId: destination.id });
      expect(await ruleReferences(destinationTarget.id)).to.deep.eq([recreated.id, recreated.id]);
    }

    expect(
      await db.getSource().manager.getRepository(IPObj).findOneByOrFail({ id: object.id }),
    ).to.deep.eq(original);
    expect(fs.readFileSync(file, 'utf8')).to.eq(template);
  });

  it('should return a controlled conflict before writing policy or replacing an incompatible object with the same name', async () => {
    const object = await createObject('address', {
      address: '192.0.2.90',
      netmask: '/32',
      ip_version: 4,
    });
    const profile = await saveProfile(modelUsing('address', object.id));
    await db.getSource().manager.getRepository(IPObj).delete(object.id);
    const conflicting = await createObject('address', {
      address: '192.0.2.99',
      netmask: '/32',
      ip_version: 4,
    });

    const response = await request(app.express)
      .post(`${profileUrl(profile)}/apply`)
      .set('Cookie', [attachSession(sessionId)])
      .send(applyPayload())
      .expect(422);
    expect(JSON.stringify(response.body)).to.include('selected-object');
    expect(await objectsNamed(object.name)).to.have.length(1);
    expect(
      await db.getSource().manager.getRepository(IPObj).findOneByOrFail({ id: conflicting.id }),
    ).to.include({ address: '192.0.2.99' });
    expect(await ruleReferences()).to.be.empty;
  });

  it('should identify an incomplete snapshot before recreating any missing object', async () => {
    const address = await createObject('address', {
      address: '192.0.2.40',
      netmask: '/32',
      ip_version: 4,
    });
    const range = await createObject('range', {
      range_start: '198.51.100.10',
      range_end: '198.51.100.30',
      ip_version: 4,
    });
    const model = modelUsing('address', address.id);
    model.objectReferences.push({
      referenceId: 'incomplete-range',
      objectType: 'range',
      sourceObjectId: range.id,
    });
    model.provision.rules.push({
      chain: 'forward',
      action: 'accept',
      source: [usage('incomplete-range')],
      comment: 'A range with a damaged saved snapshot',
    });
    const profile = await saveProfile(model);
    const stored = loadReplicationProfileModel(profile) as Record<string, any>;
    // Simulate damage in a persisted template, bypassing the normal save-time validation.
    delete stored.objectReferences[1].snapshot.range_end;
    fs.writeFileSync(resolveReplicationProfileTemplatePath(profile), JSON.stringify(stored));
    await db.getSource().manager.getRepository(IPObj).delete([address.id, range.id]);

    const response = await request(app.express)
      .post(`${profileUrl(profile)}/apply`)
      .set('Cookie', [attachSession(sessionId)])
      .send(applyPayload());

    expect(response.status).to.be.oneOf([422, 500]);
    expect(JSON.stringify(response.body)).to.include('incomplete-range');
    expect(await objectsNamed(address.name)).to.be.empty;
    expect(await objectsNamed(range.name)).to.be.empty;
    expect(await ruleReferences()).to.be.empty;
    expect(
      await db.getSource().manager.getRepository(PolicyRule).countBy({ firewallId: target.id }),
    ).to.eq(0);
  });
});
