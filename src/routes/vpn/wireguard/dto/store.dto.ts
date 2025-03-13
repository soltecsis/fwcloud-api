import { Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsNumber,
  IsString,
  IsArray,
  IsOptional,
  IsIn,
  Matches,
  ValidateNested,
} from 'class-validator';

export class WireGuardOptionDTO {
  @IsString()
  @IsIn([
    'PrivateKey',
    'Address',
    'DNS',
    'MTU',
    'Table',
    'Endpoint',
    'AllowedIPs',
    'PersistentKeepalive',
    'ListenPort',
    'PublicKey',
    'PreIp',
    'PostUp',
    'PreDown',
    'PostDown',
    'disable',
  ])
  name: string;

  @IsOptional()
  @IsString()
  arg?: string;

  @IsOptional()
  @IsNumber()
  ipobj?: number;

  @IsOptional()
  @IsNumber()
  scope?: number;

  @IsOptional()
  @IsString()
  comment?: string;

  @IsOptional()
  @IsNumber()
  wireguard_cli?: number;
}

export class StoreDto {
  @IsNotEmpty()
  @IsNumber()
  fwcloud: number;

  @IsOptional()
  @IsNumber()
  wireguard?: number;

  @IsNotEmpty()
  @IsNumber()
  firewall: number;

  @IsNotEmpty()
  @IsNumber()
  crt: number;

  @IsString()
  @IsOptional()
  install_dir?: string;

  @IsString()
  @IsOptional()
  @Matches(/^[a-zA-Z0-9\-_.]{2,64}$/, { message: 'Invalid install_name format' })
  install_name?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WireGuardOptionDTO)
  options: WireGuardOptionDTO[];

  @IsString()
  @IsOptional()
  comment?: string;

  @IsNotEmpty()
  @IsNumber()
  node_id: number;
}
