import { expect } from 'chai';

export type ErrorConstructor<T extends Error> = new (...args: any[]) => T;

/** Awaits a rejection and returns it only after checking its runtime type. */
export async function expectRejectedAs<T extends Error>(
  promise: Promise<unknown>,
  expected: ErrorConstructor<T>,
): Promise<T> {
  try {
    await promise;
  } catch (error) {
    expect(error).to.be.instanceOf(expected);
    return error as T;
  }

  throw new Error('Expected promise to reject');
}
