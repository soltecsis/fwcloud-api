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

type AuditRouteMetadata = {
  httpMethod?: string | null;
  path?: string | null;
  controller?: string | null;
  action?: string | null;
  name?: string | null;
};

export class AuditLogMiddleware extends Middleware {
  private static readonly MUTATION_KEYWORDS = new Set<string>([
    'add',
    'archive',
    'assign',
    'attach',
    'bulkremove',
    'bulkupdate',
    'ccdsync',
    'clone',
    'copy',
    'create',
    'deactivate',
    'del',
    'delete',
    'deleteconfig',
    'deletesetup',
    'deploy',
    'destroy',
    'detach',
    'disable',
    'enable',
    'generate',
    'import',
    'install',
    'lock',
    'merge',
    'move',
    'movefrom',
    'patch',
    'prefix',
    'publish',
    'register',
    'remove',
    'rename',
    'replace',
    'reset',
    'restore',
    'run',
    'save',
    'set',
    'setup',
    'store',
    'sync',
    'unassign',
    'uninstall',
    'unlock',
    'unregister',
    'update',
    'updateconfig',
    'upgrade',
    'upload',
  ]);

  private static readonly READ_KEYWORDS = new Set<string>([
    'check',
    'colors',
    'compare',
    'details',
    'diff',
    'describe',
    'download',
    'export',
    'fetch',
    'get',
    'grid',
    'health',
    'history',
    'index',
    'info',
    'inspect',
    'list',
    'login',
    'logout',
    'logs',
    'monitor',
    'options',
    'ping',
    'preview',
    'proxy',
    'read',
    'report',
    'restricted',
    'refresh',
    'search',
    'show',
    'status',
    'test',
    'token',
    'validate',
    'verify',
    'where',
  ]);

  private static readonly OPERATION_HINT_KEYS = [
    'action',
    'op',
    'operation',
    'task',
    'mode',
    'type',
  ];

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
      if (!this.shouldPersistAuditLog(req, res)) {
        return;
      }

      const dataSource = db.getSource();
      const auditLog = new AuditLog();
      const instrumentationContext = this.extractAuditContext(req);

      auditLog.call = this.buildCall(req);
      auditLog.data = this.buildPayload(req, res, start, instrumentationContext);
      auditLog.userId = AuditLogHelper.getNumeric(req.session?.user_id);
      auditLog.userName = typeof req.session?.username === 'string' ? req.session.username : null;
      auditLog.sessionId = AuditLogHelper.resolveSessionId(req);
      const sourceIp = this.getClientIp(req)?.trim() ?? null;
      auditLog.sourceIp = sourceIp && sourceIp.length > 0 ? sourceIp.substring(0, 45) : null;

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

      const firewall =
        firewallId !== null && firewallId !== undefined
          ? await Firewall.findOne({ where: { id: firewallId } })
          : null;

      const firewallClusterIdCandidate =
        firewall && firewall.clusterId !== undefined
          ? AuditLogHelper.getNumeric(firewall.clusterId)
          : null;

      const resolvedClusterId =
        clusterId ??
        (firewallClusterIdCandidate !== null && firewallClusterIdCandidate > 0
          ? firewallClusterIdCandidate
          : null);

      if (resolvedClusterId !== null && resolvedClusterId !== undefined) {
        auditLog.clusterId = resolvedClusterId;
      }

      const firewallFwCloudIdCandidate =
        firewall && firewall.fwCloudId !== undefined
          ? AuditLogHelper.getNumeric(firewall.fwCloudId)
          : null;

      if (
        (auditLog.fwCloudId === null || auditLog.fwCloudId === undefined) &&
        firewallFwCloudIdCandidate !== null &&
        firewallFwCloudIdCandidate > 0
      ) {
        auditLog.fwCloudId = firewallFwCloudIdCandidate;
      }

      const [fwCloud, cluster] = await Promise.all([
        auditLog.fwCloudId
          ? FwCloud.findOne({ where: { id: auditLog.fwCloudId } })
          : Promise.resolve(null),
        auditLog.clusterId
          ? Cluster.findOne({ where: { id: auditLog.clusterId } })
          : Promise.resolve(null),
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

  private shouldPersistAuditLog(req: Request, res: Response): boolean {
    const metadata = this.resolveRouteMetadata(req, res);
    const classification = this.classifyOperation(req, metadata);

    if (classification === 'mutation') {
      return true;
    }

    if (classification === 'read') {
      return false;
    }

    const method = typeof req.method === 'string' ? req.method.toUpperCase() : 'GET';
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
      return false;
    }

    if (method === 'DELETE') {
      return true;
    }

    return true;
  }

  private resolveRouteMetadata(req: Request, res: Response): AuditRouteMetadata | null {
    const direct = (req as Request & { __fwcRouteMeta?: AuditRouteMetadata }).__fwcRouteMeta;
    if (direct) {
      return direct;
    }

    if (res?.locals && typeof res.locals === 'object' && res.locals.__fwcRouteMeta) {
      return res.locals.__fwcRouteMeta as AuditRouteMetadata;
    }

    return null;
  }

  private classifyOperation(
    req: Request,
    metadata: AuditRouteMetadata | null,
  ): 'mutation' | 'read' | 'unknown' {
    const tokenSources: string[] = [];

    if (metadata?.action) {
      tokenSources.push(metadata.action);
    }

    if (metadata?.name) {
      tokenSources.push(metadata.name);
    }

    if (metadata?.path) {
      tokenSources.push(metadata.path);
    }

    const routePath = req.route?.path;
    if (typeof routePath === 'string') {
      tokenSources.push(routePath);
    }

    if (req.baseUrl) {
      tokenSources.push(req.baseUrl);
    }

    if (req.path) {
      tokenSources.push(req.path);
    }

    if (req.originalUrl) {
      tokenSources.push(req.originalUrl.split('?')[0]);
    }

    const queryHint = this.extractOperationHint(req.query);
    if (queryHint) {
      tokenSources.push(queryHint);
    }

    const paramsHint = this.extractOperationHint(req.params);
    if (paramsHint) {
      tokenSources.push(paramsHint);
    }

    const bodyHint = this.extractOperationHint(req.body);
    if (bodyHint) {
      tokenSources.push(bodyHint);
    }

    const tokensCache = new Map<string, string[]>();

    if (this.containsKeyword(tokenSources, tokensCache, AuditLogMiddleware.MUTATION_KEYWORDS)) {
      return 'mutation';
    }

    if (this.containsKeyword(tokenSources, tokensCache, AuditLogMiddleware.READ_KEYWORDS)) {
      return 'read';
    }

    return 'unknown';
  }

  private extractOperationHint(source: unknown): string | null {
    if (!source || typeof source !== 'object') {
      return null;
    }

    for (const key of AuditLogMiddleware.OPERATION_HINT_KEYS) {
      const value = (source as Record<string, unknown>)[key];
      if (typeof value === 'string' && value.trim().length > 0) {
        return value;
      }
    }

    return null;
  }

  private containsKeyword(
    sources: string[],
    cache: Map<string, string[]>,
    keywords: ReadonlySet<string>,
  ): boolean {
    for (const source of sources) {
      if (!source || !source.trim()) {
        continue;
      }

      if (!cache.has(source)) {
        cache.set(source, this.tokenize(source));
      }

      const tokens = cache.get(source) ?? [];
      if (tokens.length === 0) {
        continue;
      }

      if (tokens.some((token) => keywords.has(token))) {
        return true;
      }
    }

    return false;
  }

  private tokenize(raw: string): string[] {
    if (!raw || raw.length === 0) {
      return [];
    }

    const spaced = raw
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/[^a-zA-Z0-9]+/g, ' ')
      .toLowerCase();

    return spaced.split(' ').filter((value) => value.length > 0);
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
