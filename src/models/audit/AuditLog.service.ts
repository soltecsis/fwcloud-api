/*!
    Copyright 2025 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
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

    You should have received a copy of the GNU Affero General Public License
    along with FWCloud.  If not, see <https://www.gnu.org/licenses/>.
*/

import { FindManyOptions, FindOptionsWhere } from 'typeorm';
import db from '../../database/database-manager';
import { Service } from '../../fonaments/services/service';
import { User } from '../user/User';
import { AuditLog } from './AuditLog';

export class AuditLogService extends Service {
  private get auditLogRepository() {
    return db.getSource().manager.getRepository(AuditLog);
  }

  public async listAuditLogs(options: {
    isAdmin: boolean;
    sessionId?: number | null;
    userId?: number | null;
    skip?: number;
    take?: number;
  }): Promise<{ auditLogs: AuditLog[]; total: number }> {
    const findOptions: FindManyOptions<AuditLog> = {
      order: { timestamp: 'DESC', id: 'DESC' },
    };

    if (typeof options.skip === 'number' && options.skip > 0) {
      findOptions.skip = options.skip;
    }

    if (typeof options.take === 'number' && options.take > 0) {
      findOptions.take = options.take;
    }

    if (!options.isAdmin) {
      const where: FindOptionsWhere<AuditLog>[] = [];

      if (options.sessionId !== null && options.sessionId !== undefined) {
        where.push({ sessionId: options.sessionId });
      }

      if (options.userId !== null && options.userId !== undefined) {
        where.push({ userId: options.userId });
      }

      if (!where.length) {
        return { auditLogs: [], total: 0 };
      }

      findOptions.where = where;
    }

    const [auditLogs, total] = await this.auditLogRepository.findAndCount(findOptions);

    return { auditLogs, total };
  }

  public async syncEntriesWithUser(entries: AuditLog[], user: User | null): Promise<AuditLog[]> {
    if (!entries.length || !user) {
      return entries;
    }

    const userId = user.id ?? null;
    const userName = user.username ?? user.name ?? null;

    const entriesToUpdate = entries.filter(
      (entry) => entry.userId !== userId || entry.userName !== userName,
    );

    if (!entriesToUpdate.length) {
      return entries;
    }

    await this.auditLogRepository
      .createQueryBuilder()
      .update(AuditLog)
      .set({ userId, userName })
      .whereInIds(entriesToUpdate.map((entry) => entry.id))
      .execute();

    entriesToUpdate.forEach((entry) => {
      entry.userId = userId;
      entry.userName = userName;
    });

    return entries;
  }
}
