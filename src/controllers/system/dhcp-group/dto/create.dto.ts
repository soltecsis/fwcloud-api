import { ArrayMinSize, IsNumber, IsOptional, IsString } from "class-validator";

export class DHCPGroupControllerCreateDto {
    @IsString()
    name: string;

    @IsString()
    @IsOptional()
    comment: string;

    @IsNumber({}, {each: true})
    @ArrayMinSize(1)
    rules: number[]
}