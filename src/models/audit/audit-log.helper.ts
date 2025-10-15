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

import { Request } from 'express';
import { createHash } from 'crypto';
import { User } from '../user/User';

export class AuditLogHelper {
  private static readonly MAX_SIGNED_INT = 2147483647;

  public static getSessionUser(request: Request): User | null {
    return (request.session?.user as User) ?? null;
  }

  public static isAdmin(user: User | null): boolean {
    return (user?.role ?? 0) === 1;
  }

  public static resolveSessionId(request: Request): number | null {
    if (!request.session?.user_id || !request.sessionID) {
      return null;
    }

    const rawSessionId = request.sessionID;
    const numeric = this.getNumeric(rawSessionId);

    if (numeric !== null) {
      return numeric;
    }

    try {
      const hash = createHash('sha1').update(rawSessionId).digest('hex');
      const firstBytes = hash.slice(0, 8);
      const hashedValue = Number.parseInt(firstBytes, 16);

      if (Number.isNaN(hashedValue)) {
        return null;
      }

      return hashedValue % AuditLogHelper.MAX_SIGNED_INT;
    } catch {
      return null;
    }
  }

  public static getNumeric(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return Math.trunc(value);
    }

    if (typeof value === 'string' && value.trim() !== '') {
      const parsed = Number.parseInt(value, 10);
      return Number.isNaN(parsed) ? null : parsed;
    }

    if (typeof value === 'object' && value !== null && 'id' in (value as Record<string, unknown>)) {
      return this.getNumeric((value as { id: unknown }).id);
    }

    return null;
  }
}
