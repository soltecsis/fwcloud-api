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
import { IPObjGroup } from '../ipobj/IPObjGroup';
import { IPObjToIPObjGroup } from '../ipobj/IPObjToIPObjGroup';
import { Interface } from '../interface/Interface';
import { InterfaceIPObj } from '../interface/InterfaceIPObj';
import { OBJECT_TREE_FOLDERS, SERVICE_TREE_FOLDERS, Tree } from '../tree/Tree';
import { dbQuery, findTreeNodeId } from './replication-sql.helpers';
import {
  PROFILE_OBJECT_DATA_FIELDS,
  withProfileServiceSourcePorts,
  ProfileExternalObjectBinding,
  isProfileReferenceGroupType,
} from './replication-profile-object-reference';
import {
  findExistingProfileSnapshot,
  PROFILE_HOST_INTERFACE_COLUMNS,
  profileObjectSnapshotKey,
  validateProfileObjectSnapshot,
  validateProfileObjectSnapshotPlan,
} from './replication-profile-object-snapshot';
import {
  REPLICATION_PROFILE_IPOBJ_TYPE_BY_KIND,
  REPLICATION_PROFILE_IPOBJ_TYPE_BY_PROTOCOL,
  REPLICATION_PROFILE_IPOBJ_TYPE_RANGE,
  REPLICATION_PROFILE_IPOBJ_TYPE_HOST,
  REPLICATION_PROFILE_PROTOCOL_BY_IPOBJ_TYPE,
  pickProfileFields,
  PROFILE_INTERFACE_ADDRESS_METADATA_FIELDS,
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
      comment?: string | null;
      diff_serv?: number | null;
      options?: string | number | null;
      /** Keep the application-selected IP name and comment when matching an interface address. */
      useSelectedConfiguration?: boolean;
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

interface ProvisionedParameterAddress extends ObjectBindingResult {
  ipVersion: ReplicationProfileIpVersion;
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
  private readonly snapshotObjects = new Map<string, Promise<ObjectBindingResult>>();
  private readonly selectedSnapshotObjects = new Map<string, ProfileExternalObjectBinding>();
  private readonly parameterAddresses = new Map<string, Map<string, ProvisionedParameterAddress>>();

  constructor(
    private readonly fwCloudId: number,
    /** When false, nothing is written: used by dry runs. */
    private readonly allowCreate: boolean = true,
    /** Template object references of the profile -> what their usages bind to. */
    private readonly externalObjects: ReadonlyMap<string, ProfileExternalObjectBinding> = new Map(),
  ) {
    for (const binding of externalObjects.values()) {
      this.selectedSnapshotObjects.set(profileObjectSnapshotKey(binding.data), binding);
    }
  }

  resolve(request: ObjectBindingRequest): Promise<ObjectBindingResult> {
    return this.findOrCreate(
      this.cacheKey(request),
      () => this.findExisting(request),
      () => this.create(request),
    );
  }

  /** Preserve the selected interface IP for usages of its original template parameter. */
  registerParameterAddress(
    parameter: string,
    declarationKey: string,
    binding: ObjectBindingResult,
    ipVersion: ReplicationProfileIpVersion,
  ): void {
    let addresses = this.parameterAddresses.get(parameter);
    if (!addresses) {
      addresses = new Map();
      this.parameterAddresses.set(parameter, addresses);
    }

    // Real IDs identify reused IPs; previews keep distinct declarations instead of merging id 0.
    addresses.set(binding.id > 0 ? `id:${binding.id}` : declarationKey, { ...binding, ipVersion });
  }

  /** Undefined means an ordinary parameter; null means multiple interface IPs are ambiguous. */
  resolveParameterAddress(
    parameter: string,
    name?: string,
  ): ProvisionedParameterAddress | null | undefined {
    const addresses = this.parameterAddresses.get(parameter);
    if (!addresses) {
      return undefined;
    }

    const candidates = Array.from(addresses.values());
    if (candidates.length === 1) {
      return candidates[0];
    }

    const named = name ? candidates.filter((candidate) => candidate.name === name) : [];
    return named.length === 1 ? named[0] : null;
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

    const { id } = binding.id === undefined ? await this.resolveSnapshot(binding.data) : binding;

    // Application-local bindings carry the actual destination IDs back to the caller. Saved
    // template JSON is never changed; dry runs do not bind stand-in IDs as real objects.
    if (this.allowCreate && id > 0) {
      binding.id = id;
    }

    return { id, type: binding.type };
  }

  /** Validates every pending snapshot and dependency before any provisioning writes occur. */
  async prepareExternalObjects(): Promise<string[]> {
    const errors = validateProfileObjectSnapshotPlan(this.externalObjects);

    for (const [referenceId, binding] of this.externalObjects) {
      if (binding.id !== undefined) {
        continue;
      }

      const invalid = await validateProfileObjectSnapshot(
        binding.data,
        binding.type,
        this.fwCloudId,
      );

      if (invalid) {
        errors.push(`Template object reference "${referenceId}": ${invalid}`);
      }
    }

    return errors;
  }

  /** A shared dependency and its standalone template reference always resolve to one object. */
  private async resolveSnapshot(data: ReplicationProfileRecord): Promise<ObjectBindingResult> {
    const key = profileObjectSnapshotKey(data);
    const selected = this.selectedSnapshotObjects.get(key);
    if (selected?.id !== undefined) {
      return { id: selected.id, created: false, name: selected.data.name as string };
    }
    let result = this.snapshotObjects.get(key);

    if (!result) {
      result = (async () => {
        const existing = await findExistingProfileSnapshot(data, Number(data.type), this.fwCloudId);

        return existing
          ? { id: existing.id, created: false, name: data.name as string }
          : this.createSnapshot(data);
      })();
      this.snapshotObjects.set(key, result);
    }

    return result;
  }

  /** Recreates a validated snapshot through the same model APIs used by the object forms. */
  private async createSnapshot(data: ReplicationProfileRecord): Promise<ObjectBindingResult> {
    const type = Number(data.type);
    const name = data.name as string;

    if (!this.allowCreate) {
      return { id: 0, created: true, name };
    }

    if (isProfileReferenceGroupType(type)) {
      // All member IDs exist before the group receives its relationships.
      const members: ObjectBindingResult[] = [];

      for (const member of data.members as ReplicationProfileRecord[]) {
        members.push(await this.resolveSnapshot(member));
      }

      const id = await new Promise<number>((resolve, reject) => {
        IPObjGroup.insertIpobj_g(
          { name, type, fwcloud: this.fwCloudId, comment: data.comment ?? null },
          (error, result) =>
            error
              ? reject(error)
              : result?.insertId
                ? resolve(Number(result.insertId))
                : reject(new Error(`Could not recreate group "${name}".`)),
        );
      });

      for (const member of members) {
        await IPObjToIPObjGroup.insertIpobj__ipobjg({
          dbCon: db.getQuery(),
          body: { ipobj_g: id, ipobj: member.id },
        });
      }

      await placeObjectInTreeFolder(this.fwCloudId, id, type, name, this.treeFolderCache);
      return { id, created: true, name };
    }

    const columns = pickProfileFields(
      withProfileServiceSourcePorts(data),
      PROFILE_OBJECT_DATA_FIELDS,
    );
    const id = Number(
      await IPObj.insertIpobj(db.getQuery(), { ...columns, fwcloud: this.fwCloudId }),
    );
    await placeObjectInTreeFolder(this.fwCloudId, id, type, name, this.treeFolderCache);

    if (type === REPLICATION_PROFILE_IPOBJ_TYPE_HOST) {
      const hostNodeId = await findTreeNodeId(this.fwCloudId, 'OIH', 'id_obj', id);

      for (const hostInterface of data.interfaces as ReplicationProfileRecord[]) {
        const interfaceData = pickProfileFields(hostInterface, PROFILE_HOST_INTERFACE_COLUMNS);
        const interfaceId = Number(await Interface.insertInterface(db.getQuery(), interfaceData));
        await InterfaceIPObj.insertInterface__ipobj(db.getQuery(), {
          interface: interfaceId,
          ipobj: id,
          interface_order: hostInterface.interface_order ?? 1,
        });

        if (hostNodeId !== null) {
          await Tree.newNode(
            db.getQuery(),
            this.fwCloudId,
            hostInterface.name,
            hostNodeId,
            'IFH',
            interfaceId,
            hostInterface.interface_type,
          );
        }

        let interfaceNodeId: number | null | undefined;
        for (const address of hostInterface.addresses as ReplicationProfileRecord[]) {
          const addressColumns = pickProfileFields(address, PROFILE_OBJECT_DATA_FIELDS);
          const addressId = Number(
            await IPObj.insertIpobj(db.getQuery(), {
              ...addressColumns,
              fwcloud: this.fwCloudId,
              interface: interfaceId,
            }),
          );
          if (interfaceNodeId === undefined) {
            interfaceNodeId = await findTreeNodeId(this.fwCloudId, 'IFH', 'id_obj', interfaceId);
          }

          if (interfaceNodeId !== null) {
            await Tree.newNode(
              db.getQuery(),
              this.fwCloudId,
              address.name,
              interfaceNodeId,
              'OIA',
              addressId,
              address.type,
            );
          }
        }
      }
    }

    return { id, created: true, name };
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

    const metadata = pickProfileFields(request, PROFILE_INTERFACE_ADDRESS_METADATA_FIELDS);
    const selected =
      request.useSelectedConfiguration || Object.keys(metadata).length > 0
        ? `:${JSON.stringify({ name: request.name, ...metadata, useSelectedConfiguration: request.useSelectedConfiguration })}`
        : '';
    return `${request.kind}:${request.ipVersion}:${request.address}:${request.netmask}:${request.interfaceId ?? 0}${selected}`;
  }

  private findExisting(request: ObjectBindingRequest): Promise<ObjectBindingResult | null> {
    if (request.kind === 'service') {
      // A legacy port-only service has an unrestricted source and no additional matches.
      return this.findObject(
        `type = ? AND destination_port_start = ? AND destination_port_end = ?
         AND COALESCE(source_port_end, 0) = 0
         AND COALESCE(tcp_flags_mask, 0) = 0 AND COALESCE(tcp_flags_settings, 0) = 0
         AND COALESCE(diff_serv, 0) = 0 AND COALESCE(options, 0) = 0`,
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
    const metadata = pickProfileFields(request, PROFILE_INTERFACE_ADDRESS_METADATA_FIELDS);
    const conditions = [
      'type = ?',
      'ip_version = ?',
      'address = ?',
      'netmask = ?',
      'interface <=> ?',
    ];
    const params: unknown[] = [
      REPLICATION_PROFILE_IPOBJ_TYPE_BY_KIND[request.kind],
      request.ipVersion,
      request.address,
      request.netmask,
      request.interfaceId ?? null,
    ];
    if (request.useSelectedConfiguration || Object.keys(metadata).length > 0) {
      conditions.push('name = ?');
      params.push(request.name ?? this.defaultName(request));
    }
    for (const [field, value] of Object.entries(metadata)) {
      conditions.push(`${field} <=> ?`);
      params.push(value);
    }
    if (request.useSelectedConfiguration && request.comment === undefined) {
      conditions.push("COALESCE(comment, '') = ''");
    }
    return this.findObject(conditions.join(' AND '), params);
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
    // the standard objects folder.
    const ipObjTypeId = REPLICATION_PROFILE_IPOBJ_TYPE_BY_KIND[request.kind];
    const saved = await this.saveObject(
      ipObjTypeId,
      name,
      {
        address: request.address,
        netmask: request.netmask,
        ip_version: request.ipVersion,
        interfaceId: request.interfaceId ?? null,
        ...pickProfileFields(request, PROFILE_INTERFACE_ADDRESS_METADATA_FIELDS),
      },
      request.interfaceId === undefined,
    );

    if (request.interfaceId !== undefined) {
      await this.placeUnderInterface(
        saved.id,
        ipObjTypeId,
        `${name} (${request.address})`,
        request.interfaceId,
      );
    }

    return saved;
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

  /**
   * Hangs the address of a firewall interface from that interface's node, named as the tree names
   * it. Without the node the address exists but stays out of the tree until the tree is repaired.
   */
  private async placeUnderInterface(
    objectId: number,
    objectType: number,
    name: string,
    interfaceId: number,
  ): Promise<void> {
    const nodeType = TREE_FOLDER_BY_TYPE.get(objectType)?.nodeType;
    const interfaceNodeId = await findTreeNodeId(this.fwCloudId, 'IFF', 'id_obj', interfaceId);

    if (nodeType && interfaceNodeId !== null) {
      await Tree.newNode(
        db.getQuery(),
        this.fwCloudId,
        name,
        interfaceNodeId,
        nodeType,
        objectId,
        objectType,
      );
    }
  }
}
