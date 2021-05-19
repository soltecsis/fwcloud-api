import { IsOptional, IsString, Length } from "class-validator"

export class SnapshotControllerStoreDto {
    @IsString()
    @Length(0, 64)
    name: string;

    @IsString()
    @Length(0,255)
    @IsOptional()
    comment: string;

    @IsString()
    @IsOptional()
    channel_id: string;
}