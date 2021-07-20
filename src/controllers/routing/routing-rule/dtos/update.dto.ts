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

import { IsArray, IsBoolean, IsNumber, IsOptional, IsPositive, IsString } from "class-validator"
import { IpObjBelongsToTypes } from "../../../../fonaments/validation/rules/ipobj-belongs-to-types.validation";
import { IpObjGroupBelongsToTypes } from "../../../../fonaments/validation/rules/ipobj-group-belongs-to-types.validation";
import { IsClientOpenVPN } from "../../../../fonaments/validation/rules/is-client-openvpn.validation";

export class RoutingRuleControllerUpdateDto {
    @IsNumber()
    @IsOptional()
    routingTableId: number;

    @IsBoolean()
    @IsOptional()
    active: boolean;
    
    @IsString()
    @IsOptional()
    comment: string;

    @IsNumber()
    @IsPositive()
    @IsOptional()
    rule_order: number;

    @IsString()
    @IsOptional()
    style: string;

    @IsArray()
    @IsOptional()
    @IpObjBelongsToTypes([
        5, // ADDRESS
        6, // ADDRESS RANGE
        7, // NETWORK
        8, // HOST
        9, // DNS
    ])
    @IsNumber({}, {
        each: true
    })
    ipObjIds: number[]

    @IsArray()
    @IsOptional()
    @IpObjGroupBelongsToTypes([
        20
    ])
    @IsNumber({}, {
        each: true
    })
    ipObjGroupIds: number[]

    @IsArray()
    @IsOptional()
    @IsNumber({}, {
        each: true
    })
    @IsClientOpenVPN()
    openVPNIds: number[];
    
    @IsArray()
    @IsOptional()
    @IsNumber({}, {
        each: true
    })
    openVPNPrefixIds: number[];
}