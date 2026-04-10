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
  'keyingtries',
  'rekey',
  'uniqueids',
  'charondebug',
  'auto',
  'also',
  'CA Certificate',
  'type',
  '<<disable>>',
  '<<psk>>',
] as const;

export type IpsecOptionType = (typeof IPSEC_OPTIONS)[number];
export const PSK_KEY_OPTION = '<<psk>>';

@ValidatorConstraint({ name: 'IPSecOptionValidator', async: false })
export class IPSecOptionValidator implements ValidatorConstraintInterface {
  validate(value: string, args: ValidationArguments) {
    const option = args.object as IPSecOptionDTO;
    const normalizedValue = typeof value === 'string' ? value.trim() : value;

    if (option.name === PSK_KEY_OPTION) {
      return typeof normalizedValue === 'string' && normalizedValue.length >= 8;
    }
    if (!normalizedValue) return true;

    const optionValue = normalizedValue.toString();

    switch (option.name) {
      case 'left':
      case 'right':
        // IP, domain, %any, %defaultroute
        return (
          /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/.test(optionValue) || // IPv4 (with optional CIDR)
          optionValue === '%any' ||
          optionValue === '%defaultroute' ||
          /^[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)*\.[a-zA-Z]{2,}$/.test(optionValue) // domain
        );

      case 'leftid':
      case 'rightid':
        // "@domain" or DN, allow quoted or unquoted
        return (
          /^@[\w.-]+\.\w{2,}$/.test(optionValue) || // unquoted @domain
          /^"@[\w.-]+\.\w{2,}"$/.test(optionValue) || // quoted @domain
          /^([a-zA-Z]+=[^,]+,?\s*)+$/.test(optionValue) || // unquoted DN
          /^"([a-zA-Z]+=[^,]+,?\s*)+"$/.test(optionValue) // quoted DN
        );

      case 'leftcert':
      case 'rightcert':
      case 'Certificate':
      case 'CA Certificate':
        // .crt or .pem
        return /^[\w.-]+\.(crt|pem)$/.test(optionValue);

      case 'leftsubnet':
      case 'rightsubnet':
        // IP/CIDR, comma separated
        return optionValue
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
        return optionValue === '%config' || /^(\d{1,3}\.){3}\d{1,3}$/.test(optionValue);

      case 'leftauth':
      case 'rightauth':
        // psk, cert (UI) + pubkey/eap (legacy compatibility)
        return ['pubkey', 'psk', 'eap', 'cert'].includes(optionValue.toLowerCase());

      case 'ike':
      case 'esp':
        // proposal: alg-hash[-dhgroup][!], allow comma-separated list
        return optionValue
          .split(',')
          .map((v) => v.trim())
          .every((part) => part.length > 0 && /^([a-z0-9]+-){1,2}[a-z0-9]+(!)?$/.test(part));

      case 'keyexchange':
        // ikev1 / ikev2
        return ['ikev1', 'ikev2'].includes(optionValue);

      case 'dpdaction':
        // clear, hold, restart, restart-by-peer, none
        return ['clear', 'hold', 'restart', 'restart-by-peer', 'none'].includes(optionValue);

      case 'dpddelay':
        // duration: 300s, 10m
        return /^\d+(s|m)$/.test(optionValue);

      case 'leftfirewall':
      case 'rekey':
        // yes/no/true/false
        return ['yes', 'no', 'true', 'false'].includes(optionValue.toLowerCase());

      case 'charondebug':
        // e.g. ike 1, knl 2
        return /^([a-z]{3,5} \d)(,\s*[a-z]{3,5} \d)*$/.test(optionValue);

      case 'auto':
        // add, start, route, ignore
        return ['add', 'start', 'route', 'ignore'].includes(optionValue);

      case 'type':
        // tunnel, transport
        return ['tunnel', 'transport'].includes(optionValue);

      default:
        return true;
    }
  }

  defaultMessage(args: ValidationArguments) {
    const option = args.object as IPSecOptionDTO;
    return `Invalid value for ${option.name}`;
  }
}

@ValidatorConstraint({ name: 'IPSecPskKeyDependencyValidator', async: false })
export class IPSecPskKeyDependencyValidator implements ValidatorConstraintInterface {
  validate(options: IPSecOptionDTO[]) {
    if (!Array.isArray(options)) return true;

    const hasLeftPskAuth = options.some(
      (option) =>
        option?.name === 'leftauth' &&
        typeof option?.arg === 'string' &&
        option.arg.trim().toLowerCase() === 'psk',
    );
    const hasRightPskAuth = options.some(
      (option) =>
        option?.name === 'rightauth' &&
        typeof option?.arg === 'string' &&
        option.arg.trim().toLowerCase() === 'psk',
    );
    if (!hasLeftPskAuth && !hasRightPskAuth) return true;

    const leftPskKeyOption = options.find((option) => option?.name === PSK_KEY_OPTION);

    const leftKeyIsValid =
      typeof leftPskKeyOption?.arg === 'string' && leftPskKeyOption.arg.trim().length >= 8;

    if (hasLeftPskAuth && !leftKeyIsValid) return false;

    return true;
  }

  defaultMessage() {
    return `Options ${PSK_KEY_OPTION} are required (minimum 8 chars) when leftauth/rightauth is psk`;
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
  @IsOptional()
  crt?: number;

  @IsString()
  @IsOptional()
  install_dir?: string;

  @IsString()
  @IsOptional()
  @Matches(/^[a-zA-Z0-9\-_.]{2,64}$/, { message: 'Invalid install_name format' })
  install_name?: string;

  @IsString()
  @IsOptional()
  @Matches(/^[a-zA-Z0-9\-_.]{2,64}$/, { message: 'Invalid name format' })
  name?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Validate(IPSecPskKeyDependencyValidator)
  @Type(() => IPSecOptionDTO)
  options: IPSecOptionDTO[];

  @IsString()
  @IsOptional()
  comment?: string;

  @IsNotEmpty()
  @IsNumber()
  node_id: number;

  @IsOptional()
  @IsNumber()
  clone_id?: number;
}
