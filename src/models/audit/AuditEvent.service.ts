/*!
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

    You should have received a copy of the GNU Affero General Public License
    along with FWCloud.  If not, see <https://www.gnu.org/licenses/>.
*/

import { randomUUID } from 'crypto';
import { logger } from '../../fonaments/abstract-application';
import { Service } from '../../fonaments/services/service';
import { AuditLog } from './AuditLog';
import { AuditLogService } from './AuditLog.service';

export type AuditEventSource = 'cron' | 'worker' | 'importer';
export type AuditEventOperation = 'archive' | 'retention' | 'import' | 'sync' | 'cleanup';
export type AuditEventStatus = 'success' | 'failed';

export type AuditEventContext = {
  userId?: number | null;
  userName?: string | null;
  sessionId?: number | null;
  sourceIp?: string | null;
  fwCloudId?: number | null;
  fwCloudName?: string | null;
  firewallId?: number | null;
  firewallName?: string | null;
  clusterId?: number | null;
  clusterName?: string | null;
};

export type StartAuditEventInput = {
  source: AuditEventSource;
  operation: AuditEventOperation;
  entity: string;
  context?: AuditEventContext;
  details?: Record<string, unknown>;
};

export type FinishAuditEventInput = {
  affectedCount: number;
  status: AuditEventStatus;
  error?: unknown;
  finishedAt?: Date | string;
  context?: AuditEventContext;
  details?: Record<string, unknown>;
};

export type EmitAuditEventInput = StartAuditEventInput &
  FinishAuditEventInput & {
    startedAt: Date | string;
  };

type RunningAuditEvent = StartAuditEventInput & {
  startedAt: Date;
};

type InternalAuditSourceConfig = {
  enabled?: boolean;
};

type InternalAuditConfig = {
  enabled?: boolean;
  cron?: InternalAuditSourceConfig;
  worker?: InternalAuditSourceConfig;
  importer?: InternalAuditSourceConfig;
};

const MAX_ERROR_LENGTH = 1024;
const INTERNAL_AUDIT_DISABLED_EVENT_PREFIX = '__disabled_internal_audit__';
// Internal events do not carry a request user; store them under a system identity.
const DEFAULT_SYSTEM_USER_NAME = 'system';

export class AuditEventService extends Service {
  private _auditLogService: AuditLogService;
  private readonly _runningEvents = new Map<string, RunningAuditEvent>();

  public async build(): Promise<AuditEventService> {
    this._auditLogService = await this._app.getService<AuditLogService>(AuditLogService.name);
    return this;
  }

  public startEvent(input: StartAuditEventInput): string {
    if (!this.isInternalAuditEnabledForSource(input.source)) {
      return this.buildDisabledEventId();
    }

    const eventId = randomUUID();

    this._runningEvents.set(eventId, {
      ...input,
      entity: this.normalizeEntity(input.entity),
      startedAt: new Date(),
      context: this.normalizeContext(input.context),
      details: this.normalizeDetails(input.details),
    });

    return eventId;
  }

  public async finishEvent(
    eventId: string,
    input: FinishAuditEventInput,
  ): Promise<AuditLog | null> {
    if (this.isDisabledEventId(eventId)) {
      return null;
    }

    const runningEvent = this._runningEvents.get(eventId);

    if (!runningEvent) {
      logger()?.warn(`AuditEventService.finishEvent called with unknown eventId=${eventId}`);
      return null;
    }

    this._runningEvents.delete(eventId);

    try {
      return await this.emitEvent({
        source: runningEvent.source,
        operation: runningEvent.operation,
        entity: runningEvent.entity,
        startedAt: runningEvent.startedAt,
        affectedCount: input.affectedCount,
        status: input.status,
        error: input.error,
        finishedAt: input.finishedAt,
        context: this.mergeContexts(runningEvent.context, input.context),
        details: this.mergeDetails(runningEvent.details, input.details),
      });
    } catch (error) {
      logger()?.error(
        `Unexpected error while finishing audit event ${eventId}: ${error?.message ?? error}`,
      );
      return null;
    }
  }

  public async emitEvent(input: EmitAuditEventInput): Promise<AuditLog | null> {
    const source = input.source;

    if (!this.isInternalAuditEnabledForSource(source)) {
      return null;
    }

    const operation = input.operation;
    const entity = this.normalizeEntity(input.entity);
    const startedAt = this.normalizeDate(input.startedAt, new Date());
    const finishedAt = this.normalizeDate(input.finishedAt, new Date());
    const normalizedFinishedAt = finishedAt >= startedAt ? finishedAt : startedAt;
    const durationMs = Math.max(0, normalizedFinishedAt.getTime() - startedAt.getTime());
    const status = input.status;
    const affectedCount = this.normalizeAffectedCount(input.affectedCount);
    const error =
      status === 'failed' ? (this.sanitizeError(input.error) ?? 'Unknown internal error') : null;
    const details = this.normalizeDetails(input.details);
    const context = this.normalizeContext(input.context);

    const payload = {
      source,
      operation,
      entity,
      affectedCount,
      startedAt: startedAt.toISOString(),
      finishedAt: normalizedFinishedAt.toISOString(),
      durationMs,
      status,
      error,
      details,
    };

    return this._auditLogService.logMutation({
      call: `INTERNAL:${source}:${operation}`,
      description: this.buildDescription(payload),
      data: payload,
      userId: context.userId ?? null,
      userName: context.userName ?? DEFAULT_SYSTEM_USER_NAME,
      sessionId: context.sessionId ?? null,
      sourceIp: context.sourceIp ?? null,
      fwCloudId: context.fwCloudId ?? null,
      fwCloudName: context.fwCloudName ?? null,
      firewallId: context.firewallId ?? null,
      firewallName: context.firewallName ?? null,
      clusterId: context.clusterId ?? null,
      clusterName: context.clusterName ?? null,
      startedAt,
      finishedAt: normalizedFinishedAt,
    });
  }

  protected normalizeEntity(entity: string): string {
    const normalized = typeof entity === 'string' ? entity.trim() : '';
    return normalized.length > 0 ? normalized : 'unknown';
  }

  protected normalizeDate(value: Date | string | undefined, fallback: Date): Date {
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return value;
    }

    if (typeof value === 'string' && value.trim() !== '') {
      const parsed = new Date(value);

      if (!Number.isNaN(parsed.getTime())) {
        return parsed;
      }
    }

    return fallback;
  }

  protected normalizeAffectedCount(affectedCount: unknown): number {
    let numeric = Number.NaN;

    if (typeof affectedCount === 'number') {
      numeric = affectedCount;
    } else if (typeof affectedCount === 'string' && affectedCount.trim() !== '') {
      numeric = Number.parseInt(affectedCount, 10);
    } else if (typeof affectedCount === 'bigint') {
      numeric = Number(affectedCount);
    }

    if (!Number.isFinite(numeric)) {
      return 0;
    }

    return Math.max(0, Math.trunc(numeric));
  }

  protected normalizeContext(context: AuditEventContext | undefined): AuditEventContext {
    return { ...(context ?? {}) };
  }

  protected normalizeDetails(
    details: Record<string, unknown> | undefined,
  ): Record<string, unknown> | null {
    if (!details || typeof details !== 'object') {
      return null;
    }

    return { ...details };
  }

  protected mergeContexts(
    base: AuditEventContext | undefined,
    input: AuditEventContext | undefined,
  ): AuditEventContext {
    return {
      ...(base ?? {}),
      ...(input ?? {}),
    };
  }

  protected mergeDetails(
    base: Record<string, unknown> | null | undefined,
    input: Record<string, unknown> | undefined,
  ): Record<string, unknown> | null {
    const normalizedInput = this.normalizeDetails(input);
    if (!base && !normalizedInput) {
      return null;
    }

    return {
      ...(base ?? {}),
      ...(normalizedInput ?? {}),
    };
  }

  protected sanitizeError(error: unknown): string | null {
    if (error === null || error === undefined) {
      return null;
    }

    let raw: string;

    if (typeof error === 'string') {
      raw = error;
    } else if (error instanceof Error) {
      raw = error.message;
    } else if (
      typeof error === 'number' ||
      typeof error === 'boolean' ||
      typeof error === 'bigint'
    ) {
      raw = String(error);
    } else {
      try {
        raw = JSON.stringify(error);
      } catch {
        raw = '';
      }
    }

    const normalized = raw.replace(/\s+/g, ' ').trim();

    if (!normalized) {
      return null;
    }

    if (normalized.length <= MAX_ERROR_LENGTH) {
      return normalized;
    }

    return `${normalized.substring(0, MAX_ERROR_LENGTH - 3)}...`;
  }

  protected buildDescription(payload: {
    source: AuditEventSource;
    operation: AuditEventOperation;
    entity: string;
    affectedCount: number;
    status: AuditEventStatus;
  }): string {
    return `${payload.source} ${payload.operation} on ${payload.entity} | status=${payload.status} | affected=${payload.affectedCount}`;
  }

  protected isInternalAuditEnabledForSource(source: AuditEventSource): boolean {
    const config = this.readInternalAuditConfig();

    if (config.enabled === false) {
      return false;
    }

    if (config[source]?.enabled === false) {
      return false;
    }

    return true;
  }

  protected readInternalAuditConfig(): InternalAuditConfig {
    return (this._app.config.get('auditLogs.internal') ?? {}) as InternalAuditConfig;
  }

  protected buildDisabledEventId(): string {
    return `${INTERNAL_AUDIT_DISABLED_EVENT_PREFIX}${randomUUID()}`;
  }

  protected isDisabledEventId(eventId: string): boolean {
    return eventId.startsWith(INTERNAL_AUDIT_DISABLED_EVENT_PREFIX);
  }
}
