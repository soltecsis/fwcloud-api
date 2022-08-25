
import { ProgressInfoPayload, ProgressSuccessPayload } from './../../../../sockets/messages/socket-message';
import { Validate } from "../../../../decorators/validate.decorator";
import { app, logger } from "../../../../fonaments/abstract-application";
import { Controller } from "../../../../fonaments/http/controller";
import { ResponseBuilder } from "../../../../fonaments/http/response-builder";
import { OpenVPNService } from "../../../../models/vpn/openvpn/openvpn.service";
import { Request } from "express";
import { Channel } from "../../../../sockets/channels/channel";

export class OpenVPNArchiveController extends Controller {
    protected _openvpnService: OpenVPNService;

    async make() {
        this._openvpnService = await app().getService<OpenVPNService>(OpenVPNService.name);
    }

    /**
     * Starts a history archive
     * 
     * @param request 
     * @param response 
     */
    @Validate()
    public async store(request: Request): Promise<ResponseBuilder> {

        const channel: Channel = await Channel.fromRequest(request);
       
        try{
            const rowsArchived: number = await this._openvpnService.archiveHistory(channel)
            return ResponseBuilder.buildResponse().status(201).body({
                rows: rowsArchived
            });
        }catch(err){
            throw err
        }
        
    }
}