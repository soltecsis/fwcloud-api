import { IsOptional, IsString, Length } from "class-validator";

export class FirewallControllerInstallDto {
    @IsString()
    @Length(0,255)
    @IsOptional()
    channel_id: number;
}