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

import { ArrayMaxSize, IsArray, IsOptional, IsString, Length, Matches } from 'class-validator';

const CROWDSEC_CONSOLE_IDENTIFIER = /^[A-Za-z0-9._-]+$/;

export class CrowdSecConsoleEnrollDto {
  @IsString()
  @Length(1, 512)
  @Matches(/^[^\x00-\x1F\x7F]+$/, { message: 'Invalid CrowdSec enrollment key' })
  enrollmentKey: string;

  @IsOptional()
  @IsString()
  @Length(1, 64)
  @Matches(CROWDSEC_CONSOLE_IDENTIFIER, { message: 'Invalid CrowdSec Console instance name' })
  name?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(16)
  @IsString({ each: true })
  @Length(1, 64, { each: true })
  @Matches(CROWDSEC_CONSOLE_IDENTIFIER, { each: true, message: 'Invalid CrowdSec Console tag' })
  tags?: string[];
}
