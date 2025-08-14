import { IsNumber, IsOptional } from 'class-validator';

export class RouteMoveToDto {
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
  wireGuardId?: number;

  @IsNumber()
  @IsOptional()
  wireGuardPrefixId?: number;

  @IsNumber()
  @IsOptional()
  ipSecId?: number;

  @IsNumber()
  @IsOptional()
  ipSecPrefixId?: number;

  @IsNumber()
  @IsOptional()
  markId?: number;
}
