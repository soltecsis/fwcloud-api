import { Controller } from "../../../fonaments/http/controller";
import { Request } from "express";
import { ResponseBuilder } from "../../../fonaments/http/response-builder";
import { OpenVPNPolicy } from "../../../policies/openvpn.policy";
import { getRepository, createQueryBuilder } from "typeorm";
import { OpenVPN } from "../../../models/vpn/openvpn/OpenVPN";
import { NotFoundException } from "../../../fonaments/exceptions/not-found-exception";
import { Channel } from "../../../sockets/channels/channel";
import { OpenVPNService } from "../../../models/vpn/openvpn/openvpn.service";
import { FSHelper } from "../../../utils/fs-helper";
import { app } from "../../../fonaments/abstract-application";
import * as uuid from "uuid";
import * as path from "path";
import * as fs from "fs-extra";

export class OpenVPNController extends Controller {
    
    public async installer(req: Request): Promise<ResponseBuilder> {
        const channel: Channel = await Channel.fromRequest(req);

        const openVPN: OpenVPN = await getRepository(OpenVPN).createQueryBuilder("openvpn")
            .leftJoinAndSelect("openvpn.firewall", "firewall")
            .leftJoinAndSelect("firewall.fwCloud", "fwcloud")
            .where("fwcloud.id = :fwcloudId", {fwcloudId: parseInt(req.params.fwcloud)})
            .andWhere("firewall.id = :firewallId", {firewallId: parseInt(req.params.firewall)})
            .andWhere('openvpn.id = :openvpnId', { openvpnId: parseInt(req.params.openvpn)})
            .getOne();

        if (!openVPN) {
            throw new NotFoundException();
        }

        (await OpenVPNPolicy.installer(openVPN, req.session.user)).authorize();

        const exePath: string = await (await this._app.getService<OpenVPNService>(OpenVPNService.name)).generateInstaller(openVPN, channel);

        const tmpPath: string = this.generateTemporaryPath(path.basename(exePath));
        
        fs.moveSync(exePath, tmpPath);

        setTimeout(() => {
            if (FSHelper.directoryExistsSync(path.dirname(tmpPath))) {
                FSHelper.rmDirectorySync(path.dirname(tmpPath));
            }
        }, 30000);
        //TODO: Move to a temporary directory and set a remove timeout
        
        //await (await this._app.getService<OpenVPNService>(OpenVPNService.name)).cleanInstaller();

        return ResponseBuilder.buildResponse().status(201).download(tmpPath, 'openvpn_installer.exe');
    }

    /**
     * Returns a temporary path where installer can be placed
     * 
     * @param filename 
     */
    protected generateTemporaryPath(filename: string): string {
        return path.join(app().config.get('tmp.directory'), uuid.v4(), filename);
    }
}