import { Controller } from "../../fonaments/http/controller";
import { Firewall } from "../../models/firewall/Firewall";
import { getRepository } from "typeorm";
import { Request } from "express";
import { ResponseBuilder } from "../../fonaments/http/response-builder";
import { FirewallService, SSHConfig } from "../../models/firewall/firewall.service";
import { Progress } from "../../fonaments/http/progress/progress";
import { FirewallPolicy } from "../../policies/firewall.policy";

export class FirewallController extends Controller {
    
    protected firewallService: FirewallService;

    public async make(): Promise<void> {
        this.firewallService = await this._app.getService<FirewallService>(FirewallService.name);
    }
    
    public async compile(request: Request): Promise<ResponseBuilder> {
        let firewall: Firewall = await getRepository(Firewall).findOneOrFail({
            id: parseInt(request.params.firewall),
            fwCloudId: parseInt(request.params.fwcloud)
        });

        (await FirewallPolicy.compile(firewall, request.session.user)).authorize();

        firewall = await this.firewallService.compile(firewall);

        return ResponseBuilder.buildResponse().status(201).body(firewall);
    }

    public async install(request: Request): Promise<ResponseBuilder> {
        let firewall: Firewall = await getRepository(Firewall).findOneOrFail({
            id: parseInt(request.params.firewall),
            fwCloudId: parseInt(request.params.fwcloud)
        });

        (await FirewallPolicy.install(firewall, request.session.user)).authorize();

        const customSSHConfig: Partial<SSHConfig> = {
            host: request.body.sshuser ? request.body.sshuser : undefined,
            password: request.body.sshpass ? request.body.sshpass : undefined
        }

        firewall = await this.firewallService.install(firewall, customSSHConfig);

        return ResponseBuilder.buildResponse().status(201).body(firewall);
    }
}