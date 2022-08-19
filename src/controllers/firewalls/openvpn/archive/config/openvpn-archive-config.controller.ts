import { Validate } from "../../../../../decorators/validate.decorator";
import { app } from "../../../../../fonaments/abstract-application";
import { Controller } from "../../../../../fonaments/http/controller";
import { ResponseBuilder } from "../../../../../fonaments/http/response-builder";
import { OpenVPNService, OpenVPNUpdateableConfig } from "../../../../../models/vpn/openvpn/openvpn.service";
import { OpenVPNArchiveControllerUpdateDto } from "./dtos/openvpn-archive-config-update.dto";
import { Request } from "express";

export class OpenVPNArchiveConfigController extends Controller {
    protected _openvpnService: OpenVPNService;

    async make() {
        this._openvpnService = await app().getService<OpenVPNService>(OpenVPNService.name);
    }

    /**
     * Returns the openvpn archive config
     * 
     * @param request 
     * @param response 
     */
    @Validate()
    public async show(): Promise<ResponseBuilder> {
        const config: OpenVPNUpdateableConfig = this._openvpnService.getCustomizedConfig();

        return ResponseBuilder.buildResponse().status(200).body({
            archive_days: config.history.archive_days,
            retention_days: config.history.retention_days
        });
    }

    /**
     * Updates the openvpn archive config
     * 
     * @param request 
     * @param response 
     */
    @Validate(OpenVPNArchiveControllerUpdateDto)
    public async update(request: Request): Promise<ResponseBuilder> {
        await this._openvpnService.updateArchiveConfig({
            history: request.body as unknown as { archive_days: number, retention_days: number}
        });

        const config: OpenVPNUpdateableConfig = this._openvpnService.getCustomizedConfig();

        return ResponseBuilder.buildResponse().status(201).body({
            archive_days: config.history.archive_days,
            retention_days: config.history.retention_days
        });
    }
}