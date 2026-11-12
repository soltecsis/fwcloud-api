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
  /** Confirms that the installation role transition may change CrowdSec configuration. */
  @IsBoolean()
  confirm: boolean;

  /** Target installation mode. */
  @IsEnum(CrowdSecInstallationMode)
  mode: CrowdSecInstallationMode;

  /** Enables the local Firewall Bouncer when the target is a Machine. */
  @IsBoolean()
  localRemediation: boolean;

  /** Managed central Local API firewall identifier; omit for a manual external Local API. */
  @IsOptional()
  @IsInt()
  @Min(1)
  centralFirewallId?: number;

  /** Required when mode is machine. */
  @ValidateIf(
    (transition: CrowdSecTransitionDto) => transition.mode === CrowdSecInstallationMode.Machine,
  )
  @IsString()
  @Matches(CROWDSEC_MACHINE_NAME, { message: 'Invalid CrowdSec machine name' })
  machineName?: string;

  /** Required when mode is machine. */
  @ValidateIf(
    (transition: CrowdSecTransitionDto) => transition.mode === CrowdSecInstallationMode.Machine,
  )
  @IsString()
  @Length(1, 256)
  @Matches(CROWDSEC_LAPI_URL, { message: 'Invalid CrowdSec Local API URL' })
  lapiUrl?: string;

  /** Required when enabling remediation against a manual external Local API. */
  @IsOptional()
  @IsString()
  @Length(1, 8192)
  bouncerApiKey?: string;

  /** Optional PGP-encrypted CrowdSec Console enrollment key when the target is a Local API. */
  @IsOptional()
  @IsString()
  @Length(1, 8192)
  enrollmentKey?: string;
}
