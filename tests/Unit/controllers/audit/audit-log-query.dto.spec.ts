import 'reflect-metadata';
import { expect } from 'chai';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Request } from 'express';
import { AuditLogListQueryDto } from '../../../../src/controllers/audit/dtos/audit-log-query.dto';
import { AuditLogController } from '../../../../src/controllers/audit/audit-log.controller';

describe('Audit confirmation token query validation', () => {
  for (const [value, expected] of [
    ['true', true],
    ['false', false],
    [true, true],
    [false, false],
    [undefined, undefined],
  ] as const) {
    it(`accepts ${String(value)} without treating false as truthy`, async () => {
      const dto = plainToInstance(
        AuditLogListQueryDto,
        { exclude_confirmation_token_requests: value },
        { enableImplicitConversion: true },
      );

      expect(await validate(dto)).to.have.length(0);
      expect(dto.exclude_confirmation_token_requests).to.equal(expected);
    });
  }

  for (const value of ['', 'TRUE', 'False', '1', '0', 'yes', ' false ', 1, 0, [], ['true'], {}]) {
    it(`rejects ${JSON.stringify(value)} instead of implicitly coercing it`, async () => {
      const dto = plainToInstance(
        AuditLogListQueryDto,
        { exclude_confirmation_token_requests: value },
        { enableImplicitConversion: true },
      );

      const errors = await validate(dto);
      expect(errors.map((error) => error.property)).to.include(
        'exclude_confirmation_token_requests',
      );
    });
  }
});

describe('Audit confirmation token controller options', () => {
  for (const [value, expected] of [
    ['true', true],
    ['false', false],
    [true, true],
    [false, false],
    [undefined, false],
  ] as const) {
    it(`processes ${String(value)} as exclusion=${expected}`, () => {
      const controller = new AuditLogController(null);
      const options = controller['buildOptions'](
        { query: { exclude_confirmation_token_requests: value } } as unknown as Request,
        null,
      );

      expect(options.excludeConfirmationTokenRequests).to.equal(expected);
    });
  }
});
