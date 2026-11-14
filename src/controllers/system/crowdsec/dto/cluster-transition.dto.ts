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
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Min,
} from 'class-validator';
import { CrowdSecInstallationMode } from '../../../../models/system/crowdsec/crowdsec-installation.model';
import { CROWDSEC_LAPI_URL } from './machine-install.dto';

export class CrowdSecClusterTransitionDto {
  /** Confirms that the installation transition may change CrowdSec configuration. */
  @IsBoolean()
  confirm: boolean;

  /** Target installation mode. */
  @IsEnum(CrowdSecInstallationMode)
  mode: CrowdSecInstallationMode;

  /** Enables the local Firewall Bouncer for target Machine nodes. */
  @IsBoolean()
  localRemediation: boolean;

  /** Restricts a permitted node-level operation to these cluster node IDs. */
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Min(1, { each: true })
  nodeIds?: number[];

  /** Managed central Local API firewall identifier; omit for an external Local API. */
  @IsOptional()
  @IsInt()
  @Min(1)
  centralFirewallId?: number;

  /** External Local API URL used when the transition targets Machines. */
  @IsOptional()
  @IsString()
  @Length(1, 256)
  @Matches(CROWDSEC_LAPI_URL, { message: 'Invalid CrowdSec Local API URL' })
  lapiUrl?: string;

  /** Required when enabling remediation against an external Local API. */
  @IsOptional()
  @IsString()
  @Length(1, 8192)
  bouncerApiKey?: string;
}
