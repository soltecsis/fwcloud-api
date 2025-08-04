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
  'leftsubnet',
  'leftfirewall',
  'leftauth',
  'leftsourceip',
  'right',
  'rightid',
  'rightcert',
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
  '<<disable>>',
] as const;

export type IpsecOptionType = (typeof IPSEC_OPTIONS)[number];
@ValidatorConstraint({ name: 'IPSecOptionValidator', async: false })
export class IPSecOptionValidator implements ValidatorConstraintInterface {
  validate(value: string, args: ValidationArguments) {
    const option = args.object as IPSecOptionDTO;
    if (!value) return true;

    switch (option.name) {
      case 'left':
      case 'right':
        // IP, domain, %any, %defaultroute
        return (
          /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/.test(value) || // IPv4 (with optional CIDR)
          value === '%any' ||
          value === '%defaultroute' ||
          /^[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)*\.[a-zA-Z]{2,}$/.test(value) // domain
        );

      case 'leftid':
      case 'rightid':
        // "@domain" or DN, allow quoted or unquoted
        return (
          /^@[\w.-]+\.\w{2,}$/.test(value) || // unquoted @domain
          /^"@[\w.-]+\.\w{2,}"$/.test(value) || // quoted @domain
          /^([a-zA-Z]+=[^,]+,?\s*)+$/.test(value) || // unquoted DN
          /^"([a-zA-Z]+=[^,]+,?\s*)+"$/.test(value) // quoted DN
        );

      case 'leftcert':
      case 'rightcert':
      case 'Certificate':
      case 'CA Certificate':
        // .crt or .pem
        return /^[\w.-]+\.(crt|pem)$/.test(value);

      case 'leftsubnet':
      case 'rightsubnet':
        // IP/CIDR, comma separated
        return value
          .split(',')
          .map((v) => v.trim())
          .every((part) =>
            /^((25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)){3})\/([0-9]|[1-2][0-9]|3[0-2])$/.test(
              part,
            ),
          );

      case 'leftsourceip':
      case 'rightsourceip':
        // %config or IP
        return value === '%config' || /^(\d{1,3}\.){3}\d{1,3}$/.test(value);

      case 'leftauth':
      case 'rightauth':
        // pubkey, psk, eap
        return ['pubkey', 'psk', 'eap'].includes(value.toLowerCase());

      case 'ike':
      case 'esp':
        // proposal: alg-hash[-dhgroup][!]
        return /^([a-z0-9]+-){1,2}[a-z0-9]+(!)?$/.test(value);

      case 'keyexchange':
        // ikev1 / ikev2
        return ['ikev1', 'ikev2'].includes(value);

      case 'dpdaction':
        // clear, hold, restart, restart-by-peer, none
        return ['clear', 'hold', 'restart', 'restart-by-peer', 'none'].includes(value);

      case 'dpddelay':
        // duration: 300s, 10m
        return /^\d+(s|m)$/.test(value);

      case 'leftfirewall':
      case 'rekey':
        // yes/no/true/false
        return ['yes', 'no', 'true', 'false'].includes(value.toLowerCase());

      case 'charondebug':
        // e.g. ike 1, knl 2
        return /^([a-z]{3,5} \d)(,\s*[a-z]{3,5} \d)*$/.test(value);

      case 'auto':
        // add, start, route, ignore
        return ['add', 'start', 'route', 'ignore'].includes(value);

      case 'PSK':
        // min 8 chars
        return value.length >= 8;

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
