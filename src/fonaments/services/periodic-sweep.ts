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

export interface PeriodicSweepOptions {
  /** When false, `start()` is a no-op: the sweep never schedules anything. */
  readonly enabled: boolean;
  /** Delay between the *end* of one sweep and the start of the next. */
  readonly intervalSeconds: number;
  /** One sweep. Rejections are absorbed; the next sweep is scheduled anyway. */
  readonly run: () => Promise<unknown>;
}

/**
 * The scheduling half of a periodic maintenance job: a self-rescheduling timer
 * whose interval is a delay-since-completion rather than a fixed clock-time
 * schedule (which is why these jobs do not use `CronService`, whose cron
 * expressions have no clean 1:1 mapping to "N seconds after the last run
 * finished").
 *
 * The first sweep runs after one interval, not at boot, so application startup
 * never waits on maintenance work. The timer is `unref`'d, so a pending sweep
 * cannot keep the process (or a test run) alive.
 *
 * Shared by `ExpireFirewallProfileDraftsJob` and
 * `PurgeAssistedProfileRejectedProposalsJob`, which own the actual sweep and
 * expose it as a directly callable `run()` for manual and test invocations.
 */
export class PeriodicSweep {
  private _timer: NodeJS.Timeout | null = null;
  private _started = false;

  constructor(private readonly _options: PeriodicSweepOptions) {}

  public get started(): boolean {
    return this._started;
  }

  /** Idempotent, and a no-op while the job is configured as disabled. */
  public start(): void {
    if (this._started || !this._options.enabled) {
      return;
    }

    this._started = true;
    this.scheduleNext();
  }

  /** Idempotent. Safe to call during application shutdown and between tests. */
  public stop(): void {
    this._started = false;
    if (this._timer) {
      clearTimeout(this._timer);
      this._timer = null;
    }
  }

  private scheduleNext(): void {
    this._timer = setTimeout(() => {
      void this._options.run().finally(() => {
        if (!this._started) {
          return;
        }
        this.scheduleNext();
      });
    }, this._options.intervalSeconds * 1000);
    this._timer.unref?.();
  }
}
