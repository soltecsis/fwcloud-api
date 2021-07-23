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
import { Firewall } from "../../../models/firewall/Firewall";
import { Request } from "express";
import { ResponseBuilder } from "../../../fonaments/http/response-builder";
import { Validate } from "../../../decorators/validate.decorator";
import { RoutingRulesData, RoutingRuleService } from "../../../models/routing/routing-rule/routing-rule.service";
import { FwCloud } from "../../../models/fwcloud/FwCloud";
import { RoutingRulePolicy } from "../../../policies/routing-rule.policy";
import { RoutingRule } from "../../../models/routing/routing-rule/routing-rule.model";
import { RoutingRuleControllerCreateDto } from "./dtos/create.dto";
import { RoutingRuleControllerUpdateDto } from "./dtos/update.dto";
import { RoutingTableService } from "../../../models/routing/routing-table/routing-table.service";
import { RoutingRuleItemForCompiler } from "../../../models/routing/shared";
import { RoutingCompiler } from "../../../compiler/routing/RoutingCompiler";

export class RoutingRuleController extends Controller {
    
    protected routingRuleService: RoutingRuleService;
    protected routingTableService: RoutingTableService;
    protected _firewall: Firewall;
    protected _fwCloud: FwCloud;

    public async make(request: Request): Promise<void> {
        this.routingRuleService = await this._app.getService<RoutingRuleService>(RoutingRuleService.name);
        this._fwCloud = await FwCloud.findOneOrFail(parseInt(request.params.fwcloud));
        this._firewall = await Firewall.findOneOrFail(parseInt(request.params.firewall));
    }

    @Validate()
    async index(request: Request): Promise<ResponseBuilder> {
        (await RoutingRulePolicy.index(this._firewall, request.session.user)).authorize();
        
        const tables: RoutingRule[] = await this.routingRuleService.findManyInPath({
            fwCloudId: this._fwCloud.id,
            firewallId: this._firewall.id
        });

        return ResponseBuilder.buildResponse().status(200).body(tables); 
    }

    @Validate()
    async show(request: Request): Promise<ResponseBuilder> {
        const rule: RoutingRule = await this.routingRuleService.findOneInPathOrFail({
            firewallId: this._firewall.id,
            fwCloudId: this._fwCloud.id,
            id: parseInt(request.params.rule)
        });

        (await RoutingRulePolicy.show(rule, request.session.user)).authorize();

        return ResponseBuilder.buildResponse().status(200).body(rule);
    }

    @Validate(RoutingRuleControllerCreateDto)
    async create(request: Request): Promise<ResponseBuilder> {

        (await RoutingRulePolicy.create(this._firewall, request.session.user)).authorize();

        const rule: RoutingRule = await this.routingRuleService.create(request.inputs.all());

        return ResponseBuilder.buildResponse().status(201).body(rule);
    }

    @Validate(RoutingRuleControllerUpdateDto)
    async update(request: Request): Promise<ResponseBuilder> {
        const rule: RoutingRule = await this.routingRuleService.findOneInPathOrFail({
            fwCloudId: this._fwCloud.id,
            firewallId: this._firewall.id,
            id: parseInt(request.params.rule)
        });
        
        (await RoutingRulePolicy.update(rule, request.session.user)).authorize();

        const result: RoutingRule = await this.routingRuleService.update(rule.id, request.inputs.all());

        return ResponseBuilder.buildResponse().status(200).body(result);
    }

    @Validate()
    async compile(request: Request): Promise<ResponseBuilder> {
        const rule: RoutingRule = await this.routingRuleService.findOneInPathOrFail({
            fwCloudId: this._fwCloud.id,
            firewallId: this._firewall.id,
            id: parseInt(request.params.rule)
        });

        (await RoutingRulePolicy.show(rule, request.session.user)).authorize();

        const rules: RoutingRulesData<RoutingRuleItemForCompiler>[] = await this.routingRuleService.getRoutingRulesData<RoutingRuleItemForCompiler>('compiler', this._fwCloud.id, this._firewall.id, rule.id);

        const compilation = new RoutingCompiler().compile('Rule', rules);
        
        return ResponseBuilder.buildResponse().status(200).body(compilation);
    }
    
    @Validate()
    async remove(request: Request): Promise<ResponseBuilder> {
        const rule: RoutingRule = await this.routingRuleService.findOneInPathOrFail({
            fwCloudId: this._fwCloud.id,
            firewallId: this._firewall.id,
            id: parseInt(request.params.rule)
        });
        
        (await RoutingRulePolicy.delete(rule, request.session.user)).authorize();

        await this.routingRuleService.remove({
            fwCloudId: this._fwCloud.id,
            firewallId: this._firewall.id,
            id: parseInt(request.params.rule)
        });
        return ResponseBuilder.buildResponse().status(200).body(rule);
    }
}