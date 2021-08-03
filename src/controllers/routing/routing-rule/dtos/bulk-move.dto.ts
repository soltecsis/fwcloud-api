import { IsArray, IsNumber, IsPositive } from "class-validator";

export class RoutingRuleControllerBulkMoveDto {
    @IsNumber()
    @IsPositive()
    to: number;

    @IsArray()
    @IsNumber({}, {each: true})
    rules: number[]
}