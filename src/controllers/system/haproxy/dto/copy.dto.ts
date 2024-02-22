import { IsNumber, IsPositive, IsEnum, IsArray } from "class-validator";
import { Offset } from "../../../../offset";

export class HAProxyRuleCopyDto {
    @IsNumber()
    @IsPositive()
    to: number;

    @IsEnum(Offset)
    offset: Offset;

    @IsArray()
    @IsNumber({}, { each: true })
    rules: number[];
}