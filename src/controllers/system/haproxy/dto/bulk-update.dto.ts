import { IsBoolean, IsOptional, IsString, IsNumber } from 'class-validator';

export class HAProxyRuleBulkUpdateDto {
  @IsBoolean()
  @IsOptional()
  active?: boolean;

  @IsString()
  @IsOptional()
  style?: string;

  @IsNumber()
  @IsOptional()
  group?: number;
}
