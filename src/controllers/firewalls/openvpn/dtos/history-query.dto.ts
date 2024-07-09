import { IsIP, IsNumber, IsOptional, IsString } from 'class-validator';

export class HistoryQueryDto {
  @IsNumber()
  @IsOptional()
  starts_at: number;

  @IsNumber()
  @IsOptional()
  ends_at: number;

  @IsOptional()
  @IsString()
  name: string;

  @IsIP()
  @IsOptional()
  address: string;
}
