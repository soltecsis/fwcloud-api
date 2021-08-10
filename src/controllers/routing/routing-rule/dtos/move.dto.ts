import { IsArray, IsNumber, IsPositive } from "class-validator";

export class RoutingRuleControllerMoveDto {
    @IsNumber()
    @IsPositive()
    to: number;

    @IsNumber()
    offset: number;

    @IsArray()
    @IsNumber({}, {each: true})
    rules: number[]
}