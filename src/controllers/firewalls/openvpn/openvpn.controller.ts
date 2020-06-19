import { Controller } from "../../../fonaments/http/controller";
import { Request } from "express";
import { ResponseBuilder } from "../../../fonaments/http/response-builder";
import { OpenVPNPolicy } from "../../../policies/openvpn.policy";
import { getRepository, createQueryBuilder } from "typeorm";
import { OpenVPN } from "../../../models/vpn/openvpn/OpenVPN";
import { NotFoundException } from "../../../fonaments/exceptions/not-found-exception";
import { OpenVPNService } from "../../../models/vpn/openvpn/openvpn.service";
import { FSHelper } from "../../../utils/fs-helper";
import { app } from "../../../fonaments/abstract-application";
import * as uuid from "uuid";
import * as path from "path";

export class OpenVPNController extends Controller {
    
    public async installer(req: Request): Promise<ResponseBuilder> {
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

        const exePath: string = await (await this._app.getService<OpenVPNService>(OpenVPNService.name))
            .generateInstaller(req.body.connection_name, openVPN, this.generateTemporaryPath("fwcloud-vpn.exe"));
        
        setTimeout(() => {
            if (FSHelper.directoryExistsSync(path.dirname(exePath))) {
                console.log('Removing.... ' + path.dirname(exePath));
                FSHelper.rmDirectorySync(path.dirname(exePath));
            }
        }, 30000);
        
        return ResponseBuilder.buildResponse().status(201).download(exePath, "fwcloud-vpn.exe");
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