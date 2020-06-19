import { Service } from "../../../fonaments/services/service";
import { OpenVPN } from "./OpenVPN";
import { EventEmitter } from "typeorm/platform/PlatformTools";
import db from "../../../database/database-manager";

export class OpenVPNService extends Service {
    public async generateInstaller(openVPN: OpenVPN, eventEmitter: EventEmitter): Promise<string> {
        const fwCloudId: number = 0;
        const openVPNId: number = openVPN.id;

        const configData = (await OpenVPN.dumpCfg(db.getQuery(), fwCloudId, openVPNId) as any).cfg;

        return "";
    }
}