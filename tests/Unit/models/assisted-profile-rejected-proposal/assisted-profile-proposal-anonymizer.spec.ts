import { describeName, expect } from '../../../mocha/global-setup';
import {
  ASSISTED_PROFILE_ANONYMIZATION_FIELD_RULES,
  ASSISTED_PROFILE_ANONYMIZATION_VERSION,
  ASSISTED_PROFILE_CONTRACT_PATHS,
  AssistedProfileProposalAnonymizationError,
  AssistedProfileProposalAnonymizer,
  REDACTED_ADDRESS,
  REDACTED_SECRET,
  REDACTED_TEXT,
  REDACTED_VALUE,
  assertAnonymizedProposalIsSafe,
  isStructurallySafeToken,
} from '../../../../src/models/assisted-profile-rejected-proposal/assisted-profile-proposal-anonymizer';

/**
 * The values a captured sample must never contain. They are deliberately the
 * kind of content a pilot's rejected proposals really carry: people, customers,
 * sites, addresses and things that look like credentials.
 */
const PII_VALUES = [
  'Alice Smith',
  'alice@example.com',
  'customer-production.example.com',
  '10.20.30.40',
  '2001:41d0:303:2b2c::1',
  '00:1B:44:11:3A:B7',
  'Madrid-office',
  'ACME Industrial S.L.',
  'Ask Alice Smith (alice@example.com) before touching the Madrid-office uplink',
  'branch-alicante',
];

/** A rejected proposal shaped like the contract, stuffed with the values above. */
function piiProposal(): Record<string, unknown> {
  return {
    status: 'validation_failed',
    intent: {
      detectedTarget: 'cluster',
      confidence: 0.71,
      language: 'es',
      summary: 'Cluster para ACME Industrial S.L. en Madrid-office',
    },
    plan: [{ step: 1, title: 'Crear cluster', description: 'Cluster de Alice Smith' }],
    warnings: [{ code: 'ROLE_GUESSED', severity: 'warning', message: 'Guessed for Madrid-office' }],
    errors: [
      {
        code: 'MISSING_SYNC_INTERFACE',
        severity: 'error',
        field: 'generated.target.interfaces',
        message: 'Ask Alice Smith (alice@example.com) before touching the Madrid-office uplink',
      },
    ],
    clarification: null,
    fwcloudPayload: null,
    generated: {
      profile: {
        code: 'branch-alicante',
        name: 'ACME Industrial S.L.',
        description: 'Perfil de Madrid-office',
        requiredRoles: ['wan', 'lan', 'sync'],
        targetTypes: ['cluster'],
        version: 1,
      },
      roleAssignments: {
        interfaceRoles: [
          {
            interfaceName: 'branch-alicante',
            role: 'wan',
            node: 'customer-production.example.com',
          },
          { interfaceName: 'lan0', role: 'lan', node: 'customer-production.example.com' },
        ],
        nodeRoles: [{ nodeName: 'customer-production.example.com', role: 'primary' }],
      },
      target: {
        type: 'cluster',
        name: 'ACME Industrial S.L.',
        interfaces: [
          {
            name: 'branch-alicante',
            role: 'wan',
            address: '10.20.30.40/24',
            description: 'Uplink de Madrid-office',
            node: 'customer-production.example.com',
          },
          {
            name: 'lan0',
            role: 'lan',
            address: '2001:41d0:303:2b2c::1/64',
            description: null,
            node: 'customer-production.example.com',
          },
        ],
        nodes: [{ name: 'customer-production.example.com', role: 'primary' }],
      },
      rules: [
        {
          action: 'allow',
          sourceRole: 'lan',
          destinationRole: 'wan',
          service: 'tcp/443',
          description: 'Salida HTTPS para Alice Smith',
        },
      ],
    },
    requestId: 'req-alice@example.com-1',
    metadata: {
      schemaVersion: '1.0.0',
      modelProvider: 'local',
      generatedAt: '2026-08-17T10:00:00Z',
    },
  };
}

function serialize(payload: unknown): string {
  return JSON.stringify(payload);
}

describe(describeName('AssistedProfileProposalAnonymizer unit tests'), () => {
  const anonymizer = new AssistedProfileProposalAnonymizer();

  describe('PII fixture', () => {
    it('leaves no original sensitive value in the persisted representation', () => {
      const result = anonymizer.anonymize(piiProposal());
      const serialized = serialize(result.payload);

      for (const value of PII_VALUES) {
        expect(serialized).to.not.contain(value);
      }
      // Individual identifying tokens must not survive inside longer strings.
      for (const token of ['Alice', 'alice', 'ACME', 'Madrid', 'alicante', 'example.com']) {
        expect(serialized).to.not.contain(token);
      }
    });

    it('applies the documented transformation for every field class', () => {
      const payload = anonymizer.anonymize(piiProposal()).payload as Record<string, any>;

      // preserve: enum-ish, structurally safe values
      expect(payload.status).to.equal('validation_failed');
      expect(payload.intent.detectedTarget).to.equal('cluster');
      expect(payload.intent.confidence).to.equal(0.71);
      expect(payload.intent.language).to.equal('es');
      expect(payload.metadata).to.deep.equal({
        schemaVersion: '1.0.0',
        modelProvider: 'local',
        generatedAt: '2026-08-17T10:00:00Z',
      });
      expect(payload.errors[0].code).to.equal('MISSING_SYNC_INTERFACE');
      expect(payload.errors[0].severity).to.equal('error');
      expect(payload.errors[0].field).to.equal('generated.target.interfaces');
      expect(payload.generated.profile.requiredRoles).to.deep.equal(['wan', 'lan', 'sync']);
      expect(payload.generated.rules[0]).to.deep.include({
        action: 'allow',
        sourceRole: 'lan',
        destinationRole: 'wan',
        service: 'tcp/443',
      });

      // text: always a placeholder, never sanitized in place
      expect(payload.intent.summary).to.equal(REDACTED_TEXT);
      expect(payload.plan[0].title).to.equal(REDACTED_TEXT);
      expect(payload.plan[0].description).to.equal(REDACTED_TEXT);
      expect(payload.warnings[0].message).to.equal(REDACTED_TEXT);
      expect(payload.errors[0].message).to.equal(REDACTED_TEXT);
      expect(payload.generated.profile.description).to.equal(REDACTED_TEXT);
      expect(payload.generated.rules[0].description).to.equal(REDACTED_TEXT);
      // an explicit null free-text field stays distinguishable from a redacted one
      expect(payload.generated.target.interfaces[1].description).to.be.null;

      // pseudonyms: typed and stable
      expect(payload.generated.target.name).to.match(/^resource-\d+$/);
      expect(payload.generated.target.interfaces[0].name).to.match(/^iface-\d+$/);
      expect(payload.generated.target.nodes[0].name).to.match(/^node-\d+$/);

      // drop: the agent's own correlation id is not persisted at all
      expect(payload).to.not.have.property('requestId');
    });

    it('records the anonymization version and per-rule counts only', () => {
      const result = anonymizer.anonymize(piiProposal());

      expect(Object.keys(result).sort()).to.deep.equal([
        'anonymizationVersion',
        'payload',
        'redactions',
      ]);
      expect(result.anonymizationVersion).to.equal(ASSISTED_PROFILE_ANONYMIZATION_VERSION);
      expect(result.anonymizationVersion).to.equal('rejected-proposal-anonymization.v1');
      // Counts, never the values they replaced.
      for (const count of Object.values(result.redactions)) {
        expect(count).to.be.a('number');
      }
      expect(result.redactions.free_text).to.be.greaterThan(0);
      expect(result.redactions.pseudonym).to.be.greaterThan(0);
    });

    it('persists no reversible original-to-anonymized mapping', () => {
      const result = anonymizer.anonymize(piiProposal());
      const serialized = serialize(result);

      // The pseudonym table lives only inside the call; nothing in the output
      // pairs a placeholder with the value it replaced.
      expect(serialized).to.not.contain('branch-alicante');
      expect(serialized).to.not.contain('example.com');
      // Two runs over the same proposal must not accumulate state either.
      expect(serialize(anonymizer.anonymize(piiProposal()).payload)).to.equal(
        serialize(result.payload),
      );
    });
  });

  describe('stable replacement', () => {
    it('maps one original value to one placeholder across the whole proposal', () => {
      const payload = anonymizer.anonymize(piiProposal()).payload as Record<string, any>;

      const interfaceName = payload.generated.target.interfaces[0].name;
      expect(payload.generated.roleAssignments.interfaceRoles[0].interfaceName).to.equal(
        interfaceName,
      );

      const nodeName = payload.generated.target.nodes[0].name;
      expect(payload.generated.roleAssignments.nodeRoles[0].nodeName).to.equal(nodeName);
      expect(payload.generated.target.interfaces[0].node).to.equal(nodeName);
      expect(payload.generated.target.interfaces[1].node).to.equal(nodeName);
    });

    it('keeps different originals different', () => {
      const payload = anonymizer.anonymize(piiProposal()).payload as Record<string, any>;

      expect(payload.generated.target.interfaces[0].name).to.not.equal(
        payload.generated.target.interfaces[1].name,
      );
    });

    it('reuses the same placeholder for a repeated value, not two unrelated ones', () => {
      const payload = anonymizer.anonymize({
        generated: {
          target: {
            type: 'cluster',
            name: 'branch-alicante',
            interfaces: [
              { name: 'branch-alicante', role: 'wan' },
              { name: 'branch-alicante', role: 'lan' },
            ],
            nodes: [],
          },
          rules: [],
        },
      }).payload as Record<string, any>;

      const [first, second] = payload.generated.target.interfaces;
      expect(first.name).to.equal(second.name);
      expect(first.role).to.equal('wan');
      expect(second.role).to.equal('lan');
      // The same label reused in an unrelated field class becomes an
      // independent pseudonym: the placeholder prefix stays truthful and no
      // link is created where the contract does not define one.
      expect(payload.generated.target.name).to.match(/^resource-\d+$/);
      expect(payload.generated.target.name).to.not.equal(first.name);
    });
  });

  describe('IP address handling', () => {
    const addressProposal = (address: unknown): Record<string, unknown> => ({
      generated: {
        target: {
          type: 'firewall',
          name: 'fw',
          interfaces: [{ name: 'wan0', role: 'wan', address }],
          nodes: [],
        },
        rules: [],
      },
    });

    const addressOf = (proposal: Record<string, unknown>): string =>
      (anonymizer.anonymize(proposal).payload as any).generated.target.interfaces[0].address;

    it('replaces a public IPv4 host address with a documentation address', () => {
      expect(addressOf(addressProposal('93.184.216.34'))).to.equal('198.51.100.1');
    });

    it('does not treat RFC1918 addresses as non-sensitive', () => {
      expect(addressOf(addressProposal('192.168.73.12'))).to.equal('198.51.100.1');
      expect(addressOf(addressProposal('10.20.30.40'))).to.equal('198.51.100.1');
      expect(addressOf(addressProposal('172.16.5.9'))).to.equal('198.51.100.1');
    });

    it('preserves the prefix length while generalizing the network', () => {
      expect(addressOf(addressProposal('192.168.73.12/24'))).to.equal('198.51.100.1/24');
      expect(addressOf(addressProposal('10.0.0.0/8'))).to.equal('198.51.100.1/8');
    });

    it('replaces IPv6 addresses from the IPv6 documentation range', () => {
      expect(addressOf(addressProposal('2001:41d0:303:2b2c::1'))).to.equal('2001:db8::1');
      expect(addressOf(addressProposal('fe80::1234:5678:9abc:def0/64'))).to.equal('2001:db8::1/64');
    });

    it('replaces MAC addresses with a locally administered placeholder', () => {
      expect(addressOf(addressProposal('00:1B:44:11:3A:B7'))).to.equal('02:00:00:00:00:01');
    });

    it('allocates one placeholder per distinct address and repeats it for equal ones', () => {
      const payload = anonymizer.anonymize({
        generated: {
          target: {
            type: 'cluster',
            name: 'fw',
            interfaces: [
              { name: 'a', role: 'wan', address: '10.0.0.1/24' },
              { name: 'b', role: 'lan', address: '10.0.0.2/24' },
              { name: 'c', role: 'dmz', address: '10.0.0.1/24' },
            ],
            nodes: [],
          },
          rules: [],
        },
      }).payload as Record<string, any>;

      const [first, second, third] = payload.generated.target.interfaces;
      expect(first.address).to.equal('198.51.100.1/24');
      expect(second.address).to.equal('198.51.100.2/24');
      expect(third.address).to.equal(first.address);
    });

    it('generalizes an address that appears where the policy expects an enum', () => {
      const payload = anonymizer.anonymize({
        status: 'validation_failed',
        intent: { detectedTarget: 'firewall', confidence: 1, summary: 'x', language: '10.0.0.1' },
      }).payload as Record<string, any>;

      expect(payload.intent.language).to.equal('198.51.100.1');
    });

    it('falls back to a typed placeholder once the documentation pool is exhausted', () => {
      // 300 distinct addresses, spread over arrays small enough to stay inside
      // the structural limits.
      const group = (base: number): string[] =>
        Array.from({ length: 100 }, (_unused, index) => `10.0.${base}.${index}`);
      const payload = anonymizer.anonymize({
        fwcloudPayload: {
          operation: 'apply',
          targetType: 'firewall',
          payload: { a: group(1), b: group(2), c: group(3) },
        },
      }).payload as Record<string, any>;

      const addresses = [
        ...payload.fwcloudPayload.payload.a,
        ...payload.fwcloudPayload.payload.b,
        ...payload.fwcloudPayload.payload.c,
      ];
      expect(addresses[0]).to.equal('198.51.100.1');
      expect(addresses[253]).to.equal('198.51.100.254');
      expect(addresses[254]).to.equal(REDACTED_ADDRESS);
      expect(addresses[addresses.length - 1]).to.equal(REDACTED_ADDRESS);
    });

    it('emits a bare placeholder, not a placeholder with a prefix, once exhausted', () => {
      // A prefix appended to `<redacted-address>` would be neither a
      // placeholder nor an address, and the output guard would reject the whole
      // sample rather than the one address it could not allocate.
      const group = (base: number): string[] =>
        Array.from({ length: 100 }, (_unused, index) => `10.0.${base}.${index}/24`);
      const result = anonymizer.anonymize({
        fwcloudPayload: {
          operation: 'apply',
          targetType: 'firewall',
          payload: { a: group(1), b: group(2), c: group(3) },
        },
      });

      const addresses = [
        ...(result.payload as any).fwcloudPayload.payload.a,
        ...(result.payload as any).fwcloudPayload.payload.c,
      ];
      expect(addresses[0]).to.equal('198.51.100.1/24');
      expect(addresses[addresses.length - 1]).to.equal(REDACTED_ADDRESS);
      expect(() => assertAnonymizedProposalIsSafe(result.payload)).to.not.throw();
    });
  });

  describe('free-text handling', () => {
    it('replaces every free-text field rather than sanitizing it in place', () => {
      const payload = anonymizer.anonymize({
        status: 'needs_clarification',
        clarification: {
          questions: [
            {
              code: 'WHICH_SITE',
              question: 'Is this for Madrid-office or for ACME Industrial S.L.?',
              required: true,
              expectedAnswerType: 'choice',
              options: ['Madrid-office', 'ACME Industrial S.L.'],
            },
          ],
        },
      }).payload as Record<string, any>;

      const question = payload.clarification.questions[0];
      expect(question.code).to.equal('WHICH_SITE');
      expect(question.required).to.equal(true);
      expect(question.expectedAnswerType).to.equal('choice');
      expect(question.question).to.equal(REDACTED_TEXT);
      expect(question.options).to.deep.equal([REDACTED_TEXT, REDACTED_TEXT]);
    });

    it('redacts a value that looks like prose even at a preserved path', () => {
      const payload = anonymizer.anonymize({
        generated: {
          target: { type: 'firewall', name: 'fw', interfaces: [], nodes: [] },
          rules: [
            {
              action: 'allow',
              sourceRole: 'lan',
              destinationRole: 'wan',
              service: 'whatever Alice Smith asked for',
            },
          ],
        },
      }).payload as Record<string, any>;

      expect(payload.generated.rules[0].service).to.equal(REDACTED_TEXT);
    });

    it('redacts a hostname or e-mail address at a preserved path', () => {
      const payload = anonymizer.anonymize({
        errors: [
          {
            code: 'BAD',
            severity: 'error',
            field: 'customer-production.example.com',
            message: 'x',
          },
          { code: 'alice@example.com', severity: 'error', message: 'x' },
        ],
      }).payload as Record<string, any>;

      expect(payload.errors[0].field).to.equal(REDACTED_VALUE);
      expect(payload.errors[1].code).to.equal(REDACTED_TEXT);
    });
  });

  describe('secret-like values', () => {
    it('removes values whose key looks like a credential, subtree included', () => {
      const payload = anonymizer.anonymize({
        status: 'success',
        fwcloudPayload: {
          operation: 'apply',
          targetType: 'firewall',
          payload: {
            password: 'S3cr3t-Pa55w0rd!',
            apiKey: 'AKIAIOSFODNN7EXAMPLE',
            access_token: 'ya29.a0AfH6SMB',
            credentials: { user: 'root', privateKey: 'irrelevant' },
            sessionId: 'abc123',
            authorization: 'Bearer eyJhbGciOiJIUzI1NiJ9',
          },
        },
      }).payload as Record<string, any>;

      const inner = payload.fwcloudPayload.payload;
      expect(inner.password).to.equal(REDACTED_SECRET);
      expect(inner.apiKey).to.equal(REDACTED_SECRET);
      expect(inner.access_token).to.equal(REDACTED_SECRET);
      expect(inner.credentials).to.equal(REDACTED_SECRET);
      expect(inner.sessionId).to.equal(REDACTED_SECRET);
      expect(inner.authorization).to.equal(REDACTED_SECRET);
      expect(serialize(payload)).to.not.contain('root');
      expect(serialize(payload)).to.not.contain('S3cr3t');
    });

    it('removes credential-shaped values whose key looks innocent', () => {
      const secrets = {
        a: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload.signature',
        b: '-----BEGIN RSA PRIVATE KEY-----\nMIIEow==\n-----END RSA PRIVATE KEY-----',
        c: 'password=hunter2',
        d: 'postgres://fwcloud:hunter2@db.internal:5432/fwcloud',
        e: 'sk-abcdef0123456789abcdef',
        f: 'AKIAIOSFODNN7EXAMPLEAKIAIOSFODNN7EXAMPLE',
      };
      const payload = anonymizer.anonymize({
        fwcloudPayload: { operation: 'apply', targetType: 'firewall', payload: secrets },
      }).payload as Record<string, any>;

      for (const key of Object.keys(secrets)) {
        expect(payload.fwcloudPayload.payload[key]).to.equal(REDACTED_SECRET);
      }
      const serialized = serialize(payload);
      expect(serialized).to.not.contain('hunter2');
      expect(serialized).to.not.contain('PRIVATE KEY');
      expect(serialized).to.not.contain('db.internal');
    });

    it('never pseudonymizes a credential into a reusable placeholder', () => {
      const payload = anonymizer.anonymize({
        generated: {
          target: {
            type: 'firewall',
            name: 'Bearer eyJhbGciOiJIUzI1NiJ9abcdef',
            interfaces: [],
            nodes: [],
          },
          rules: [],
        },
      }).payload as Record<string, any>;

      expect(payload.generated.target.name).to.equal(REDACTED_SECRET);
    });
  });

  describe('structural utility', () => {
    it('keeps the structure a domain-validation failure depends on', () => {
      const payload = anonymizer.anonymize(piiProposal()).payload as Record<string, any>;

      // The rejection was "missing sync interface": the shape that proves it is
      // still fully analyzable after anonymization.
      expect(payload.generated.target.type).to.equal('cluster');
      expect(payload.generated.target.interfaces).to.have.length(2);
      expect(payload.generated.target.interfaces.map((item: any) => item.role)).to.deep.equal([
        'wan',
        'lan',
      ]);
      expect(payload.generated.profile.requiredRoles).to.contain('sync');
      expect(payload.generated.roleAssignments.nodeRoles[0].role).to.equal('primary');
      expect(payload.generated.rules).to.have.length(1);
    });

    it('preserves contract enum values even at unknown paths', () => {
      const payload = anonymizer.anonymize({
        fwcloudPayload: {
          operation: 'create_cluster',
          targetType: 'cluster',
          payload: { mode: 'firewall', nested: { status: 'success', count: 3, on: true } },
        },
      }).payload as Record<string, any>;

      expect(payload.fwcloudPayload.operation).to.equal('create_cluster');
      expect(payload.fwcloudPayload.payload.mode).to.equal('firewall');
      expect(payload.fwcloudPayload.payload.nested).to.deep.equal({
        status: 'success',
        count: 3,
        on: true,
      });
    });

    it('defaults to redaction for unknown string values', () => {
      const payload = anonymizer.anonymize({
        status: 'success',
        unexpectedProperty: 'Madrid-office uplink for ACME',
      }).payload as Record<string, any>;

      expect(payload.status).to.equal('success');
      expect(payload.unexpectedProperty).to.equal(REDACTED_VALUE);
    });

    it('pseudonymizes object keys that are content rather than identifiers', () => {
      const payload = anonymizer.anonymize({
        fwcloudPayload: {
          operation: 'apply',
          targetType: 'firewall',
          payload: { 'alice@example.com': 1, 'Madrid office': 2, keepThis: 3 },
        },
      }).payload as Record<string, any>;

      const keys = Object.keys(payload.fwcloudPayload.payload);
      expect(keys).to.contain('keepThis');
      expect(keys.filter((key) => /^key-\d+$/.test(key))).to.have.length(2);
      expect(serialize(payload)).to.not.contain('alice@example.com');
      expect(serialize(payload)).to.not.contain('Madrid');
    });

    it('records only the type of a payload that is not a JSON object', () => {
      const result = anonymizer.anonymize('Alice Smith asked for a firewall');

      expect(result.payload).to.deep.equal({ nonObjectPayload: true, valueType: 'string' });
      expect(serialize(result.payload)).to.not.contain('Alice');
      expect(result.redactions.non_object_payload).to.equal(1);
    });
  });

  describe('failure modes', () => {
    it('fails rather than partially sanitizing a payload nested too deeply', () => {
      let nested: Record<string, unknown> = { leaf: 'x' };
      for (let index = 0; index < 20; index += 1) {
        nested = { nested };
      }

      expect(() => anonymizer.anonymize(nested)).to.throw(
        AssistedProfileProposalAnonymizationError,
      );
    });

    it('fails on an over-sized array, object or node count', () => {
      expect(() => anonymizer.anonymize({ items: Array.from({ length: 201 }, () => 1) })).to.throw(
        AssistedProfileProposalAnonymizationError,
      );

      const wide: Record<string, unknown> = {};
      for (let index = 0; index < 201; index += 1) {
        wide[`k${index}`] = 1;
      }
      expect(() => anonymizer.anonymize(wide)).to.throw(AssistedProfileProposalAnonymizationError);

      const many: Record<string, unknown> = {};
      for (let index = 0; index < 60; index += 1) {
        many[`group${index}`] = Array.from({ length: 100 }, () => ({ a: 1 }));
      }
      expect(() => anonymizer.anonymize(many)).to.throw(AssistedProfileProposalAnonymizationError);
    });

    it('fails on values that are not JSON data', () => {
      expect(() => anonymizer.anonymize({ confidence: Number.NaN })).to.throw(
        AssistedProfileProposalAnonymizationError,
      );
      expect(() => anonymizer.anonymize({ hook: () => undefined })).to.throw(
        AssistedProfileProposalAnonymizationError,
      );
      expect(() => anonymizer.anonymize({ when: new Date() })).to.throw(
        AssistedProfileProposalAnonymizationError,
      );
    });
  });

  describe('assertAnonymizedProposalIsSafe', () => {
    it('accepts the anonymizer output', () => {
      const result = anonymizer.anonymize(piiProposal());
      expect(() => assertAnonymizedProposalIsSafe(result.payload)).to.not.throw();
    });

    it('rejects payloads that still hold identifying content', () => {
      for (const unsafe of [
        { name: 'Alice Smith' },
        { host: 'customer-production.example.com' },
        { mail: 'alice@example.com' },
        { address: '10.20.30.40' },
        { address: 'fe80::1' },
        { mac: '00:1b:44:11:3a:b7' },
        { url: 'https://intranet.acme.example/setup' },
        { note: 'a sentence with spaces' },
        { password: 'hunter2' },
        { confidence: Number.POSITIVE_INFINITY },
      ]) {
        expect(() => assertAnonymizedProposalIsSafe(unsafe)).to.throw(
          AssistedProfileProposalAnonymizationError,
        );
      }
    });

    it('accepts placeholders, pseudonyms, documentation addresses and safe tokens', () => {
      expect(() =>
        assertAnonymizedProposalIsSafe({
          text: REDACTED_TEXT,
          secret: REDACTED_SECRET,
          value: REDACTED_VALUE,
          missing: REDACTED_ADDRESS,
          name: 'iface-1',
          other: 'node-2',
          v4: '198.51.100.7/24',
          v6: '2001:db8::a/64',
          mac: '02:00:00:00:00:01',
          role: 'wan',
          service: 'tcp/443',
          when: '2026-08-17T10:00:00Z',
          version: '1.0.0',
          nested: [{ deep: 'allow' }, null, 3, false],
        }),
      ).to.not.throw();
    });
  });

  describe('policy definition', () => {
    it('classifies every field of the vendored contract', () => {
      // Every leaf the mapper and validator care about must have an explicit
      // rule; anything new falls back to default-deny, which is safe but loses
      // evaluation value silently.
      for (const path of [
        'status',
        'intent.summary',
        'errors[].message',
        'generated.target.name',
        'generated.target.interfaces[].address',
        'generated.rules[].action',
        'metadata.schemaVersion',
      ]) {
        expect(ASSISTED_PROFILE_ANONYMIZATION_FIELD_RULES).to.have.property(path);
      }
    });

    it('derives contract container paths from the rule table', () => {
      expect(ASSISTED_PROFILE_CONTRACT_PATHS.has('generated.target.interfaces')).to.equal(true);
      expect(ASSISTED_PROFILE_CONTRACT_PATHS.has('generated.target')).to.equal(true);
      expect(ASSISTED_PROFILE_CONTRACT_PATHS.has('generated.target.interfaces[].name')).to.equal(
        true,
      );
      expect(ASSISTED_PROFILE_CONTRACT_PATHS.has('customer-production.example.com')).to.equal(
        false,
      );
    });

    it('treats identifying shapes as unsafe tokens', () => {
      expect(isStructurallySafeToken('wan0')).to.equal(true);
      expect(isStructurallySafeToken('tcp/443')).to.equal(true);
      expect(isStructurallySafeToken('1.0.0')).to.equal(true);
      expect(isStructurallySafeToken('apg.mvp.v1')).to.equal(true);
      expect(isStructurallySafeToken('example.com')).to.equal(false);
      expect(isStructurallySafeToken('alice@example.com')).to.equal(false);
      expect(isStructurallySafeToken('10.0.0.1')).to.equal(false);
      expect(isStructurallySafeToken('two words')).to.equal(false);
      expect(isStructurallySafeToken('x'.repeat(65))).to.equal(false);
    });
  });
});
