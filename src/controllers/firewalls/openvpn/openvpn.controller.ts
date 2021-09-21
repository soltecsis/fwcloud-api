/*!
    Copyright 2021 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
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

import { Controller } from "../../../fonaments/http/controller";
import { Request } from "express";
import { ResponseBuilder } from "../../../fonaments/http/response-builder";
import { OpenVPNPolicy } from "../../../policies/openvpn.policy";
import { getRepository } from "typeorm";
import { OpenVPN } from "../../../models/vpn/openvpn/OpenVPN";
import { NotFoundException } from "../../../fonaments/exceptions/not-found-exception";
import { OpenVPNService } from "../../../models/vpn/openvpn/openvpn.service";
import { FSHelper } from "../../../utils/fs-helper";
import { app } from "../../../fonaments/abstract-application";
import * as uuid from "uuid";
import * as path from "path";
import { Validate } from "../../../decorators/validate.decorator";
import { OpenVPNControllerInstallerDto } from "./dtos/installer.dto";

export class OpenVPNController extends Controller {
    
    @Validate(OpenVPNControllerInstallerDto)
    public async installer(req: Request): Promise<ResponseBuilder> {
        const openVPN: OpenVPN = await getRepository(OpenVPN).createQueryBuilder("openvpn")
            .leftJoinAndSelect("openvpn.firewall", "firewall")
            .leftJoinAndSelect("firewall.fwCloud", "fwcloud")
            .where("fwcloud.id = :fwcloudId", {fwcloudId: parseInt(req.params.fwcloud)})
            .andWhere("firewall.id = :firewallId", {firewallId: parseInt(req.params.firewall)})
            .andWhere('openvpn.id = :openvpnId', { openvpnId: parseInt(req.params.openvpn)})
            .andWhere('openvpn.openvpn IS NOT NULL')
            .getOne();

        if (!openVPN) {
            throw new NotFoundException();
        }

        const serverOpenVPN: OpenVPN = await getRepository(OpenVPN).createQueryBuilder("openvpn")
            .leftJoinAndSelect("openvpn.firewall", "firewall")
            .leftJoinAndSelect("firewall.fwCloud", "fwcloud")
            .where("fwcloud.id = :fwcloudId", {fwcloudId: parseInt(req.params.fwcloud)})
            .andWhere("firewall.id = :firewallId", {firewallId: parseInt(req.params.firewall)})
            .andWhere('openvpn.id = :openvpnId', { openvpnId: openVPN.parentId})
            .andWhere('openvpn.openvpn IS NULL')
            .getOne();

        if (!serverOpenVPN) {
            throw new NotFoundException();
        }

        (await OpenVPNPolicy.installer(openVPN, req.session.user)).authorize();

        const exePath: string = await (await this._app.getService<OpenVPNService>(OpenVPNService.name))
            .generateInstaller(req.body.connection_name, openVPN, this.generateTemporaryPath("fwcloud-vpn.exe"));
        
        setTimeout(() => {
            if (FSHelper.directoryExistsSync(path.dirname(exePath))) {
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