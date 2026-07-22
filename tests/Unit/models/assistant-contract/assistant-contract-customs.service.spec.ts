import { describeName, expect, testSuite } from '../../../mocha/global-setup';
import { Repository } from 'typeorm';
import db from '../../../../src/database/database-manager';
import { Application } from '../../../../src/Application';
import { AuditLog } from '../../../../src/models/audit/AuditLog';
import {
  ASSISTANT_CONTRACT_CUSTOMS_AUDIT_CALL,
  AssistantContractCustomsService,
  REDACTED_ASSISTANT_CONTRACT_VALUE,
} from '../../../../src/models/assistant-contract/assistant-contract-customs.service';
import { AssistantContractMismatchException } from '../../../../src/models/assistant-contract/assistant-contract-mismatch.exception';
import validSuccess from './fixtures/valid-success.json';
import invalidMissingField from './fixtures/invalid-missing-field.json';
import invalidUnknownVersion from './fixtures/invalid-unknown-version.json';
import { expectRejectedAs } from '../../../utils/assertions';

describe(describeName('AssistantContractCustomsService Unit Tests'), () => {
  let app: Application;
  let service: AssistantContractCustomsService;
  let auditRepository: Repository<AuditLog>;

  before(async () => {
    app = testSuite.app;
    await testSuite.resetDatabaseData();
    auditRepository = db.getSource().manager.getRepository(AuditLog);
  });

  beforeEach(async () => {
    service = await app.getService<AssistantContractCustomsService>(
      AssistantContractCustomsService.name,
    );

    await auditRepository.delete({ call: ASSISTANT_CONTRACT_CUSTOMS_AUDIT_CALL });
  });

  function getAuditEntries(): Promise<AuditLog[]> {
    return auditRepository.find({ where: { call: ASSISTANT_CONTRACT_CUSTOMS_AUDIT_CALL } });
  }

  it('should be provided as an application service', () => {
    expect(service).to.be.instanceOf(AssistantContractCustomsService);
  });

  it('should return the payload untouched when it passes the customs gate', async () => {
    const result = await service.validate(validSuccess);
    expect(result).to.deep.equal(validSuccess);

    expect(await getAuditEntries()).to.have.length(0);
  });

  it('should throw AssistantContractMismatchException and audit the rejection reason on a schema violation', async () => {
    const thrown = await expectRejectedAs(
      service.validate(invalidMissingField, {
        fwCloudId: 7,
        userId: 3,
        userName: 'assistant-tester',
        sessionId: 99,
        sourceIp: '10.0.0.9',
        requestId: 'request-123',
        correlationId: 'correlation-456',
        agentEndpoint: 'https://fwcloud-ai-agent:8443',
      }),
      AssistantContractMismatchException,
    );

    expect(thrown.reason).to.equal('schema_violation');
    expect(thrown.status).to.equal(502);

    const entries = await getAuditEntries();
    expect(entries).to.have.length(1);
    expect(entries[0].description).to.contain('does not conform to contract schema version');
    expect(entries[0].fwCloudId).to.equal(7);
    expect(entries[0].userId).to.equal(3);
    expect(entries[0].sourceIp).to.equal('10.0.0.9');

    const data = JSON.parse(entries[0].data);
    expect(data.reason).to.equal('schema_violation');
    expect(data.requestId).to.equal('request-123');
    expect(data.correlationId).to.equal('correlation-456');
    expect(data.agentEndpoint).to.equal('https://fwcloud-ai-agent:8443');
    expect(data.errors.some((e: { message: string }) => e.message.includes('intent'))).to.be.true;
  });

  it('should throw and audit on an unknown/unsupported schema version', async () => {
    const thrown = await expectRejectedAs(
      service.validate(invalidUnknownVersion),
      AssistantContractMismatchException,
    );

    expect(thrown.reason).to.equal('unknown_schema_version');
    expect(thrown.schemaVersion).to.equal('9.9.9');

    const entries = await getAuditEntries();
    expect(entries).to.have.length(1);
    const data = JSON.parse(entries[0].data);
    expect(data.reason).to.equal('unknown_schema_version');
    expect(data.acceptedSchemaVersions).to.deep.equal(['1.0.0']);
  });

  it('should never persist the raw rejected payload in the audit log data', async () => {
    const apiKey = 'secret-agent-api-key';
    const rejectedPayload = {
      ...invalidMissingField,
      'X-API-Key': apiKey,
    };

    await expectRejectedAs(service.validate(rejectedPayload), AssistantContractMismatchException);

    const entries = await getAuditEntries();
    expect(entries).to.have.length(1);
    const data = JSON.parse(entries[0].data);
    expect(data).to.not.have.property('payload');
    expect(JSON.stringify(data)).to.not.contain('req-missing-intent');
    expect(JSON.stringify(data)).to.not.contain(apiKey);
    expect(data).to.not.have.property('X-API-Key');
  });

  it('should redact a sensitive value echoed as the untrusted schema version', async () => {
    const apiKey = 'secret-agent-api-key';
    const rejectedPayload = structuredClone(invalidUnknownVersion);
    rejectedPayload.metadata.schemaVersion = apiKey;

    const thrown = await expectRejectedAs(
      service.validate(rejectedPayload, { sensitiveValues: [apiKey] }),
      AssistantContractMismatchException,
    );

    expect(thrown.schemaVersion).to.equal(REDACTED_ASSISTANT_CONTRACT_VALUE);
    expect(thrown.message).to.not.contain(apiKey);

    const entries = await getAuditEntries();
    expect(entries).to.have.length(1);
    expect(entries[0].description).to.not.contain(apiKey);
    expect(entries[0].data).to.not.contain(apiKey);

    const data = JSON.parse(entries[0].data);
    expect(data.schemaVersion).to.equal(REDACTED_ASSISTANT_CONTRACT_VALUE);
  });
});
