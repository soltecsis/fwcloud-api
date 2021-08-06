import { IsArray, IsNumber, IsOptional } from "class-validator";

export class RoutingTableControllerCompileRoutesQueryDto {
    @IsOptional()
    @IsArray()
    @IsNumber({}, {each: true})
    routes?: number[];
}