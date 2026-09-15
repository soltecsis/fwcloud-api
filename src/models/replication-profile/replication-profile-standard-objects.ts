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

import {
  REPLICATION_PROFILE_IPOBJ_TYPE_ADDRESS,
  REPLICATION_PROFILE_IPOBJ_TYPE_CONTINENT,
  REPLICATION_PROFILE_IPOBJ_TYPE_COUNTRY,
  REPLICATION_PROFILE_IPOBJ_TYPE_GROUP,
  REPLICATION_PROFILE_IPOBJ_TYPE_ICMP,
  REPLICATION_PROFILE_IPOBJ_TYPE_IP,
  REPLICATION_PROFILE_IPOBJ_TYPE_NETWORK,
  REPLICATION_PROFILE_IPOBJ_TYPE_RANGE,
  REPLICATION_PROFILE_IPOBJ_TYPE_SERVICE_GROUP,
  REPLICATION_PROFILE_IPOBJ_TYPE_TCP,
  REPLICATION_PROFILE_IPOBJ_TYPE_UDP,
} from './replication-profile.constants';
import { dbQuery } from './replication-sql.helpers';

/**
 * FWCloud's predefined objects (the "Standard" folders of the objects and
 * services trees, plus the countries). They are seeded with the same fixed ids
 * in every installation, which lets a profile reference them portably.
 */
export interface ReplicationProfileStandardObject {
  id: number;
  name: string;
  type: number;
  protocol: number | null;
  address: string | null;
  netmask: string | null;
  range_start: string | null;
  range_end: string | null;
  ip_version: number | null;
  icmp_type: number | null;
  icmp_code: number | null;
  source_port_start: number | null;
  source_port_end: number | null;
  destination_port_start: number | null;
  destination_port_end: number | null;
  comment: string | null;
}

export interface ReplicationProfileStandardGroup {
  id: number;
  name: string;
  /** 20 object group, 21 service group, 23 continent. */
  type: number;
  members: number[];
}

export interface ReplicationProfileStandardCatalog {
  objects: ReplicationProfileStandardObject[];
  groups: ReplicationProfileStandardGroup[];
}

/** ip/tcp/icmp/udp services, addresses, ranges, networks and countries. */
const STANDARD_OBJECT_TYPES = [
  REPLICATION_PROFILE_IPOBJ_TYPE_IP,
  REPLICATION_PROFILE_IPOBJ_TYPE_TCP,
  REPLICATION_PROFILE_IPOBJ_TYPE_ICMP,
  REPLICATION_PROFILE_IPOBJ_TYPE_UDP,
  REPLICATION_PROFILE_IPOBJ_TYPE_ADDRESS,
  REPLICATION_PROFILE_IPOBJ_TYPE_RANGE,
  REPLICATION_PROFILE_IPOBJ_TYPE_NETWORK,
  REPLICATION_PROFILE_IPOBJ_TYPE_COUNTRY,
];
const STANDARD_GROUP_TYPES = [
  REPLICATION_PROFILE_IPOBJ_TYPE_GROUP,
  REPLICATION_PROFILE_IPOBJ_TYPE_SERVICE_GROUP,
  REPLICATION_PROFILE_IPOBJ_TYPE_CONTINENT,
];

export async function loadReplicationProfileStandardCatalog(): Promise<ReplicationProfileStandardCatalog> {
  const [objects, groups, members] = await Promise.all([
    dbQuery<ReplicationProfileStandardObject>(
      `SELECT id, name, type, protocol, address, netmask, range_start, range_end, ip_version,
              icmp_type, icmp_code, source_port_start, source_port_end,
              destination_port_start, destination_port_end, comment
       FROM ipobj
       WHERE fwcloud IS NULL AND type IN (${STANDARD_OBJECT_TYPES.join(', ')})
       ORDER BY type, name`,
    ),
    dbQuery<{ id: number; name: string; type: number }>(
      `SELECT id, name, type FROM ipobj_g
       WHERE fwcloud IS NULL AND type IN (${STANDARD_GROUP_TYPES.join(', ')})
       ORDER BY type, name`,
    ),
    dbQuery<{ ipobj_g: number; ipobj: number }>(
      `SELECT GI.ipobj_g, GI.ipobj FROM ipobj__ipobjg GI
       INNER JOIN ipobj_g G ON G.id = GI.ipobj_g
       WHERE G.fwcloud IS NULL
       ORDER BY GI.ipobj_g, GI.ipobj`,
    ),
  ]);
  const membersByGroup = new Map<number, number[]>();

  for (const member of members) {
    const groupId = Number(member.ipobj_g);
    membersByGroup.set(groupId, [...(membersByGroup.get(groupId) ?? []), Number(member.ipobj)]);
  }

  return {
    objects: objects.map((object) => ({
      ...object,
      type: Number(object.type),
      ip_version: object.ip_version === null ? null : Number(object.ip_version),
    })),
    groups: groups.map((group) => ({
      id: Number(group.id),
      name: group.name,
      type: Number(group.type),
      members: membersByGroup.get(Number(group.id)) ?? [],
    })),
  };
}
