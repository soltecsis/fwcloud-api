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

import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Min,
  ValidateIf,
} from 'class-validator';
import { CrowdSecInstallationMode } from '../../../../models/system/crowdsec/crowdsec-installation.model';
import { CROWDSEC_LAPI_URL, CROWDSEC_MACHINE_NAME } from './machine-install.dto';

export class CrowdSecTransitionDto {
  @IsBoolean()
  confirm: boolean;

  @IsEnum(CrowdSecInstallationMode)
  mode: CrowdSecInstallationMode;

  @IsBoolean()
  localRemediation: boolean;

  @ValidateIf(
    (transition: CrowdSecTransitionDto) => transition.mode === CrowdSecInstallationMode.Machine,
  )
  @IsInt()
  @Min(1)
  centralFirewallId?: number;

  @ValidateIf(
    (transition: CrowdSecTransitionDto) => transition.mode === CrowdSecInstallationMode.Machine,
  )
  @IsString()
  @Matches(CROWDSEC_MACHINE_NAME, { message: 'Invalid CrowdSec machine name' })
  machineName?: string;

  @ValidateIf(
    (transition: CrowdSecTransitionDto) => transition.mode === CrowdSecInstallationMode.Machine,
  )
  @IsString()
  @Length(1, 256)
  @Matches(CROWDSEC_LAPI_URL, { message: 'Invalid CrowdSec Local API URL' })
  lapiUrl?: string;

  @IsOptional()
  @IsString()
  @Length(1, 8192)
  bouncerApiKey?: string;
}
