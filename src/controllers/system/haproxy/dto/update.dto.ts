import { Type } from "class-transformer";
import { IsBoolean, IsOptional, IsNumber, IsString, IsArray, ValidateNested, IsPositive, IsEnum } from "class-validator";
import { Offset } from "../../../../offset";
import { PositionalEntityDto } from "../../../dtos/positional-entity.dto";

export class HAProxyRuleUpdateDto {
    @IsBoolean()
    @IsOptional()
    active?: boolean;

    @IsNumber()
    @IsOptional()
    groupId?: number;

    @IsNumber()
    @IsOptional()
    firewallId?: number;

    @IsString()
    @IsOptional()
    style: string;

    @IsNumber()
    @IsOptional()
    rule_type?: number;

    @IsNumber()
    @IsOptional()
    frontendIpId?: number;

    @IsNumber()
    @IsOptional()
    frontendPortId?: number;

    @IsArray()
    @IsOptional()
    @ValidateNested({
        each: true
    })
    @Type(() => PositionalEntityDto)
    backendIpsIds?: number;

    @IsNumber()
    @IsOptional()
    backendPortId?: number;

    @IsString()
    @IsOptional()
    cfg_text?: string;

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