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
import { createHash } from 'crypto';

const MAX_DATA_LENGTH = 64 * 1024; // 64KB to avoid oversized entries
const MAX_SIGNED_INT = 2147483647;

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

      auditLog.call = this.buildCall(req);
      auditLog.data = this.buildPayload(req, res, start);
      auditLog.description = this.buildDescription(req, res);
      auditLog.userId = this.getNumeric(req.session?.user_id);
      auditLog.userName = typeof req.session?.username === 'string' ? req.session.username : null;
      auditLog.sessionId = this.resolveSessionId(req);

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

      await dataSource.manager.getRepository(AuditLog).save(auditLog);
    } catch (error) {
      logger().error(`Unexpected error while creating audit log: ${error?.message ?? error}`);
    }
  }

  private buildCall(req: Request): string {
    const base = `${req.method.toUpperCase()} ${req.originalUrl}`;
    return base.length <= 255 ? base : `${base.substring(0, 252)}...`;
  }

  private buildDescription(req: Request, res: Response): string {
    const pieces: string[] = [];
    pieces.push(`${req.method.toUpperCase()} ${req.originalUrl}`);
    pieces.push(`status=${res.statusCode}`);

    if (req.session?.user_id) {
      pieces.push(`user=${req.session.user_id}`);
    }

    const ip = this.getClientIp(req);
    if (ip) {
      pieces.push(`ip=${ip}`);
    }

    return pieces.join(' | ');
  }

  private buildPayload(req: Request, res: Response, start: number): string {
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

  private filterHeaders(headers: Request['headers']): Record<string, string> {
    const sanitized: Record<string, string> = {};
    const redacted = new Set(['authorization', 'cookie', 'set-cookie', 'x-auth-token']);

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
          const extracted = this.getNumeric(source[key]);
          if (extracted !== null) {
            return extracted;
          }
        }
      }
    }

    if (req.inputs) {
      for (const key of keys) {
        if (req.inputs.has(key)) {
          const extracted = this.getNumeric(req.inputs.get(key));
          if (extracted !== null) {
            return extracted;
          }
        }
      }
    }

    return null;
  }

  private getNumeric(value: any): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return Math.trunc(value);
    }

    if (typeof value === 'string' && value.trim() !== '') {
      const parsed = Number.parseInt(value, 10);
      return Number.isNaN(parsed) ? null : parsed;
    }

    if (typeof value === 'object' && value !== null) {
      if ('id' in value) {
        return this.getNumeric(value.id);
      }
    }

    return null;
  }

  private resolveSessionId(req: Request): number | null {
    if (!req.session?.user_id || !req.sessionID) {
      return null;
    }

    const rawSessionId = req.sessionID;

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

      return hashedValue % MAX_SIGNED_INT;
    } catch (error) {
      logger().warn(`Unable to derive numeric session id: ${error?.message ?? error}`);
      return null;
    }
  }
}
