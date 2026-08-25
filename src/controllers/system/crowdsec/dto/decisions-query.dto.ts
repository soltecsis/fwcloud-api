/*!
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

import { IsIn, IsInt, IsOptional, IsString, Length, Max, Min, Matches } from 'class-validator';

const CROWDSEC_TOKEN = /^[A-Za-z0-9_.-]+$/;
const CROWDSEC_SCENARIO = /^[A-Za-z0-9:/_.-]+$/;

export class CrowdSecDecisionsQueryDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsString()
  @Length(1, 64)
  @Matches(CROWDSEC_TOKEN, { message: 'Invalid CrowdSec decision scope' })
  scope?: string;

  @IsOptional()
  @IsString()
  @Length(1, 256)
  @Matches(/^[^\x00-\x1F\x7F]+$/, { message: 'Invalid CrowdSec decision value' })
  value?: string;

  @IsOptional()
  @IsString()
  @Length(1, 64)
  @Matches(CROWDSEC_TOKEN, { message: 'Invalid CrowdSec decision type' })
  decision_type?: string;

  @IsOptional()
  @IsIn(['local', 'CAPI', 'lists', 'all'])
  origin?: string;

  @IsOptional()
  @IsString()
  @Length(1, 128)
  @Matches(CROWDSEC_SCENARIO, { message: 'Invalid CrowdSec decision scenario' })
  scenario?: string;
}
