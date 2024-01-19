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
import { IsBoolean, IsOptional, IsNumber, IsString, IsPositive, IsEnum, IsIn } from "class-validator";
import { Offset } from "../../../../offset";

export class DHCPRuleCreateDto {
    @IsBoolean()
    @IsOptional()
    active: boolean;

    @IsNumber()
    @IsOptional()
    groupId?: number;

    @IsNumber()
    @IsOptional()
    firewallId?: number;

    @IsString()
    @IsOptional()
    style: string;

    @IsIn([1, 2])
    @IsOptional()
    rule_type?: number;

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

    @IsNumber()
    @IsOptional()
    max_lease?: number;

    @IsString()
    @IsOptional()
    cfg_text?: string;

    @IsNumber()
    @IsOptional()
    special?: number;

    @IsString()
    @IsOptional()
    comment?: string;

    @IsNumber()
    @IsPositive()
    @IsOptional()
    to?: number;

    @IsEnum(Offset)
    @IsOptional()
    offset?: Offset;
}