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

export const IPSEC_OPTIONS = [
  'left',
  'leftid',
  'leftcert',
  'leftsendcert',
  'leftsubnet',
  'leftfirewall',
  'leftauth',
  'leftsourceip',
  'right',
  'rightid',
  'rightauth',
  'rightsubnet',
  'rightsourceip',
  'ike',
  'esp',
  'keyexchange',
  'dpdaction',
  'dpddelay',
  'rekey',
  'charondebug',
  'auto',
  'also',
  'CA Certificate',
  '<<vpn_network>>',
] as const;

export type IpsecOptionType = (typeof IPSEC_OPTIONS)[number];
@ValidatorConstraint({ name: 'IPSecOptionValidator', async: false })
export class IPSecOptionValidator implements ValidatorConstraintInterface {
  validate(value: string, args: ValidationArguments) {
    const option = args.object as IPSecOptionDTO;
    if (!value) return true;

    switch (option.name) {
      case 'left':
        // Accept IPv4 with or without CIDR, and %defaultroute for left
        return /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/.test(value) || value === '%defaultroute';
      case 'right':
        // Accept IPv4 with or without CIDR, and %any for right
        return /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/.test(value) || value === '%any';

      case 'IKEVersion':
        return value === '1' || value === '2';

      case 'AuthMethod':
        return ['psk', 'cert'].includes(value);

      case 'Phase1Encryption':
      case 'Phase2Encryption':
        return ['aes128', 'aes192', 'aes256', '3des'].includes(value);

      case 'Phase1Hash':
      case 'Phase2Hash':
        return ['sha1', 'sha256', 'sha384', 'sha512', 'md5'].includes(value);

      case 'Phase1DHGroup':
        return ['1', '2', '5', '14', '15', '16', '17', '18'].includes(value);

      case 'Phase2PFS':
        return [
          'group1',
          'group2',
          'group5',
          'group14',
          'group15',
          'group16',
          'group17',
          'group18',
          'none',
        ].includes(value);

      case 'Phase1Lifetime':
      case 'Phase2Lifetime':
        return /^\d+$/.test(value) && parseInt(value) > 0;

      case 'PoolStart':
      case 'PoolEnd':
        return /^(\d{1,3}\.){3}\d{1,3}$/.test(value);

      case 'NATTraversal':
      case 'SplitTunnel':
      case 'Mobike':
        return ['yes', 'no'].includes(value.toLowerCase());

      case 'PSK':
        return value.length >= 8; //

      case 'Certificate':
      case 'CA Certificate':
        return value.trim().endsWith('.crt') || value.trim().endsWith('.pem');

      default:
        return true;
    }
  }

  defaultMessage(args: ValidationArguments) {
    const option = args.object as IPSecOptionDTO;
    return `Invalid value for ${option.name}`;
  }
}
export class IPSecOptionDTO {
  @IsString()
  @IsIn(IPSEC_OPTIONS)
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
