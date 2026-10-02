import { expect } from 'chai';
import { Request } from 'express';
import { isLoggedIn } from '../../../src/gates/isLoggedIn';

describe('isLoggedIn security gate', () => {
  for (const user of [null, undefined]) {
    it(`denies a ${String(user)} session user`, async () => {
      const request = { session: { user } } as unknown as Request;
      expect(await new isLoggedIn().grant(request)).to.eq(false);
    });
  }

  it('denies a missing session', async () => {
    expect(await new isLoggedIn().grant({} as Request)).to.eq(false);
  });

  it('allows a populated authenticated user', async () => {
    const request = { session: { user: { id: 1, role: 2 } } } as unknown as Request;
    expect(await new isLoggedIn().grant(request)).to.eq(true);
  });
});
