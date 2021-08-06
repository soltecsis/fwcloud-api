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

import { Controller } from "../../fonaments/http/controller";
import { Firewall } from "../../models/firewall/Firewall";
import { getRepository } from "typeorm";
import { Request } from "express";
import { ResponseBuilder } from "../../fonaments/http/response-builder";
import { FirewallService, SSHConfig } from "../../models/firewall/firewall.service";
import { FirewallPolicy } from "../../policies/firewall.policy";
import { Channel } from "../../sockets/channels/channel";
import { ProgressPayload } from "../../sockets/messages/socket-message";
import { Validate, ValidateQuery } from "../../decorators/validate.decorator";
import { FirewallControllerCompileDto } from "./dtos/compile.dto";
import { FirewallControllerInstallDto } from "./dtos/install.dto";
import { RoutingRulesData, RoutingRuleService } from "../../models/routing/routing-rule/routing-rule.service";
import { RoutingRuleItemForCompiler } from "../../models/routing/shared";
import { RoutingCompiler } from "../../compiler/routing/RoutingCompiler";
import { FirewallControllerCompileRoutingRuleQueryDto } from "./dtos/compile-routing-rules.dto";

export class FirewallController extends Controller {
    
    protected firewallService: FirewallService;
    protected routingRuleService: RoutingRuleService;

    public async make(): Promise<void> {
        this.firewallService = await this._app.getService<FirewallService>(FirewallService.name);
        this.routingRuleService = await this._app.getService<RoutingRuleService>(RoutingRuleService.name);
    }
    
    @Validate(FirewallControllerCompileDto)
    public async compile(request: Request): Promise<ResponseBuilder> {
        /**
         * This method is not used temporarily
         */
        let firewall: Firewall = await getRepository(Firewall).findOneOrFail({
            id: parseInt(request.params.firewall),
            fwCloudId: parseInt(request.params.fwcloud)
        });

        (await FirewallPolicy.compile(firewall, request.session.user)).authorize();

        const channel: Channel = await Channel.fromRequest(request);

        firewall = await this.firewallService.compile(firewall, channel);

        channel.emit('message', new ProgressPayload('end', false, 'Compiling firewall'));

        return ResponseBuilder.buildResponse().status(201).body(firewall);
    }

    @Validate(FirewallControllerInstallDto)
    public async install(request: Request): Promise<ResponseBuilder> {
        /**
         * This method is not used temporarily
         */
        let firewall: Firewall = await getRepository(Firewall).findOneOrFail({
            id: parseInt(request.params.firewall),
            fwCloudId: parseInt(request.params.fwcloud)
        });

        (await FirewallPolicy.install(firewall, request.session.user)).authorize();

        const channel: Channel = await Channel.fromRequest(request);

        const customSSHConfig: Partial<SSHConfig> = {
            username: request.body.sshuser ? request.body.sshuser : undefined,
            password: request.body.sshpass ? request.body.sshpass : undefined
        }

        firewall = await this.firewallService.install(firewall, customSSHConfig, channel);

        channel.emit('message', new ProgressPayload('end', false, 'Installing firewall'));

        return ResponseBuilder.buildResponse().status(201).body(firewall);
    }

    @Validate()
    @ValidateQuery(FirewallControllerCompileRoutingRuleQueryDto)
    async compileRoutingRules(request: Request): Promise<ResponseBuilder> {
        let firewall: Firewall = await getRepository(Firewall).findOneOrFail({
            id: parseInt(request.params.firewall),
            fwCloudId: parseInt(request.params.fwcloud)
        });


        (await FirewallPolicy.compile(firewall, request.session.user)).authorize();

        let rules: RoutingRulesData<RoutingRuleItemForCompiler>[] = await this.routingRuleService.getRoutingRulesData('compiler', firewall.fwCloudId, firewall.id);
        if (Array.isArray(request.query.rules)) {
            rules = rules.filter(rules => (request.query.rules as string[]).includes(rules.id.toString()))
        }
        const compilation = new RoutingCompiler().compile('Rule', rules);

        return ResponseBuilder.buildResponse().status(200).body(compilation)
    }
}