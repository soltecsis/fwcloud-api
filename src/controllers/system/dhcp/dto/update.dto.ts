/*!
    Copyright 2023 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
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
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsOptional,
  IsNumber,
  IsString,
  Max,
  Min,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { PositionalEntityDto } from '../../../dtos/positional-entity.dto';

export class DHCPRuleUpdateDto {
  @IsBoolean()
  @IsOptional()
  active?: boolean;

  @IsNumber()
  @IsOptional()
  group?: number;

  @IsNumber()
  @IsOptional()
  firewallId?: number;

  @IsString()
  @IsOptional()
  style?: string;

  @IsNumber()
  @IsOptional()
  networkId?: number;

  @IsNumber()
  @IsOptional()
  rangeId?: number;

  @IsNumber()
  @IsOptional()
  routerId?: number;

  @IsNumber()
  @IsOptional()
  interfaceId?: number;

  @IsArray()
  @IsOptional()
  @ValidateNested({
    each: true,
  })
  @Type(() => PositionalEntityDto)
  ipObjIds?: PositionalEntityDto[];

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(999999)
  max_lease?: number;

  @IsString()
  @IsOptional()
  cfg_text?: string;

  @IsString()
  @IsOptional()
  comment?: string;
}
