import { Application } from '../../Application';
import { Service } from '../../fonaments/services/service';
import { PolicyRuleService } from '../../policy-rule/policy-rule.service';
import db from '../../database/database-manager';
import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

//TODO: REVISAR
@Entity()
export class OpenAI {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  apikey: string;
}

export class AIassistantService extends Service {
  protected _PolicyRuleService: PolicyRuleService;

  constructor(app: Application) {
    super(app);
    this._PolicyRuleService = new PolicyRuleService(app);
  }
  /* async getPolicyScript(fwcloud: number, firewallId: number) {
    if (!fwcloud || !firewallId) {
      throw new Error('Firewall or FwCloud is not defined');
    }
    return await this._PolicyRuleService.content(fwcloud, firewallId);
  }
  async getCompiledRules(fwcloud: number, firewallId: number, rulesIds: number[]) {
    if (!fwcloud || !firewallId) {
      throw new Error('Firewall or FwCloud is not defined');
    }
    return await this._PolicyRuleService.content(fwcloud, firewallId);
  }*/

  public static async UpdateOpenAiApiKey(apikey: string) {
    const openaiApiKey = {
      apikey: apikey,
    };
    await db.getSource().getRepository(OpenAI).insert({ apikey: apikey });
    return apikey;
  }

  public static async GetOpenAiApiKey(apiKey: number) {
    const pet = await db
      .getSource()
      .getRepository(OpenAI)
      .createQueryBuilder('apikey')
      .select()
      .where('openai.apikey = :id', { apikey: apiKey })
      .getOne();

    return pet ?? undefined;
  }

  public static async DeleteOpenAiApiKey(apikey: number) {
    await db
      .getSource()
      .getRepository(OpenAI)
      .createQueryBuilder('apikey')
      .delete()
      .from('apikey')
      .where('openai.apikey = :id', { apikey: apikey })
      .execute();
  }
}
