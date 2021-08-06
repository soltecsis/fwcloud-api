import { IsArray, IsNumber } from "class-validator";

export class RoutingRuleControllerBulkRemoveQueryDto {
    @IsArray()
    @IsNumber({}, {each: true})
    rules: number;
}