import { IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator';

export class OpenVPNStatusSamplingUpdateDto {
  @IsBoolean()
  enabled: boolean;

  @IsOptional()
  @IsString()
  status_file?: string;

  @IsOptional()
  @IsNumber()
  collector_firewall?: number;
}
