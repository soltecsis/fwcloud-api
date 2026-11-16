import { expect } from 'chai';
import {
  isSensitiveAuditKey,
  maskSensitiveAuditText,
  sanitizeAuditData,
} from '../../../../src/models/audit/audit-log-sanitizer';

describe('Audit log sanitization compatibility', () => {
  it('redacts nested credential fields without changing the source payload', () => {
    const input = {
      name: 'visible',
      body: [{ Password: 'secret', authCode: '123456', sessionCookie: 'cookie' }],
    };
    expect(sanitizeAuditData(input)).to.deep.equal({
      name: 'visible',
      body: [{ Password: '[REDACTED]', authCode: '[REDACTED]', sessionCookie: '[REDACTED]' }],
    });
    expect(input.body[0].Password).to.equal('secret');
  });

  it('preserves existing markers for cycles and repeated object references', () => {
    const child = { name: 'shared' };
    const input: any = { first: child, second: child };
    input.self = input;
    expect(sanitizeAuditData(input)).to.deep.equal({
      first: { name: 'shared' },
      second: '[circular]',
      self: '[circular]',
    });
  });

  it('preserves scalar conversions, date formatting and buffer summaries', () => {
    expect(
      sanitizeAuditData([
        null,
        undefined,
        42,
        false,
        'text',
        BigInt(7),
        Symbol('value'),
        new Date('2024-01-01Z'),
        Buffer.from('abc'),
      ]),
    ).to.deep.equal([
      null,
      null,
      42,
      false,
      'text',
      '7',
      'Symbol(value)',
      '2024-01-01T00:00:00.000Z',
      '[buffer:3]',
    ]);
  });

  it('preserves invalid-date error handling at the root and inside objects', () => {
    expect(() => sanitizeAuditData(new Date('invalid'))).to.throw(RangeError);
    expect(sanitizeAuditData({ value: new Date('invalid') })).to.deep.equal({
      value: '[unserializable:Invalid time value]',
    });
  });

  it('preserves errors thrown while reading object properties', () => {
    const input = {
      get value() {
        throw new Error('property unavailable');
      },
    };
    expect(() => sanitizeAuditData(input)).to.throw('property unavailable');
  });

  it('keeps sensitive-key matching case insensitive and retains its existing spellings', () => {
    for (const key of ['Password', 'AUTHCode', 'sessionCookie', 'private_key', 'x-auth-token']) {
      expect(isSensitiveAuditKey(key)).to.equal(true);
    }
    for (const key of [null, undefined, '', 'name', 'x-api-key']) {
      expect(isSensitiveAuditKey(key)).to.equal(false);
    }
  });

  it('redacts repeated and alternating payloads consistently', () => {
    const input = 'password=secret name=visible token=hidden ...[truncated]';
    const expected = 'password=[REDACTED] name=visible token=[REDACTED] ...[truncated]';
    for (let attempt = 0; attempt < 3; attempt++) {
      expect(maskSensitiveAuditText(input)).to.equal(expected);
      expect(maskSensitiveAuditText('token=another')).to.equal('token=[REDACTED]');
    }
  });

  it('masks malformed and truncated payloads without losing visible text or truncation markers', () => {
    expect(
      maskSensitiveAuditText('password=secret name=visible token=hidden ...[truncated]'),
    ).to.equal('password=[REDACTED] name=visible token=[REDACTED] ...[truncated]');
    expect(maskSensitiveAuditText('{"password":"secret","name":"visible"')).to.equal(
      '{"password":[REDACTED],"name":"visible"',
    );
  });
});
