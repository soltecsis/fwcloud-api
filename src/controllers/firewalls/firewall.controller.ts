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
import { Firewall, FirewallInstallCommunication } from "../../models/firewall/Firewall";
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
import { FwCloud } from "../../models/fwcloud/FwCloud";
import { PingDto } from "./dtos/ping.dto";
import { InfoDto } from "./dtos/info.dto";
import { Communication, FwcAgentInfo } from "../../communications/communication";
import { SSHCommunication } from "../../communications/ssh.communication";
import { AgentCommunication } from "../../communications/agent.communication";
import { PgpHelper } from "../../utils/pgp";
import { PluginDto } from './dtos/plugin.dto';
import StringHelper from "../../utils/string.helper";

export class FirewallController extends Controller {
    
    protected firewallService: FirewallService;
    protected routingRuleService: RoutingRuleService;
    protected _fwCloud: FwCloud;

    public async make(request: Request): Promise<void> {
        //Get the fwcloud from the URL which contains the firewall
        this._fwCloud = await getRepository(FwCloud).createQueryBuilder('fwcloud')
            .where('fwcloud.id = :id', {id: parseInt(request.params.fwcloud)})
            .getOneOrFail();

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

        let rules: RoutingRulesData<RoutingRuleItemForCompiler>[] = await this.routingRuleService.getRoutingRulesData(
            'compiler',
            firewall.fwCloudId,
            firewall.id,
            request.query.rules ? (request.query.rules as string[]).map(item => parseInt(item)) : undefined
        );
        const compilation = new RoutingCompiler().compile('Rule', rules);

        return ResponseBuilder.buildResponse().status(200).body(compilation)
    }

    @Validate(PingDto)
    async pingCommunication(request: Request): Promise<ResponseBuilder> {
        const input: PingDto = request.body;

        (await FirewallPolicy.ping(this._fwCloud, request.session.user)).authorize();

        const pgp = new PgpHelper(request.session.pgp);

        try {
            let communication: Communication<unknown>;

            if (input.communication === FirewallInstallCommunication.SSH) {
                communication = new SSHCommunication({
                    host: input.host,
                    port: input.port,
                    username: await pgp.decrypt(input.username),
                    password: await pgp.decrypt(input.password),
                    options: null
                })
            } else {
                communication = new AgentCommunication({
                    host: input.host,
                    port: input.port,
                    protocol: input.protocol,
                    apikey: await pgp.decrypt(input.apikey)
                })
            }

            await communication.ping();

            return ResponseBuilder.buildResponse().status(200).body({
                status: 'OK'
            })
        } catch(error) {
            if (error.message === 'Method not implemented') {
                return ResponseBuilder.buildResponse().status(501);
            }

            throw error;
        }
    }

    @Validate(InfoDto)
    async infoCommunication(request: Request): Promise<ResponseBuilder> {
        const input: InfoDto = request.body;

        (await FirewallPolicy.info(this._fwCloud, request.session.user)).authorize();

        const pgp = new PgpHelper(request.session.pgp);

        try {
            let communication: Communication<unknown>;

            if (input.communication === FirewallInstallCommunication.SSH) {
                communication = new SSHCommunication({
                    host: input.host,
                    port: input.port,
                    username: await pgp.decrypt(input.username),
                    password: await pgp.decrypt(input.password),
                    options: null
                })
            } else {
                communication = new AgentCommunication({
                    host: input.host,
                    port: input.port,
                    protocol: input.protocol,
                    apikey: await pgp.decrypt(input.apikey)
                })
            }

            let info: FwcAgentInfo = await communication.info();

            return ResponseBuilder.buildResponse().status(200).body(info)
        } catch(error) {
            if (error.message === 'Method not implemented') {
                return ResponseBuilder.buildResponse().status(501);
            }

            throw error;
        }
    }

    @Validate(PluginDto)
    async installPlugin(req: Request): Promise<ResponseBuilder> {
        try{
            const channel = await Channel.fromRequest(req);
            const pgp = new PgpHelper(req.session.pgp);       
            const communication = new AgentCommunication({
                protocol: req.body.protocol,
                host: req.body.host,
                port: req.body.port,
                apikey: await pgp.decrypt(req.body.apikey)
            });
            
            const data = await communication.installPlugin(req.body.plugin,req.body.enable,channel);
            
            return ResponseBuilder.buildResponse().status(200).body(
                data
            )
        } catch (error) {
            if (error.message === 'Method not implemented') {
                return ResponseBuilder.buildResponse().status(501);
            }
            throw error;
        }
    }
}