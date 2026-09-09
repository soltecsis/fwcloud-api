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

/**
 * Request contract for POST /fwclouds/:fwcloud/assistant/drafts/:draft/apply-new.
 *
 * The sibling `/apply` endpoint applies onto infrastructure that already
 * exists and therefore identifies it by `{ kind, id }`. This one *creates*
 * what the proposal describes, so there is no id to send yet: the caller
 * states the kind it expects to be created — checked against the draft's own
 * proposal, the same way `preview_hash` binds the confirmation to the content
 * the user reviewed in API-12 — and may name the new firewall/cluster instead
 * of accepting the generated name.
 *
 * Deliberately a separate DTO rather than widening
 * `ApplyFirewallProfileDraftDto` into a discriminated union: the existing
 * apply contract stays byte-for-byte what it was, and neither endpoint can
 * accidentally accept the other's body (the global validation pipeline
 * applies `whitelist` + `forbidNonWhitelisted`, so an `id` sent here is
 * rejected rather than ignored).
 */

import { Type } from 'class-transformer';
import { AcknowledgedAssumptionsDto } from './acknowledged-assumptions.dto';
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { REPLICATION_PROFILE_TARGET_KINDS } from '../../../models/replication-profile/replication-profile.constants';

export class CreateTargetFromDraftTargetDto {
  /** Must match the target kind the draft's stored proposal declares. */
  @IsIn(REPLICATION_PROFILE_TARGET_KINDS)
  kind: string;

  /**
   * Name for the firewall/cluster this apply creates. Optional: when absent
   * the proposal's own name is used. It never renames the materialized
   * profile, only the infrastructure.
   */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  // Rejects '' and whitespace-only alike: either would reach firewall creation
  // and produce an unusable, unnamed-looking resource. (`@IsNotEmpty` would be
  // a strict subset of this check, so it is deliberately not stacked on top.)
  @Matches(/\S/, { message: 'name must not be empty or whitespace-only' })
  name?: string;
}

export class CreateTargetFromDraftDto extends AcknowledgedAssumptionsDto {
  @IsString()
  @IsNotEmpty()
  preview_hash: string;

  @ValidateNested()
  @Type(() => CreateTargetFromDraftTargetDto)
  target: CreateTargetFromDraftTargetDto;
}
