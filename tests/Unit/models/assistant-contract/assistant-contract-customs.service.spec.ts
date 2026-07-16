import { describeName, expect, testSuite } from '../../../mocha/global-setup';
import db from '../../../../src/database/database-manager';
import { Application } from '../../../../src/Application';
import { AuditLog } from '../../../../src/models/audit/AuditLog';
import {
  ASSISTANT_CONTRACT_CUSTOMS_AUDIT_CALL,
  AssistantContractCustomsService,
} from '../../../../src/models/assistant-contract/assistant-contract-customs.service';
import { AssistantContractMismatchException } from '../../../../src/models/assistant-contract/assistant-contract-mismatch.exception';
import validSuccess from './fixtures/valid-success.json';
import invalidMissingField from './fixtures/invalid-missing-field.json';
import invalidUnknownVersion from './fixtures/invalid-unknown-version.json';

describe(describeName('AssistantContractCustomsService Unit Tests'), () => {
  let app: Application;
  let service: AssistantContractCustomsService;

  before(async () => {
    app = testSuite.app;
    await testSuite.resetDatabaseData();
  });

  beforeEach(async () => {
    service = await app.getService<AssistantContractCustomsService>(
      AssistantContractCustomsService.name,
    );

    await db
      .getSource()
      .manager.getRepository(AuditLog)
      .delete({ call: ASSISTANT_CONTRACT_CUSTOMS_AUDIT_CALL });
  });

  function getAuditEntries(): Promise<AuditLog[]> {
    return db
      .getSource()
      .manager.getRepository(AuditLog)
      .find({ where: { call: ASSISTANT_CONTRACT_CUSTOMS_AUDIT_CALL } });
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
    let thrown: AssistantContractMismatchException | null = null;

    try {
      await service.validate(invalidMissingField, {
        fwCloudId: 7,
        userId: 3,
        userName: 'assistant-tester',
        sessionId: 99,
        sourceIp: '10.0.0.9',
      });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).to.be.instanceOf(AssistantContractMismatchException);
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
    expect(data.errors.some((e: { message: string }) => e.message.includes('intent'))).to.be.true;
  });

  it('should throw and audit on an unknown/unsupported schema version', async () => {
    let thrown: AssistantContractMismatchException | null = null;

    try {
      await service.validate(invalidUnknownVersion);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).to.be.instanceOf(AssistantContractMismatchException);
    expect(thrown.reason).to.equal('unknown_schema_version');
    expect(thrown.schemaVersion).to.equal('9.9.9');

    const entries = await getAuditEntries();
    expect(entries).to.have.length(1);
    const data = JSON.parse(entries[0].data);
    expect(data.reason).to.equal('unknown_schema_version');
    expect(data.acceptedSchemaVersions).to.deep.equal(['1.0.0']);
  });

  it('should never persist the raw rejected payload in the audit log data', async () => {
    await service.validate(invalidMissingField).catch(() => undefined);

    const entries = await getAuditEntries();
    expect(entries).to.have.length(1);
    const data = JSON.parse(entries[0].data);
    expect(data).to.not.have.property('payload');
    expect(JSON.stringify(data)).to.not.contain('req-missing-intent');
  });
});
