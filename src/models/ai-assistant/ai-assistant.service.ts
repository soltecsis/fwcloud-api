import { Application } from '../../Application';
import { Service } from '../../fonaments/services/service';
import { PolicyRuleService } from '../../policy-rule/policy-rule.service';
import { Firewall } from '../firewall/Firewall';
import { FwCloud } from '../fwcloud/FwCloud';
import OpenAI from 'openai';

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

  async getResponse(prompt: string): Promise<string> {
    try {
      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
      const completion = await openai.chat.completions.create({
        model: 'o1-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 350,
      });
      console.log('Completion', completion);
      return completion.choices[0].message?.content || 'No response received.';
    } catch (error) {
      console.error('Error communicating with OpenAI API:', error);
      throw new Error('Failed to fetch response from OpenAI API.');
    }
  }
}
