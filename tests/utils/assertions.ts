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

/** Runs a call that must throw and returns the error only after checking its runtime type. */
export function expectThrownAs<T extends Error>(
  call: () => unknown,
  expected: ErrorConstructor<T>,
): T {
  try {
    call();
  } catch (error) {
    expect(error).to.be.instanceOf(expected);
    return error as T;
  }

  throw new Error('Expected call to throw');
}
