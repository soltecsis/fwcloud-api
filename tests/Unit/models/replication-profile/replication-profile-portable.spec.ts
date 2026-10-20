import { expect } from 'chai';
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
});
