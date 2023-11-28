import { IsBoolean, IsOptional, IsNumber, IsString } from "class-validator";

export class DHCPRuleCreateDto {
    @IsBoolean()
    @IsOptional()
    active: boolean;

    @IsNumber()
    groupId: number;

    @IsString()
    @IsOptional()
    style: string;

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

    @IsString()
    @IsOptional()
    comment?: string;
}