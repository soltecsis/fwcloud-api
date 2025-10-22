import { Transform } from 'class-transformer';
import { IsISO8601, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class AuditLogListQueryDto {
  @IsOptional()
  @IsISO8601({ strict: true })
  @Transform(trim)
  ts_from?: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  @Transform(trim)
  ts_to?: string;

  @IsOptional()
  @IsString()
  @Transform(trim)
  user_name?: string;

  @IsOptional()
  @IsString()
  @Transform(trim)
  session_id?: string;

  @IsOptional()
  @IsString()
  @Transform(trim)
  fwcloud_name?: string;

  @IsOptional()
  @IsString()
  @Transform(trim)
  firewall_name?: string;

  @IsOptional()
  @IsString()
  @Transform(trim)
  cluster_name?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(200)
  limit?: number;

  @IsOptional()
  @IsString()
  @Transform(trim)
  cursor?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(200)
  pageSize?: number;
}
