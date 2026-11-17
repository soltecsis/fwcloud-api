import { Transform } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsISO8601,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { AuditEventType, parseAuditEventTypes } from '../../../models/audit/audit-event-type';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class AuditLogListQueryDto {
  @IsOptional()
  @Transform(({ value }) => parseAuditEventTypes(value))
  @IsArray()
  @ArrayNotEmpty()
  @IsEnum(AuditEventType, { each: true })
  event_type?: AuditEventType[];

  @IsOptional()
  @IsISO8601({ strict: true })
  @Transform(trim)
  started_at_from?: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  @Transform(trim)
  started_at_to?: string;

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
  @IsInt()
  @Min(1)
  fwcloud_id?: number;

  @IsOptional()
  @IsString()
  @Transform(trim)
  firewall_name?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  firewall_id?: number;

  @IsOptional()
  @IsString()
  @Transform(trim)
  cluster_name?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  cluster_id?: number;

  @IsOptional()
  @IsString()
  @Transform(trim)
  source_ip?: string;

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
