import { IsArray, IsNumber, IsPositive } from "class-validator";

export class RouteControllerBulkMoveDto {
    @IsNumber()
    @IsPositive()
    to: number;

    @IsArray()
    @IsNumber({}, {each: true})
    routes: number[]
}