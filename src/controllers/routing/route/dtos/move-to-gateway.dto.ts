import { IsNumber, IsOptional } from "class-validator";

export class RouteMoveToGatewayDto {
    @IsNumber()
    fromId: number;
    
    @IsNumber()
    toId: number;

    @IsNumber()
    @IsOptional()
    ipObjId?: number;

}