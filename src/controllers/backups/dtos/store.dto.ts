import { IsOptional, IsString, Length } from "class-validator";

export class BackupControllerStoreDto {
    @IsString()
    @Length(0,255)
    @IsOptional()
    comment: string;

    @IsString()
    @Length(0,255)
    @IsOptional()
    channel_id: string;
}