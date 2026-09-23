import { performance } from 'node:perf_hooks';
import { escapeId } from 'mysql2';
import type { DatabaseService } from '../../src/database/database.service';

interface TableSnapshot {
  name: string;
  columns: string[];
  rows: unknown[][];
  autoIncrement: string | null;
}

interface ResetTiming {
  calls: number;
  totalMs: number;
  maxMs: number;
}

/** Keeps the migrated and seeded state in memory, outside the cleared playground. */
export class DatabaseReset {
  private snapshot: TableSnapshot[] | null = null;
  private timings: Record<string, ResetTiming> = {};

  public async reset(service: DatabaseService, rebuildSchema = false): Promise<void> {
    if (rebuildSchema || !this.snapshot) {
      // Never retain a baseline from a partially completed rebuild.
      this.snapshot = null;
      await this.measure('rebuild', async () => {
        await this.measure('drop', () => service.resetMigrations());
        await this.measure('migrate', () => service.runMigrations());
        await this.measure('seed', () => service.feedDefaultData());
        await this.measure('snapshot', () => this.capture(service));
      });
    } else {
      await this.measure('restore', () => this.restore(service));
    }
  }

  public getTimings(): Record<string, ResetTiming> {
    return Object.fromEntries(
      Object.entries(this.timings).map(([phase, timing]) => [
        phase,
        {
          calls: timing.calls,
          totalMs: Math.round(timing.totalMs),
          maxMs: Math.round(timing.maxMs),
        },
      ]),
    );
  }

  private async measure<T>(phase: string, action: () => Promise<T>): Promise<T> {
    const start = performance.now();
    try {
      return await action();
    } finally {
      const elapsed = performance.now() - start;
      const timing = (this.timings[phase] ??= { calls: 0, totalMs: 0, maxMs: 0 });
      timing.calls++;
      timing.totalMs += elapsed;
      timing.maxMs = Math.max(timing.maxMs, elapsed);
    }
  }

  private async capture(service: DatabaseService): Promise<void> {
    const runner = service.dataSource.createQueryRunner();
    try {
      const tables: { name: string }[] = await runner.query(
        `SELECT TABLE_NAME AS name FROM information_schema.TABLES
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME`,
      );
      const snapshot: TableSnapshot[] = [];
      for (const { name } of tables) {
        const rows: Record<string, unknown>[] = await runner.query(
          `SELECT * FROM ${escapeId(name)}`,
        );
        const columns = rows.length ? Object.keys(rows[0]) : [];
        // SHOW CREATE avoids MySQL 8's cached information_schema AUTO_INCREMENT values.
        const [definition] = await runner.query(`SHOW CREATE TABLE ${escapeId(name)}`);
        const createSql: string = definition['Create Table'];
        snapshot.push({
          name,
          columns,
          rows: rows.map((row) => columns.map((column) => row[column])),
          autoIncrement: /\bAUTO_INCREMENT\b/.test(createSql)
            ? (/\bAUTO_INCREMENT=(\d+)/.exec(createSql)?.[1] ?? '1')
            : null,
        });
      }
      this.snapshot = snapshot;
    } finally {
      await runner.release();
    }
  }

  private async restore(service: DatabaseService): Promise<void> {
    const runner = service.dataSource.createQueryRunner();
    let session: { foreignKeys: number | string; sqlMode: string };
    try {
      [session] = await runner.query(
        'SELECT @@SESSION.FOREIGN_KEY_CHECKS AS foreignKeys, @@SESSION.SQL_MODE AS sqlMode',
      );
      await runner.query('SET SESSION FOREIGN_KEY_CHECKS = 0');
      // Preserve explicit zero IDs in the baseline, including seeded object types.
      await runner.query('SET SESSION SQL_MODE = ?', [
        [session.sqlMode, 'NO_AUTO_VALUE_ON_ZERO'].filter(Boolean).join(','),
      ]);
      // Use one connection for the whole reset so session settings apply to every query.
      // DELETE and inserts share a commit, avoiding a table rebuild/fsync per TRUNCATE.
      await runner.startTransaction();
      for (const table of this.snapshot) {
        await runner.query(`DELETE FROM ${escapeId(table.name)}`);
      }
      for (const table of this.snapshot) {
        if (table.rows.length) {
          const placeholders = `(${table.columns.map(() => '?').join(', ')})`;
          await runner.query(
            `INSERT INTO ${escapeId(table.name)} (${table.columns.map((column) => escapeId(column)).join(', ')}) VALUES ${table.rows.map(() => placeholders).join(', ')}`,
            table.rows.flat(),
          );
        }
      }
      await runner.commitTransaction();
      // ALTER commits implicitly in MySQL/MariaDB, so restore counters after the data.
      for (const table of this.snapshot) {
        if (table.autoIncrement) {
          const [definition] = await runner.query(`SHOW CREATE TABLE ${escapeId(table.name)}`);
          const createSql: string = definition['Create Table'];
          const nextId = /\bAUTO_INCREMENT=(\d+)/.exec(createSql)?.[1] ?? '1';
          if (nextId !== table.autoIncrement) {
            await runner.query(
              `ALTER TABLE ${escapeId(table.name)} AUTO_INCREMENT = ${table.autoIncrement}`,
            );
          }
        }
      }
    } catch (error) {
      // The current test still fails; a later reset must rebuild the damaged state.
      this.snapshot = null;
      if (runner.isTransactionActive) await runner.rollbackTransaction();
      throw error;
    } finally {
      try {
        if (session) {
          try {
            await runner.query('SET SESSION FOREIGN_KEY_CHECKS = ?', [Number(session.foreignKeys)]);
          } finally {
            await runner.query('SET SESSION SQL_MODE = ?', [session.sqlMode]);
          }
        }
      } finally {
        await runner.release();
      }
    }
  }
}
