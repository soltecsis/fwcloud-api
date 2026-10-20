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
    GNU Affero General Public License for more details.

    You should have received a copy of the GNU Affero General Public License
    along with FWCloud.  If not, see <https://www.gnu.org/licenses/>.
*/

import { IsInt, IsNumber, IsOptional, IsString, Length, Matches, Min } from 'class-validator';

export class CrowdSecBlockingStatisticsHistoryQueryDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  starts_at?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  ends_at?: number;
}

export class CrowdSecBlockingStatisticsAddressHistoryQueryDto extends CrowdSecBlockingStatisticsHistoryQueryDto {
  @IsString()
  @Length(1, 8192)
  @Matches(/^[^\x00-\x1F\x7F]+$/, { message: 'Invalid CrowdSec statistics addresses' })
  addresses: string;
}

export class CrowdSecBlockingStatisticsClusterHistoryQueryDto extends CrowdSecBlockingStatisticsHistoryQueryDto {
  @IsInt()
  @Min(1)
  node_id: number;
}

export class CrowdSecBlockingStatisticsClusterAddressHistoryQueryDto extends CrowdSecBlockingStatisticsAddressHistoryQueryDto {
  @IsInt()
  @Min(1)
  node_id: number;
}
