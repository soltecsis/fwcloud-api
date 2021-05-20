import { IsString, Matches } from "class-validator";
import { InstallerGenerator } from "../../../../openvpn-installer/installer-generator";

export class OpenVPNControllerInstallerDto {
    @IsString()
    @Matches(new RegExp(InstallerGenerator.connectionNameRegExp))
    connection_name: string;
}