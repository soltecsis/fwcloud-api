import { IsArray, IsNumber, IsOptional } from "class-validator";

export class FirewallControllerCompileRoutingRuleQueryDto {
    @IsOptional()
    @IsArray()
    @IsNumber({}, {each: true})
    rules: number[]
}