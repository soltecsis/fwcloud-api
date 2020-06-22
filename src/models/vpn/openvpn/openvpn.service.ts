import { Service } from "../../../fonaments/services/service";
import { OpenVPN } from "./OpenVPN";
import { EventEmitter } from "typeorm/platform/PlatformTools";
import db from "../../../database/database-manager";
import { InstallerGenerator } from "../../../openvpn-installer/installer-generator";
import { getRepository } from "typeorm";
import { Firewall } from "../../firewall/Firewall";
import { FwCloud } from "../../fwcloud/FwCloud";

export class OpenVPNService extends Service {
    public async generateInstaller(name: string, openVPN: OpenVPN, outputPath: string): Promise<string> {
        let configData: string;

        try {
            const openVPNId: number = openVPN.id;
            const firewall: Firewall = await getRepository(Firewall).findOne(openVPN.firewallId, { relations: ['fwCloud']});
            const fwCloudId: number = firewall.fwCloudId;
            
            configData = (await OpenVPN.dumpCfg(db.getQuery(), fwCloudId, openVPNId) as any).cfg;
            
        } catch (e) {
            throw new Error('Unable to generate the openvpn configuration during installer generation: ' + JSON.stringify(e));
        }

        const installerGenerator: InstallerGenerator = new InstallerGenerator("lib/nsis", name, configData, outputPath)
        return installerGenerator.generate();
    }
}