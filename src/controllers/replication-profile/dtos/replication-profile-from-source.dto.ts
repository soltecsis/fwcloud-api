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
 * Contract for creating a custom policy template profile by capturing the
 * current structure (interfaces + IPv4 FORWARD policy) of an existing
 * firewall or cluster of the request's FWCloud. The profile model itself is
 * built server-side from the source, so this DTO only carries the source
 * reference and the profile metadata.
 */

import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { REPLICATION_PROFILE_TARGET_KINDS } from '../../../models/replication-profile/replication-profile.constants';

/** Codes are used verbatim as URL path segments (`/profiles/:code/:version`). */
const CODE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

export class ReplicationProfileSourceDto {
  @IsIn(REPLICATION_PROFILE_TARGET_KINDS)
  kind: string;

  @IsInt()
  @IsPositive()
  id: number;
}

export class ReplicationProfileFromSourceDto {
  @ValidateNested()
  @Type(() => ReplicationProfileSourceDto)
  source: ReplicationProfileSourceDto;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  /** Defaults to a stable slug generated from `name` when omitted. */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  @Matches(CODE_PATTERN, {
    message: 'code must start with a letter or digit and use only letters, digits, ".", "_" or "-"',
  })
  code?: string;

  /** Defaults to "fwcloud", the scope of every custom profile. */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  scope?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  category?: string;
}
