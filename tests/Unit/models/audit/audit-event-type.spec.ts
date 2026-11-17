import 'reflect-metadata';
import { expect } from 'chai';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AuditEventType, classifyAuditEvent } from '../../../../src/models/audit/audit-event-type';
import { AuditLogListQueryDto } from '../../../../src/controllers/audit/dtos/audit-log-query.dto';

describe('Audit event classification and query validation', () => {
  const examples: Array<[string, string, string | null, number, AuditEventType]> = [
    ['PUT', '/policy/compile', null, 200, AuditEventType.Compilation],
    ['PUT', '/policy/compile/rule', null, 200, AuditEventType.Compilation],
    ['POST', '/policy/install', null, 200, AuditEventType.Installation],
    ['PUT', '/firewalls/4', 'compile', 200, AuditEventType.Compilation],
    ['POST', '/firewalls/4', 'install', 200, AuditEventType.Installation],
    ['POST', '/objects', 'store', 200, AuditEventType.Creation],
    ['POST', '/objects', null, 201, AuditEventType.Creation],
    ['POST', '/firewall', null, 200, AuditEventType.Creation],
    ['POST', '/policy/rule', null, 204, AuditEventType.Creation],
    ['PUT', '/objects/4', 'update', 200, AuditEventType.Modification],
    ['PATCH', '/objects/4', null, 200, AuditEventType.Modification],
    ['PUT', '/firewall/del', null, 200, AuditEventType.Deletion],
    ['DELETE', '/objects/4', null, 204, AuditEventType.Deletion],
    ['POST', '/user/login?token=secret', null, 401, AuditEventType.Login],
    ['POST', '/user/logout/', null, 204, AuditEventType.Logout],
    ['POST', '/custom/action', null, 200, AuditEventType.Other],
  ];
  for (const [method, path, action, status, expected] of examples) {
    it(`classifies ${method} ${path} (${action}) as ${expected}`, () => {
      expect(classifyAuditEvent(method, path, action, status)).to.equal(expected);
    });
  }

  for (const value of ['login', 'compilation, installation', ['creation', 'deletion'], 'other']) {
    it(`accepts event_type=${JSON.stringify(value)}`, async () => {
      const dto = plainToInstance(
        AuditLogListQueryDto,
        { event_type: value },
        { enableImplicitConversion: true },
      );
      expect(await validate(dto)).to.have.length(0);
      expect(dto.event_type).to.be.an('array');
    });
  }
  for (const value of ['', 'unsupported', 'login,invalid', [], ['login', ''], { type: 'login' }]) {
    it(`rejects event_type=${JSON.stringify(value)}`, async () => {
      const dto = plainToInstance(
        AuditLogListQueryDto,
        { event_type: value },
        { enableImplicitConversion: true },
      );
      expect(await validate(dto)).not.to.have.length(0);
    });
  }
});
