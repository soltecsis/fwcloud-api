import { IsBoolean, IsNumber, IsOptional, IsString } from "class-validator"

export class RoutingRuleControllerCreateDto {
    @IsNumber()
    routingTableId: number;

    @IsBoolean()
    @IsOptional()
    active: boolean;
    
    @IsString()
    @IsOptional()
    comment: string;
}