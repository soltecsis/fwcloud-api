import { IsNumber, IsPositive } from "class-validator";

export class OpenVPNArchiveControllerUpdateDto {
    @IsNumber()
    @IsPositive()
    archive_days: number;
    
    @IsNumber()
    @IsPositive()
    retention_days: number;
}