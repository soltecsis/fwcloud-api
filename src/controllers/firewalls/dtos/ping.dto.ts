import { IsEnum, isEnum, IsObject, IsOptional, IsString } from "class-validator";
import { FirewallInstallCommunication, FirewallInstallProtocol } from "../../../models/firewall/Firewall";

export class PingDto {
    @IsEnum(FirewallInstallCommunication)
    communication: FirewallInstallCommunication;

    @IsString()
    host: string;

    @IsString()
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
}