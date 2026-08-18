/*
    Copyright 2026 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
    https://soltecsis.com
    info@soltecsis.com


    This file is part of FWCloud (https://fwcloud.net).

    FWCloud is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    FWCloud is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with FWCloud.  If not, see <https://www.gnu.org/licenses/>.
*/

export type CounterLabels = Readonly<Record<string, string>>;

export interface CounterDeclaration {
  readonly name: string;
  readonly help: string;
  /** Label names, in the order they are reported. Empty for unlabelled counters. */
  readonly labelNames: readonly string[];
  /** Every label combination this counter may ever expose. */
  readonly series: readonly CounterLabels[];
}

export interface MetricSample {
  readonly labels: CounterLabels;
  readonly value: number;
}

export interface MetricFamilySnapshot {
  readonly name: string;
  readonly type: 'counter';
  readonly help: string;
  readonly labelNames: readonly string[];
  readonly samples: readonly MetricSample[];
}

interface PreparedSeries {
  readonly labels: CounterLabels;
  readonly key: string;
}

interface PreparedCounter {
  readonly declaration: CounterDeclaration;
  readonly series: readonly PreparedSeries[];
}

/**
 * A closed, in-process counter store.
 *
 * "Closed" is the whole point: every series a counter may ever expose is
 * declared up front and materialized at zero by the constructor. `increment()`
 * can only find an existing series, never create one, so no caller — including
 * a future one passing a draft id, a user id or a raw error message — can widen
 * the metric's cardinality. Out-of-vocabulary increments are dropped and
 * reported through `droppedIncrements`, which the unit tests assert on.
 *
 * Counters live in the API process's memory and reset when it restarts. That is
 * a deliberate trade: adoption counters are cumulative *within* an observation
 * window, and persisting them would mean either a new table or an external
 * telemetry system, both out of scope. `collectionStartedAt` in the snapshot
 * tells an operator which window the numbers describe.
 */
export class CounterRegistry {
  /**
   * The declarations with their series keys resolved once. Every read and every
   * reset walks this instead of rebuilding the same strings, so `seriesKey()`
   * is only ever called again for caller-supplied labels.
   */
  private readonly _counters: readonly PreparedCounter[];
  private readonly _values = new Map<string, number>();
  private _collectionStartedAt: Date;
  private _droppedIncrements = 0;

  constructor(declarations: readonly CounterDeclaration[], now: () => Date = () => new Date()) {
    this._counters = declarations.map((declaration) => ({
      declaration,
      series: declaration.series.map((labels) => ({
        labels,
        key: CounterRegistry.seriesKey(declaration.name, labels),
      })),
    }));
    this._collectionStartedAt = now();
    this.materialize();
  }

  public get collectionStartedAt(): Date {
    return this._collectionStartedAt;
  }

  /** Increments that named a series outside the declared vocabulary. Always 0 in practice. */
  public get droppedIncrements(): number {
    return this._droppedIncrements;
  }

  /**
   * Adds one to a declared series. Returns false — rather than throwing — when
   * the series was never declared, because a metric can never be allowed to
   * break the business transaction that emitted it.
   */
  public increment(name: string, labels: CounterLabels = {}): boolean {
    const key = CounterRegistry.seriesKey(name, labels);
    const current = this._values.get(key);

    if (current === undefined) {
      this._droppedIncrements += 1;
      return false;
    }

    this._values.set(key, current + 1);
    return true;
  }

  public read(name: string, labels: CounterLabels = {}): number | undefined {
    return this._values.get(CounterRegistry.seriesKey(name, labels));
  }

  /** Point-in-time copy of every declared series, including the untouched zeros. */
  public snapshot(): MetricFamilySnapshot[] {
    return this._counters.map(({ declaration, series }) => ({
      name: declaration.name,
      type: 'counter' as const,
      help: declaration.help,
      labelNames: [...declaration.labelNames],
      samples: series.map(({ labels, key }) => ({
        labels: { ...labels },
        value: this._values.get(key) ?? 0,
      })),
    }));
  }

  /** Returns every series to zero and restarts the observation window. Tests and tooling only. */
  public reset(now: () => Date = () => new Date()): void {
    this._droppedIncrements = 0;
    this._collectionStartedAt = now();
    this.materialize();
  }

  /** Sets — not clears then sets — every declared series, so no key is ever absent. */
  private materialize(): void {
    for (const counter of this._counters) {
      for (const series of counter.series) {
        this._values.set(series.key, 0);
      }
    }
  }

  /** Label order must not change identity, so the key is built from sorted names. */
  private static seriesKey(name: string, labels: CounterLabels): string {
    const parts = Object.keys(labels)
      .sort()
      .map((label) => `${label}=${labels[label]}`);
    return parts.length === 0 ? name : `${name}{${parts.join(',')}}`;
  }
}
