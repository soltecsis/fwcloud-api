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
  ValidatorConstraint,
  ValidatorConstraintInterface,
  Validate,
} from 'class-validator';
@ValidatorConstraint({ async: false })
export class WireGuardOptionValidator implements ValidatorConstraintInterface {
  validate(option: WireGuardOptionDTO) {
    if (!option.arg) return true;

    switch (option.name) {
      // [Interface]
      case 'PrivateKey':
        return /^[A-Za-z0-9+/]{43}=$/.test(option.arg);
      case 'Address':
        return /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}(,\s*(\d{1,3}\.){3}\d{1,3}\/\d{1,2})*$/.test(
          option.arg,
        );
      case 'ListenPort':
        return /^([1-9]\d{0,3}|[1-5]\d{4}|6[0-4]\d{3}|65[0-4]\d{2}|655[0-2]\d|6553[0-5])$/.test(
          option.arg,
        );
      case 'MTU':
        return /^\d+$/.test(option.arg) && parseInt(option.arg) > 0;
      case 'DNS':
        return /^((\d{1,3}\.){3}\d{1,3}|[a-zA-Z0-9.-]+)(,\s*((\d{1,3}\.){3}\d{1,3}|[a-zA-Z0-9.-]+))*$/.test(
          option.arg,
        );
      case 'Table':
        return option.arg === 'off' || option.arg === '';

      // [Peer]
      case 'PublicKey':
        return /^[A-Za-z0-9+/]{42,44}$/.test(option.arg);
      case 'AllowedIPs':
        return /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}(,\s*(\d{1,3}\.){3}\d{1,3}\/\d{1,2})*$/.test(
          option.arg,
        );
      case 'Endpoint':
        return /^((\d{1,3}\.){3}\d{1,3}|[a-zA-Z0-9.-]+):(\d{1,5})$/.test(option.arg);
      case 'PersistentKeepalive':
        return /^\d+$/.test(option.arg) && parseInt(option.arg) <= 65535;
      case 'PresharedKey':
        return /^[A-Za-z0-9+/]{43}=$/.test(option.arg);

      // Commands
      case 'PreUp':
      case 'PostUp':
      case 'PreDown':
      case 'PostDown':
        return option.arg.length > 0;

      default:
        return true;
    }
  }

  defaultMessage() {
    return 'Invalid option configuration for $property';
  }
}
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
    'PreUp',
    'PostUp',
    'PreDown',
    'PostDown',
    'SaveConfig',
    'FwMark',
    'PresharedKey',
    'disable',
  ])
  name: string;

  @IsOptional()
  @IsString()
  @Validate(WireGuardOptionValidator)
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
