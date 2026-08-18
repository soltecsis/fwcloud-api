/**
 * Reading helpers for the Assisted Profile adoption counters.
 *
 * Every metrics assertion needs the same two things — the value of one series,
 * and the full set of series that exist — and needs them against two shapes:
 * `AssistedProfileMetricsService.snapshot()` (camelCase `labelNames`) and the
 * endpoint's DTO (snake_case `label_names`). Both agree on `name` and
 * `samples`, which is all these helpers touch, so one reader serves the unit
 * and the E2E specs alike.
 *
 * They throw plain errors rather than calling `expect`, so they work in the
 * pure-unit specs (bare `chai`) and the DB-backed ones (the global-setup
 * `expect`) without either importing the other's assertion entry point.
 */

export interface MetricSampleLike {
  readonly labels: Readonly<Record<string, string>>;
  readonly value: number;
}

export interface MetricFamilyLike {
  readonly name: string;
  readonly samples: readonly MetricSampleLike[];
}

/**
 * The value of the single series matching `labels`, which must be declared.
 * A missing family or series is a failed test rather than a `0`: reading a
 * counter that does not exist means the declaration and the assertion have
 * drifted apart, which is exactly what these specs are meant to catch.
 */
export function metricValue(
  families: readonly MetricFamilyLike[],
  name: string,
  labels: Readonly<Record<string, string>> = {},
): number {
  const family = families.find((item) => item.name === name);
  if (!family) {
    throw new Error(`No such metric family: ${name}`);
  }

  const sample = family.samples.find((item) =>
    Object.keys(labels).every((label) => item.labels[label] === labels[label]),
  );
  if (!sample) {
    throw new Error(`No such series: ${name}${JSON.stringify(labels)}`);
  }

  return sample.value;
}

/**
 * Every series that currently exists, as stable `name{labels}` strings. Compare
 * two of these around an operation to prove it created no new dimension.
 */
export function metricSeriesKeys(families: readonly MetricFamilyLike[]): string[] {
  return families.flatMap((family) =>
    family.samples.map((sample) => `${family.name}${JSON.stringify(sample.labels)}`),
  );
}
