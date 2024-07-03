import { IsNumber, IsOptional } from 'class-validator';

export class RoutingRuleMoveFromDto {
  @IsNumber()
  fromId: number;

  @IsNumber()
  toId: number;

  @IsNumber()
  @IsOptional()
  ipObjId?: number;

  @IsNumber()
  @IsOptional()
  ipObjGroupId?: number;

  @IsNumber()
  @IsOptional()
  openVPNId?: number;

  @IsNumber()
  @IsOptional()
  openVPNPrefixId?: number;

  @IsNumber()
  @IsOptional()
  markId?: number;
}
