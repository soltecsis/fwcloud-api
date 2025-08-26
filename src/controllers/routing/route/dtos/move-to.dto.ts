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
  wireguardId?: number;

  @IsNumber()
  @IsOptional()
  wireguardPrefixId?: number;

  @IsNumber()
  @IsOptional()
  ipsecId?: number;

  @IsNumber()
  @IsOptional()
  ipsecPrefixId?: number;

  @IsNumber()
  @IsOptional()
  markId?: number;
}
