import { PluginsFlags } from './../../../models/firewall/Firewall';
import { IsBoolean, IsEnum, IsNumber, IsString } from "class-validator"
import { FirewallInstallProtocol } from "../../../models/firewall/Firewall";

export class PluginDto {
    @IsString()
    host: string;

    @IsNumber()
    port: number;

    @IsEnum(FirewallInstallProtocol)
    protocol: FirewallInstallProtocol;
    
    @IsString()
    apikey: string;

    @IsEnum(PluginsFlags)
    plugin: PluginsFlags 

    @IsBoolean()
    enable: boolean
}