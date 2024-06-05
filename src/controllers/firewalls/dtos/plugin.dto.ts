import {
  FirewallInstallCommunication,
  PluginsFlags,
} from './../../../models/firewall/Firewall';
import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { FirewallInstallProtocol } from '../../../models/firewall/Firewall';

export class PluginDto {
  @IsEnum(FirewallInstallCommunication)
  communication: FirewallInstallCommunication;

  @IsString()
  host: string;

  @IsNumber()
  port: number;

  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsString()
  password?: string;

  @IsOptional()
  @IsEnum(FirewallInstallProtocol)
  protocol?: FirewallInstallProtocol;

  @IsOptional()
  @IsString()
  apikey?: string;

  @IsEnum(PluginsFlags)
  plugin: PluginsFlags;

  @IsBoolean()
  enable: boolean;
}
