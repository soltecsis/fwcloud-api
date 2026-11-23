import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import db from '../../database/database-manager';
import { app } from '../../fonaments/abstract-application';
import { IPObjRepository } from '../ipobj/IPObj.repository';
import type { FwcData, FwcLockData } from './FwCloud';

interface LockRow {
  locked_by: string;
  locked_at: string;
}

interface LockSession {
  username: string;
  remote_addr: string;
  keepalive_ts: number;
}

/** Cloud lock operations. Role and resource authorization stay with the callers. */
export class FwCloudLockService {
  private static async readSession(sessionId: string): Promise<LockSession | undefined> {
    try {
      const data = await readFile(
        join(app().config.get('session').files_path, `${sessionId}.json`),
        'utf8',
      );
      return JSON.parse(data) as LockSession;
    } catch (error) {
      if (error.code === 'ENOENT') return undefined;
      throw error;
    }
  }

  static async expire(cloudId: number): Promise<void> {
    const manager = db.getSource().manager;
    const [lock] = await manager.query<LockRow[]>(
      'SELECT locked_by, locked_at FROM fwcloud WHERE id = ? AND locked = 1',
      [cloudId],
    );
    if (!lock) return;
    const session = await this.readSession(lock.locked_by);
    if (!session || Date.now() - session.keepalive_ts > app().config.get('session').keepalive_ms) {
      // Do not clear a lock transferred or renewed since the expiration check began.
      await manager.query(
        'UPDATE fwcloud SET locked = 0 WHERE id = ? AND locked = 1 AND locked_by <=> ? AND locked_at <=> ?',
        [cloudId, lock.locked_by, lock.locked_at],
      );
    }
  }

  static async acquire(data: FwcData): Promise<FwcLockData> {
    const manager = db.getSource().manager;
    await this.expire(data.fwcloud);
    // The ownership and membership predicates are part of the write itself,
    // so two different sessions cannot both acquire the same available lock.
    const updated = await manager.query<{ affectedRows: number }>(
      `UPDATE fwcloud
       SET locked = 1, locked_at = CURRENT_TIMESTAMP, locked_by = ?
       WHERE id = ? AND (locked = 0 OR (locked = 1 AND locked_by = ?))
       AND EXISTS (SELECT 1 FROM user__fwcloud WHERE fwcloud = ? AND user = ?)`,
      [data.lock_session_id, data.fwcloud, data.lock_session_id, data.fwcloud, data.iduser],
    );
    if (updated.affectedRows > 0) return { result: true };

    const [lock] = await manager.query<LockRow[]>(
      'SELECT locked_by, locked_at FROM fwcloud WHERE id = ? AND locked = 1',
      [data.fwcloud],
    );
    if (!lock) return { result: false };
    const session = await this.readSession(lock.locked_by);
    if (!session) return { result: false };

    const ip = session.remote_addr;
    const repo = new IPObjRepository(manager);
    const remoteAddrName =
      ip !== '127.0.0.1'
        ? (await repo.getNameByAddressOpenVPN(ip)) ||
          (await repo.getNameByAddressWireGuard(ip)) ||
          (await repo.getNameByAddressIPSec(ip)) ||
          (await repo.getNameByAddress(ip)) ||
          ''
        : '';
    return {
      result: false,
      lockByUser: session.username,
      lockedAt: lock.locked_at,
      remoteAddr: ip,
      remoteAddrName,
    };
  }

  private static clearOwnedLocks(sessionId: string, cloudId?: number) {
    const sql = `UPDATE fwcloud SET locked = 0, locked_at = NULL, locked_by = NULL
                 WHERE locked = 1 AND locked_by = ?${cloudId === undefined ? '' : ' AND id = ?'}`;
    return db
      .getSource()
      .manager.query<{ affectedRows: number }>(
        sql,
        cloudId === undefined ? [sessionId] : [sessionId, cloudId],
      );
  }

  static async release(cloudId: number, sessionId: string): Promise<{ result: boolean }> {
    if (cloudId == null) return { result: false };
    const result = await this.clearOwnedLocks(sessionId, cloudId);
    return { result: result.affectedRows > 0 };
  }

  static releaseAll(sessionId: string): Promise<{ affectedRows: number }> {
    return this.clearOwnedLocks(sessionId);
  }

  static async takeOver(
    cloudId: number,
    sessionId: string,
  ): Promise<{ result: boolean; previousLockedBy: string }> {
    return db.getSource().transaction(async (manager) => {
      // Capture the actual previous owner for the notification in the same transaction.
      const [lock] = await manager.query<LockRow[]>(
        'SELECT locked_by FROM fwcloud WHERE id = ? FOR UPDATE',
        [cloudId],
      );
      if (!lock) return { result: false, previousLockedBy: null };
      const result = await manager.query<{ affectedRows: number }>(
        'UPDATE fwcloud SET locked = 1, locked_at = CURRENT_TIMESTAMP, locked_by = ? WHERE id = ?',
        [sessionId, cloudId],
      );
      return { result: result.affectedRows > 0, previousLockedBy: lock.locked_by };
    });
  }
}
