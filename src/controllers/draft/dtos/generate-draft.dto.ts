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
 * Request contract for POST /fwclouds/:fwcloud/assistant/drafts/generate.
 *
 * The global validation pipeline already applies `whitelist: true` +
 * `forbidNonWhitelisted: true` (src/fonaments/validation/validator.ts), so
 * no `credentials`-shaped field is declared here on purpose: any such key in
 * the body is rejected automatically rather than silently accepted.
 *
 * The 2KB *byte* limit on `instruction` is deliberately NOT enforced here —
 * class-validator's `@MaxLength` counts UTF-16 code units, not encoded
 * bytes. The controller checks `Buffer.byteLength(instruction, 'utf8')`
 * explicitly before this DTO's instance is used for anything else.
 */

import { Type } from 'class-transformer';
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { REPLICATION_PROFILE_TARGET_KINDS } from '../../../models/replication-profile/replication-profile.constants';

const TARGET_KINDS: readonly string[] = REPLICATION_PROFILE_TARGET_KINDS;

export class GenerateFirewallProfileDraftClarificationDto {
  @IsString()
  @IsNotEmpty()
  generation_id: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2048)
  answer: string;
}

export class GenerateFirewallProfileDraftDto {
  /** Required unless this call is answering a pending clarification. */
  @ValidateIf((dto: GenerateFirewallProfileDraftDto) => !dto.clarification)
  @IsString()
  @IsNotEmpty()
  // IsNotEmpty alone accepts a whitespace-only string (it only rejects '');
  // the instruction must contain at least one non-whitespace character.
  @Matches(/\S/, { message: 'instruction must not be empty or whitespace-only' })
  instruction?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[a-z]{2}$/, {
    message: 'language must be a lowercase two-letter language code',
  })
  language?: string;

  @IsOptional()
  @IsIn(TARGET_KINDS)
  targetKind?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => GenerateFirewallProfileDraftClarificationDto)
  clarification?: GenerateFirewallProfileDraftClarificationDto;
}
