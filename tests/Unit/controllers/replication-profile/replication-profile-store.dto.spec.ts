import { ClassConstructor, plainToClass } from 'class-transformer';
import { validate, ValidationError } from 'class-validator';
import { expect } from '../../../mocha/global-setup';
import {
  ReplicationProfileStoreDto,
  ReplicationProfileVersionStoreDto,
} from '../../../../src/controllers/replication-profile/dtos/replication-profile-store.dto';
import { makeCustomReplicationProfilePayload } from '../../../utils/replication-profile-fixtures';

/**
 * The DTO is exercised through the exact options the production validation
 * pipeline uses (see src/fonaments/validation/validator.ts), so these tests
 * cover whitelist rejection and nested validation the same way the API does.
 */
const VALIDATION_OPTIONS = {
  forbidUnknownValues: true,
  whitelist: true,
  forbidNonWhitelisted: true,
};

function minimalPayload(): Record<string, unknown> {
  return makeCustomReplicationProfilePayload();
}

function fullPayload(): Record<string, unknown> {
  return {
    name: 'Basic office firewall',
    description: 'Reusable profile for a basic office firewall.',
    code: 'basic-office-firewall',
    version: 2,
    scope: 'custom',
    targetKind: 'firewall',
    category: 'office',
    model: {
      compatibility: { targetKinds: ['firewall'], supportedRoles: ['wan', 'lan', 'dmz'] },
      uiDefaults: { targetKind: 'firewall', connectionType: 'agent' },
      topologyPreset: {
        interfaces: [
          { role: 'wan', required: true },
          { role: 'lan', required: true },
          { role: 'dmz', required: false },
        ],
      },
      provision: {
        rules: [
          {
            action: 'accept',
            sourceRole: 'lan',
            destinationRole: 'wan',
            service: { protocol: 'tcp', port: 443 },
          },
          { action: 'deny', sourceRole: 'wan', destinationRole: 'lan', service: 'any' },
        ],
      },
      options: { mode: 'merge' },
      roleAssignments: { interfaceRoles: ['wan', 'lan', 'dmz'] },
    },
  };
}

/** Flattens nested validation errors to a set of dotted property paths that failed. */
function failedProps(errors: ValidationError[], prefix = ''): string[] {
  const out: string[] = [];

  for (const error of errors) {
    const path = prefix ? `${prefix}.${error.property}` : error.property;

    if (error.constraints && Object.keys(error.constraints).length > 0) {
      out.push(path);
    }

    if (error.children && error.children.length > 0) {
      out.push(...failedProps(error.children, path));
    }
  }

  return out;
}

async function validatePayload(
  payload: Record<string, unknown>,
  dto: ClassConstructor<object> = ReplicationProfileStoreDto,
): Promise<string[]> {
  const instance = plainToClass(dto, payload);
  const errors = await validate(instance, VALIDATION_OPTIONS);

  return failedProps(errors);
}

describe(ReplicationProfileStoreDto.name, () => {
  it('should accept the minimum valid payload', async () => {
    expect(await validatePayload(minimalPayload())).to.be.empty;
  });

  it('should accept a fully populated payload', async () => {
    expect(await validatePayload(fullPayload())).to.be.empty;
  });

  describe('required fields', () => {
    for (const field of ['name', 'scope', 'model'] as const) {
      it(`should reject a payload missing "${field}"`, async () => {
        const payload = minimalPayload();
        delete payload[field];

        expect(await validatePayload(payload)).to.include(field);
      });
    }

    it('should reject a model missing compatibility', async () => {
      const payload = minimalPayload();
      delete (payload.model as Record<string, unknown>).compatibility;

      expect(await validatePayload(payload)).to.include('model.compatibility');
    });

    it('should accept a payload without code, version or roleAssignments', async () => {
      const payload = minimalPayload();

      expect(await validatePayload(payload)).to.be.empty;
    });

    it('should accept a payload without targetKind', async () => {
      const payload = minimalPayload();
      delete payload.targetKind;

      expect(await validatePayload(payload)).to.be.empty;
    });
  });

  describe('field constraints', () => {
    it('should reject an unknown targetKind', async () => {
      expect(await validatePayload({ ...minimalPayload(), targetKind: 'gateway' })).to.include(
        'targetKind',
      );
    });

    it('should reject a non URL-safe code', async () => {
      expect(await validatePayload({ ...minimalPayload(), code: 'has spaces/slash' })).to.include(
        'code',
      );
    });

    it('should reject a non-positive version', async () => {
      expect(await validatePayload({ ...minimalPayload(), version: 0 })).to.include('version');
    });
  });

  describe('model.compatibility', () => {
    it('should reject an empty targetKinds array', async () => {
      const payload = minimalPayload();
      (payload.model as Record<string, unknown>).compatibility = { targetKinds: [] };

      expect(await validatePayload(payload)).to.include('model.compatibility');
    });

    it('should reject an unsupported targetKind', async () => {
      const payload = minimalPayload();
      (payload.model as Record<string, unknown>).compatibility = { targetKinds: ['gateway'] };

      expect(await validatePayload(payload)).to.include('model.compatibility');
    });

    it('should accept custom supportedRoles', async () => {
      const payload = minimalPayload();
      (payload.model as Record<string, unknown>).compatibility = {
        targetKinds: ['firewall'],
        supportedRoles: ['wan', 'guest'],
      };

      expect(await validatePayload(payload)).to.be.empty;
    });

    it('should reject invalid supportedRoles values', async () => {
      const payload = minimalPayload();
      (payload.model as Record<string, unknown>).compatibility = {
        targetKinds: ['firewall'],
        supportedRoles: ['wan', ''],
      };

      expect(await validatePayload(payload)).to.include('model.compatibility');
    });
  });

  describe('model.roleAssignments', () => {
    it('should reject an empty interfaceRoles array', async () => {
      const payload = minimalPayload();
      (payload.model as Record<string, unknown>).roleAssignments = { interfaceRoles: [] };

      expect(await validatePayload(payload)).to.include('model.roleAssignments');
    });

    it('should accept custom interface roles', async () => {
      const payload = minimalPayload();
      (payload.model as Record<string, unknown>).roleAssignments = { interfaceRoles: ['vpn'] };

      expect(await validatePayload(payload)).to.be.empty;
    });

    it('should reject invalid interface role values', async () => {
      const payload = minimalPayload();
      (payload.model as Record<string, unknown>).roleAssignments = { interfaceRoles: [''] };

      expect(await validatePayload(payload)).to.include('model.roleAssignments');
    });
  });

  describe('model.provision (MVP rule model)', () => {
    const withProvision = (provision: unknown): Record<string, unknown> => {
      const payload = minimalPayload();
      (payload.model as Record<string, unknown>).provision = provision;

      return payload;
    };

    it('should accept accept/deny rules using wan/lan/dmz roles', async () => {
      expect(
        await validatePayload(
          withProvision({
            rules: [{ action: 'accept', sourceRole: 'lan', destinationRole: 'dmz' }],
          }),
        ),
      ).to.be.empty;
    });

    it('should reject a rule action outside accept/deny', async () => {
      expect(
        await validatePayload(withProvision({ rules: [{ action: 'allow', sourceRole: 'lan' }] })),
      ).to.include('model.provision');
    });

    it('should accept custom rule roles', async () => {
      expect(
        await validatePayload(
          withProvision({ rules: [{ action: 'accept', sourceRole: 'guest' }] }),
        ),
      ).to.be.empty;
    });

    it('should reject invalid provision service ports and protocols', async () => {
      expect(
        await validatePayload(
          withProvision({
            rules: [
              {
                action: 'accept',
                sourceRole: 'lan',
                service: { protocol: 'icmp', port: 0 },
              },
            ],
          }),
        ),
      ).to.include('model.provision');
    });

    it('should accept custom provision interface roles', async () => {
      expect(await validatePayload(withProvision({ interfaces: [{ role: 'guest' }] }))).to.be.empty;
    });
  });

  describe('model policy/template structure', () => {
    it('should accept structure-only table profiles created by the profile editor', async () => {
      const payload = minimalPayload();
      const templateStructure = {
        mode: 'table',
        entries: [
          {
            target: 'input',
            ipVersion: 'ipv4',
            action: 'accept',
            structure: { source: 'office-lan' },
            comment: 'Input policy skeleton',
          },
          { target: 'vpn', ipVersion: 'any', structure: { tunnels: [] } },
          { target: 'routing', ipVersion: 'any', structure: { routes: [] } },
          { target: 'system', ipVersion: 'any', structure: { settings: [] } },
        ],
      };

      payload.model = {
        compatibility: {
          target_kinds: ['firewall', 'cluster'],
          supportedTargets: ['input', 'vpn', 'routing', 'system'],
        },
        policyStructure: templateStructure,
        provision: { structure: templateStructure },
        options: { structureMode: 'table' },
      };

      expect(await validatePayload(payload)).to.be.empty;
    });

    it('should accept pasted JSON structure profiles', async () => {
      const payload = minimalPayload();
      const templateStructure = {
        mode: 'json',
        value: {
          policies: {
            ipv4: {
              forward: [],
              snat: [],
              dnat: [],
            },
            ipv6: {
              input: [],
              output: [],
            },
          },
          vpn: [],
          routing: [],
          system: [],
        },
      };

      payload.model = {
        compatibility: {
          target_kinds: ['firewall', 'cluster'],
          supportedTargets: ['json'],
        },
        template_structure: templateStructure,
        provision: { structure: templateStructure },
        options: { structureMode: 'json' },
      };

      expect(await validatePayload(payload)).to.be.empty;
    });
  });

  describe('credential rejection', () => {
    it('should reject secrets nested inside model.options', async () => {
      const payload = minimalPayload();
      (payload.model as Record<string, unknown>).options = { password: 'super-secret' };

      expect(await validatePayload(payload)).to.include('model');
    });

    it('should reject secrets nested inside model.provision', async () => {
      const payload = minimalPayload();
      (payload.model as Record<string, unknown>).provision = {
        rules: [{ action: 'accept', apiKey: 'leaked' }],
      };

      expect(await validatePayload(payload)).to.include('model');
    });
  });

  describe('whitelist / forward compatibility', () => {
    it('should reject server-managed fields the client must not set', async () => {
      const failed = await validatePayload({
        ...minimalPayload(),
        isBuiltin: true,
        is_built_in: true,
        fwcloud_id: 9,
      });

      expect(failed).to.include('isBuiltin');
      expect(failed).to.include('is_built_in');
      expect(failed).to.include('fwcloud_id');
    });

    it('should reject unknown keys at the model top level', async () => {
      const payload = minimalPayload();
      (payload.model as Record<string, unknown>).unexpected = true;

      expect(await validatePayload(payload)).to.include('model.unexpected');
    });

    it('should tolerate forward-compatible keys inside open model sub-objects', async () => {
      const payload = minimalPayload();
      (payload.model as Record<string, unknown>).uiDefaults = {
        targetKind: 'firewall',
        futureField: 'ignored',
      };

      expect(await validatePayload(payload)).to.be.empty;
    });
  });
});

describe(ReplicationProfileVersionStoreDto.name, () => {
  it('should accept the same editable profile fields as the create DTO', async () => {
    expect(await validatePayload(minimalPayload(), ReplicationProfileVersionStoreDto)).to.be.empty;
  });

  it('should reject client-managed code and version overrides', async () => {
    const failed = await validatePayload(
      { ...minimalPayload(), code: 'manual-code', version: 99 },
      ReplicationProfileVersionStoreDto,
    );

    expect(failed).to.include('code');
    expect(failed).to.include('version');
  });
});
