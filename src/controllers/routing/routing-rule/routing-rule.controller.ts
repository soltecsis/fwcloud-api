import { Controller } from "../../../fonaments/http/controller";
import { Firewall } from "../../../models/firewall/Firewall";
import { Request } from "express";
import { ResponseBuilder } from "../../../fonaments/http/response-builder";
import { Validate } from "../../../decorators/validate.decorator";
import { RoutingRuleService } from "../../../models/routing/routing-rule/routing-rule.service";
import { FwCloud } from "../../../models/fwcloud/FwCloud";
import { RoutingRulePolicy } from "../../../policies/routing-rule.policy";
import { RoutingRule } from "../../../models/routing/routing-rule/routing-rule.model";
import { RoutingRuleControllerCreateDto } from "./dtos/create.dto";
import { RoutingRuleControllerUpdateDto } from "./dtos/update.dto";

export class RoutingRuleController extends Controller {
    
    protected routingRuleService: RoutingRuleService;
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
        
        const tables: RoutingRule[] = await this.routingRuleService.find({
            join: {
                alias: "rule",
                innerJoin: {
                    routingTable: "rule.routingTable",
                    firewall: "routingTable.firewall",
                }
            },
            where: qb => {
                qb.where('firewall.id = :firewallId AND firewall.fwCloudId = :fwcloudId', {firewallId: this._firewall.id, fwcloudId: this._fwCloud.id})
            }
        });

        return ResponseBuilder.buildResponse().status(200).body(tables); 
    }

    @Validate()
    async show(request: Request): Promise<ResponseBuilder> {
        const rule: RoutingRule = await this.routingRuleService.findOneWithinFwCloudOrFail({
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

        const rule: RoutingRule = await this.routingRuleService.create({
            routingTableId: parseInt(request.inputs.get('routingTableId')),
            active: request.inputs.get('active'),
            comment: request.inputs.get('comment') 
        });

        return ResponseBuilder.buildResponse().status(201).body(rule);
    }

    @Validate(RoutingRuleControllerUpdateDto)
    async update(request: Request): Promise<ResponseBuilder> {
        const rule: RoutingRule = await this.routingRuleService.findOneWithinFwCloudOrFail({
            fwCloudId: this._fwCloud.id,
            firewallId: this._firewall.id,
            id: parseInt(request.params.rule)
        });
        
        (await RoutingRulePolicy.update(rule, request.session.user)).authorize();

        const result: RoutingRule = await this.routingRuleService.update({
            fwCloudId: this._fwCloud.id,
            firewallId: this._firewall.id,
            id: parseInt(request.params.rule)
        }, request.inputs.all());

        return ResponseBuilder.buildResponse().status(200).body(result);
    }
    
    @Validate()
    async remove(request: Request): Promise<ResponseBuilder> {
        const rule: RoutingRule = await this.routingRuleService.findOneWithinFwCloudOrFail({
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