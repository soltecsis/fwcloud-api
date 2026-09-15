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

import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import Model from '../Model';

const tableName = 'profile_object_binding';

/** What the binding points at, so a later run knows how to reuse it. */
export type ProfileObjectBindingKind = 'interface' | 'ipobj' | 'rule';

/**
 * Records every object a profile application created or reused on a target.
 * It is what makes an apply idempotent and reversible: a second run of the same
 * profile version resolves its roles and parameters to the objects recorded
 * here instead of creating them again, and the trail says exactly what a given
 * profile version put on a given firewall.
 */
@Entity(tableName)
@Index('IDX_profile_object_binding_target', ['profileCode', 'profileVersion', 'targetFirewallId'])
export class ProfileObjectBinding extends Model {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'fwcloud' })
  fwCloudId: number;

  @Column({ name: 'profile_code' })
  profileCode: string;

  @Column({ name: 'profile_version' })
  profileVersion: number;

  @Column({ name: 'target_firewall' })
  targetFirewallId: number;

  @Column({ name: 'binding_kind' })
  bindingKind: ProfileObjectBindingKind;

  /** Interface role or parameter name the object was resolved for. */
  @Column({ name: 'binding_key' })
  bindingKey: string;

  @Column({ name: 'object_id' })
  objectId: number;

  /** True when this application created the object rather than reusing it. */
  @Column({ name: 'created_by_profile' })
  createdByProfile: number;

  @Column({ name: 'created_at' })
  createdAt: Date;

  public getTableName(): string {
    return tableName;
  }
}
