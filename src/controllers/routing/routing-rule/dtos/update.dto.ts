import { IsBoolean, IsNumber, IsOptional, IsString } from "class-validator"

export class RoutingRuleControllerUpdateDto {
    @IsNumber()
    routingTableId: number;

    @IsBoolean()
    @IsOptional()
    active: boolean;
    
    @IsString()
    @IsOptional()
    comment: string;
}