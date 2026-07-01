import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { REPLICATION_PROFILE_TARGET_KINDS } from '../../../models/replication-profile/replication-profile.constants';

const trimLowercase = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class ReplicationProfileListQueryDto {
  @IsOptional()
  @IsString()
  @IsIn(REPLICATION_PROFILE_TARGET_KINDS)
  @Transform(trimLowercase)
  targetKind?: string;
}
