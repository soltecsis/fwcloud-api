import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class OpenVPNStatusSamplingUpdateDto {
  @IsBoolean()
  enabled: boolean;

  @IsOptional()
  @IsString()
  status_file?: string;
}
