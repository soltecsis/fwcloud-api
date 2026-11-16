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

export type AuditLogIdentity = {
  userId: number | null;
  userName: string | null;
  sessionId: number | null;
};

export class AuditLogHelper {
  private static readonly MAX_SIGNED_INT = 2147483647;
  private static readonly MAX_SOURCE_IP_LENGTH = 45;
  private static readonly MAX_DATA_LENGTH = 64 * 1024; // 64KB to avoid oversized entries
  public static readonly TRUNCATED_DATA_SUFFIX = '...[truncated]';

  public static getRequestIdentity(request: Request): AuditLogIdentity {
    return {
      userId: this.getNumeric(request.session?.user_id),
      userName: typeof request.session?.username === 'string' ? request.session.username : null,
      sessionId: this.resolveSessionId(request),
    };
  }

  public static getSessionUser(request: Request): User | null {
    return (request.session?.user as User) ?? null;
  }

  public static isAdmin(user: User | null): boolean {
    return user?.role === 1;
  }

  public static resolveSessionId(request: Request): number | null {
    if (!request.session?.user_id || !request.sessionID) {
      return null;
    }

    const numeric = this.getNumeric(request.sessionID);
    if (numeric !== null) {
      return numeric;
    }

    try {
      const hash = createHash('sha1').update(request.sessionID).digest('hex');
      return Number.parseInt(hash.slice(0, 8), 16) % AuditLogHelper.MAX_SIGNED_INT;
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

  public static getPositiveNumeric(value: unknown): number | null {
    const numeric = this.getNumeric(value);
    return numeric !== null && numeric > 0 ? numeric : null;
  }

  public static getTrimmedString(value: unknown): string | null {
    const trimmed = typeof value === 'string' ? value.trim() : '';
    return trimmed.length > 0 ? trimmed : null;
  }

  public static normalizeSourceIp(value: unknown): string | null {
    return this.getTrimmedString(value)?.substring(0, AuditLogHelper.MAX_SOURCE_IP_LENGTH) ?? null;
  }

  public static truncateData(serialized: string): string {
    return serialized.length > AuditLogHelper.MAX_DATA_LENGTH
      ? `${serialized.substring(0, AuditLogHelper.MAX_DATA_LENGTH)}${AuditLogHelper.TRUNCATED_DATA_SUFFIX}`
      : serialized;
  }

  public static asRecord(value: unknown): Record<string, unknown> | null {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  }

  public static normalizeHttpStatus(value: unknown): number | null {
    const numeric = this.getNumeric(value);
    return numeric !== null && numeric >= 100 && numeric <= 599 ? numeric : null;
  }

  public static toUtcISOString(date: Date | null | undefined): string {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
      return '';
    }

    return date.toISOString();
  }
}
