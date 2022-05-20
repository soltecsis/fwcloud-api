/*!
    Copyright 2021 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
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

import { Type } from "class-transformer";
import { IsArray, IsBoolean, IsEnum, IsNumber, IsOptional, IsPositive, IsString, ValidateNested } from "class-validator"
import { IpObjBelongsToTypes } from "../../../../fonaments/validation/rules/ipobj-belongs-to-types.validation";
import { Offset } from "../../../../offset";
import { PositionalEntityDto } from "../../../dtos/positional-entity.dto";

export class RouteControllerStoreDto {
    @IsNumber()
    @IsOptional()
    routeGroupId: number;
    
    @IsNumber()
    @IpObjBelongsToTypes([
        5, // ADDRESS
    ])
    gatewayId: number;

    @IsNumber()
    @IsOptional()
    interfaceId: number;
        
    @IsBoolean()
    @IsOptional()
    active: boolean;

    @IsString()
    @IsOptional()
    comment: string;

    @IsString()
    @IsOptional()
    style: string;

    @IsNumber()
    @IsOptional()
    fwApplyToId?: number

    @IsArray()
    @IsOptional()
    @ValidateNested({
        each: true
    })
    @Type(() => PositionalEntityDto)
    ipObjIds?: PositionalEntityDto[]

    @IsArray()
    @IsOptional()
    @ValidateNested({
        each: true
    })
    @Type(() => PositionalEntityDto)
    ipObjGroupIds?: PositionalEntityDto[]

    @IsArray()
    @IsOptional()
    @ValidateNested({
        each: true
    })
    @Type(() => PositionalEntityDto)
    openVPNIds?: PositionalEntityDto[];
    
    @IsArray()
    @IsOptional()
    @ValidateNested({
        each: true
    })
    @Type(() => PositionalEntityDto)
    openVPNPrefixIds?: PositionalEntityDto[];

    @IsNumber()
    @IsPositive()
    @IsOptional()
    to?: number;

    @IsEnum(Offset)
    @IsOptional()
    offset?: Offset;
}