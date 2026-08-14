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
 * Request contract for POST /fwclouds/:fwcloud/assistant/drafts/:draft/apply.
 *
 * `target` identifies the EXISTING firewall/cluster the user chose to apply
 * the previewed profile to -- this endpoint never creates infrastructure
 * (that's `TargetOrchestrationService`, a different scenario). `preview_hash`
 * binds the confirmation to exactly what the user reviewed in API-12; it is
 * compared against the draft's stored hash, never trusted on its own.
 */

import { Type } from 'class-transformer';
import { IsNotEmpty, IsString, ValidateNested } from 'class-validator';
import { ReplicationProfileApplyTargetDto } from '../../replication-profile/dtos/replication-profile-apply.dto';

export class ApplyFirewallProfileDraftDto {
  @IsString()
  @IsNotEmpty()
  preview_hash: string;

  // Same `{ kind, id }` shape API-14 uses to identify a real firewall/cluster.
  @ValidateNested()
  @Type(() => ReplicationProfileApplyTargetDto)
  target: ReplicationProfileApplyTargetDto;
}
