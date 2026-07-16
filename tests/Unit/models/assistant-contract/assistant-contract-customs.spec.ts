import { describeName, expect } from '../../../mocha/global-setup';
import { AssistantContractCustoms } from '../../../../src/models/assistant-contract/assistant-contract-customs';
import { VendoredContractSchema } from '../../../../src/models/assistant-contract/schemas/manifest';
import validSuccess from './fixtures/valid-success.json';
import validClarification from './fixtures/valid-clarification.json';
import validValidationFailed from './fixtures/valid-validation-failed.json';
import invalidMissingField from './fixtures/invalid-missing-field.json';
import invalidWrongType from './fixtures/invalid-wrong-type.json';
import invalidUnknownVersion from './fixtures/invalid-unknown-version.json';
import invalidAdditionalProperty from './fixtures/invalid-additional-property.json';

describe(describeName('AssistantContractCustoms Unit Tests'), () => {
  describe('against the real vendored apg.mvp.v1 schema (N)', () => {
    const customs = new AssistantContractCustoms();

    it('should accept a valid success fixture', () => {
      const result = customs.check(validSuccess);
      expect(result.ok).to.be.true;
    });

    it('should accept a valid needs_clarification fixture', () => {
      const result = customs.check(validClarification);
      expect(result.ok).to.be.true;
    });

    it('should accept a valid validation_failed fixture', () => {
      const result = customs.check(validValidationFailed);
      expect(result.ok).to.be.true;
    });

    it('should reject a fixture missing a required field', () => {
      const result = customs.check(invalidMissingField);
      expect(result.ok).to.be.false;
      if (result.ok === false) {
        expect(result.reason).to.equal('schema_violation');
        expect(result.errors.some((e) => e.message.includes("required property 'intent'"))).to.be
          .true;
      }
    });

    it('should reject a fixture with a wrong field type', () => {
      const result = customs.check(invalidWrongType);
      expect(result.ok).to.be.false;
      if (result.ok === false) {
        expect(result.reason).to.equal('schema_violation');
        expect(result.errors.some((e) => e.instancePath === '/intent/confidence')).to.be.true;
      }
    });

    it('should reject a fixture with an unknown/unsupported schemaVersion', () => {
      const result = customs.check(invalidUnknownVersion);
      expect(result.ok).to.be.false;
      if (result.ok === false) {
        expect(result.reason).to.equal('unknown_schema_version');
        expect(result.schemaVersion).to.equal('9.9.9');
      }
    });

    it('should reject a fixture with an additional/unexpected property', () => {
      const result = customs.check(invalidAdditionalProperty);
      expect(result.ok).to.be.false;
      if (result.ok === false) {
        expect(result.reason).to.equal('schema_violation');
        expect(result.errors.some((e) => e.message.includes('additional properties'))).to.be.true;
      }
    });

    it('should reject a non-object payload as malformed', () => {
      for (const bogus of [null, 'a string', 42, ['array']]) {
        const result = customs.check(bogus);
        expect(result.ok, JSON.stringify(bogus)).to.be.false;
        if (result.ok === false) {
          expect(result.reason).to.equal('malformed_payload');
        }
      }
    });

    it('should reject a payload missing metadata.schemaVersion entirely', () => {
      const { metadata, ...rest } = validSuccess as Record<string, unknown>;
      const result = customs.check(rest);
      expect(result.ok).to.be.false;
      if (result.ok === false) {
        expect(result.reason).to.equal('unknown_schema_version');
        expect(result.schemaVersion).to.be.null;
      }
    });

    it('should expose the accepted schema version(s)', () => {
      expect(customs.acceptedSchemaVersions).to.deep.equal(['1.0.0']);
    });
  });

  describe('N/N-1 acceptance window (synthetic manifest)', () => {
    const simpleObjectSchema = (requiredField: string) => ({
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      type: 'object',
      additionalProperties: true,
      properties: {
        metadata: {
          type: 'object',
          properties: { schemaVersion: { type: 'string' } },
          required: ['schemaVersion'],
        },
      },
      required: ['metadata', requiredField],
    });

    const syntheticManifest: VendoredContractSchema[] = [
      {
        contractVersion: 'apg.test.vN',
        schemaVersion: '0.9.0',
        schema: simpleObjectSchema('legacyField'),
        sourceRepo: 'test-fixture',
        sourcePath: 'n/a',
        sourceCommit: 'n/a',
        sha256: 'n/a',
        vendoredAt: '2026-01-01',
      },
      {
        contractVersion: 'apg.test.vN',
        schemaVersion: '1.0.0',
        schema: simpleObjectSchema('currentField'),
        sourceRepo: 'test-fixture',
        sourcePath: 'n/a',
        sourceCommit: 'n/a',
        sha256: 'n/a',
        vendoredAt: '2026-02-01',
      },
    ];

    const customs = new AssistantContractCustoms(syntheticManifest);

    it('should accept the current version N', () => {
      const result = customs.check({
        metadata: { schemaVersion: '1.0.0' },
        currentField: true,
      });
      expect(result.ok).to.be.true;
    });

    it('should accept the previous version N-1', () => {
      const result = customs.check({
        metadata: { schemaVersion: '0.9.0' },
        legacyField: true,
      });
      expect(result.ok).to.be.true;
    });

    it('should reject a version older than N-1', () => {
      const olderManifest = [
        {
          ...syntheticManifest[0],
          schemaVersion: '0.8.0',
        },
        ...syntheticManifest,
      ];
      const customsWithHistory = new AssistantContractCustoms(olderManifest);

      const result = customsWithHistory.check({ metadata: { schemaVersion: '0.8.0' } });
      expect(result.ok).to.be.false;
      if (result.ok === false) {
        expect(result.reason).to.equal('unknown_schema_version');
      }
      expect(customsWithHistory.acceptedSchemaVersions).to.deep.equal(['0.9.0', '1.0.0']);
    });

    it('should throw when constructed with an empty manifest', () => {
      expect(() => new AssistantContractCustoms([])).to.throw(
        /requires at least one vendored contract schema/,
      );
    });
  });
});
