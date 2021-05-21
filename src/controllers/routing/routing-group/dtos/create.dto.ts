import { ArrayMinSize, IsNumber, IsOptional, IsString, MinLength } from "class-validator";

export class RoutingGroupControllerCreateDto {
    @IsString()
    name: string;

    @IsString()
    @IsOptional()
    comment: string;

    @IsNumber({}, {each: true})
    @ArrayMinSize(1)
    routingRules: number[]
}