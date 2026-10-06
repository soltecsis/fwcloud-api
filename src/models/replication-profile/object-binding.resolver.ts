/*
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

    You should have received a copy of the GNU General Public License
    along with FWCloud.  If not, see <https://www.gnu.org/licenses/>.
*/

import db from '../../database/database-manager';
import { IPObj } from '../ipobj/IPObj';
import { Tree } from '../tree/Tree';
import { dbQuery } from './replication-sql.helpers';
import { ProfileExternalObjectBinding } from './replication-profile-object-reference';
import { PROFILE_OBJECT_DATA_FIELDS } from './replication-profile-object-reference.service';
import {
  REPLICATION_PROFILE_IPOBJ_TYPE_ADDRESS,
  REPLICATION_PROFILE_IPOBJ_TYPE_BY_KIND,
  REPLICATION_PROFILE_IPOBJ_TYPE_DNS,
  REPLICATION_PROFILE_IPOBJ_TYPE_HOST,
  REPLICATION_PROFILE_IPOBJ_TYPE_ICMP,
  REPLICATION_PROFILE_IPOBJ_TYPE_IP,
  REPLICATION_PROFILE_IPOBJ_TYPE_NETWORK,
  REPLICATION_PROFILE_IPOBJ_TYPE_RANGE,
  REPLICATION_PROFILE_IPOBJ_TYPE_TCP,
  REPLICATION_PROFILE_IPOBJ_TYPE_UDP,
  ReplicationProfileIpVersion,
  ReplicationProfileObjectKind,
  ReplicationProfileRecord,
  ReplicationProfileRuleProtocol,
} from './replication-profile.constants';

/**
 * What the caller wants to exist in the FWCloud. The resolver turns it into a
 * concrete ipobj id, reusing an equivalent object when one is already there.
 */
export type ObjectBindingRequest =
  | {
      kind: Exclude<ReplicationProfileObjectKind, 'range'>;
      ipVersion: ReplicationProfileIpVersion;
      address: string;
      netmask: string;
      name?: string;
      /** Binds the address to a firewall interface (used for provisioned IPs). */
      interfaceId?: number;
    }
  | {
      kind: 'range';
      ipVersion: ReplicationProfileIpVersion;
      start: string;
      end: string;
      name?: string;
    }
  | {
      kind: 'service';
      protocol: ReplicationProfileRuleProtocol;
      port: number;
      name?: string;
    };

export interface ObjectBindingResult {
  id: number;
  /** False when an equivalent object already existed and was reused. */
  created: boolean;
  name: string;
}

/** Objects tree folder each object type is placed in. */
const TREE_FOLDER_BY_TYPE: Record<number, { name: string; nodeType: string }> = {
  [REPLICATION_PROFILE_IPOBJ_TYPE_IP]: { name: 'IP', nodeType: 'SOI' },
  [REPLICATION_PROFILE_IPOBJ_TYPE_TCP]: { name: 'TCP', nodeType: 'SOT' },
  [REPLICATION_PROFILE_IPOBJ_TYPE_ICMP]: { name: 'ICMP', nodeType: 'SOM' },
  [REPLICATION_PROFILE_IPOBJ_TYPE_UDP]: { name: 'UDP', nodeType: 'SOU' },
  [REPLICATION_PROFILE_IPOBJ_TYPE_ADDRESS]: { name: 'Addresses', nodeType: 'OIA' },
  [REPLICATION_PROFILE_IPOBJ_TYPE_RANGE]: { name: 'Address Ranges', nodeType: 'OIR' },
  [REPLICATION_PROFILE_IPOBJ_TYPE_NETWORK]: { name: 'Networks', nodeType: 'OIN' },
  [REPLICATION_PROFILE_IPOBJ_TYPE_HOST]: { name: 'Hosts', nodeType: 'OIH' },
  [REPLICATION_PROFILE_IPOBJ_TYPE_DNS]: { name: 'DNS', nodeType: 'ONS' },
};

/**
 * Single entry point that turns the declarative object references of a profile
 * into ipobj ids, with resolve-or-create semantics: an equivalent object in the
 * FWCloud is reused, and only a genuinely new one is created (and placed in the
 * objects tree, so it is not orphaned). Applying the same profile twice
 * therefore does not litter the FWCloud with duplicates.
 */
export class ObjectBindingResolver {
  private readonly cache = new Map<string, ObjectBindingResult>();
  private readonly treeFolderCache = new Map<string, number | null>();

  constructor(
    private readonly fwCloudId: number,
    /** When false, nothing is written: used by dry runs. */
    private readonly allowCreate: boolean = true,
    /** Template object references of the profile -> what their usages bind to. */
    private readonly externalObjects: ReadonlyMap<string, ProfileExternalObjectBinding> = new Map(),
  ) {}

  /** Objects created during this run, in creation order. */
  public readonly created: ObjectBindingResult[] = [];

  async resolve(request: ObjectBindingRequest): Promise<ObjectBindingResult> {
    const key = this.cacheKey(request);
    const cached = this.cache.get(key);

    if (cached) {
      return cached;
    }

    const existing = await this.findExisting(request);
    const result = existing ?? (await this.create(request));

    this.cache.set(key, result);

    if (result.created) {
      this.created.push(result);
    }

    return result;
  }

  /**
   * What every usage of a template's external object binds to, so one reference always means one
   * object: the existing object it resolved to or, for replacement data, an identical object of
   * the FWCloud (all of its data compared, so a service with other flags or source ports is not
   * taken for it) or else a new one.
   */
  async resolveExternal(
    referenceId: string,
  ): Promise<{ id: number; type: number; isGroup: boolean }> {
    const binding = this.externalObjects.get(referenceId);

    if (!binding) {
      throw new Error(`Template object reference "${referenceId}" has not been resolved.`);
    }

    if (binding.id !== undefined) {
      return { id: binding.id, type: binding.type, isGroup: binding.isGroup };
    }

    const key = `external:${referenceId}`;
    let result = this.cache.get(key);

    if (!result) {
      result =
        (await this.findIdenticalObject(binding.data)) ?? (await this.createObject(binding.data));
      this.cache.set(key, result);

      if (result.created) {
        this.created.push(result);
      }
    }

    return { id: result.id, type: binding.type, isGroup: false };
  }

  private async findIdenticalObject(
    data: ReplicationProfileRecord,
  ): Promise<ObjectBindingResult | null> {
    // Columns the data leaves out are NULL in a created object, so they must be NULL here too.
    const rows = await dbQuery<{ id: number; name: string }>(
      `SELECT id, name FROM ipobj
       WHERE fwcloud = ? AND interface IS NULL AND ${PROFILE_OBJECT_DATA_FIELDS.map((field) => `${field} <=> ?`).join(' AND ')}
       ORDER BY id LIMIT 1`,
      [this.fwCloudId, ...PROFILE_OBJECT_DATA_FIELDS.map((field) => data[field] ?? null)],
    );

    return rows.length ? { id: rows[0].id, created: false, name: rows[0].name } : null;
  }

  private async createObject(data: ReplicationProfileRecord): Promise<ObjectBindingResult> {
    const name = data.name as string;

    if (!this.allowCreate) {
      return { id: 0, created: true, name };
    }

    const { type, ...columns } = data;
    const created = await db
      .getSource()
      .manager.getRepository(IPObj)
      .save({ ...columns, ipObjTypeId: Number(type), fwCloudId: this.fwCloudId });

    await this.placeInTree(created.id, Number(type), name);

    return { id: created.id, created: true, name };
  }

  private cacheKey(request: ObjectBindingRequest): string {
    if (request.kind === 'service') {
      return `service:${request.protocol}:${request.port}`;
    }

    if (request.kind === 'range') {
      return `range:${request.ipVersion}:${request.start}:${request.end}`;
    }

    return `${request.kind}:${request.ipVersion}:${request.address}:${request.netmask}:${request.interfaceId ?? 0}`;
  }

  private async findExisting(request: ObjectBindingRequest): Promise<ObjectBindingResult | null> {
    if (request.kind === 'service') {
      const type =
        request.protocol === 'tcp'
          ? REPLICATION_PROFILE_IPOBJ_TYPE_TCP
          : REPLICATION_PROFILE_IPOBJ_TYPE_UDP;

      const rows = await dbQuery<{ id: number; name: string }>(
        `SELECT id, name FROM ipobj
         WHERE fwcloud = ? AND type = ? AND destination_port_start = ? AND destination_port_end = ?
         ORDER BY id LIMIT 1`,
        [this.fwCloudId, type, request.port, request.port],
      );

      return rows.length ? { id: rows[0].id, created: false, name: rows[0].name } : null;
    }

    if (request.kind === 'range') {
      const rows = await dbQuery<{ id: number; name: string }>(
        `SELECT id, name FROM ipobj
         WHERE fwcloud = ? AND type = ? AND ip_version = ? AND range_start = ? AND range_end = ?
         ORDER BY id LIMIT 1`,
        [
          this.fwCloudId,
          REPLICATION_PROFILE_IPOBJ_TYPE_RANGE,
          request.ipVersion,
          request.start,
          request.end,
        ],
      );

      return rows.length ? { id: rows[0].id, created: false, name: rows[0].name } : null;
    }

    // An address bound to an interface must match that interface: the same
    // literal IP under a different interface is a different object.
    const interfaceClause =
      request.interfaceId === undefined ? 'AND interface IS NULL' : 'AND interface = ?';
    const params: unknown[] = [
      this.fwCloudId,
      REPLICATION_PROFILE_IPOBJ_TYPE_BY_KIND[request.kind],
      request.ipVersion,
      request.address,
      request.netmask,
    ];

    if (request.interfaceId !== undefined) {
      params.push(request.interfaceId);
    }

    const rows = await dbQuery<{ id: number; name: string }>(
      `SELECT id, name FROM ipobj
       WHERE fwcloud = ? AND type = ? AND ip_version = ? AND address = ? AND netmask = ?
       ${interfaceClause}
       ORDER BY id LIMIT 1`,
      params,
    );

    return rows.length ? { id: rows[0].id, created: false, name: rows[0].name } : null;
  }

  private async create(request: ObjectBindingRequest): Promise<ObjectBindingResult> {
    if (!this.allowCreate) {
      // Dry run: report the object that would be created without a real id.
      return { id: 0, created: true, name: this.defaultName(request) };
    }

    const name = request.name ?? this.defaultName(request);
    const repository = db.getSource().manager.getRepository(IPObj);

    if (request.kind === 'service') {
      const isTcp = request.protocol === 'tcp';
      const created = await repository.save({
        name,
        ipObjTypeId: isTcp
          ? REPLICATION_PROFILE_IPOBJ_TYPE_TCP
          : REPLICATION_PROFILE_IPOBJ_TYPE_UDP,
        protocol: isTcp ? 6 : 17,
        source_port_start: 0,
        source_port_end: 0,
        destination_port_start: request.port,
        destination_port_end: request.port,
        fwCloudId: this.fwCloudId,
      });

      await this.placeInTree(created.id, created.ipObjTypeId, name);

      return { id: created.id, created: true, name };
    }

    if (request.kind === 'range') {
      const created = await repository.save({
        name,
        ipObjTypeId: REPLICATION_PROFILE_IPOBJ_TYPE_RANGE,
        range_start: request.start,
        range_end: request.end,
        ip_version: request.ipVersion,
        fwCloudId: this.fwCloudId,
      });

      await this.placeInTree(created.id, REPLICATION_PROFILE_IPOBJ_TYPE_RANGE, name);

      return { id: created.id, created: true, name };
    }

    const ipObjTypeId = REPLICATION_PROFILE_IPOBJ_TYPE_BY_KIND[request.kind];
    const created = await repository.save({
      name,
      ipObjTypeId,
      address: request.address,
      netmask: request.netmask,
      ip_version: request.ipVersion,
      interfaceId: request.interfaceId ?? null,
      fwCloudId: this.fwCloudId,
    });

    // Addresses owned by an interface hang from the interface node, not from
    // the standard objects folder, so they are only placed when unbound.
    if (request.interfaceId === undefined) {
      await this.placeInTree(created.id, ipObjTypeId, name);
    }

    return { id: created.id, created: true, name };
  }

  private defaultName(request: ObjectBindingRequest): string {
    if (request.kind === 'range') {
      return `${request.start}-${request.end}`;
    }

    return request.kind === 'service'
      ? `${request.protocol.toUpperCase()}/${request.port}`
      : `${request.address}${request.netmask === '/32' || request.netmask === '/128' ? '' : request.netmask}`;
  }

  private async placeInTree(objectId: number, objectType: number, name: string): Promise<void> {
    const folder = TREE_FOLDER_BY_TYPE[objectType];

    if (!folder) {
      return;
    }

    const parentId = await this.getTreeFolderId(folder.name, folder.nodeType);

    if (parentId === null) {
      return;
    }

    await Tree.newNode(
      db.getQuery(),
      this.fwCloudId,
      name,
      parentId,
      folder.nodeType,
      objectId,
      objectType,
    );
  }

  private async getTreeFolderId(name: string, nodeType: string): Promise<number | null> {
    const key = `${nodeType}:${name}`;

    if (this.treeFolderCache.has(key)) {
      return this.treeFolderCache.get(key)!;
    }

    const rows = await dbQuery<{ id: number }>(
      'SELECT id FROM fwc_tree WHERE fwcloud = ? AND node_type = ? AND name = ? LIMIT 1',
      [this.fwCloudId, nodeType, name],
    );
    const id = rows.length ? rows[0].id : null;

    this.treeFolderCache.set(key, id);

    return id;
  }
}
