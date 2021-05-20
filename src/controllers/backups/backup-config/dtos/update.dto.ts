import { IsNumber, IsPositive, IsString } from "class-validator";

export class BackupConfigControllerUpdateDto {
    @IsString()
    schedule: string;

    @IsNumber()
    @IsPositive()
    max_days: number;

    @IsNumber()
    @IsPositive()
    max_copies: number;
}