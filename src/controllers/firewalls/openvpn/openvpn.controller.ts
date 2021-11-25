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
import { Validate, ValidateQuery } from "../../../decorators/validate.decorator";
import { OpenVPNControllerInstallerDto } from "./dtos/installer.dto";
import { Firewall } from "../../../models/firewall/Firewall";
import { FwCloud } from "../../../models/fwcloud/FwCloud";
import { FindOpenVPNStatusHistoryOptions, FindResponse, GraphDataResponse, GraphOpenVPNStatusHistoryOptions, OpenVPNStatusHistoryService } from "../../../models/vpn/openvpn/status/openvpn-status-history.service";
import { HistoryQueryDto } from "./dtos/history-query.dto";
import { GraphQueryDto } from "./dtos/graph-query.dto";

export class OpenVPNController extends Controller {
    protected _openvpn: OpenVPN;
    protected _firewall: Firewall;
    protected _fwCloud: FwCloud;

    public async make(request: Request): Promise<void> {
        if (request.params.openvpn) {
            this._openvpn = await getRepository(OpenVPN).findOneOrFail(parseInt(request.params.openvpn));
        }

        const firewallQueryBuilder = getRepository(Firewall).createQueryBuilder('firewall')
            .where('firewall.id = :id', {id: parseInt(request.params.firewall)});
        if (request.params.openvpn) {
            firewallQueryBuilder.innerJoin('firewall.openVPNs', 'openvpn', 'openvpn.id = :openvpn', {openvpn: parseInt(request.params.openvpn)})
        }
        this._firewall = await firewallQueryBuilder.getOneOrFail();

        this._fwCloud = await getRepository(FwCloud).createQueryBuilder('fwcloud')
            .innerJoin('fwcloud.firewalls', 'firewall', 'firewall.id = :firewallId', {firewallId: parseInt(request.params.firewall)})
            .where('fwcloud.id = :id', {id: parseInt(request.params.fwcloud)})
            .getOneOrFail();
    }

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

    @ValidateQuery(HistoryQueryDto)
    @Validate()
    public async history(req: Request): Promise<ResponseBuilder> {
        const openVPN: OpenVPN = await this.getOpenVPNServerOrFail(
            parseInt(req.params.fwcloud),
            parseInt(req.params.firewall),
            parseInt(req.params.openvpn)
        );

        (await OpenVPNPolicy.history(openVPN, req.session.user)).authorize();

        const options: FindOpenVPNStatusHistoryOptions = this.buildOptions(req.query);

        const historyService: OpenVPNStatusHistoryService = await app().getService<OpenVPNStatusHistoryService>(OpenVPNStatusHistoryService.name);
        const results: FindResponse = await historyService.history(openVPN.id, options);

        return ResponseBuilder.buildResponse().status(200).body(results);
    }

    @ValidateQuery(GraphQueryDto)
    @Validate()
    public async graph(req: Request): Promise<ResponseBuilder> {
        const openVPN: OpenVPN = await this.getOpenVPNServerOrFail(
            parseInt(req.params.fwcloud),
            parseInt(req.params.firewall),
            parseInt(req.params.openvpn)
        );

        (await OpenVPNPolicy.history(openVPN, req.session.user)).authorize();

        const options: GraphOpenVPNStatusHistoryOptions = this.buildOptions(req.query);

        if (req.query.limit) {
            options.limit = parseInt(req.query.limit as string);
        }

        const historyService: OpenVPNStatusHistoryService = await app().getService<OpenVPNStatusHistoryService>(OpenVPNStatusHistoryService.name);
        const results: GraphDataResponse = await historyService.graph(openVPN.id, options);

        return ResponseBuilder.buildResponse().status(200).body(results);
    }

    /**
     * Returns a temporary path where installer can be placed
     * 
     * @param filename 
     */
    protected generateTemporaryPath(filename: string): string {
        return path.join(app().config.get('tmp.directory'), uuid.v4(), filename);
    }

    protected getOpenVPNServerOrFail(fwcloudId: number, firewallId: number, openVPNId: number): Promise<OpenVPN> {
        return getRepository(OpenVPN).createQueryBuilder("openvpn")
        .innerJoinAndSelect("openvpn.firewall", "firewall")
        .innerJoinAndSelect("firewall.fwCloud", "fwcloud")
        .innerJoin('openvpn.crt', 'crt')
        .where("fwcloud.id = :fwcloudId", {fwcloudId})
        .andWhere("firewall.id = :firewallId", {firewallId})
        .andWhere('openvpn.id = :openVPNId', { openVPNId})
        .andWhere('openvpn.parentId IS NULL')
        .andWhere('crt.type =  2')
        .getOneOrFail();
    }

    protected buildOptions(query: Record<string, unknown>): FindOpenVPNStatusHistoryOptions {
        const options: FindOpenVPNStatusHistoryOptions = {
            rangeTimestamp: [new Date(0), new Date()]
        }

        if (query.starts_at) {
            options.rangeTimestamp[0] =  new Date(parseInt(query.starts_at as string));
        }

        if (query.ends_at) {
            options.rangeTimestamp[1] = new Date(parseInt(query.ends_at as string));
        }

        if (query.name) {
            options.name = query.name as string;
        }

        if (query.address) {
            options.address = query.address as string;
        }

        return options;
    }
}