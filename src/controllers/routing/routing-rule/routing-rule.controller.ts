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
import { Validate, ValidateQuery } from "../../../decorators/validate.decorator";
import { ICreateRoutingRule, RoutingRulesData, RoutingRuleService } from "../../../models/routing/routing-rule/routing-rule.service";
import { FwCloud } from "../../../models/fwcloud/FwCloud";
import { RoutingRulePolicy } from "../../../policies/routing-rule.policy";
import { RoutingRule } from "../../../models/routing/routing-rule/routing-rule.model";
import { RoutingRuleControllerCreateDto } from "./dtos/create.dto";
import { RoutingRuleControllerUpdateDto } from "./dtos/update.dto";
import { RoutingTableService } from "../../../models/routing/routing-table/routing-table.service";
import { RoutingRuleItemForCompiler } from "../../../models/routing/shared";
import { RoutingCompiler } from "../../../compiler/routing/RoutingCompiler";
import { getRepository, In, SelectQueryBuilder } from "typeorm";
import { RoutingRuleControllerMoveDto } from "./dtos/move.dto";
import { HttpException } from "../../../fonaments/exceptions/http/http-exception";
import { RoutingRuleControllerBulkUpdateDto } from "./dtos/bulk-update.dto";
import { RoutingRuleControllerBulkRemoveQueryDto } from "./dtos/bulk-remove.dto";
import { RoutingRuleControllerCopyDto } from "./dtos/copy.dto";
import { Offset } from "../../../offset";

export class RoutingRuleController extends Controller {
    
    protected routingRuleService: RoutingRuleService;
    protected routingTableService: RoutingTableService;
    
    protected _firewall: Firewall;
    protected _fwCloud: FwCloud;
    protected _routingRule: RoutingRule;


    public async make(request: Request): Promise<void> {
        this.routingRuleService = await this._app.getService<RoutingRuleService>(RoutingRuleService.name);
        
        if (request.params.routingRule) {
            this._routingRule = await getRepository(RoutingRule).findOneOrFail(parseInt(request.params.routingRule));
        }

        //Get the firewall from the URL which contains the route group 
        const firewallQueryBuilder = getRepository(Firewall).createQueryBuilder('firewall').where('firewall.id = :id', {id: parseInt(request.params.firewall)});
        if (request.params.routingRule) {
            firewallQueryBuilder
            .innerJoin('firewall.routingTables', 'table')
            .innerJoin('table.routingRules', 'rule', 'rule.id = :ruleId', {ruleId: parseInt(request.params.routingRule)})
        }
        this._firewall = await firewallQueryBuilder.getOneOrFail();

        //Get the fwcloud from the URL which contains the firewall
        this._fwCloud = await getRepository(FwCloud).createQueryBuilder('fwcloud')
            .innerJoin('fwcloud.firewalls', 'firewall', 'firewall.id = :firewallId', {firewallId: this._firewall.id})
            .where('fwcloud.id = :id', {id: parseInt(request.params.fwcloud)}).getOneOrFail();
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
    async grid(request: Request): Promise<ResponseBuilder> {
        (await RoutingRulePolicy.index(this._firewall, request.session.user)).authorize();
        
        const grid = await this.routingRuleService.getRoutingRulesData('grid', this._firewall.fwCloudId, this._firewall.id);


        return ResponseBuilder.buildResponse().status(200).body(grid);
    }

    @Validate()
    async show(request: Request): Promise<ResponseBuilder> {
        (await RoutingRulePolicy.show(this._routingRule, request.session.user)).authorize();

        return ResponseBuilder.buildResponse().status(200).body(this._routingRule);
    }

    @Validate(RoutingRuleControllerCreateDto)
    async create(request: Request): Promise<ResponseBuilder> {

        (await RoutingRulePolicy.create(this._firewall, request.session.user)).authorize();

        const rule: RoutingRule = await this.routingRuleService.create(request.inputs.all<ICreateRoutingRule>());

        return ResponseBuilder.buildResponse().status(201).body(rule);
    }

    @Validate(RoutingRuleControllerCopyDto)
    async copy(request: Request): Promise<ResponseBuilder> {

        const rules: RoutingRule[] = [];

        const ids: string[] = request.inputs.get('rules');
        
        for(let id of ids) {
            const rule: RoutingRule = await this.routingRuleService.findOneInPathOrFail({
                fwCloudId: this._fwCloud.id,
                firewallId: this._firewall.id,
                id: parseInt(id)
            });

            (await RoutingRulePolicy.delete(rule, request.session.user)).authorize();    
        
            rules.push(rule);
        }

        const created: RoutingRule[] = await this.routingRuleService.copy(rules.map(item => item.id), request.inputs.get('to'), request.inputs.get<Offset>('offset'))

        return ResponseBuilder.buildResponse().status(201).body(created);
    }

    @Validate(RoutingRuleControllerUpdateDto)
    async update(request: Request): Promise<ResponseBuilder> {
        (await RoutingRulePolicy.update(this._routingRule, request.session.user)).authorize();

        const result: RoutingRule = await this.routingRuleService.update(this._routingRule.id, request.inputs.all());

        return ResponseBuilder.buildResponse().status(200).body(result);
    }

    @Validate(RoutingRuleControllerBulkUpdateDto)
    async bulkUpdate(request: Request): Promise<ResponseBuilder> {
        const rules: RoutingRule[] = [];

        const ids: string[] = request.query.rules as string[] || [];
        
        for(let id of ids) {
            const rule: RoutingRule = await this.routingRuleService.findOneInPathOrFail({
                fwCloudId: this._fwCloud.id,
                firewallId: this._firewall.id,
                id: parseInt(id)
            });

            (await RoutingRulePolicy.delete(rule, request.session.user)).authorize();    
        
            rules.push(rule);
        }

        if (rules.length === 0) {
            throw new HttpException(`Missing rules ids to be removed`, 400);
        }

        const result: RoutingRule[] = await this.routingRuleService.bulkUpdate(rules.map(item => item.id), request.inputs.all());

        return ResponseBuilder.buildResponse().status(200).body(result);
    }

    @Validate(RoutingRuleControllerMoveDto)
    async move(request: Request): Promise<ResponseBuilder> {
        (await RoutingRulePolicy.index(this._firewall, request.session.user)).authorize();
        
        const rules: RoutingRule[] = await getRepository(RoutingRule).find({
            join: {
                alias: 'rule',
                innerJoin: {
                    table: 'rule.routingTable',
                    firewall: 'table.firewall',
                    fwcloud: 'firewall.fwCloud'
                }
            },
            where: (qb: SelectQueryBuilder<RoutingRule>) => {
                qb.whereInIds(request.inputs.get('rules'))
                    .andWhere('firewall.id = :firewall', {firewall: this._firewall.id})
                    .andWhere('firewall.fwCloudId = :fwcloud', {fwcloud: this._fwCloud.id})
            }
        });

        const result: RoutingRule[] = await this.routingRuleService.move(rules.map(item => item.id), request.inputs.get('to'), request.inputs.get<Offset>('offset'));

        return ResponseBuilder.buildResponse().status(200).body(result);
    }

    @Validate()
    async compile(request: Request): Promise<ResponseBuilder> {
        (await RoutingRulePolicy.show(this._routingRule, request.session.user)).authorize();

        const rules: RoutingRulesData<RoutingRuleItemForCompiler>[] = await this.routingRuleService.getRoutingRulesData<RoutingRuleItemForCompiler>('compiler', this._fwCloud.id, this._firewall.id, [this._routingRule.id]);

        const compilation = new RoutingCompiler().compile('Rule', rules);
        
        return ResponseBuilder.buildResponse().status(200).body(compilation);
    }
    
    @Validate()
    async remove(request: Request): Promise<ResponseBuilder> {
        (await RoutingRulePolicy.delete(this._routingRule, request.session.user)).authorize();

        await this.routingRuleService.remove({
            fwCloudId: this._fwCloud.id,
            firewallId: this._firewall.id,
            id: parseInt(request.params.rule)
        });
        return ResponseBuilder.buildResponse().status(200).body(this._routingRule);
    }

    @Validate()
    @ValidateQuery(RoutingRuleControllerBulkRemoveQueryDto)
    async bulkRemove(request: Request): Promise<ResponseBuilder> {
        const rules: RoutingRule[] = [];

        const ids: string[] = request.query.rules as string[] || [];
        
        for(let id of ids) {
            const rule: RoutingRule = await this.routingRuleService.findOneInPathOrFail({
                fwCloudId: this._fwCloud.id,
                firewallId: this._firewall.id,
                id: parseInt(id)
            });

            (await RoutingRulePolicy.delete(rule, request.session.user)).authorize();    
        
            rules.push(rule);
        }

        if (rules.length === 0) {
            throw new HttpException(`Missing routes ids to be removed`, 400);
        }

        const returned: RoutingRule[] = await this.routingRuleService.bulkRemove(rules.map(item => item.id));

        return ResponseBuilder.buildResponse().status(200).body(returned);

    }
}