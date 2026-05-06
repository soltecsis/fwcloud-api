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
const MAX_DESCRIPTION_SECTION_LENGTH = 512;
const MAX_DESCRIPTION_VALUE_LENGTH = 120;

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

const ACTION_VERB_MAP: Record<string, string> = {
  add: 'Add',
  archive: 'Archive',
  assign: 'Assign',
  attach: 'Attach',
  backup: 'Backup',
  check: 'Check',
  clone: 'Clone',
  compare: 'Compare',
  compile: 'Compile',
  create: 'Create',
  deactivate: 'Deactivate',
  del: 'Delete',
  delete: 'Delete',
  destroy: 'Delete',
  detach: 'Detach',
  disable: 'Disable',
  download: 'Download',
  enable: 'Enable',
  export: 'Export',
  fetch: 'Fetch',
  generate: 'Generate',
  get: 'Get',
  import: 'Import',
  index: 'List',
  info: 'Get',
  install: 'Install',
  list: 'List',
  login: 'Log in',
  logout: 'Log out',
  merge: 'Merge',
  move: 'Move',
  patch: 'Update',
  publish: 'Publish',
  register: 'Register',
  remove: 'Remove',
  rename: 'Rename',
  replace: 'Replace',
  reset: 'Reset',
  restore: 'Restore',
  run: 'Run',
  save: 'Save',
  search: 'Search',
  setup: 'Setup',
  show: 'Show',
  sync: 'Sync',
  test: 'Test',
  uninstall: 'Uninstall',
  unlock: 'Unlock',
  unregister: 'Unregister',
  update: 'Update',
  upload: 'Upload',
  validate: 'Validate',
  verify: 'Verify',
};

const ACTION_TOKENS = new Set(Object.keys(ACTION_VERB_MAP));
const IGNORED_RESOURCE_TOKENS = new Set(['id', 'ids', 'uuid']);
const DESCRIPTION_COLUMN_KEYS = new Set([
  'user',
  'fwcloud',
  'firewall',
  'cluster',
  'ip',
  'sourceip',
]);
const HUMANIZE_TOKEN_OVERRIDES: Record<string, string> = {
  api: 'API',
  auditlog: 'Audit log',
  auditlogs: 'Audit logs',
  ca: 'CA',
  crt: 'CRT',
  dhcp: 'DHCP',
  firewall: 'Firewall',
  fwcloud: 'FWCloud',
  fwclouds: 'FWClouds',
  haproxy: 'HAProxy',
  ip: 'IP',
  ipobj: 'IP object',
  ipobjs: 'IP objects',
  ipsec: 'IPSec',
  policy: 'Policy',
  position: 'Position',
  positions: 'Positions',
  rule: 'Rule',
  rules: 'Rules',
  openvpn: 'OpenVPN',
  tfa: 'TFA',
  vpn: 'VPN',
  websrv: 'Web Server',
  wireguard: 'WireGuard',
};

type AuditRouteMetadata = {
  httpMethod?: string | null;
  path?: string | null;
  controller?: string | null;
  action?: string | null;
  name?: string | null;
};

type RenderableInstrumentationEntry = {
  normalizedLabel: string | null;
  text: string;
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
    'auditlog',
    'auditlogs',
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
    (req as Request & { __auditLogOriginalUrl?: string }).__auditLogOriginalUrl =
      typeof req.originalUrl === 'string' ? req.originalUrl : undefined;

    if (res.locals) {
      res.locals.__auditLogStartedAt = start;
    }

    const initialAuditLog = await this.persistInitialAuditLog(req, res, start);
    const initialAuditLogId = initialAuditLog?.id ?? null;

    if (res.locals && initialAuditLogId !== null) {
      res.locals.__auditLogId = initialAuditLogId;
    }

    const finalize = () => {
      if (handled) {
        return;
      }
      handled = true;

      this.completeAuditLog(req, res, start, initialAuditLogId).catch((error) => {
        logger().error(`Failed to complete audit log: ${error?.message ?? error}`);
      });
    };

    res.on('finish', finalize);
    res.on('close', finalize);

    next();
  }

  private async persistInitialAuditLog(
    req: Request,
    res: Response,
    start: number,
  ): Promise<AuditLog | null> {
    try {
      if (!this.shouldPersistAuditLog(req, res)) {
        return null;
      }

      const auditLog = new AuditLog();
      const instrumentationContext = this.extractAuditContext(req);

      auditLog.startedAt = new Date(start);

      auditLog.call = this.buildCall(req);
      auditLog.durationMs = null;
      auditLog.finishedAt = null;
      auditLog.data = this.buildPayload(req, res, null, instrumentationContext, null);

      await this.populateRequestContext(auditLog, req, res);

      auditLog.description = this.buildDescription(req, res, instrumentationContext, false);

      return await db.getSource().manager.getRepository(AuditLog).save(auditLog);
    } catch (error) {
      logger().error(
        `Unexpected error while creating initial audit log: ${error?.message ?? error}`,
      );
      return null;
    }
  }

  private async completeAuditLog(
    req: Request,
    res: Response,
    start: number,
    initialAuditLogId: number | null,
  ): Promise<void> {
    try {
      const auditLogWasHandled = !!res?.locals?.__auditLogHandled;
      const repository = db.getSource().manager.getRepository(AuditLog);

      if (!this.shouldPersistAuditLog(req, res)) {
        if (initialAuditLogId !== null && !auditLogWasHandled) {
          await repository.delete(initialAuditLogId);
        }
        return;
      }

      const instrumentationContext = this.extractAuditContext(req);
      const durationMs = Math.max(0, Date.now() - start);
      const startedAt = new Date(start);
      const finishedAt = new Date(start + durationMs);
      let auditLog =
        initialAuditLogId !== null
          ? await repository.findOne({ where: { id: initialAuditLogId } })
          : null;

      if (!auditLog) {
        auditLog = new AuditLog();
      }

      auditLog.startedAt = startedAt;
      auditLog.call = this.buildCall(req);
      auditLog.durationMs = durationMs;
      auditLog.finishedAt = finishedAt;
      auditLog.data = this.buildPayload(req, res, durationMs, instrumentationContext, finishedAt);

      await this.populateRequestContext(auditLog, req, res, true);

      auditLog.description = this.buildDescription(req, res, instrumentationContext);

      await repository.save(auditLog);
    } catch (error) {
      logger().error(`Unexpected error while completing audit log: ${error?.message ?? error}`);
    }
  }

  private async populateRequestContext(
    auditLog: AuditLog,
    req: Request,
    res: Response,
    preserveExistingValues: boolean = false,
  ): Promise<void> {
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

    auditLog.fwCloudId = this.keepValue(fwCloudId, auditLog.fwCloudId, preserveExistingValues);
    auditLog.firewallId = this.keepValue(firewallId, auditLog.firewallId, preserveExistingValues);
    auditLog.clusterId = this.keepValue(clusterId, auditLog.clusterId, preserveExistingValues);

    const firewall =
      auditLog.firewallId !== null && auditLog.firewallId !== undefined
        ? await Firewall.findOne({ where: { id: auditLog.firewallId } })
        : null;

    const firewallClusterIdCandidate =
      firewall && firewall.clusterId !== undefined
        ? AuditLogHelper.getNumeric(firewall.clusterId)
        : null;
    const localClusterId = AuditLogHelper.getNumeric(res?.locals?.__auditLogClusterId);

    const resolvedClusterId =
      auditLog.clusterId ??
      (firewallClusterIdCandidate !== null && firewallClusterIdCandidate > 0
        ? firewallClusterIdCandidate
        : null) ??
      (localClusterId !== null && localClusterId > 0 ? localClusterId : null);

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

    auditLog.fwCloudName =
      fwCloud?.name ??
      this.getAuditLogLocalString(res, '__auditLogFwCloudName') ??
      (preserveExistingValues ? auditLog.fwCloudName : null);
    auditLog.firewallName =
      firewall?.name ??
      this.getAuditLogLocalString(res, '__auditLogFirewallName') ??
      (preserveExistingValues ? auditLog.firewallName : null);
    auditLog.clusterName =
      cluster?.name ??
      this.getAuditLogLocalString(res, '__auditLogClusterName') ??
      (preserveExistingValues ? auditLog.clusterName : null);
  }

  private getAuditLogLocalString(res: Response, key: string): string | null {
    const value = res?.locals?.[key];
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
  }

  private keepValue<T>(value: T | null, current: T | null, keepCurrent: boolean): T | null {
    return value ?? (keepCurrent ? current : null);
  }

  private buildCall(req: Request): string {
    const base = `${req.method.toUpperCase()} ${req.originalUrl}`;
    return base.length <= 255 ? base : `${base.substring(0, 252)}...`;
  }

  private buildDescription(
    req: Request,
    res: Response,
    instrumentation: Record<string, string | number> = {},
    includeStatus: boolean = true,
  ): string {
    const pieces: string[] = [];
    const usedLabels = new Set<string>();
    const routeMetadata = this.resolveRouteMetadata(req, res);
    const narrative = this.buildOperationNarrative(req, routeMetadata);
    if (narrative) {
      pieces.push(narrative);
    }

    if (includeStatus) {
      pieces.push(`Status ${res.statusCode}`);
      usedLabels.add('status');
    }

    const instrumentationEntries = this.buildInstrumentationEntries(instrumentation, usedLabels);
    const excludedSectionKeys = new Set<string>([
      ...this.buildDescriptionKeySet(usedLabels),
      ...DESCRIPTION_COLUMN_KEYS,
    ]);
    for (const entry of instrumentationEntries) {
      if (entry.normalizedLabel) {
        excludedSectionKeys.add(entry.normalizedLabel);
      }
    }

    const paramsLabel = this.renderDescriptionSection('Params', req.params, excludedSectionKeys);
    if (paramsLabel) {
      pieces.push(paramsLabel);
      usedLabels.add('params');
    }

    const queryLabel = this.renderDescriptionSection('Query', req.query, excludedSectionKeys);
    if (queryLabel) {
      pieces.push(queryLabel);
      usedLabels.add('query');
    }

    const bodyLabel = this.renderDescriptionSection('Body', req.body, excludedSectionKeys);
    if (bodyLabel) {
      pieces.push(bodyLabel);
      usedLabels.add('body');
    }

    for (const entry of instrumentationEntries) {
      pieces.push(entry.text);
    }

    const description = pieces.join('. ');
    return description.length > 0 ? description : this.buildCall(req);
  }

  private buildInstrumentationEntries(
    instrumentation: Record<string, string | number>,
    usedLabels: ReadonlySet<string>,
  ): RenderableInstrumentationEntry[] {
    const entries: RenderableInstrumentationEntry[] = [];

    for (const [label, value] of Object.entries(instrumentation)) {
      if (value === null || value === undefined) {
        continue;
      }

      if (usedLabels.has(label)) {
        continue;
      }

      const normalizedLabel = this.normalizeDescriptionKey(label);
      if (normalizedLabel && DESCRIPTION_COLUMN_KEYS.has(normalizedLabel)) {
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

      const labelTitle = this.humanizeToken(label);
      const safeLabel = labelTitle && labelTitle.trim().length > 0 ? labelTitle : label;
      entries.push({
        normalizedLabel,
        text: `${safeLabel}: ${rendered}`,
      });
    }

    return entries;
  }

  private buildDescriptionKeySet(labels: Iterable<string>): Set<string> {
    const normalizedLabels = new Set<string>();

    for (const label of labels) {
      const normalized = this.normalizeDescriptionKey(label);
      if (normalized) {
        normalizedLabels.add(normalized);
      }
    }

    return normalizedLabels;
  }

  private normalizeDescriptionKey(rawLabel: string): string | null {
    if (!rawLabel || rawLabel.trim().length === 0) {
      return null;
    }

    const tokens = this.tokenize(rawLabel).filter((token) => !IGNORED_RESOURCE_TOKENS.has(token));
    if (tokens.length === 0) {
      return null;
    }

    if (tokens[0] === 'target' && tokens[1] === 'scope') {
      return 'scope';
    }

    return tokens.join('');
  }

  private buildOperationNarrative(
    req: Request,
    metadata: AuditRouteMetadata | null,
  ): string | null {
    const policyNarrative = this.buildPolicyMoveNarrative(req, metadata);
    if (policyNarrative) {
      return policyNarrative;
    }

    const verb = this.resolveOperationVerb(req, metadata);
    const resource = this.resolveOperationResource(req, metadata);

    if (!verb && !resource) {
      return null;
    }

    const pastVerb = verb ? this.toPastTense(verb) : null;
    const base = pastVerb && resource ? `${pastVerb} ${resource}` : (pastVerb ?? resource ?? '');
    const trimmed = base.trim();

    if (!trimmed) {
      return null;
    }

    return this.truncateDescription(trimmed, MAX_DESCRIPTION_SECTION_LENGTH);
  }

  private buildPolicyMoveNarrative(
    req: Request,
    metadata: AuditRouteMetadata | null,
  ): string | null {
    const tokens = this.collectTokens([
      metadata?.path,
      metadata?.name,
      req.baseUrl,
      req.path,
      req.originalUrl ? req.originalUrl.split('?')[0] : null,
    ]);

    const hasPolicyHint = tokens.has('policy');
    if (!hasPolicyHint) {
      return null;
    }

    const newPositionValue = this.resolveRequestValue(req, ['new_position']);
    const newRuleValue = this.resolveRequestValue(req, ['new_rule']);
    const newOrderValue = this.resolveRequestValue(req, ['new_order']);
    const hasMoveHint =
      tokens.has('move') || !!newPositionValue || !!newRuleValue || !!newOrderValue;

    if (!hasMoveHint) {
      return null;
    }

    const positionValue = newPositionValue ?? this.resolveRequestValue(req, ['position']);
    const ruleValue = newRuleValue ?? this.resolveRequestValue(req, ['rule']);
    const orderValue = newOrderValue ?? this.resolveRequestValue(req, ['position_order', 'order']);

    const objectInfo = this.resolvePolicyObject(req);

    if (!objectInfo && !positionValue && !ruleValue) {
      return null;
    }

    const parts: string[] = ['Moved in the policy'];

    if (objectInfo) {
      parts.push(`${objectInfo.label} ${objectInfo.value}`);
    }

    if (positionValue && ruleValue) {
      parts.push(`to position ${positionValue} and rule ${ruleValue}`);
    } else if (positionValue) {
      parts.push(`to position ${positionValue}`);
    } else if (ruleValue) {
      parts.push(`to rule ${ruleValue}`);
    }

    if (orderValue && !positionValue) {
      parts.push(`with order ${orderValue}`);
    }

    return parts.join(' ');
  }

  private resolvePolicyObject(req: Request): { label: string; value: string } | null {
    const candidates: Array<{ keys: string[]; label: string }> = [
      { keys: ['ipobj'], label: 'object' },
      { keys: ['ipobj_g', 'ipobjGroup', 'ipobjGroupId'], label: 'object group' },
      { keys: ['interface'], label: 'interface' },
      { keys: ['openvpn'], label: 'OpenVPN' },
      { keys: ['wireguard'], label: 'WireGuard' },
      { keys: ['ipsec'], label: 'IPSec' },
      { keys: ['prefix'], label: 'prefix' },
      { keys: ['mark'], label: 'mark' },
    ];

    for (const candidate of candidates) {
      const value = this.resolveRequestValue(req, candidate.keys);
      if (value) {
        return { label: candidate.label, value };
      }
    }

    return null;
  }

  private resolveRequestValue(req: Request, keys: string[]): string | null {
    const raw = this.findFirstValue(req, keys);
    if (raw === null || raw === undefined) {
      return null;
    }

    const sanitized = this.sanitize(raw);
    const rendered = this.renderDescriptionValue(sanitized, 0);
    if (!rendered || rendered.length === 0) {
      return null;
    }

    return rendered;
  }

  private collectTokens(sources: Array<string | null | undefined>): Set<string> {
    const tokens = new Set<string>();

    for (const source of sources) {
      if (!source) {
        continue;
      }

      for (const token of this.tokenize(source)) {
        tokens.add(token);
      }
    }

    return tokens;
  }

  private toPastTense(verb: string): string {
    const normalized = verb.trim().toLowerCase();
    const irregular: Record<string, string> = {
      'log in': 'logged in',
      'log out': 'logged out',
      get: 'retrieved',
      fetch: 'fetched',
      run: 'ran',
      set: 'set',
      reset: 'reset',
      put: 'put',
      cut: 'cut',
      read: 'read',
      show: 'showed',
      list: 'listed',
      move: 'moved',
      delete: 'deleted',
      remove: 'removed',
      update: 'updated',
      create: 'created',
      add: 'added',
      assign: 'assigned',
      attach: 'attached',
      detach: 'detached',
      enable: 'enabled',
      disable: 'disabled',
      install: 'installed',
      uninstall: 'uninstalled',
      upload: 'uploaded',
      download: 'downloaded',
      export: 'exported',
      import: 'imported',
      compile: 'compiled',
      merge: 'merged',
      rename: 'renamed',
      replace: 'replaced',
      save: 'saved',
      sync: 'synced',
      validate: 'validated',
      verify: 'verified',
      search: 'searched',
      register: 'registered',
      unregister: 'unregistered',
      publish: 'published',
      archive: 'archived',
      restore: 'restored',
      backup: 'backed up',
      generate: 'generated',
      test: 'tested',
      compare: 'compared',
      check: 'checked',
      clone: 'cloned',
      unlock: 'unlocked',
      lock: 'locked',
    };

    const mapped = irregular[normalized];
    const past = mapped ? mapped : normalized.endsWith('e') ? `${normalized}d` : `${normalized}ed`;

    return past.charAt(0).toUpperCase() + past.slice(1);
  }

  private resolveOperationVerb(req: Request, metadata: AuditRouteMetadata | null): string | null {
    const routePath = this.stripPathParameterTokens(this.normalizeRoutePath(req.route?.path));
    const metadataPath = this.stripPathParameterTokens(metadata?.path);
    const candidates: Array<string | null | undefined> = [
      metadata?.action,
      metadata?.name,
      metadataPath,
      routePath,
      req.path,
      req.originalUrl ? req.originalUrl.split('?')[0] : null,
    ];

    for (const candidate of candidates) {
      if (!candidate) {
        continue;
      }

      const tokens = this.tokenize(candidate);
      for (let i = tokens.length - 1; i >= 0; i--) {
        const verb = ACTION_VERB_MAP[tokens[i]];
        if (verb) {
          return verb;
        }
      }
    }

    const method = typeof req.method === 'string' ? req.method.toUpperCase() : '';
    if (method === 'POST') {
      return 'Create';
    }

    if (method === 'PUT' || method === 'PATCH') {
      return 'Update';
    }

    if (method === 'DELETE') {
      return 'Delete';
    }

    if (method === 'GET' || method === 'HEAD') {
      return 'Get';
    }

    return null;
  }

  private resolveOperationResource(
    req: Request,
    metadata: AuditRouteMetadata | null,
  ): string | null {
    const routePath = this.stripPathParameterTokens(this.normalizeRoutePath(req.route?.path));
    const metadataPath = this.stripPathParameterTokens(metadata?.path);
    const sources: Array<string | null | undefined> = [
      metadata?.name,
      metadataPath,
      routePath,
      req.baseUrl ? `${req.baseUrl}${req.path ?? ''}` : null,
      req.path,
      req.originalUrl ? req.originalUrl.split('?')[0] : null,
    ];

    for (const source of sources) {
      if (!source) {
        continue;
      }

      const tokens = this.tokenize(source);
      const filtered = tokens.filter(
        (token) => !ACTION_TOKENS.has(token) && !IGNORED_RESOURCE_TOKENS.has(token),
      );

      if (filtered.length > 0) {
        const humanized = this.humanizeTokens(filtered);
        if (humanized.length > 0) {
          return humanized;
        }
      }
    }

    if (metadata?.controller) {
      const baseName = metadata.controller.replace(/Controller$/, '');
      const tokens = this.tokenize(baseName);
      const filtered = tokens.filter(
        (token) => !ACTION_TOKENS.has(token) && !IGNORED_RESOURCE_TOKENS.has(token),
      );
      if (filtered.length > 0) {
        const humanized = this.humanizeTokens(filtered);
        if (humanized.length > 0) {
          return humanized;
        }
      }
    }

    return null;
  }

  private renderDescriptionSection(
    label: string,
    value: unknown,
    excludedKeys: Set<string> = new Set<string>(),
  ): string | null {
    const sanitized = this.sanitize(value);
    const filtered = this.filterDescriptionSectionValue(sanitized, excludedKeys);
    const rendered = this.renderDescriptionValue(filtered, 0);
    if (!rendered || rendered.length === 0) {
      return null;
    }

    return `${label}: ${rendered}`;
  }

  private filterDescriptionSectionValue(value: unknown, excludedKeys: Set<string>): unknown {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return value;
    }

    const objectValue = value as Record<string, unknown>;
    const filtered: Record<string, unknown> = {};
    let hasOwnKey = false;
    for (const key in objectValue) {
      if (!Object.prototype.hasOwnProperty.call(objectValue, key)) {
        continue;
      }

      hasOwnKey = true;
      const entryValue = objectValue[key];
      const normalizedKey = this.normalizeDescriptionKey(key);
      const isRenderable = this.renderDescriptionValue(entryValue, 1) !== null;

      if (normalizedKey && excludedKeys.has(normalizedKey) && isRenderable) {
        continue;
      }

      if (normalizedKey && isRenderable) {
        excludedKeys.add(normalizedKey);
      }

      filtered[key] = entryValue;
    }

    return hasOwnKey ? filtered : value;
  }

  private renderDescriptionValue(value: any, depth: number): string | null {
    if (value === null || value === undefined) {
      return null;
    }

    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed.length === 0) {
        return null;
      }
      return this.truncateDescription(trimmed, MAX_DESCRIPTION_VALUE_LENGTH);
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }

    if (Array.isArray(value)) {
      if (value.length === 0) {
        return null;
      }

      if (depth > 0) {
        return this.truncateDescription(JSON.stringify(value), MAX_DESCRIPTION_VALUE_LENGTH);
      }

      let description = '';
      for (const item of value) {
        const rendered = this.renderDescriptionValue(item, depth + 1);
        if (rendered === null || rendered.length === 0) {
          continue;
        }
        description += description.length > 0 ? `, ${rendered}` : rendered;
      }

      return description.length > 0 ? description : null;
    }

    if (typeof value === 'object') {
      if (depth > 0) {
        return this.truncateDescription(JSON.stringify(value), MAX_DESCRIPTION_VALUE_LENGTH);
      }

      const objectValue = value as Record<string, unknown>;
      let description = '';
      for (const key in objectValue) {
        if (!Object.prototype.hasOwnProperty.call(objectValue, key)) {
          continue;
        }

        const rendered = this.renderDescriptionValue(objectValue[key], depth + 1);
        if (rendered === null || rendered.length === 0) {
          continue;
        }
        const part = `${key}=${rendered}`;
        description += description.length > 0 ? `, ${part}` : part;
      }

      return description.length > 0 ? description : null;
    }

    return this.truncateDescription(String(value), MAX_DESCRIPTION_VALUE_LENGTH);
  }

  private humanizeTokens(tokens: string[]): string {
    const cleaned: string[] = [];
    const seen = new Set<string>();

    for (const token of tokens) {
      const trimmed = token.trim();
      if (!trimmed) {
        continue;
      }

      const normalized = this.normalizeResourceToken(trimmed);
      if (!normalized || seen.has(normalized)) {
        continue;
      }

      seen.add(normalized);
      cleaned.push(trimmed);
    }

    return cleaned.map((token) => this.humanizeToken(token)).join(' ');
  }

  private normalizeResourceToken(token: string): string {
    const normalized = token.trim().toLowerCase();
    if (!normalized) {
      return '';
    }

    if (normalized.endsWith('ies') && normalized.length > 3) {
      return `${normalized.substring(0, normalized.length - 3)}y`;
    }

    if (normalized.endsWith('s') && normalized.length > 3 && !normalized.endsWith('ss')) {
      return normalized.substring(0, normalized.length - 1);
    }

    return normalized;
  }

  private humanizeToken(token: string): string {
    const normalized = token.toLowerCase();
    const override = HUMANIZE_TOKEN_OVERRIDES[normalized];
    if (override) {
      return override;
    }

    if (!normalized) {
      return '';
    }

    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
  }

  private normalizeRoutePath(pathValue: unknown): string | null {
    if (typeof pathValue === 'string') {
      return pathValue;
    }

    if (
      typeof pathValue === 'number' ||
      typeof pathValue === 'boolean' ||
      typeof pathValue === 'bigint'
    ) {
      return String(pathValue);
    }

    if (pathValue instanceof RegExp) {
      return pathValue.source;
    }

    if (Array.isArray(pathValue)) {
      const joined = pathValue
        .map((entry) => {
          if (typeof entry === 'string') {
            return entry;
          }
          if (entry instanceof RegExp) {
            return entry.source;
          }
          if (
            typeof entry === 'number' ||
            typeof entry === 'boolean' ||
            typeof entry === 'bigint'
          ) {
            return String(entry);
          }
          return null;
        })
        .filter((entry): entry is string => entry !== null && entry.length > 0)
        .join('|');

      return joined.length > 0 ? joined : null;
    }

    return null;
  }

  private stripPathParameterTokens(pathValue: string | null | undefined): string | null {
    if (!pathValue || pathValue.trim().length === 0) {
      return null;
    }

    return pathValue
      .replace(/:[a-zA-Z0-9_]+/g, '')
      .replace(/\{[a-zA-Z0-9_]+\}/g, '')
      .replace(/<([a-zA-Z0-9_]+)>/g, '')
      .replace(/\/{2,}/g, '/')
      .trim();
  }

  private truncateDescription(value: string, maxLength: number): string {
    if (!value || value.length <= maxLength) {
      return value;
    }

    if (maxLength <= 3) {
      return value.substring(0, maxLength);
    }

    return `${value.substring(0, maxLength - 3)}...`;
  }

  private buildPayload(
    req: Request,
    res: Response,
    durationMs: number | null,
    instrumentation: Record<string, string | number> = {},
    finishedAt: Date | null = null,
  ): string {
    const payload = {
      method: req.method,
      url: req.originalUrl,
      statusCode: durationMs === null ? null : res.statusCode,
      durationMs,
      finishedAt: finishedAt ? finishedAt.toISOString() : null,
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
    if (res?.locals?.__auditLogHandled) {
      return false;
    }

    const method = typeof req.method === 'string' ? req.method.toUpperCase() : 'GET';
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
      return false;
    }

    const normalizedPath = this.normalizeRequestPath(req);

    if (this.isRestrictedRequest(normalizedPath)) {
      return false;
    }

    if (this.isExplicitDeleteRequest(normalizedPath)) {
      return true;
    }

    const metadata = this.resolveRouteMetadata(req, res);
    const classification = this.classifyOperation(req, metadata);

    if (classification === 'mutation') {
      return true;
    }

    if (classification === 'read') {
      return false;
    }

    if (method === 'DELETE') {
      return true;
    }

    return true;
  }

  private normalizeRequestPath(req: Request): string {
    const captured = (req as Request & { __auditLogOriginalUrl?: string }).__auditLogOriginalUrl;
    const raw =
      typeof captured === 'string' && captured.length > 0
        ? captured
        : typeof req.originalUrl === 'string' && req.originalUrl.length > 0
          ? req.originalUrl
          : typeof req.url === 'string'
            ? req.url
            : '';

    const withoutQuery = raw.split('?')[0];
    return withoutQuery.toLowerCase();
  }

  private getPathSegments(path: string): string[] {
    return path
      .split('/')
      .map((segment) => segment.trim())
      .filter((segment) => segment.length > 0);
  }

  private isRestrictedRequest(path: string): boolean {
    const segments = this.getPathSegments(path);
    const last = segments[segments.length - 1];
    return last === 'restricted' || last === 'restrictions';
  }

  private isExplicitDeleteRequest(path: string): boolean {
    const segments = this.getPathSegments(path);
    const last = segments[segments.length - 1];

    return last === 'del' || last === 'delete' || last === 'destroy' || last === 'delfromcluster';
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
