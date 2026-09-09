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

import { ArrayMaxSize, IsArray, IsNotEmpty, IsOptional, IsString } from 'class-validator';

/**
 * The one field both confirmed-apply bodies share. Extended rather than
 * repeated so the two apply contracts stay separate documents (see each DTO's
 * own header) without their single common field drifting apart.
 */
export abstract class AcknowledgedAssumptionsDto {
  /**
   * The reviewer's receipt for the assumptions API-12 showed. Accepted and not
   * enforced on purpose: assumptions are part of the content `preview_hash` is
   * calculated over (see `readPreviewAssumptions`), so the hash check each
   * endpoint performs already proves the confirmation was made against this
   * exact set. Declaring it is nonetheless required -- the global pipeline runs
   * with `forbidNonWhitelisted`, so an undeclared field is a 400, not an
   * ignored one.
   */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(256)
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  acknowledged_assumption_ids?: string[];
}
