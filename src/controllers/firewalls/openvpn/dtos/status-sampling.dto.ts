import { IsArray, IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator';

export class OpenVPNStatusSamplingUpdateDto {
  @IsBoolean()
  enabled: boolean;

  @IsArray()
  @IsString({ each: true })
  status_files: string[];

  @IsOptional()
  @IsNumber()
  collector_firewall?: number;
}
