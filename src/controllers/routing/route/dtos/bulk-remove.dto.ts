import { IsArray, IsNumber } from "class-validator";

export class RouteControllerBulkRemoveQueryDto {
    @IsArray()
    @IsNumber({}, {each: true})
    routes: number;
}