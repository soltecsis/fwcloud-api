import { IsOptional, IsString } from "class-validator";

export class FwCloudControllerUpdateDto {
    @IsString()
    name: string;

    @IsString()
    @IsOptional()
    image: string;

    @IsString()
    @IsOptional()
    comment: string;
}