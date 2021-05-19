import { IsBoolean, IsNumber, IsObject, IsOptional, IsSemVer, IsString } from "class-validator"

export class RouteControllerStoreDto {
    @IsNumber()
    @IsOptional()
    routeGroupId: number;
    
    @IsNumber()
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
}