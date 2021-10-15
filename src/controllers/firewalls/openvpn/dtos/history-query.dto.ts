import { IsDate, IsIP, IsNumber, IsOptional, IsString } from "class-validator";

export class HistoryQueryDto {
    @IsDate()
    @IsOptional()
    starts_at: Date;

    @IsDate()
    @IsOptional()
    ends_at: Date;

    @IsOptional()
    @IsString()
    name: string;

    @IsIP()
    @IsOptional()
    address: string;
}