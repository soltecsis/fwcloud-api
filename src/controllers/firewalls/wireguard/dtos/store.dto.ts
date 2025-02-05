/*!
    Copyright 2024 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
    https://soltecsis.com
    info@soltecsis.com


    This file is part of FWCloud (https://fwcloud.net).

    FWCloud is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    FWCloud is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with FWCloud.  If not, see <https://www.gnu.org/licenses/>.
*/

import {
  IsString,
  IsOptional,
  IsNumber,
  Matches,
  IsEnum,
  ValidateIf,
  ArrayUnique,
  IsIP,
  IsIn,
} from 'class-validator';

const VALID_WG_COMMANDS = [
  'ip-link',
  'ifconfig',
  'ip-address',
  'ip-rule',
  'ip-route',
  'ip-netns',
  'tcpdump',
  'iptables',
  'journalctl',
  'wg',
  'wg-addconf',
  'wg-set',
  'wg-setconf',
  'wg-genkey',
  'wg-pubkey',
  'wg-allowed-ips',
  'wg-show',
  'wg-showconf',
  'wg-quick',
  'wg-quickconf',
  'wg-quickup',
  'wg-quickdown',
  'wg-quickconfup',
  'wg-quickconfdown',
  'wg-quickconfshow',
];

enum WireGuardScope {
  CCD = 0,
  CONFIG_FILE = 1,
  WG_INTERFACE = 2,
  WG_PEER = 3,
}

const VALID_WG_OPTIONS = [
  'address',
  'allowed-ips',
  'endpoint',
  'persistent-keepalive',
  'dns',
  'table',
  'mtu',
  'private-key',
  'public-key',
  'listen-port',
  'post-up',
  'post-down',
  'pre-up',
  'pre-down',
];

export class WireGuardDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsEnum(WireGuardScope)
  scope?: WireGuardScope;

  @ValidateIf((o) => o.name === 'listen-port')
  @IsNumber()
  listenPort?: number;

  @ValidateIf((o) => o.name === 'server')
  @IsString()
  server?: string;

  @IsOptional()
  @IsString()
  comment?: string;

  @ValidateIf((o) => VALID_WG_COMMANDS.includes(o.name))
  @IsString({ each: true })
  @ArrayUnique()
  @IsIn(VALID_WG_COMMANDS, { each: true, message: 'Invalid WireGuard command' })
  options?: string[];

  @ValidateIf(
    (o) =>
      VALID_WG_OPTIONS.includes(o.name) || ['address', 'allowed-ips', 'endpoint'].includes(o.name),
  )
  @IsString()
  @ValidateIf((o) => ['address', 'allowed-ips', 'endpoint'].includes(o.name))
  @IsIP()
  value?: string;

  @ValidateIf((o) => o.name === 'private-key' || o.name === 'public-key')
  @Matches(/^[A-Za-z0-9+/]{43}=$/, { message: 'Invalid WireGuard key format' })
  key?: string;
}
