/**
 * Polls `predicate` until it returns (or resolves to) true, or rejects after
 * `timeoutMs`. Prefer this over racing a single `await` against background
 * work (fire-and-forget pipelines, async event emission) whose completion
 * order relative to the caller's own continuation is not guaranteed.
 */
export async function waitFor(
  predicate: () => boolean | Promise<boolean>,
  timeoutMs = 2000,
): Promise<void> {
  const start = Date.now();
  while (true) {
    if (await predicate()) {
      return;
    }
    if (Date.now() - start > timeoutMs) {
      throw new Error('Timed out waiting for condition');
    }
    await new Promise<void>((resolve) => setImmediate(resolve));
  }
}
