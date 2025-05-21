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
  ValidationArguments,
} from 'class-validator';

@ValidatorConstraint({ name: 'IPSecOptionValidator', async: false })
export class IPSecOptionValidator implements ValidatorConstraintInterface {
  validate(value: string, args: ValidationArguments) {
    const option = args.object as IPSecOptionDTO;
    //TODO: ADAPTAR CON LAS OPCIONES DE IPSEC
    if (!value) return true;
    switch (option.name) {
      // [Interface]
      case 'PrivateKey':
        return /^[A-Za-z0-9+/]{43}=$/.test(value);
      case 'Address':
        return /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}(,\s*(\d{1,3}\.){3}\d{1,3}\/\d{1,2})*$/.test(value);
      case 'ListenPort':
        return /^([1-9]\d{0,3}|[1-5]\d{4}|6[0-4]\d{3}|65[0-4]\d{2}|655[0-2]\d|6553[0-5])$/.test(
          value,
        );
      case 'MTU':
        return /^\d+$/.test(value) && parseInt(value) > 0;
      case 'DNS': {
        const isValid =
          /^((\d{1,3}\.){3}\d{1,3}|[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9](\.[a-zA-Z]{2,})+)(,\s*((\d{1,3}\.){3}\d{1,3}|[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9](\.[a-zA-Z]{2,})+))*$/.test(
            value,
          );
        return isValid;
      }
      case 'Table':
        return value === 'off' || value === '';

      // [Peer]
      case 'PublicKey':
        return /^[A-Za-z0-9+/]{42,44}$/.test(value);
      case 'AllowedIPs':
        return /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}(,\s*(\d{1,3}\.){3}\d{1,3}\/\d{1,2})*$/.test(value);
      case 'Endpoint':
        return /^((\d{1,3}\.){3}\d{1,3}|[a-zA-Z0-9.-]+):(\d{1,5})$/.test(value);
      case 'PersistentKeepalive':
        return /^\d+$/.test(value) && parseInt(value) <= 65535;
      case 'PresharedKey':
        return /^[A-Za-z0-9+/]{43}=$/.test(value);

      // Commands
      case 'PreUp':
      case 'PostUp':
      case 'PreDown':
      case 'PostDown':
        return value.length > 0;

      default:
        return true;
    }
  }

  defaultMessage(args: ValidationArguments) {
    const option = args.object as IPSecOptionDTO;
    return `Invalid value for ${option.name}`;
  }
}
//TODO: ADAPTAR CON LAS OPCIONES DE IPSEC
export class IPSecOptionDTO {
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
    '<<disable>>',
    '<<vpn_network>>',
  ])
  name: string;

  @IsOptional()
  @IsString()
  @Validate(IPSecOptionValidator)
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
  ipsec_cli?: number;
}

export class StoreDto {
  @IsNotEmpty()
  @IsNumber()
  fwcloud: number;

  @IsOptional()
  @IsNumber()
  ipsec?: number;

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
  @Type(() => IPSecOptionDTO)
  options: IPSecOptionDTO[];

  @IsString()
  @IsOptional()
  comment?: string;

  @IsNotEmpty()
  @IsNumber()
  node_id: number;
}
