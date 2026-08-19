import { IsBoolean, IsInt, IsOptional, IsString, Min, ValidateIf } from 'class-validator';

export class OpenVPNStatusSamplingUpdateDto {
  @IsBoolean()
  enabled: boolean;

  @IsOptional()
  @IsString()
  status_file?: string;

  @ValidateIf((_, value) => value !== undefined)
  @IsInt()
  @Min(1)
  sampling_interval?: number;

  @ValidateIf((_, value) => value !== undefined)
  @IsInt()
  @Min(1)
  request_max_lines?: number;

  @ValidateIf((_, value) => value !== undefined)
  @IsInt()
  @Min(1)
  cache_max_size?: number;
}
