import { Service } from "../../../fonaments/services/service";
import { OpenVPN } from "./OpenVPN";
import { EventEmitter } from "typeorm/platform/PlatformTools";
import db from "../../../database/database-manager";
import { InstallerGenerator } from "../../../openvpn-installer/installer-generator";

export class OpenVPNService extends Service {
    public async generateInstaller(name: string, openVPN: OpenVPN, outputPath: string): Promise<string> {
        const fwCloudId: number = 0;
        const openVPNId: number = openVPN.id;
        let configData: string;

        try {
            configData = (await OpenVPN.dumpCfg(db.getQuery(), fwCloudId, openVPNId) as any).cfg;
        } catch (e) {
            throw new Error('Unable to generate the openvpn configuration during installer generation: ' + JSON.stringify(e));
        }

        const installerGenerator: InstallerGenerator = new InstallerGenerator("lib/nsis", name, configData, outputPath)

        return installerGenerator.generate();
    }
}