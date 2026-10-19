import { createHash } from 'crypto';
import type { EntityManager, QueryRunner } from 'typeorm';
import db from '../../database/database-manager';
import { HttpException } from '../../fonaments/exceptions/http/http-exception';
import { ReplicationProfileTemplateChanges } from './replication-profile-template';

/** Advisory lock of the templates of an owner, also taken by the slot migration. */
export function replicationProfileLockName(userId: number): string {
  return `rp:${createHash('sha256').update(String(userId)).digest('hex').slice(0, 60)}`;
}

/** Takes, on the connection of the runner, the lock of an owner's templates; false on timeout. */
export async function acquireReplicationProfileLock(
  runner: QueryRunner,
  userId: number,
): Promise<boolean> {
  const [result] = await runner.query('SELECT GET_LOCK(?, 30) AS acquired', [
    replicationProfileLockName(userId),
  ]);
  return Number(result?.acquired) === 1;
}

export async function releaseReplicationProfileLock(
  runner: QueryRunner,
  userId: number,
): Promise<void> {
  await runner.query('SELECT RELEASE_LOCK(?)', [replicationProfileLockName(userId)]);
}

/** Restores the templates before the rollback releases SQL locks to another writer. */
export async function undoReplicationProfileChanges(
  runner: QueryRunner,
  files: ReplicationProfileTemplateChanges,
): Promise<void> {
  try {
    files.restore();
  } finally {
    if (runner.isTransactionActive) await runner.rollbackTransaction();
  }
}

/**
 * A connection-scoped lock spans SQL commit AND filesystem compensation.
 * Unlike an in-process mutex it also serializes different API workers, and
 * unlike a row lock it covers the first creation of a template. It is held
 * per owner, so free codes and unique names are chosen without races.
 */
export async function replicationProfileTransaction<T>(
  userId: number,
  operation: (manager: EntityManager, files: ReplicationProfileTemplateChanges) => Promise<T>,
): Promise<T> {
  const runner = db.getSource().createQueryRunner();
  const files = new ReplicationProfileTemplateChanges();
  let locked = false;
  await runner.connect();
  try {
    locked = await acquireReplicationProfileLock(runner, userId);
    if (!locked)
      throw new HttpException('Replication profile is being modified. Please retry.', 409);
    await runner.startTransaction();
    try {
      const result = await operation(runner.manager, files);
      await runner.commitTransaction();
      return result;
    } catch (error) {
      // Restored before the advisory lock is released to another writer.
      await undoReplicationProfileChanges(runner, files);
      throw error;
    }
  } finally {
    try {
      if (locked) await releaseReplicationProfileLock(runner, userId);
    } finally {
      await runner.release();
    }
  }
}
