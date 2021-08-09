import { IsArray, IsNumber, IsPositive, IsString } from "class-validator";

export class RouteControllerBulkMoveDto {
    @IsNumber()
    @IsPositive()
    to: number;

    @IsNumber()
    direction: number;

    @IsArray()
    @IsNumber({}, {each: true})
    routes: number[]
}