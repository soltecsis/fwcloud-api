import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class ClusterPolicyNodeDto {
  @IsInt()
  @Min(1)
  firewallId: number;

  @IsOptional()
  @IsString()
  sshuser?: string;

  @IsOptional()
  @IsString()
  sshpass?: string;
}

export class ClusterPolicyInstallDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ClusterPolicyNodeDto)
  nodes: ClusterPolicyNodeDto[];
}
