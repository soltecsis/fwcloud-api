/*
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

    You should have received a copy of the GNU General Public License
    along with FWCloud.  If not, see <https://www.gnu.org/licenses/>.
*/

import { NextFunction, Request, Response } from 'express';
import { Middleware } from '../fonaments/http/middleware/Middleware';
import { AuditLog } from '../models/audit/AuditLog';
import { logger } from '../fonaments/abstract-application';
import db from '../database/database-manager';
import { FwCloud } from '../models/fwcloud/FwCloud';
import { Firewall } from '../models/firewall/Firewall';
import { Cluster } from '../models/firewall/Cluster';
import { AuditLogHelper } from '../models/audit/audit-log.helper';

const MAX_DATA_LENGTH = 64 * 1024; // 64KB to avoid oversized entries

type NamedEntityContext = {
  id?: number | null;
  name?: string | null;
};

type DescriptionContext = {
  userId?: number | null;
  userName?: string | null;
  fwCloud?: NamedEntityContext;
  firewall?: NamedEntityContext;
  cluster?: NamedEntityContext;
};

const SENSITIVE_KEY_PATTERNS = [
  'password',
  'passcode',
  'passwd',
  'secret',
  'token',
  'apikey',
  'api_key',
  'accesskey',
  'access_key',
  'auth',
  'credential',
  'otp',
];

export class AuditLogMiddleware extends Middleware {
  public async handle(req: Request, res: Response, next: NextFunction): Promise<void> {
    const start = Date.now();
    let handled = false;

    const finalize = () => {
      if (handled) {
        return;
      }
      handled = true;

      this.persistAuditLog(req, res, start).catch((error) => {
        logger().error(`Failed to persist audit log: ${error?.message ?? error}`);
      });
    };

    res.on('finish', finalize);
    res.on('close', finalize);

    next();
  }

  private async persistAuditLog(req: Request, res: Response, start: number): Promise<void> {
    try {
      const dataSource = db.getSource();
      const auditLog = new AuditLog();
      const instrumentationContext = this.extractAuditContext(req);

      auditLog.call = this.buildCall(req);
      auditLog.data = this.buildPayload(req, res, start, instrumentationContext);
      auditLog.userId = AuditLogHelper.getNumeric(req.session?.user_id);
      auditLog.userName = typeof req.session?.username === 'string' ? req.session.username : null;
      auditLog.sessionId = AuditLogHelper.resolveSessionId(req);

      const fwCloudId = this.extractIdentifier(req, [
        'fwcloud',
        'fwcloud_id',
        'fwcloudId',
        'fwCloudId',
      ]);
      const firewallId = this.extractIdentifier(req, [
        'firewall',
        'firewall_id',
        'id_firewall',
        'firewallId',
      ]);
      const clusterId = this.extractIdentifier(req, ['cluster', 'cluster_id', 'clusterId']);

      auditLog.fwCloudId = fwCloudId;
      auditLog.firewallId = firewallId;
      auditLog.clusterId = clusterId;

      const [fwCloud, firewall, cluster] = await Promise.all([
        fwCloudId ? FwCloud.findOne({ where: { id: fwCloudId } }) : Promise.resolve(null),
        firewallId ? Firewall.findOne({ where: { id: firewallId } }) : Promise.resolve(null),
        clusterId ? Cluster.findOne({ where: { id: clusterId } }) : Promise.resolve(null),
      ]);

      auditLog.fwCloudName = fwCloud?.name ?? null;
      auditLog.firewallName = firewall?.name ?? null;
      auditLog.clusterName = cluster?.name ?? null;

      auditLog.description = this.buildDescription(
        req,
        res,
        {
          userId: auditLog.userId,
          userName: auditLog.userName,
          fwCloud: { id: auditLog.fwCloudId, name: auditLog.fwCloudName },
          firewall: { id: auditLog.firewallId, name: auditLog.firewallName },
          cluster: { id: auditLog.clusterId, name: auditLog.clusterName },
        },
        instrumentationContext,
      );

      await dataSource.manager.getRepository(AuditLog).save(auditLog);
    } catch (error) {
      logger().error(`Unexpected error while creating audit log: ${error?.message ?? error}`);
    }
  }

  private buildCall(req: Request): string {
    const base = `${req.method.toUpperCase()} ${req.originalUrl}`;
    return base.length <= 255 ? base : `${base.substring(0, 252)}...`;
  }

  private buildDescription(
    req: Request,
    res: Response,
    context: DescriptionContext = {},
    instrumentation: Record<string, string | number> = {},
  ): string {
    const resolveEntityValue = (entity?: NamedEntityContext): string | null => {
      if (!entity) {
        return null;
      }

      if (entity.name && entity.name.trim() !== '') {
        return entity.name;
      }

      if (entity.id !== null && entity.id !== undefined) {
        return String(entity.id);
      }

      return null;
    };

    const pieces: string[] = [];
    const usedLabels = new Set<string>();
    pieces.push(`${req.method.toUpperCase()} ${req.originalUrl}`);
    pieces.push(`status=${res.statusCode}`);
    usedLabels.add('status');

    const trimmedUserName =
      typeof context.userName === 'string' ? context.userName.trim() : undefined;
    const userLabel = trimmedUserName && trimmedUserName.length > 0 ? trimmedUserName : null;
    const fallbackUserLabel =
      context.userId !== null && context.userId !== undefined ? String(context.userId) : null;

    if (userLabel || fallbackUserLabel) {
      pieces.push(`user=${userLabel ?? fallbackUserLabel}`);
      usedLabels.add('user');
    }

    const fwCloudLabel = resolveEntityValue(context?.fwCloud);
    if (fwCloudLabel) {
      pieces.push(`fwcloud=${fwCloudLabel}`);
      usedLabels.add('fwcloud');
    }

    const firewallLabel = resolveEntityValue(context?.firewall);
    if (firewallLabel) {
      pieces.push(`firewall=${firewallLabel}`);
      usedLabels.add('firewall');
    }

    const clusterLabel = resolveEntityValue(context?.cluster);
    if (clusterLabel) {
      pieces.push(`cluster=${clusterLabel}`);
      usedLabels.add('cluster');
    }

    const ip = this.getClientIp(req);
    if (ip) {
      pieces.push(`ip=${ip}`);
      usedLabels.add('ip');
    }

    for (const [label, value] of Object.entries(instrumentation)) {
      if (value === null || value === undefined) {
        continue;
      }

      if (usedLabels.has(label)) {
        continue;
      }

      const rendered =
        typeof value === 'string'
          ? value.trim()
          : Number.isFinite(value)
            ? String(value)
            : String(value);

      if (rendered.length === 0) {
        continue;
      }

      pieces.push(`${label}=${rendered}`);
    }

    return pieces.join(' | ');
  }

  private buildPayload(
    req: Request,
    res: Response,
    start: number,
    instrumentation: Record<string, string | number> = {},
  ): string {
    const payload = {
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      durationMs: Date.now() - start,
      ip: this.getClientIp(req),
      headers: this.filterHeaders(req.headers),
      query: this.sanitize(req.query),
      params: this.sanitize(req.params),
      body: this.sanitize(req.body),
      context: this.sanitize(instrumentation),
    };

    const serialized = JSON.stringify(payload);

    if (serialized.length > MAX_DATA_LENGTH) {
      return `${serialized.substring(0, MAX_DATA_LENGTH)}...[truncated]`;
    }

    return serialized;
  }

  private sanitize(input: any, seen: WeakSet<object> = new WeakSet()): any {
    if (input === null || input === undefined) {
      return input ?? null;
    }

    if (typeof input === 'string' || typeof input === 'number' || typeof input === 'boolean') {
      return input;
    }

    if (input instanceof Date) {
      return input.toISOString();
    }

    if (Buffer.isBuffer(input)) {
      return `[buffer:${input.length}]`;
    }

    if (Array.isArray(input)) {
      return input.map((item) => this.sanitize(item, seen));
    }

    if (typeof input === 'object') {
      if (seen.has(input)) {
        return '[circular]';
      }

      seen.add(input);

      const output: Record<string, any> = {};
      for (const key of Object.keys(input)) {
        const value = input[key];
        if (this.isSensitiveKey(key)) {
          output[key] = '[REDACTED]';
          continue;
        }

        try {
          output[key] = this.sanitize(value, seen);
        } catch (error) {
          output[key] = `[unserializable:${error?.message ?? 'error'}]`;
        }
      }

      return output;
    }

    return String(input);
  }

  private extractAuditContext(req: Request): Record<string, string | number> {
    const contextEntries: Array<{ label: string; keys: string[] }> = [
      { label: 'device', keys: ['deviceId', 'device_id', 'device'] },
      { label: 'policy', keys: ['policyId', 'policy_id', 'policy'] },
      { label: 'scope', keys: ['scope', 'targetScope', 'target_scope'] },
      { label: 'target', keys: ['target', 'targetId', 'target_id'] },
    ];

    const context: Record<string, string | number> = {};

    for (const entry of contextEntries) {
      const rawValue = this.findFirstValue(req, entry.keys);
      const normalized = this.normalizeContextValue(rawValue);
      if (normalized !== null) {
        context[entry.label] = normalized;
      }
    }

    if (!Object.prototype.hasOwnProperty.call(context, 'policy')) {
      const policyFallback = this.findFirstValue(req, ['policy', 'policyId', 'policy_id']);
      const normalizedPolicy = this.normalizeContextValue(policyFallback);
      if (normalizedPolicy !== null) {
        context.policy = normalizedPolicy;
      }
    }

    if (!Object.prototype.hasOwnProperty.call(context, 'firewall')) {
      const firewallValue = this.findFirstValue(req, [
        'firewall',
        'firewallId',
        'firewall_id',
        'id_firewall',
      ]);
      const normalizedFirewall = this.normalizeContextValue(firewallValue);
      if (normalizedFirewall !== null) {
        context.firewall = normalizedFirewall;
      }
    }

    return context;
  }

  private findFirstValue(req: Request, keys: string[]): any {
    const sources = [
      typeof req.body === 'object' && req.body ? req.body : null,
      typeof req.params === 'object' && req.params ? req.params : null,
      typeof req.query === 'object' && req.query ? req.query : null,
    ].filter((source): source is Record<string, any> => source !== null);

    for (const source of sources) {
      for (const key of keys) {
        if (Object.prototype.hasOwnProperty.call(source, key) && source[key] !== undefined) {
          return source[key];
        }
      }
    }

    if (req.inputs) {
      for (const key of keys) {
        if (req.inputs.has(key)) {
          return req.inputs.get(key);
        }
      }
    }

    return null;
  }

  private normalizeContextValue(value: any): string | number | null {
    if (value === null || value === undefined) {
      return null;
    }

    const numeric = AuditLogHelper.getNumeric(value);
    if (numeric !== null) {
      return numeric;
    }

    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : null;
    }

    return null;
  }

  private isSensitiveKey(key: string | null | undefined): boolean {
    if (!key) {
      return false;
    }

    const normalized = key.toLowerCase();
    return SENSITIVE_KEY_PATTERNS.some(
      (pattern) => normalized === pattern || normalized.includes(pattern),
    );
  }

  private filterHeaders(headers: Request['headers']): Record<string, string> {
    const sanitized: Record<string, string> = {};
    const redacted = new Set([
      'authorization',
      'cookie',
      'set-cookie',
      'x-auth-token',
      'x-api-key',
      'x-access-token',
    ]);

    for (const [key, value] of Object.entries(headers)) {
      if (value === undefined) {
        continue;
      }

      const normalizedKey = key.toLowerCase();
      if (redacted.has(normalizedKey)) {
        sanitized[key] = '[REDACTED]';
        continue;
      }

      sanitized[key] = Array.isArray(value) ? value.join(', ') : String(value);
    }

    return sanitized;
  }

  private getClientIp(req: Request): string | null {
    const forwarded = req.headers['x-forwarded-for'];
    if (Array.isArray(forwarded)) {
      return forwarded[0];
    }

    if (typeof forwarded === 'string' && forwarded.length > 0) {
      return forwarded.split(',')[0].trim();
    }

    return req.ip ?? null;
  }

  private extractIdentifier(req: Request, keys: string[]): number | null {
    const sources = [
      typeof req.body === 'object' && req.body ? req.body : null,
      typeof req.params === 'object' && req.params ? req.params : null,
      typeof req.query === 'object' && req.query ? req.query : null,
    ].filter((source): source is Record<string, any> => source !== null);

    for (const source of sources) {
      for (const key of keys) {
        if (Object.prototype.hasOwnProperty.call(source, key) && source[key] !== undefined) {
          const extracted = AuditLogHelper.getNumeric(source[key]);
          if (extracted !== null) {
            return extracted;
          }
        }
      }
    }

    if (req.inputs) {
      for (const key of keys) {
        if (req.inputs.has(key)) {
          const extracted = AuditLogHelper.getNumeric(req.inputs.get(key));
          if (extracted !== null) {
            return extracted;
          }
        }
      }
    }

    return null;
  }
}
