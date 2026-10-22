import { describeName, expect, testSuite } from '../../../mocha/global-setup';
import db from '../../../../src/database/database-manager';
import defaultReplicationProfile from '../../../../src/models/replication-profile/presets/default-replication-profile.v1.json';
import { ReplicationProfile } from '../../../../src/models/replication-profile/replication-profile.model';
import {
  buildReplicationProfileTemplatePath,
  getCustomReplicationProfileTemplatesDirectory,
  getReplicationProfileTemplatesDirectory,
  getUserReplicationProfileTemplatesDirectory,
  loadReplicationProfileModel,
  removeReplicationProfileModel,
  ReplicationProfileTemplateException,
  ReplicationProfileTemplateReference,
  resolveReplicationProfileTemplatePath,
  writeReplicationProfileModel,
} from '../../../../src/models/replication-profile/replication-profile-template';
import { expectThrownAs } from '../../../utils/assertions';
import {
  readVersionedReplicationProfileTemplate,
  templateExists,
  writeRawReplicationProfileTemplate,
} from '../../../utils/replication-profile-fixtures';
import * as fs from 'fs';
import * as path from 'path';
import { IsNull, Like, Repository } from 'typeorm';

describe(describeName('Replication Profile Template Unit Tests'), () => {
  let repository: Repository<ReplicationProfile>;
  let codePrefix: string;

  const reference = (templatePath: string): ReplicationProfileTemplateReference => ({
    code: `${codePrefix}template`,
    version: 1,
    targetKind: 'firewall',
    path: templatePath,
  });

  const writeRawTemplate = (content: string): ReplicationProfileTemplateReference => {
    const profile = reference(`custom/fixtures/${codePrefix}raw.v1.json`);
    writeRawReplicationProfileTemplate(profile, content);

    return profile;
  };

  const catchTemplateError = (call: () => unknown): ReplicationProfileTemplateException =>
    expectThrownAs(call, ReplicationProfileTemplateException);

  before(async () => {
    await testSuite.resetDatabaseData();
  });

  beforeEach(() => {
    repository = db.getSource().manager.getRepository(ReplicationProfile);
    codePrefix = `rp-template-${Date.now()}-${Math.round(Math.random() * 100000)}-`;
  });

  afterEach(async () => {
    await repository.delete({ code: Like(`${codePrefix}%`) });
  });

  it('should preserve validity strings and offsets verbatim through saving, loading and editing', () => {
    const periods = [
      { time_start: '2026-10-01T08:15:30+02:00', time_end: '2026-10-31T19:45:59+01:00' },
      { time_start: '2026-10-01T08:15:30.000Z' },
      { time_end: '2026-10-31T19:45:59.000Z' },
      { time_start: null, time_end: null },
      {},
    ];
    const profile = reference(`custom/fixtures/${codePrefix}validity.v1.json`);
    const model = {
      provision: {
        rules: periods.map((period) => ({
          chain: 'forward',
          comment: 'Temporary access',
          ...period,
        })),
      },
    };
    writeReplicationProfileModel(profile, model);
    const loaded = loadReplicationProfileModel(profile);
    expect(loaded).to.deep.eq(model);
    const edited = JSON.parse(JSON.stringify(loaded));
    edited.provision.rules[0].comment = 'Edited access';
    writeReplicationProfileModel(profile, edited);
    expect(loadReplicationProfileModel(profile)).to.deep.eq(edited);
    const json = JSON.parse(
      fs.readFileSync(resolveReplicationProfileTemplatePath(profile), 'utf8'),
    );
    expect(
      json.provision.rules.map(({ time_start, time_end }) => ({ time_start, time_end })),
    ).to.deep.eq(
      model.provision.rules.map(({ time_start, time_end }) => ({ time_start, time_end })),
    );
  });

  it('should reject invalid validity periods on both save and load', () => {
    const model = {
      provision: {
        rules: [
          {
            chain: 'forward',
            time_start: '2026-11-01T00:00:00Z',
            time_end: '2026-10-01T00:00:00Z',
          },
        ],
      },
    };
    const profile = reference(`custom/fixtures/${codePrefix}invalid-validity.v1.json`);
    expect(() => writeReplicationProfileModel(profile, model)).to.throw('definition is invalid');
    expect(templateExists(profile)).to.be.false;
    const raw = writeRawTemplate(JSON.stringify(model));
    const error = catchTemplateError(() => loadReplicationProfileModel(raw));
    expect(error.reason).to.eq('invalid_model');
    expect(error.validationErrors.some((error) => error.code === 'invalid_rule_validity')).to.be
      .true;
  });

  describe('buildReplicationProfileTemplatePath()', () => {
    it('should name the template after the profile code and version', () => {
      expect(
        buildReplicationProfileTemplatePath({ code: 'default', version: 1, userId: null }),
      ).to.be.eq('default.latest.json');
      expect(
        buildReplicationProfileTemplatePath({
          code: 'office-lan',
          versionSlot: 'previous',
          userId: 12,
        }),
      ).to.be.eq('custom/users/12/office-lan.previous.json');
    });

    it('should not let a code ending in a slot name read as the slot of another code', () => {
      // "Office - previous" becomes the code office-previous, never the previous slot of office.
      const files = [
        buildReplicationProfileTemplatePath({
          code: 'office',
          versionSlot: 'previous',
          userId: 12,
        }),
        buildReplicationProfileTemplatePath({ code: 'office-previous', userId: 12 }),
      ].map((file) => path.basename(file, '.json').split('.'));

      expect(files).to.deep.eq([
        ['office', 'previous'],
        ['office-previous', 'latest'],
      ]);
    });
  });

  describe('resolveReplicationProfileTemplatePath()', () => {
    it('should resolve built-in and custom templates inside their directories', () => {
      expect(resolveReplicationProfileTemplatePath(reference('default.v1.json'))).to.be.eq(
        path.join(getReplicationProfileTemplatesDirectory(), 'default.v1.json'),
      );
      expect(
        resolveReplicationProfileTemplatePath(reference('custom/users/12/office.v1.json')),
      ).to.be.eq(path.join(getUserReplicationProfileTemplatesDirectory(12), 'office.v1.json'));
      expect(getUserReplicationProfileTemplatesDirectory(12)).to.be.eq(
        path.join(getCustomReplicationProfileTemplatesDirectory(), 'users', '12'),
      );
    });

    it('should reject paths that could reach files outside the templates directory', () => {
      for (const unsafePath of [
        '../test.json',
        'custom/../../test.json',
        'custom/users/12/../../../../../config/prod.json',
        './default.v1.json',
        '/etc/passwd',
        '/etc/fwcloud.json',
        'C:\\fwcloud\\default.v1.json',
        'custom\\users\\12\\office.v1.json',
        'custom//office.v1.json',
        '.hidden.json',
        'default.v1.txt',
        '',
        null,
      ]) {
        const error = catchTemplateError(() =>
          resolveReplicationProfileTemplatePath(reference(unsafePath)),
        );

        expect(error.reason, String(unsafePath)).to.be.eq('invalid_path');
        expect(error.message).to.contain('must be a relative .json path inside config/templates');
      }
    });

    it('should not save a profile whose template path leaves the templates directory', async () => {
      const profile = repository.create({
        code: `${codePrefix}unsafe-path`,
        version: 1,
        name: 'Unsafe template path',
        scope: 'generic',
        targetKind: 'firewall',
        path: '../../config/test.json',
        isBuiltin: false,
        isActive: true,
        isDeprecated: false,
        userId: 1,
      });

      await expect(repository.save(profile)).to.be.rejectedWith(
        ReplicationProfileTemplateException,
        /must be a relative \.json path/,
      );
      expect(await repository.findOne({ where: { code: profile.code } })).to.be.null;
    });
  });

  describe('loadReplicationProfileModel()', () => {
    it('should load the default profile model from its version-controlled template', async () => {
      const profile = await repository.findOneOrFail({
        where: { code: defaultReplicationProfile.code, version: defaultReplicationProfile.version },
      });

      expect(profile.path).to.be.eq('default.latest.json');
      expect(loadReplicationProfileModel(profile)).to.deep.eq(
        readVersionedReplicationProfileTemplate('default.latest.json'),
      );
    });

    it('should find a valid version-controlled template for every seeded profile', async () => {
      const seeded = (await repository.find({ where: { isBuiltin: true, userId: IsNull() } }))
        // Built-in fixtures of other tests keep their templates among the custom ones.
        .filter((profile) => !profile.path.startsWith('custom/'));

      expect(seeded.map((profile) => profile.code)).to.include(defaultReplicationProfile.code);
      for (const profile of seeded) {
        expect(() => loadReplicationProfileModel(profile), profile.path).not.to.throw();
      }
    });

    it('should reject a missing template', () => {
      const profile = reference(`custom/fixtures/${codePrefix}missing.v1.json`);
      const error = catchTemplateError(() => loadReplicationProfileModel(profile));

      expect(error.reason).to.be.eq('not_found');
      expect(error.status).to.be.eq(500);
      expect(error.message).to.be.eq(
        `Template "${profile.path}" of replication profile ${profile.code} (latest) does not exist.`,
      );
    });

    it('should reject a template that cannot be read', () => {
      const profile = reference(`custom/fixtures/${codePrefix}unreadable.v1.json`);
      const file = resolveReplicationProfileTemplatePath(profile);
      // A directory where the template should be makes reading it fail.
      fs.mkdirSync(file, { recursive: true });

      try {
        const error = catchTemplateError(() => loadReplicationProfileModel(profile));

        expect(error.reason).to.be.eq('unreadable');
        expect(error.status).to.be.eq(500);
        expect(error.message).to.be.eq(
          `Template "${profile.path}" of replication profile ${profile.code} (latest) could not be read (EISDIR).`,
        );
      } finally {
        fs.rmdirSync(file);
      }
    });

    it('should reject a template that is not valid JSON', () => {
      const profile = writeRawTemplate('{ "replicate": {}, ');
      const error = catchTemplateError(() => loadReplicationProfileModel(profile));

      expect(error.reason).to.be.eq('invalid_json');
      expect(error.message).to.match(
        new RegExp(`^Template "${profile.path}" of replication profile .+ is not valid JSON: `),
      );
    });

    it('should reject a template that does not hold a model object', () => {
      for (const content of ['[]', '"model"', 'null']) {
        const profile = writeRawTemplate(content);
        const error = catchTemplateError(() => loadReplicationProfileModel(profile));

        expect(error.reason, content).to.be.eq('invalid_model');
        expect(
          error.validationErrors.map((entry) => entry.code),
          content,
        ).to.include('invalid_model');
      }
    });

    it('should reject a template whose model structure is invalid for the profile', () => {
      const profile = writeRawTemplate(
        JSON.stringify({ compatibility: { target_kinds: ['cluster'] } }),
      );
      const error = catchTemplateError(() => loadReplicationProfileModel(profile));

      expect(error.reason).to.be.eq('invalid_model');
      expect(error.message).to.contain('does not contain a valid replication profile model');
      expect(error.validationErrors).not.to.be.empty;
      expect(error.toResponse().errors).to.deep.eq({ template: error.validationErrors });
    });

    it('should reject a template linked to a file outside its directory', () => {
      const profile = reference(`custom/fixtures/${codePrefix}link.v1.json`);
      const file = resolveReplicationProfileTemplatePath(profile);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.symlinkSync(path.resolve('config', 'test.json'), file);

      try {
        const error = catchTemplateError(() => loadReplicationProfileModel(profile));

        expect(error.reason).to.be.eq('invalid_path');
        expect(error.message).to.contain('resolves outside its templates directory');
      } finally {
        fs.rmSync(file, { force: true });
      }
    });
  });

  describe('writeReplicationProfileModel()', () => {
    it('should write a template that loads back the same model', () => {
      const profile = reference(`custom/fixtures/${codePrefix}written.v1.json`);
      const model = { compatibility: { target_kinds: ['firewall'] }, replicate: {}, options: {} };

      writeReplicationProfileModel(profile, model);

      expect(loadReplicationProfileModel(profile)).to.deep.eq(model);
      expect(
        fs
          .readdirSync(path.dirname(resolveReplicationProfileTemplatePath(profile)))
          .filter((fileName) => fileName.startsWith(`${codePrefix}written`)),
      ).to.deep.eq([`${codePrefix}written.v1.json`]);
    });
  });

  describe('removeReplicationProfileModel()', () => {
    it('should remove the template and accept one that is already gone', () => {
      const profile = reference(`custom/fixtures/${codePrefix}removed.v1.json`);
      writeReplicationProfileModel(profile, { replicate: {}, options: {} });

      removeReplicationProfileModel(profile);

      expect(templateExists(profile)).to.be.false;
      expect(() => removeReplicationProfileModel(profile)).not.to.throw();
    });
  });
});
