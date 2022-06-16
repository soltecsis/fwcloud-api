import { IsOptional, IsString } from "class-validator";

export class CaControllerUpdateDto {
    @IsString()
    @IsOptional()
    comment: string;
}