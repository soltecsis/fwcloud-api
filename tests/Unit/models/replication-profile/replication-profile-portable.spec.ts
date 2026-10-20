import { expect } from 'chai';
import { ValidationException } from '../../../../src/fonaments/exceptions/validation-exception';
import {
  parseReplicationProfileDocument,
  portableProfileModel,
  REPLICATION_PROFILE_FORMAT,
} from '../../../../src/models/replication-profile/replication-profile-portable';

describe('Replication profile portable format', () => {
  const document = () => ({
    format: REPLICATION_PROFILE_FORMAT,
    formatVersion: 1,
    profile: { code: 'office-template', name: 'Office Template', targetKind: 'firewall' },
    versions: { latest: { model: { compatibility: { target_kinds: ['firewall'] } } } },
  });

  it('accepts the minimal documented format and a null previous version', () => {
    const parsed = parseReplicationProfileDocument({
      ...document(),
      versions: { ...document().versions, previous: null },
    });
    expect(parsed.profile).to.include({ scope: 'generic', category: null, description: null });
    expect(parsed.versions).not.to.have.property('previous');
  });

  for (const name of ['Production Firewall', 'Office_Template', 'Branch-Firewall']) {
    it(`accepts template name ${name}`, () => {
      const input = document();
      input.profile.name = name;
      expect(parseReplicationProfileDocument(input).profile.name).to.eq(name);
    });
  }

  for (const name of [
    'Production.Firewall',
    'Template.v2',
    '../template',
    'a/b',
    'a\\b',
    'a:b',
    'a\n',
    ' ',
    'a'.repeat(256),
  ]) {
    it(`rejects unsafe template name ${JSON.stringify(name)}`, () => {
      const input = document();
      input.profile.name = name;
      expect(() => parseReplicationProfileDocument(input)).to.throw();
    });
  }

  for (const [label, change] of [
    [
      'identifier',
      (d: any) => {
        d.format = 'other';
      },
    ],
    [
      'version',
      (d: any) => {
        d.formatVersion = 2;
      },
    ],
    [
      'string version',
      (d: any) => {
        d.formatVersion = '1';
      },
    ],
    [
      'missing metadata',
      (d: any) => {
        delete d.profile;
      },
    ],
    [
      'missing code',
      (d: any) => {
        delete d.profile.code;
      },
    ],
    [
      'unsafe code',
      (d: any) => {
        d.profile.code = '../overwrite';
      },
    ],
    [
      'target kind',
      (d: any) => {
        d.profile.targetKind = 'router';
      },
    ],
    [
      'invalid scope',
      (d: any) => {
        d.profile.scope = 1;
      },
    ],
    [
      'invalid category',
      (d: any) => {
        d.profile.category = [];
      },
    ],
    [
      'missing latest',
      (d: any) => {
        delete d.versions.latest;
      },
    ],
    [
      'missing model',
      (d: any) => {
        delete d.versions.latest.model;
      },
    ],
    [
      'empty model',
      (d: any) => {
        d.versions.latest.model = {};
      },
    ],
    [
      'incompatible model',
      (d: any) => {
        d.versions.latest.model.compatibility.target_kinds = ['cluster'];
      },
    ],
    [
      'invalid previous',
      (d: any) => {
        d.versions.previous = { model: null };
      },
    ],
    [
      'third version',
      (d: any) => {
        d.versions.v3 = d.versions.latest;
      },
    ],
    [
      'internal path',
      (d: any) => {
        d.profile.path = '/tmp/template.json';
      },
    ],
    [
      'built-in override',
      (d: any) => {
        d.profile.isBuiltin = true;
      },
    ],
    [
      'owner override',
      (d: any) => {
        d.profile.userId = 1;
      },
    ],
    [
      'credentials',
      (d: any) => {
        d.versions.latest.model.options = { password: 'hidden' };
      },
    ],
    [
      'missing reference',
      (d: any) => {
        d.versions.latest.model.provision = {
          interfaces: [],
          rules: [{ action: 'accept', source: [{ kind: 'external', referenceId: 'missing' }] }],
        };
      },
    ],
  ] as const) {
    it(`rejects ${label}`, () => {
      const input = document();
      change(input);
      expect(() => parseReplicationProfileDocument(input)).to.throw();
    });
  }

  it('preserves full models and nested snapshot relationships without source ids', () => {
    const original = {
      options: { extension: [true, 3, { value: 'kept' }] },
      objectReferences: [
        {
          referenceId: 'address-group',
          objectType: 'group',
          sourceName: 'Office',
          sourceObjectId: 123,
          snapshot: {
            type: 20,
            name: 'Office',
            members: [{ id: 456, type: 5, name: 'IP', address: '192.0.2.5', ip_version: 4 }],
          },
          locations: ['model.provision.rules[0].source[0]'],
          resolved: true,
          currentObject: { id: 123 },
        },
      ],
      provision: { rules: [{ source: [{ kind: 'external', referenceId: 'address-group' }] }] },
    };
    const portable = portableProfileModel(original) as any;
    expect(portable.options).to.deep.eq(original.options);
    expect(portable.provision).to.deep.eq(original.provision);
    expect(portable.objectReferences[0]).not.to.have.any.keys(
      'sourceObjectId',
      'resolved',
      'currentObject',
    );
    expect(portable.objectReferences[0].snapshot.members[0]).to.deep.eq({
      type: 5,
      name: 'IP',
      address: '192.0.2.5',
      ip_version: 4,
    });
    expect(original.objectReferences[0].snapshot.members[0].id).to.eq(456);
  });

  it('removes ids throughout host snapshots without touching other model ids or sharing input data', () => {
    const original = {
      id: 1,
      options: { id: 2 },
      objectReferences: [
        {
          referenceId: 'host',
          objectType: 'host',
          sourceName: 'Host',
          snapshot: {
            id: 3,
            type: 8,
            name: 'Host',
            interfaces: [
              {
                id: 4,
                name: 'eth0',
                addresses: [{ id: 5, name: 'Address', address: '192.0.2.5' }],
              },
            ],
          },
        },
      ],
    };
    const before = JSON.stringify(original);
    const portable = portableProfileModel(original) as typeof original;
    const snapshot = portable.objectReferences[0].snapshot;
    expect(portable.id).to.eq(1);
    expect(portable.options.id).to.eq(2);
    expect(snapshot).not.to.have.property('id');
    expect(snapshot.interfaces[0]).not.to.have.property('id');
    expect(snapshot.interfaces[0].addresses[0]).not.to.have.property('id');
    snapshot.interfaces[0].addresses[0].name = 'Changed';
    portable.options.id = 9;
    expect(JSON.stringify(original)).to.eq(before);
  });

  for (const [key, value, message] of [
    ['description', 1, 'description must be a string or null.'],
    ['category', [], 'category must be a string or null.'],
    ['scope', null, 'scope must be a nonempty string of at most 255 characters.'],
    ['targetKind', 'router', 'targetKind must be firewall or cluster.'],
  ] as const) {
    it(`preserves the validation response for invalid ${key}`, () => {
      const input = document();
      try {
        parseReplicationProfileDocument({ ...input, profile: { ...input.profile, [key]: value } });
        expect.fail('Expected an invalid metadata error');
      } catch (error) {
        expect(error).to.be.instanceOf(ValidationException);
        expect(error.status).to.eq(422);
        expect(error.message).to.eq('Invalid replication profile import.');
        expect(error.toResponse().errors).to.deep.eq({ [`profile.${key}`]: [message] });
      }
    });
  }

  it('validates unknown metadata fields before invalid known fields', () => {
    const input = document();
    try {
      parseReplicationProfileDocument({
        ...input,
        profile: { ...input.profile, name: '../unsafe', isBuiltin: true },
      });
      expect.fail('Expected an unsupported field error');
    } catch (error) {
      expect(error).to.be.instanceOf(ValidationException);
      expect(error.toResponse().errors).to.deep.eq({ 'profile.isBuiltin': ['Unsupported field.'] });
    }
  });

  it('preserves independently normalized metadata for the previous version', () => {
    const input = document();
    const metadata = {
      ...input.profile,
      name: 'Previous Template',
      scope: 'previous-scope',
      targetKind: 'cluster',
      description: null,
      category: null,
    };
    const model = {
      compatibility: { target_kinds: ['cluster'] },
      topologyPreset: { nodes: [{ role: 'primary' }, { role: 'secondary' }] },
    };
    const parsed = parseReplicationProfileDocument({
      ...input,
      versions: { ...input.versions, previous: { metadata, model } },
    });
    expect(parsed.versions.previous).to.deep.eq({ metadata, model });
    expect(parsed.profile.targetKind).to.eq('firewall');
  });
});
