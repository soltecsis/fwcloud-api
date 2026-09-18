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

import { IsBoolean, IsInt, IsOptional, IsString, Length, Matches, Min } from 'class-validator';

export const CROWDSEC_MACHINE_NAME = /^[A-Za-z0-9_.-]{1,128}$/;
export const CROWDSEC_LAPI_URL = /^https?:\/\/[^\s/]+(?::\d{1,5})?\/?$/;

export class CrowdSecMachineInstallDto {
  @IsInt()
  @Min(1)
  centralFirewallId: number;

  @IsString()
  @Matches(CROWDSEC_MACHINE_NAME, { message: 'Invalid CrowdSec machine name' })
  machineName: string;

  @IsString()
  @Length(1, 256)
  @Matches(CROWDSEC_LAPI_URL, {
    message: 'Invalid CrowdSec Local API URL',
  })
  lapiUrl: string;

  @IsBoolean()
  localRemediation: boolean;

  @IsOptional()
  @IsBoolean()
  continueWithoutLapiConnectivity?: boolean;

  @IsOptional()
  @IsString()
  @Length(1, 512)
  bouncerApiKey?: string;
}
