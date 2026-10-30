import * as fs from 'fs';
import sinon from 'sinon';
import { describeName, expect, testSuite } from '../../../mocha/global-setup';
import { expectRejectedAs } from '../../../utils/assertions';
import { createUser } from '../../../utils/utils';
import { FwCloudFactory, FwCloudProduct } from '../../../utils/fwcloud-factory';
import db from '../../../../src/database/database-manager';
import { User } from '../../../../src/models/user/User';
import { Firewall } from '../../../../src/models/firewall/Firewall';
import { IPObj } from '../../../../src/models/ipobj/IPObj';
import { IPObjGroup } from '../../../../src/models/ipobj/IPObjGroup';
import { Interface } from '../../../../src/models/interface/Interface';
import { ReplicationProfile } from '../../../../src/models/replication-profile/replication-profile.model';
import { ReplicationProfileService } from '../../../../src/models/replication-profile/replication-profile.service';
import { ProfileApplicationService } from '../../../../src/models/replication-profile/profile-application.service';
import type {
  PolicyReplicationMode,
  PolicyReplicationResult,
} from '../../../../src/models/replication-profile/policy-replication.types';
import {
  ReplicationProfileValidationException,
  validateReplicationProfilePayload,
} from '../../../../src/models/replication-profile/replication-profile-validation.service';
import {
  getProfileObjectReferenceLocations,
  PROFILE_REFERENCE_OBJECT_TYPES,
  ProfileObjectReplacement,
  ProfileReferenceObjectType,
  ReplicationProfileObjectReference,
} from '../../../../src/models/replication-profile/replication-profile-object-reference';
import {
  captureProfileObjectReferences,
  resolveProfileObjectReferences,
} from '../../../../src/models/replication-profile/replication-profile-object-reference.service';
import {
  loadReplicationProfileModel,
  resolveReplicationProfileTemplatePath,
  writeReplicationProfileModel,
} from '../../../../src/models/replication-profile/replication-profile-template';

type Model = Record<string, any>;

const REFERENCE_ID = 'selected-object';
const SERVICE_TYPES: ProfileReferenceObjectType[] = [
  'ipProtocol',
  'tcp',
  'udp',
  'icmp',
  'serviceGroup',
];

const usage = (referenceId = REFERENCE_ID) => ({ kind: 'external', referenceId });

/** One object per type a replacement can describe: its data, and replacement data for it. */
const VALUE_OBJECTS: {
  objectType: ProfileReferenceObjectType;
  data: Record<string, unknown>;
  replacement: Record<string, unknown>;
  /** What the object created from that replacement holds. */
  created: Record<string, unknown>;
}[] = [
  {
    objectType: 'address',
    data: { ip_version: 4, address: '198.51.100.4', netmask: '/32' },
    replacement: { address: '203.0.113.7' },
    created: { ip_version: 4, address: '203.0.113.7', netmask: '/32' },
  },
  {
    objectType: 'network',
    data: { ip_version: 4, address: '198.51.100.0', netmask: '/24' },
    replacement: { address: '203.0.113.0', netmask: '/25' },
    created: { ip_version: 4, address: '203.0.113.0', netmask: '/25' },
  },
  {
    objectType: 'range',
    data: { ip_version: 4, range_start: '198.51.100.10', range_end: '198.51.100.20' },
    replacement: { range_start: '203.0.113.10', range_end: '203.0.113.20' },
    created: { ip_version: 4, range_start: '203.0.113.10', range_end: '203.0.113.20' },
  },
  {
    objectType: 'tcp',
    data: {
      protocol: 6,
      source_port_start: 1024,
      source_port_end: 65535,
      destination_port_start: 8000,
      destination_port_end: 8010,
      tcp_flags_mask: 2,
      tcp_flags_settings: 2,
    },
    replacement: {
      source_port_start: 0,
      source_port_end: 65535,
      destination_port_start: 8443,
      destination_port_end: 8443,
    },
    created: { protocol: 6, destination_port_start: 8443, destination_port_end: 8443 },
  },
  {
    objectType: 'udp',
    data: {
      protocol: 17,
      source_port_start: 0,
      source_port_end: 65535,
      destination_port_start: 53,
      destination_port_end: 53,
    },
    replacement: {
      source_port_start: 0,
      source_port_end: 65535,
      destination_port_start: 5353,
      destination_port_end: 5353,
    },
    created: { protocol: 17, destination_port_start: 5353, destination_port_end: 5353 },
  },
  {
    objectType: 'icmp',
    data: { protocol: 1, icmp_type: 8, icmp_code: -1 },
    replacement: { icmp_type: 0, icmp_code: -1 },
    created: { protocol: 1, icmp_type: 0, icmp_code: -1 },
  },
  {
    objectType: 'ipProtocol',
    data: { protocol: 253 },
    replacement: { protocol: 50 },
    created: { protocol: 50 },
  },
];

describe('Replication profile reference locations', () => {
  it('preserves traversal order for shared references in large templates without counting aliases twice', () => {
    const rules = Array.from({ length: 2048 }, () => ({
      source: [usage('shared-address')],
      services: [usage('shared-service'), usage('other-service'), usage('shared-service')],
    }));
    const structure = { rules };
    const model = { provision: structure, policyStructure: structure };
    const locations = getProfileObjectReferenceLocations(model);

    expect([...locations.keys()]).to.deep.eq(['shared-address', 'shared-service', 'other-service']);
    expect(locations.get('shared-service')).to.deep.eq(
      rules.flatMap((_, index) => [
        `model.provision.rules[${index}].services[0]`,
        `model.provision.rules[${index}].services[2]`,
      ]),
    );
    expect(locations.get('shared-address')).to.deep.eq(
      rules.map((_, index) => `model.provision.rules[${index}].source[0]`),
    );
    expect(locations.get('other-service')).to.deep.eq(
      rules.map((_, index) => `model.provision.rules[${index}].services[1]`),
    );
  });
});

describe(describeName('Replication profile external object references'), () => {
  let fwc: FwCloudProduct;
  let user: User;
  let target: Firewall;
  let profiles: ReplicationProfileService;
  let application: ProfileApplicationService;

  before(async () => {
    await testSuite.resetDatabaseData();
    profiles = await testSuite.app.getService<ReplicationProfileService>(
      ReplicationProfileService.name,
    );
    application = await testSuite.app.getService<ProfileApplicationService>(
      ProfileApplicationService.name,
    );
  });

  beforeEach(async () => {
    fwc = await new FwCloudFactory().make();
    // Profile codes are unique per owner, so each test gets its own.
    user = await createUser({ role: 1 });
    target = await db
      .getSource()
      .manager.getRepository(Firewall)
      .save({ name: 'external-objects-target', fwCloudId: fwc.fwcloud.id });
  });

  afterEach(() => sinon.restore());

  function createObject(
    objectType: ProfileReferenceObjectType,
    data: Record<string, unknown> = {},
    fwCloudId = fwc.fwcloud.id,
  ): Promise<IPObj> {
    return db
      .getSource()
      .manager.getRepository(IPObj)
      .save({
        name: objectType === 'dns' ? 'external.example.test' : `External ${objectType}`,
        ipObjTypeId: PROFILE_REFERENCE_OBJECT_TYPES[objectType],
        fwCloudId,
        ...data,
      });
  }

  async function createGroup(
    objectType: 'group' | 'serviceGroup',
    members: IPObj[],
    name = `External ${objectType}`,
  ): Promise<IPObjGroup> {
    const group = await db
      .getSource()
      .manager.getRepository(IPObjGroup)
      .save({ name, type: PROFILE_REFERENCE_OBJECT_TYPES[objectType], fwCloudId: fwc.fwcloud.id });

    for (const member of members) {
      await db
        .getSource()
        .query('INSERT INTO ipobj__ipobjg (ipobj, ipobj_g) VALUES (?, ?)', [member.id, group.id]);
    }

    return group;
  }

  /** Two forward rules using the same external object: in source and destination, or as service. */
  function twoRuleModel(objectType: ProfileReferenceObjectType, sourceObjectId?: number): Model {
    const isService = SERVICE_TYPES.includes(objectType);

    return {
      compatibility: { targetKinds: ['firewall'] },
      objectReferences: [{ referenceId: REFERENCE_ID, objectType, sourceObjectId }],
      provision: {
        interfaces: [{ role: 'lan', name: 'LAN' }],
        rules: [
          {
            chain: 'forward',
            action: 'accept',
            [isService ? 'service' : 'source']: [usage()],
            comment: 'First usage',
          },
          {
            chain: 'forward',
            action: 'accept',
            [isService ? 'service' : 'destination']: [usage()],
            comment: 'Second usage',
          },
        ],
      },
    };
  }

  function twoRuleLocations(objectType: ProfileReferenceObjectType): string[] {
    return SERVICE_TYPES.includes(objectType)
      ? ['model.provision.rules[0].service[0]', 'model.provision.rules[1].service[0]']
      : ['model.provision.rules[0].source[0]', 'model.provision.rules[1].destination[0]'];
  }

  function createProfile(model: Model): Promise<ReplicationProfile> {
    return profiles.createCustomProfile(
      { name: `External objects ${target.id}`, scope: 'fwcloud', model },
      { fwCloudId: fwc.fwcloud.id, userId: user.id },
    );
  }

  function storedReferences(profile: ReplicationProfile): ReplicationProfileObjectReference[] {
    return loadReplicationProfileModel(profile)
      .objectReferences as ReplicationProfileObjectReference[];
  }

  function apply(
    profile: ReplicationProfile,
    mode: PolicyReplicationMode = 'merge',
    objectReplacements?: Record<string, ProfileObjectReplacement>,
  ): Promise<PolicyReplicationResult> {
    return application.apply(
      { user },
      {
        fwCloudId: fwc.fwcloud.id,
        profileCode: profile.code,
        profileVersion: profile.version,
        replication: { target: { kind: 'firewall', id: target.id }, mode },
        objectReplacements,
      },
    );
  }

  /** ipobj (or group, as g<id>) of every object of the target's rules, in rule order. */
  async function ruleObjects(): Promise<(number | string)[]> {
    const rows = await db.getSource().query(
      `SELECT R.ipobj, R.ipobj_g FROM policy_r__ipobj R INNER JOIN policy_r P ON P.id = R.rule
         WHERE P.firewall = ? ORDER BY P.id, R.position, R.position_order`,
      [target.id],
    );

    return rows.map((row) => (row.ipobj_g > 0 ? `g${row.ipobj_g}` : row.ipobj));
  }

  async function objectsNamed(name: string): Promise<IPObj[]> {
    return db.getSource().manager.getRepository(IPObj).findBy({ name, fwCloudId: fwc.fwcloud.id });
  }

  /** Nothing an application creates exists on the target. */
  async function expectTargetUntouched(): Promise<void> {
    for (const table of ['interface', 'policy_r', 'routing_table', 'openvpn', 'wireguard']) {
      const [row] = await db
        .getSource()
        .query(`SELECT COUNT(*) AS n FROM ${table} WHERE firewall = ?`, [target.id]);

      expect(Number(row.n), table).to.eq(0);
    }
  }

  describe('saving a template', () => {
    for (const { objectType, data } of VALUE_OBJECTS) {
      it(`stores a ${objectType} with its snapshot and the locations it is used in`, async () => {
        const object = await createObject(objectType, data);
        const profile = await createProfile(twoRuleModel(objectType, object.id));
        const template = JSON.parse(
          fs.readFileSync(resolveReplicationProfileTemplatePath(profile), 'utf8'),
        );

        expect(template.objectReferences).to.deep.eq([
          {
            referenceId: REFERENCE_ID,
            objectType,
            sourceObjectId: object.id,
            sourceName: object.name,
            snapshot: {
              type: PROFILE_REFERENCE_OBJECT_TYPES[objectType],
              name: object.name,
              ...data,
            },
            locations: twoRuleLocations(objectType),
          },
        ]);
      });
    }

    it('stores a host with its interfaces and addresses', async () => {
      const host = fwc.ipobjs.get('host');
      const profile = await createProfile(twoRuleModel('host', host.id));
      const [interfaceRow] = await db
        .getSource()
        .query(
          'SELECT I.id, I.name FROM interface__ipobj H INNER JOIN interface I ON I.id = H.interface WHERE H.ipobj = ? ORDER BY I.id LIMIT 1',
          [host.id],
        );
      const { snapshot } = storedReferences(profile)[0];

      expect(snapshot).to.include({ type: 8, name: 'host' });
      expect((snapshot.interfaces as any[])[0]).to.include({
        id: interfaceRow.id,
        name: interfaceRow.name,
      });
    });

    it('stores a group with its members, VPN clients and prefixes included', async () => {
      // The factory group holds four objects plus a client and a prefix of each VPN kind.
      const profile = await createProfile(twoRuleModel('group', fwc.ipobjGroup.id));
      const members = storedReferences(profile)[0].snapshot.members as any[];
      const vpnClients = [
        [fwc.openvpnClients.get('OpenVPN-Cli-3'), 311],
        [fwc.wireguardClients.get('WireGuard-Cli-3'), 321],
        [fwc.ipsecClients.get('IPSec-Cli-3'), 331],
      ] as const;
      const prefixes = [
        [fwc.openvpnPrefix, 401],
        [fwc.wireguardPrefix, 402],
        [fwc.ipsecPrefix, 403],
      ] as const;

      expect(
        members.filter((member) => member.type < 300).map((member) => member.id),
      ).to.have.members(
        ['address', 'addressRange', 'network', 'host'].map((name) => fwc.ipobjs.get(name).id),
      );
      expect(members.find((member) => member.id === fwc.ipobjs.get('address').id)).to.deep.eq({
        id: fwc.ipobjs.get('address').id,
        type: 5,
        name: 'address',
        address: '10.20.30.40',
      });
      expect(members.filter((member) => member.type > 300)).to.have.deep.members([
        ...vpnClients.map(([client, type]) => ({
          id: client.id,
          type,
          name: [...fwc.crts.values()].find((crt) => crt.id === client.crtId).cn,
        })),
        ...prefixes.map(([prefix, type]) => ({ id: prefix.id, type, name: prefix.name })),
      ]);
    });

    it('lists each usage once for templates the editor saves as policyStructure and provision', async () => {
      const object = await createObject('address', VALUE_OBJECTS[0].data);
      const rules = [
        { chain: 'forward', ipVersion: 4, action: 'accept', source: [usage()] },
        { chain: 'input', ipVersion: 4, action: 'accept', destination: [usage()] },
      ];
      const profile = await createProfile({
        compatibility: { targetKinds: ['firewall'] },
        objectReferences: [
          { referenceId: REFERENCE_ID, objectType: 'address', sourceObjectId: object.id },
        ],
        policyStructure: { interfaces: [], rules },
        provision: { interfaces: [], rules },
      });

      expect(storedReferences(profile)[0].locations).to.deep.eq([
        'model.provision.rules[0].source[0]',
        'model.provision.rules[1].destination[0]',
      ]);
    });

    it('keeps the snapshot when a new version or a clone is saved after the object is deleted', async () => {
      const object = await createObject('range', VALUE_OBJECTS[2].data);
      const profile = await createProfile(twoRuleModel('range', object.id));
      // What an editor loads and sends back: the stored model with the resolution of each reference.
      const loaded = loadReplicationProfileModel(profile);
      loaded.objectReferences = (
        await resolveProfileObjectReferences(loaded, fwc.fwcloud.id)
      ).objectReferences;
      const options = { fwCloudId: fwc.fwcloud.id, userId: user.id };

      await db.getSource().manager.getRepository(IPObj).delete(object.id);

      const next = await profiles.createCustomProfileVersion(
        profile.code,
        { name: profile.name, scope: 'fwcloud', model: loaded },
        options,
      );
      const clone = await profiles.cloneCustomProfile(profile.code, profile.version, {}, options);

      expect(storedReferences(next)).to.deep.eq(storedReferences(profile));
      expect(storedReferences(clone)).to.deep.eq(storedReferences(profile));
    });

    it('refreshes the snapshot from the object when the template is saved again', async () => {
      const object = await createObject('address', VALUE_OBJECTS[0].data);
      const profile = await createProfile(twoRuleModel('address', object.id));

      await db
        .getSource()
        .manager.getRepository(IPObj)
        .update(object.id, { name: 'Renamed address', address: '198.51.100.99' });

      const next = await profiles.createCustomProfileVersion(
        profile.code,
        {
          name: profile.name,
          scope: 'fwcloud',
          model: loadReplicationProfileModel(profile),
        },
        { fwCloudId: fwc.fwcloud.id, userId: user.id },
      );

      expect(storedReferences(next)[0]).to.include({ sourceName: 'Renamed address' });
      expect(storedReferences(next)[0].snapshot).to.include({ address: '198.51.100.99' });
    });

    it('needs the snapshot of an object that is not available from the FWCloud', async () => {
      const otherCloud = await new FwCloudFactory().make();
      const foreign = await createObject('address', VALUE_OBJECTS[0].data, otherCloud.fwcloud.id);

      for (const sourceObjectId of [foreign.id, 999999999]) {
        const error = await expectRejectedAs(
          createProfile(twoRuleModel('address', sourceObjectId)),
          ReplicationProfileValidationException,
        );

        expect(error.validationErrors.map((item) => item.path)).to.have.members([
          'model.objectReferences[0].sourceName',
          'model.objectReferences[0].snapshot',
        ]);
      }
    });

    it('reports malformed references and usages as validation errors', async () => {
      const address = await createObject('address', {
        ip_version: 6,
        address: '2001:db8::1',
        netmask: '/128',
      });
      const model = await captureProfileObjectReferences(
        twoRuleModel('address', address.id),
        fwc.fwcloud.id,
      );
      const errorPaths = (value: Model) =>
        validateReplicationProfilePayload({ targetKind: 'firewall', model: value }).map(
          (error) => error.path,
        );
      const withRules = (rules: Model[]) => ({
        ...model,
        provision: { ...model.provision, rules },
      });
      const [reference] = model.objectReferences;

      // An IPv6 address in the IPv4 rules it is used by.
      expect(errorPaths(model)).to.deep.eq(twoRuleLocations('address'));

      const ipv6Model = withRules(
        model.provision.rules.map((rule: Model) => ({ ...rule, ipVersion: 6 })),
      );
      expect(errorPaths(ipv6Model)).to.be.empty;
      expect(errorPaths({ ...ipv6Model, objectReferences: [] })).to.deep.eq(
        twoRuleLocations('address'),
      );
      expect(
        errorPaths({ ...ipv6Model, objectReferences: [reference, { ...reference }] }),
      ).to.deep.eq(['model.objectReferences[1].referenceId']);
      expect(
        errorPaths({
          ...ipv6Model,
          objectReferences: [{ ...reference, referenceId: '_bad id' }],
        }),
      ).to.include('model.objectReferences[0].referenceId');
      expect(
        errorPaths({ ...ipv6Model, objectReferences: [{ ...reference, objectType: 'ip' }] }),
      ).to.deep.eq(['model.objectReferences[0].objectType']);
      expect(
        errorPaths({
          ...ipv6Model,
          objectReferences: [{ ...reference, snapshot: { ...reference.snapshot, type: 7 } }],
        }),
      ).to.deep.eq(['model.objectReferences[0].snapshot.type']);
      // A service position, a field that takes no objects and a usage carrying object data.
      expect(
        errorPaths(withRules([{ chain: 'forward', ipVersion: 6, service: [usage()] }])),
      ).to.deep.eq(['model.provision.rules[0].service[0]']);
      expect(errorPaths({ ...ipv6Model, uiDefaults: { selected: usage() } })).to.deep.eq([
        'model.uiDefaults.selected',
      ]);
      expect(
        errorPaths(
          withRules([
            { chain: 'forward', ipVersion: 6, source: [{ ...usage(), address: '2001:db8::2' }] },
          ]),
        ),
      ).to.deep.eq(['model.provision.rules[0].source[0]']);
    });

    it('reports an address in a service position', async () => {
      const service = await createObject('tcp', VALUE_OBJECTS[3].data);
      const model = await captureProfileObjectReferences(
        twoRuleModel('tcp', service.id),
        fwc.fwcloud.id,
      );
      model.provision.rules[0] = { chain: 'forward', source: [usage()] };

      expect(
        validateReplicationProfilePayload({ targetKind: 'firewall', model }).map(
          (error) => error.path,
        ),
      ).to.deep.eq(['model.provision.rules[0].source[0]']);
    });
  });

  describe('loading a template', () => {
    it('resolves an unchanged object and marks it unresolved once deleted', async () => {
      const object = await createObject('address', VALUE_OBJECTS[0].data);
      const profile = await createProfile(twoRuleModel('address', object.id));
      const templateFile = resolveReplicationProfileTemplatePath(profile);
      const template = fs.readFileSync(templateFile, 'utf8');

      const live = await resolveProfileObjectReferences(
        loadReplicationProfileModel(profile),
        fwc.fwcloud.id,
      );

      expect(live.errors).to.be.empty;
      expect(live.missingObjects).to.be.empty;
      expect(live.objectReferences[0]).to.include({ resolved: true, sourceName: object.name });
      expect(live.objectReferences[0].currentObject).to.include({
        id: object.id,
        address: '198.51.100.4',
      });
      expect(live.objectReferences[0].snapshot).to.include({ address: '198.51.100.4' });

      await db.getSource().manager.getRepository(IPObj).delete(object.id);

      const model = loadReplicationProfileModel(profile);
      const missing = await resolveProfileObjectReferences(model, fwc.fwcloud.id);

      expect(fs.readFileSync(templateFile, 'utf8')).to.eq(template);
      expect(missing.errors).to.be.empty;
      expect(missing.missingObjects).to.have.length(1);
      expect(missing.objectReferences[0]).to.deep.eq({
        referenceId: REFERENCE_ID,
        objectType: 'address',
        sourceObjectId: object.id,
        sourceName: object.name,
        snapshot: { type: 5, name: object.name, ...VALUE_OBJECTS[0].data },
        locations: twoRuleLocations('address'),
        resolved: false,
        currentObject: null,
        requiredFields: ['address'],
      });
      expect(missing.bindings.get(REFERENCE_ID)).to.deep.eq({
        type: 5,
        data: { type: 5, name: object.name, ...VALUE_OBJECTS[0].data },
      });
    });

    it('reports a conflict when the original object no longer matches its saved snapshot', async () => {
      const object = await createObject('address', VALUE_OBJECTS[0].data);
      const profile = await createProfile(twoRuleModel('address', object.id));
      const templateFile = resolveReplicationProfileTemplatePath(profile);
      const template = fs.readFileSync(templateFile, 'utf8');

      await db
        .getSource()
        .manager.getRepository(IPObj)
        .update(object.id, { address: '198.51.100.5' });

      const result = await resolveProfileObjectReferences(
        loadReplicationProfileModel(profile),
        fwc.fwcloud.id,
      );

      expect(result.errors).to.have.length(1);
      expect(result.errors[0]).to.include('conflict').and.include(object.name);
      expect(result.missingObjects).to.have.length(1);
      expect(result.objectReferences[0]).to.include({ resolved: false, currentObject: null });
      expect(result.objectReferences[0].snapshot).to.include({ address: '198.51.100.4' });
      expect(result.objectReferences[0].conflictingObjects).to.have.length(1);
      expect(result.objectReferences[0].conflictingObjects[0]).to.include({
        id: object.id,
        address: '198.51.100.5',
      });
      expect(result.bindings.has(REFERENCE_ID)).to.eq(false);
      expect(fs.readFileSync(templateFile, 'utf8')).to.eq(template);
    });

    it('does not resolve an object of another FWCloud, nor an id now holding another type', async () => {
      const object = await createObject('address', VALUE_OBJECTS[0].data);
      const profile = await createProfile(twoRuleModel('address', object.id));
      const model = loadReplicationProfileModel(profile);
      const otherCloud = await new FwCloudFactory().make();

      expect(
        (await resolveProfileObjectReferences(model, otherCloud.fwcloud.id)).missingObjects,
      ).to.have.length(1);

      await db.getSource().query('UPDATE ipobj SET type = 7 WHERE id = ?', [object.id]);

      expect(
        (await resolveProfileObjectReferences(model, fwc.fwcloud.id)).missingObjects,
      ).to.have.length(1);
    });

    it('does not reuse a deleted object ID that now belongs to an unrelated object of the same type', async () => {
      const original = await createObject('address', VALUE_OBJECTS[0].data);
      const profile = await createProfile(twoRuleModel('address', original.id));
      await db.getSource().manager.getRepository(IPObj).delete(original.id);
      const unrelated = await createObject('address', {
        id: original.id,
        name: 'Unrelated address',
        address: '192.0.2.91',
        netmask: '/32',
        ip_version: 4,
      });
      const loaded = await resolveProfileObjectReferences(
        loadReplicationProfileModel(profile),
        fwc.fwcloud.id,
      );
      expect(loaded.missingObjects).to.have.length(1);

      const applied = await apply(profile);
      expect(applied.errors).to.be.empty;
      const [recreated] = await objectsNamed(original.name);
      expect(recreated.id).not.to.eq(unrelated.id);
      expect(recreated.address).to.eq(original.address);
      expect(await ruleObjects()).to.deep.eq([recreated.id, recreated.id]);
      expect((await objectsNamed(unrelated.name))[0].address).to.eq(unrelated.address);
    });
  });

  describe('applying a template', () => {
    for (const { objectType, data } of [
      ...VALUE_OBJECTS,
      { objectType: 'dns' as const, data: {} },
      { objectType: 'host' as const, data: {} },
    ]) {
      it(`binds every usage of an existing ${objectType} to that object`, async () => {
        const object = await createObject(objectType, data);
        const profile = await createProfile(twoRuleModel(objectType, object.id));
        const template = fs.readFileSync(resolveReplicationProfileTemplatePath(profile), 'utf8');

        const result = await apply(profile);

        expect(result.errors).to.be.empty;
        expect(result.applied).to.eq(true);
        expect(result.missingObjects).to.be.empty;
        expect(result.objectReferences[0]).to.include({ resolved: true });
        expect(result.objectReferences[0].currentObject).to.include({ id: object.id });
        expect(await ruleObjects()).to.deep.eq([object.id, object.id]);
        expect(fs.readFileSync(resolveReplicationProfileTemplatePath(profile), 'utf8')).to.eq(
          template,
        );
      });
    }

    for (const { objectType, data } of VALUE_OBJECTS) {
      it(`automatically recreates a deleted ${objectType} once from its snapshot after preview`, async () => {
        const object = await createObject(objectType, data);
        const profile = await createProfile(twoRuleModel(objectType, object.id));
        const templateFile = resolveReplicationProfileTemplatePath(profile);
        const template = fs.readFileSync(templateFile, 'utf8');

        // The creation API may recycle the highest deleted ID. Keep a later row to exercise
        // real reference remapping rather than accidentally retaining the same numeric ID.
        await createObject('address', {
          name: 'Later object',
          ip_version: 4,
          address: '192.0.2.250',
          netmask: '/32',
        });

        await db.getSource().manager.getRepository(IPObj).delete(object.id);

        const creation = sinon.spy(IPObj, 'insertIpobj');
        const preview = await apply(profile, 'dry_run');

        expect(preview.errors).to.be.empty;
        expect(preview.applied).to.eq(false);
        expect(preview.missingObjects).to.have.length(1);
        expect(preview.missingObjects[0].snapshot).to.include(data);
        expect(await objectsNamed(object.name)).to.be.empty;
        expect(creation.called).to.eq(false);
        await expectTargetUntouched();

        const result = await apply(profile);
        const [replacementId, ...others] = await ruleObjects();

        expect(result.errors).to.be.empty;
        expect(result.applied).to.eq(true);
        expect(result.missingObjects).to.be.empty;
        expect(result.objectReferences[0].currentObject).to.include({ id: replacementId });
        expect(replacementId).not.to.eq(object.id);
        expect(creation.calledOnce).to.eq(true);
        expect(others).to.deep.eq([replacementId]);
        expect(
          await db
            .getSource()
            .manager.getRepository(IPObj)
            .findOneBy({ id: Number(replacementId) }),
        ).to.include({
          name: object.name,
          ipObjTypeId: PROFILE_REFERENCE_OBJECT_TYPES[objectType],
          ...data,
        });
        expect(fs.readFileSync(templateFile, 'utf8')).to.eq(template);
        expect(
          (
            await resolveProfileObjectReferences(
              loadReplicationProfileModel(profile),
              fwc.fwcloud.id,
            )
          ).missingObjects,
        ).to.be.empty;
        const repeated = await apply(profile, 'replace_defaults');
        expect(repeated.errors).to.be.empty;
        expect(await objectsNamed(object.name)).to.have.length(1);
        expect(creation.calledOnce).to.eq(true);
      });
    }

    it('recreates an object used by rules and routing once and binds every occurrence to it', async () => {
      const object = await createObject('address', VALUE_OBJECTS[0].data);
      const model = twoRuleModel('address', object.id);
      model.provision.routing = {
        tables: [
          { key: 'external', number: 123, name: 'External', routes: [{ gateway: usage() }] },
        ],
        rules: [{ table: 'external', from: [usage()] }],
      };
      const profile = await createProfile(model);

      await db.getSource().manager.getRepository(IPObj).delete(object.id);

      const missing = await apply(profile, 'dry_run');

      expect(missing.missingObjects).to.have.length(1);
      expect(missing.missingObjects[0].locations).to.deep.eq([
        ...twoRuleLocations('address'),
        'model.provision.routing.tables[0].routes[0].gateway',
        'model.provision.routing.rules[0].from[0]',
      ]);
      await expectTargetUntouched();

      const result = await apply(profile);
      const [replacementId] = await ruleObjects();
      const [route] = await db
        .getSource()
        .query(
          'SELECT R.gateway FROM route R INNER JOIN routing_table T ON T.id = R.routing_table WHERE T.firewall = ?',
          [target.id],
        );
      const [routingRule] = await db.getSource().query(
        `SELECT O.ipobj FROM routing_r__ipobj O INNER JOIN routing_r R ON R.id = O.rule
           INNER JOIN routing_table T ON T.id = R.routing_table WHERE T.firewall = ?`,
        [target.id],
      );

      expect(result.errors).to.be.empty;
      expect(await ruleObjects()).to.deep.eq([replacementId, replacementId]);
      expect(route.gateway).to.eq(replacementId);
      expect(routingRule.ipobj).to.eq(replacementId);
      expect(await objectsNamed(object.name)).to.have.length(1);
    });

    it('lists the usages of system entries too', async () => {
      const object = await createObject('address', VALUE_OBJECTS[0].data);
      const model = twoRuleModel('address', object.id);
      model.provision.system = { haproxy: [{ frontendIp: usage(), backendIps: [usage()] }] };
      const profile = await createProfile(model);

      await db.getSource().manager.getRepository(IPObj).delete(object.id);

      const result = await apply(profile, 'dry_run');

      expect(result.missingObjects).to.have.length(1);
      expect(result.missingObjects[0].locations).to.include.members([
        'model.provision.system.haproxy[0].frontendIp',
        'model.provision.system.haproxy[0].backendIps[0]',
      ]);
    });

    it('rejects a replacement conflicting with the flags of an existing object of the same name', async () => {
      const original = await createObject('tcp', VALUE_OBJECTS[3].data);
      const profile = await createProfile(twoRuleModel('tcp', original.id));
      const { tcp_flags_mask, tcp_flags_settings, ...unflagged } = VALUE_OBJECTS[3].data;
      const replacement = { [REFERENCE_ID]: { data: { name: original.name, ...unflagged } } };

      const first = await apply(profile, 'merge', replacement);
      expect(first.applied).to.eq(false);
      expect(first.errors.join(' ')).to.contain('conflict');
      await expectTargetUntouched();

      const second = await apply(profile, 'replace_defaults', replacement);

      expect(second.applied).to.eq(false);
      expect(second.errors.join(' ')).to.contain('conflict');
      expect((await objectsNamed(original.name)).map((object) => object.id)).to.deep.eq([
        original.id,
      ]);
    });

    it('takes an existing object of the same type as a replacement', async () => {
      const object = await createObject('network', VALUE_OBJECTS[1].data);
      const profile = await createProfile(twoRuleModel('network', object.id));
      const replacement = await createObject('network', {
        ip_version: 4,
        address: '192.0.2.0',
        netmask: '/24',
      });
      const address = await createObject('address', VALUE_OBJECTS[0].data);

      await db.getSource().manager.getRepository(IPObj).delete(object.id);

      const wrongType = await apply(profile, 'merge', {
        [REFERENCE_ID]: { sourceObjectId: address.id },
      });

      expect(wrongType.applied).to.eq(false);
      expect(wrongType.errors.join(' ')).to.contain(`object ${address.id} does not exist`);
      await expectTargetUntouched();

      const result = await apply(profile, 'merge', {
        [REFERENCE_ID]: { sourceObjectId: replacement.id },
      });

      expect(result.errors).to.be.empty;
      expect(await ruleObjects()).to.deep.eq([replacement.id, replacement.id]);
    });

    for (const objectType of ['group', 'serviceGroup'] as const) {
      it(`recreates a deleted ${objectType} after recreating its missing members`, async () => {
        const memberType = objectType === 'group' ? VALUE_OBJECTS[0] : VALUE_OBJECTS[3];
        const member = await createObject(memberType.objectType, memberType.data);
        const group = await createGroup(objectType, [member]);
        const profile = await createProfile(twoRuleModel(objectType, group.id));
        const { snapshot } = storedReferences(profile)[0];

        expect(snapshot.members).to.deep.eq([
          { id: member.id, type: member.ipObjTypeId, name: member.name, ...memberType.data },
        ]);
        expect((await apply(profile, 'dry_run')).errors).to.be.empty;

        await createObject('address', {
          name: 'Later object',
          ip_version: 4,
          address: '192.0.2.250',
          netmask: '/32',
        });
        await createGroup(objectType, [], 'Later group');

        await db.getSource().query('DELETE FROM ipobj__ipobjg WHERE ipobj_g = ?', [group.id]);
        await db.getSource().manager.getRepository(IPObjGroup).delete(group.id);
        await db.getSource().manager.getRepository(IPObj).delete(member.id);

        const missing = await apply(profile, 'dry_run');

        expect(missing.missingObjects).to.have.length(1);
        expect(missing.missingObjects[0].snapshot).to.deep.eq(snapshot);
        expect(missing.errors).to.be.empty;
        expect(await objectsNamed(member.name)).to.be.empty;
        await expectTargetUntouched();

        const byData = await apply(profile, 'merge', { [REFERENCE_ID]: { data: memberType.data } });

        expect(byData.errors.join(' ')).to.contain('can only be replaced by an existing one');

        const result = await apply(profile);
        const recreated = await db.getSource().manager.getRepository(IPObjGroup).findOneBy({
          name: group.name,
          fwCloudId: fwc.fwcloud.id,
        });
        const [recreatedMember] = await objectsNamed(member.name);
        const relations = await db
          .getSource()
          .query('SELECT ipobj FROM ipobj__ipobjg WHERE ipobj_g = ?', [recreated.id]);

        expect(result.errors).to.be.empty;
        expect(recreated.id).not.to.eq(group.id);
        expect(recreatedMember.id).not.to.eq(member.id);
        expect(recreatedMember).to.include(memberType.data);
        expect(relations.map((relation) => relation.ipobj)).to.deep.eq([recreatedMember.id]);
        expect(await ruleObjects()).to.deep.eq([`g${recreated.id}`, `g${recreated.id}`]);
        expect((await apply(profile, 'replace_defaults')).errors).to.be.empty;
        expect(await objectsNamed(member.name)).to.have.length(1);
      });
    }

    it('recreates a host dependency with its interface metadata and addresses', async () => {
      const host = await createObject('host', { name: 'Host dependency' });
      const hostInterface = await db.getSource().manager.getRepository(Interface).save({
        name: 'eth0',
        type: '11',
        interface_type: '11',
        labelName: 'Original LAN',
        comment: 'Preserved metadata',
        mac: '02:00:5e:00:53:01',
      });
      await db
        .getSource()
        .query(
          'INSERT INTO interface__ipobj (interface, ipobj, interface_order) VALUES (?, ?, ?)',
          [hostInterface.id, host.id, 2],
        );
      const address = await createObject('address', {
        name: 'Host address',
        address: '192.0.2.77',
        netmask: '/32',
        ip_version: 4,
        interfaceId: hostInterface.id,
      });
      const group = await createGroup('group', [host], 'Group with a host');
      const profile = await createProfile(twoRuleModel('group', group.id));
      const snapshot = storedReferences(profile)[0].snapshot;
      expect((snapshot.members as any[])[0].interfaces[0]).to.include({
        name: 'eth0',
        type: 11,
        interface_type: 11,
        labelName: 'Original LAN',
        comment: 'Preserved metadata',
        mac: hostInterface.mac,
        interface_order: 2,
      });

      await db.getSource().query('DELETE FROM ipobj__ipobjg WHERE ipobj_g = ?', [group.id]);
      await db.getSource().manager.getRepository(IPObjGroup).delete(group.id);
      await db.getSource().manager.getRepository(IPObj).delete(address.id);
      await db.getSource().query('DELETE FROM interface__ipobj WHERE ipobj = ?', [host.id]);
      await db.getSource().manager.getRepository(Interface).delete(hostInterface.id);
      await db.getSource().manager.getRepository(IPObj).delete(host.id);
      expect((await apply(profile, 'dry_run')).errors).to.be.empty;
      await expectTargetUntouched();

      const result = await apply(profile);
      expect(result.errors).to.be.empty;
      const [recreatedHost] = await objectsNamed(host.name);
      const [recreatedAddress] = await objectsNamed(address.name);
      const [recreatedInterface] = await db
        .getSource()
        .query(
          'SELECT I.*, H.interface_order FROM interface I INNER JOIN interface__ipobj H ON H.interface = I.id WHERE H.ipobj = ?',
          [recreatedHost.id],
        );
      expect(recreatedInterface).to.include({
        name: 'eth0',
        labelName: 'Original LAN',
        comment: 'Preserved metadata',
        mac: hostInterface.mac,
      });
      expect(Number(recreatedInterface.type)).to.eq(11);
      expect(Number(recreatedInterface.interface_type)).to.eq(11);
      expect(Number(recreatedInterface.interface_order)).to.eq(2);
      expect(recreatedAddress).to.include({
        address: address.address,
        netmask: address.netmask,
        ip_version: 4,
        interfaceId: recreatedInterface.id,
      });
      expect((await apply(profile, 'replace_defaults')).errors).to.be.empty;
      expect(await objectsNamed(host.name)).to.have.length(1);
      expect(await objectsNamed(address.name)).to.have.length(1);
    });

    it('creates one object when the same confirmed application is submitted concurrently', async () => {
      const object = await createObject('range', VALUE_OBJECTS[2].data);
      const profile = await createProfile(twoRuleModel('range', object.id));
      await db.getSource().manager.getRepository(IPObj).delete(object.id);
      const creation = sinon.spy(IPObj, 'insertIpobj');

      const results = await Promise.all([apply(profile), apply(profile)]);

      results.forEach((result) => {
        expect(result.errors).to.be.empty;
        expect(result.applied).to.eq(true);
      });
      expect(await objectsNamed(object.name)).to.have.length(1);
      expect(creation.calledOnce).to.eq(true);
      const ids = results.map((result) => result.objectReferences[0].currentObject.id);
      expect(ids[0]).to.eq(ids[1]);
    });

    it('rejects an object group with nothing of the IP family of the rule', async () => {
      const member = await createObject('address', {
        ip_version: 6,
        address: '2001:db8::1',
        netmask: '/128',
      });
      const group = await createGroup('group', [member]);
      const profile = await createProfile(twoRuleModel('group', group.id));

      const result = await apply(profile);

      expect(result.applied).to.eq(false);
      expect(result.errors.join(' ')).to.contain('holds nothing of IPv4');
      await expectTargetUntouched();
    });

    for (const [objectType, data] of [
      ['address', { address: 'not-an-ip' }],
      ['address', { ip_version: 4, address: '2001:db8::1' }],
      ['address', { address: '203.0.113.7', interface: 1 }],
      ['address', { type: 7, address: '203.0.113.7' }],
      ['network', { address: '203.0.113.0', netmask: '/99' }],
      ['network', { netmask: '/24' }],
      ['range', { range_start: '203.0.113.20', range_end: '203.0.113.10' }],
      ['range', { range_start: '203.0.113.10', range_end: '2001:db8::1' }],
      ['tcp', { ...VALUE_OBJECTS[3].replacement, destination_port_start: 70000 }],
      ['tcp', { ...VALUE_OBJECTS[3].replacement, source_port_start: 4000, source_port_end: 1000 }],
      ['tcp', { ...VALUE_OBJECTS[3].replacement, protocol: 17 }],
      ['udp', { ...VALUE_OBJECTS[4].replacement, destination_port_end: 'any' }],
      ['icmp', { icmp_type: 300, icmp_code: -1 }],
    ] as [ProfileReferenceObjectType, Record<string, unknown>][]) {
      it(`validates ${objectType} replacement ${JSON.stringify(data)} as the objects API does`, async () => {
        const object = await createObject(
          objectType,
          VALUE_OBJECTS.find((item) => item.objectType === objectType).data,
        );
        const profile = await createProfile(twoRuleModel(objectType, object.id));

        await db.getSource().manager.getRepository(IPObj).delete(object.id);

        const result = await apply(profile, 'merge', { [REFERENCE_ID]: { data } });

        expect(result.applied).to.eq(false);
        expect(
          result.errors.some((error) => error.startsWith(`objectReplacements.${REFERENCE_ID}:`)),
        ).to.be.true;
        expect(result.missingObjects.map((reference) => reference.referenceId)).to.deep.eq([
          REFERENCE_ID,
        ]);
        expect(await objectsNamed(object.name)).to.be.empty;
        await expectTargetUntouched();
      });
    }

    it('rejects replacements of references the template does not have, or with both forms', async () => {
      const object = await createObject('address', VALUE_OBJECTS[0].data);
      const profile = await createProfile(twoRuleModel('address', object.id));

      const unknown = await apply(profile, 'merge', { other: { sourceObjectId: object.id } });
      const both = await apply(profile, 'merge', {
        [REFERENCE_ID]: { sourceObjectId: object.id, data: { address: '203.0.113.7' } },
      });

      expect(unknown.errors).to.deep.eq([
        'objectReplacements: "other" is not an object reference of the profile.',
      ]);
      expect(both.errors.join(' ')).to.contain('send either the sourceObjectId');
      await expectTargetUntouched();
    });

    it('does not ask for a deleted object no usage is left for', async () => {
      const used = await createObject('address', VALUE_OBJECTS[0].data);
      const unused = await createObject('range', VALUE_OBJECTS[2].data);
      const model = twoRuleModel('address', used.id);
      model.objectReferences.push({
        referenceId: 'unused',
        objectType: 'range',
        sourceObjectId: unused.id,
      });
      const profile = await createProfile(model);

      await db.getSource().manager.getRepository(IPObj).delete(unused.id);

      const result = await apply(profile);

      expect(result.errors).to.be.empty;
      expect(result.applied).to.eq(true);
      expect(result.missingObjects).to.be.empty;
      expect(result.objectReferences.find((item) => item.referenceId === 'unused')).to.include({
        resolved: false,
      });
    });

    it('checks every reference before creating a replacement or a VPN', async () => {
      const address = await createObject('address', VALUE_OBJECTS[0].data);
      const range = await createObject('range', VALUE_OBJECTS[2].data);
      const model = twoRuleModel('address', address.id);
      model.objectReferences.push({
        referenceId: 'range',
        objectType: 'range',
        sourceObjectId: range.id,
      });
      model.provision.rules[1].destination = [usage('range')];
      const profile = await createProfile(model);
      const saved = loadReplicationProfileModel(profile) as Model;
      delete saved.objectReferences[1].snapshot.range_start;
      writeReplicationProfileModel(profile, saved);
      const replacements = {
        [REFERENCE_ID]: { data: { name: 'Not created yet', address: '203.0.113.7' } },
      };

      await db.getSource().manager.getRepository(IPObj).delete([address.id, range.id]);

      const vpn = sinon.spy(application as any, 'provisionVpnResources');
      const result = await apply(profile, 'merge', replacements);
      const vpnResult = await application.provisionVpn(
        { user },
        {
          fwCloudId: fwc.fwcloud.id,
          profileCode: profile.code,
          profileVersion: profile.version,
          replication: { target: { kind: 'firewall', id: target.id }, mode: 'replace_defaults' },
          objectReplacements: replacements,
        },
      );

      expect(result.missingObjects.map((reference) => reference.referenceId)).to.deep.eq(['range']);
      expect(vpnResult.missingObjects.map((reference) => reference.referenceId)).to.deep.eq([
        'range',
      ]);
      expect(vpnResult.connectionIds).to.deep.eq({});
      expect(vpn.called).to.eq(false);
      expect(await objectsNamed('Not created yet')).to.be.empty;
      await expectTargetUntouched();
    });

    it('keeps applying templates without external objects', async () => {
      const [standard] = await db
        .getSource()
        .query('SELECT id FROM ipobj WHERE fwcloud IS NULL AND type = 5 ORDER BY id LIMIT 1');
      const profile = await createProfile({
        compatibility: { targetKinds: ['firewall'] },
        provision: {
          interfaces: [{ role: 'lan', name: 'LAN' }],
          rules: [{ chain: 'forward', source: [{ kind: 'std', id: standard.id }] }],
        },
      });

      const result = await apply(profile);

      expect(result.errors).to.be.empty;
      expect(result.applied).to.eq(true);
      expect(result).not.to.have.property('objectReferences');
      expect(result).not.to.have.property('missingObjects');
      expect(loadReplicationProfileModel(profile)).not.to.have.property('objectReferences');
      expect(await ruleObjects()).to.deep.eq([standard.id]);
    });
  });
});
