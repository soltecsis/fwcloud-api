import { Application } from "../../Application";
import { Service } from "../../fonaments/services/service";
import { PolicyRuleService } from "../../policy-rule/policy-rule.service";
import { Firewall } from "../firewall/Firewall";
import { FwCloud } from "../fwcloud/FwCloud";

export class AIassistantService extends Service {
    protected _PolicyRuleService: PolicyRuleService;
    protected _firewall: Firewall;
    protected _fwCloud: FwCloud;

    constructor(app: Application) {
        super(app);
        this._PolicyRuleService = new PolicyRuleService(app);

    }
    async getPolicyScript(fwcloud: number, firewallId: number) {
        if (!fwcloud || !firewallId) {
            throw new Error('Firewall or FwCloud is not defined');
        }      
        const policyScript = await this._PolicyRuleService.content(fwcloud, firewallId);
        return policyScript;
    }
}