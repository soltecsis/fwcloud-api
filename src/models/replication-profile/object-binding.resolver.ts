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
import { OBJECT_TREE_FOLDERS, SERVICE_TREE_FOLDERS, Tree } from '../tree/Tree';
import { dbQuery, findTreeNodeId } from './replication-sql.helpers';
import {
  PROFILE_OBJECT_DATA_FIELDS,
  ProfileExternalObjectBinding,
} from './replication-profile-object-reference';
import {
  REPLICATION_PROFILE_IPOBJ_TYPE_BY_KIND,
  REPLICATION_PROFILE_IPOBJ_TYPE_BY_PROTOCOL,
  REPLICATION_PROFILE_IPOBJ_TYPE_RANGE,
  REPLICATION_PROFILE_PROTOCOL_BY_IPOBJ_TYPE,
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

/** Folder of the objects or services tree each object type is placed in. */
const TREE_FOLDER_BY_TYPE = new Map(
  [...OBJECT_TREE_FOLDERS, ...SERVICE_TREE_FOLDERS].map((folder) => [folder.objType, folder]),
);

/**
 * Places an object a profile created in the folder of the objects or services tree its type
 * belongs to: an object without a node exists but stays out of the tree until the tree is
 * repaired. `folderIds` remembers the folders already looked up.
 */
export async function placeObjectInTreeFolder(
  fwCloudId: number,
  objectId: number,
  objectType: number,
  name: string,
  folderIds: Map<number, number | null> = new Map(),
): Promise<void> {
  const folder = TREE_FOLDER_BY_TYPE.get(objectType);

  if (!folder) {
    return;
  }

  let folderId = folderIds.get(objectType);

  if (folderId === undefined) {
    folderId = await findTreeNodeId(fwCloudId, folder.nodeType, 'name', folder.name);
    folderIds.set(objectType, folderId);
  }

  if (folderId !== null) {
    await Tree.newNode(
      db.getQuery(),
      fwCloudId,
      name,
      folderId,
      folder.nodeType,
      objectId,
      objectType,
    );
  }
}

/**
 * Single entry point that turns the declarative object references of a profile
 * into ipobj ids, with resolve-or-create semantics: an equivalent object in the
 * FWCloud is reused, and only a genuinely new one is created (and placed in the
 * objects tree, so it is not orphaned). Applying the same profile twice
 * therefore does not litter the FWCloud with duplicates.
 */
export class ObjectBindingResolver {
  private readonly cache = new Map<string, ObjectBindingResult>();
  private readonly treeFolderCache = new Map<number, number | null>();

  constructor(
    private readonly fwCloudId: number,
    /** When false, nothing is written: used by dry runs. */
    private readonly allowCreate: boolean = true,
    /** Template object references of the profile -> what their usages bind to. */
    private readonly externalObjects: ReadonlyMap<string, ProfileExternalObjectBinding> = new Map(),
  ) {}

  resolve(request: ObjectBindingRequest): Promise<ObjectBindingResult> {
    return this.findOrCreate(
      this.cacheKey(request),
      () => this.findExisting(request),
      () => this.create(request),
    );
  }

  /**
   * What every usage of a template's external object binds to, so one reference always means one
   * object: the existing object it resolved to or, for replacement data, an identical object of
   * the FWCloud (all of its data compared, so a service with other flags or source ports is not
   * taken for it) or else a new one.
   */
  async resolveExternal(referenceId: string): Promise<{ id: number; type: number }> {
    const binding = this.externalObjects.get(referenceId);

    if (!binding) {
      throw new Error(`Template object reference "${referenceId}" has not been resolved.`);
    }

    const { id } =
      binding.id === undefined
        ? await this.findOrCreate(
            `external:${referenceId}`,
            () => this.findIdenticalObject(binding.data),
            () => this.createObject(binding.data),
          )
        : binding;

    return { id, type: binding.type };
  }

  /** One lookup per key and run: the object found for it or else the one created. */
  private async findOrCreate(
    key: string,
    find: () => Promise<ObjectBindingResult | null>,
    create: () => Promise<ObjectBindingResult>,
  ): Promise<ObjectBindingResult> {
    let result = this.cache.get(key);

    if (!result) {
      result = (await find()) ?? (await create());
      this.cache.set(key, result);
    }

    return result;
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

  private findExisting(request: ObjectBindingRequest): Promise<ObjectBindingResult | null> {
    if (request.kind === 'service') {
      return this.findObject(
        'type = ? AND destination_port_start = ? AND destination_port_end = ?',
        [REPLICATION_PROFILE_IPOBJ_TYPE_BY_PROTOCOL[request.protocol], request.port, request.port],
      );
    }

    if (request.kind === 'range') {
      return this.findObject('type = ? AND ip_version = ? AND range_start = ? AND range_end = ?', [
        REPLICATION_PROFILE_IPOBJ_TYPE_RANGE,
        request.ipVersion,
        request.start,
        request.end,
      ]);
    }

    // An address bound to an interface must match that interface: the same
    // literal IP under a different interface is a different object.
    return this.findObject(
      'type = ? AND ip_version = ? AND address = ? AND netmask = ? AND interface <=> ?',
      [
        REPLICATION_PROFILE_IPOBJ_TYPE_BY_KIND[request.kind],
        request.ipVersion,
        request.address,
        request.netmask,
        request.interfaceId ?? null,
      ],
    );
  }

  private findIdenticalObject(data: ReplicationProfileRecord): Promise<ObjectBindingResult | null> {
    // Columns the data leaves out are NULL in a created object, so they must be NULL here too.
    return this.findObject(
      `interface IS NULL AND ${PROFILE_OBJECT_DATA_FIELDS.map((field) => `${field} <=> ?`).join(' AND ')}`,
      PROFILE_OBJECT_DATA_FIELDS.map((field) => data[field] ?? null),
    );
  }

  /** The oldest object of the FWCloud matching the condition, as a binding that reuses it. */
  private async findObject(
    condition: string,
    params: unknown[],
  ): Promise<ObjectBindingResult | null> {
    const [row] = await dbQuery<{ id: number; name: string }>(
      `SELECT id, name FROM ipobj WHERE fwcloud = ? AND ${condition} ORDER BY id LIMIT 1`,
      [this.fwCloudId, ...params],
    );

    return row ? { id: row.id, created: false, name: row.name } : null;
  }

  private async create(request: ObjectBindingRequest): Promise<ObjectBindingResult> {
    if (!this.allowCreate) {
      // Dry run: report the object that would be created without a real id.
      return { id: 0, created: true, name: this.defaultName(request) };
    }

    const name = request.name ?? this.defaultName(request);

    if (request.kind === 'service') {
      const ipObjTypeId = REPLICATION_PROFILE_IPOBJ_TYPE_BY_PROTOCOL[request.protocol];

      return this.saveObject(ipObjTypeId, name, {
        protocol: REPLICATION_PROFILE_PROTOCOL_BY_IPOBJ_TYPE[ipObjTypeId],
        source_port_start: 0,
        source_port_end: 0,
        destination_port_start: request.port,
        destination_port_end: request.port,
      });
    }

    if (request.kind === 'range') {
      return this.saveObject(REPLICATION_PROFILE_IPOBJ_TYPE_RANGE, name, {
        range_start: request.start,
        range_end: request.end,
        ip_version: request.ipVersion,
      });
    }

    // Addresses owned by an interface hang from the interface node, not from
    // the standard objects folder, so they are only placed when unbound.
    return this.saveObject(
      REPLICATION_PROFILE_IPOBJ_TYPE_BY_KIND[request.kind],
      name,
      {
        address: request.address,
        netmask: request.netmask,
        ip_version: request.ipVersion,
        interfaceId: request.interfaceId ?? null,
      },
      request.interfaceId === undefined,
    );
  }

  /** The object the replacement data of a template's external object describes. */
  private async createObject(data: ReplicationProfileRecord): Promise<ObjectBindingResult> {
    const { type, ...columns } = data;
    const name = data.name as string;

    return this.allowCreate
      ? this.saveObject(Number(type), name, columns)
      : { id: 0, created: true, name };
  }

  /** Saves a new object of the FWCloud and, unless told otherwise, places it in the objects tree. */
  private async saveObject(
    ipObjTypeId: number,
    name: string,
    columns: ReplicationProfileRecord,
    inTree: boolean = true,
  ): Promise<ObjectBindingResult> {
    const { id } = await db
      .getSource()
      .manager.getRepository(IPObj)
      .save({ ...columns, name, ipObjTypeId, fwCloudId: this.fwCloudId });

    if (inTree) {
      await placeObjectInTreeFolder(this.fwCloudId, id, ipObjTypeId, name, this.treeFolderCache);
    }

    return { id, created: true, name };
  }

  private defaultName(request: ObjectBindingRequest): string {
    if (request.kind === 'range') {
      return `${request.start}-${request.end}`;
    }

    return request.kind === 'service'
      ? `${request.protocol.toUpperCase()}/${request.port}`
      : `${request.address}${request.netmask === '/32' || request.netmask === '/128' ? '' : request.netmask}`;
  }
}
