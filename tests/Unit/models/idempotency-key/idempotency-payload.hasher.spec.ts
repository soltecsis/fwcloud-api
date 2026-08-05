import { describeName, expect } from '../../../mocha/global-setup';
import {
  IdempotencyPayloadHasher,
  digestIdempotencyKey,
} from '../../../../src/models/idempotency-key/idempotency-payload.hasher';

describe(describeName('IdempotencyPayloadHasher Unit Tests'), () => {
  const hasher = new IdempotencyPayloadHasher();

  it('hashes semantically identical payloads with different key order identically', () => {
    const first = { z: [3, 2, 1], a: { second: true, first: 'value' } };
    const second = { a: { first: 'value', second: true }, z: [3, 2, 1] };

    expect(hasher.calculate(first)).to.equal(hasher.calculate(second));
    expect(hasher.calculate(first)).to.match(/^[a-f0-9]{64}$/);
  });

  it('produces a different hash for a semantic field change', () => {
    const first = { draftId: 1, previewHash: 'a'.repeat(64) };
    const second = { draftId: 1, previewHash: 'b'.repeat(64) };

    expect(hasher.calculate(first)).to.not.equal(hasher.calculate(second));
  });

  it('produces a different hash when semantically-significant array order changes', () => {
    const first = { rules: ['allow-a', 'allow-b'] };
    const second = { rules: ['allow-b', 'allow-a'] };

    expect(hasher.calculate(first)).to.not.equal(hasher.calculate(second));
  });

  it('distinguishes an omitted optional field from one explicitly set to null', () => {
    const omitted = { draftId: 1 };
    const explicitNull = { draftId: 1, note: null };

    expect(hasher.calculate(omitted)).to.not.equal(hasher.calculate(explicitNull));
  });

  it('drops undefined-valued properties so they match an omitted field', () => {
    const omitted = { draftId: 1 };
    const explicitUndefined = { draftId: 1, note: undefined };

    expect(hasher.calculate(omitted)).to.equal(hasher.calculate(explicitUndefined));
  });

  it('hashes Unicode values through stable UTF-8 encoding', () => {
    const value = { note: 'café éè 你好 😀' };

    expect(hasher.calculate(value)).to.equal(hasher.calculate({ ...value }));
    expect(hasher.calculate(value)).to.match(/^[a-f0-9]{64}$/);
  });

  it('rejects non-JSON-serializable payloads', () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    expect(() => hasher.calculate(circular)).to.throw();
  });
});

describe(describeName('digestIdempotencyKey Unit Tests'), () => {
  it('is deterministic and produces a SHA-256 hex digest', () => {
    expect(digestIdempotencyKey('same-key')).to.equal(digestIdempotencyKey('same-key'));
    expect(digestIdempotencyKey('same-key')).to.match(/^[a-f0-9]{64}$/);
  });

  it('produces different digests for different raw keys', () => {
    expect(digestIdempotencyKey('key-a')).to.not.equal(digestIdempotencyKey('key-b'));
  });
});
