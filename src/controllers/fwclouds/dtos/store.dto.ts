import { IsOptional, IsString } from "class-validator";

export class FwCloudControllerStoreDto {
    @IsString()
    name: string;

    @IsString()
    @IsOptional()
    image: string;

    @IsString()
    @IsOptional()
    comment: string;
}