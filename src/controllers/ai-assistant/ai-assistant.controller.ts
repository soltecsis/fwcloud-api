import { Request, Response } from 'express';
import { Controller } from '../../fonaments/http/controller';
import { ResponseBuilder } from '../../fonaments/http/response-builder';
import { Validate } from '../../decorators/validate.decorator';
import { AIAssistantService } from '../../models/ai-assistant/ai-assistant.service';
import { AiAssistantDto } from './dto/ai-assistant.dto';
import { Firewall } from '../../models/firewall/Firewall';
import { FwCloud } from '../../models/fwcloud/FwCloud';
import db from '../../database/database-manager';
import { AiAssistantCredentialDto } from './dto/ai-assistant-credentials.dto';
import { PgpHelper } from '../../utils/pgp';
import { parse } from 'querystring';
import OpenAI from 'openai';
import { PolicyRuleService } from '../../policy-rule/policy-rule.service';
import { PolicyCompiler } from '../../compiler/policy/PolicyCompiler';
import { PolicyRule } from '../../models/policy/PolicyRule';

const utilsModel = require('../../utils/utils');

export class AIassistantController extends Controller {
  private _aiAssistantService: AIAssistantService;
  protected _firewall: Firewall;
  protected _fwCloud: FwCloud;
  protected _policyRuleService: PolicyRuleService;
  private openai: OpenAI;

  public async make(req: Request): Promise<void> {
    this._aiAssistantService = await this._app.getService<AIAssistantService>(
      AIAssistantService.name,
    );

    if (req.params.firewall) {
      this._firewall = await db
        .getSource()
        .manager.getRepository(Firewall)
        .findOneOrFail({ where: { id: parseInt(req.params.firewall) } });
    }
    if (req.params.fwcloud) {
      this._fwCloud = await db
        .getSource()
        .manager.getRepository(FwCloud)
        .findOneOrFail({ where: { id: parseInt(req.params.fwcloud) } });
    }
  }

  @Validate()
  public async getConfig(req: Request, res: Response): Promise<ResponseBuilder> {
    try {
      const config = await this._aiAssistantService.getAiCredentials();

      if (!config) {
        return ResponseBuilder.buildResponse()
          .status(404)
          .body({ error: 'No AI assistant configuration found.' });
      } else {
        const pgp = new PgpHelper({ public: req.session.uiPublicKey, private: '' });
        if (config[0].apiKey !== null) {
          config[0].apiKey = await pgp.encrypt(config[0].apiKey);
        }

        return ResponseBuilder.buildResponse().status(200).body(config);
      }
    } catch (error) {
      return ResponseBuilder.buildResponse()
        .status(500)
        .body({ error: 'Failed to fetch AI assistant configuration.' });
    }
  }

  @Validate(AiAssistantCredentialDto)
  public async updateConfig(req: Request, res: Response): Promise<ResponseBuilder> {
    try {
      const pgp = new PgpHelper(req.session.pgp);
      if (req.body.apiKey !== null) {
        req.body.apiKey = await pgp.decrypt(req.body.apiKey);
      }

      const config = await this._aiAssistantService.upateOrCreateAiCredentials(
        req.body.ai,
        req.body.model,
        req.body.apiKey !== null ? await utilsModel.encrypt(req.body.apiKey) : null,
      );
      return ResponseBuilder.buildResponse().status(200).body(config);
    } catch (error) {
      return ResponseBuilder.buildResponse()
        .status(500)
        .body({ error: 'Failed to update AI assistant configuration.' });
    }
  }

  @Validate()
  public async deleteConfig(req: Request, res: Response): Promise<ResponseBuilder> {
    try {
      const config = this._aiAssistantService.deleteAllAiCredentials();
      return ResponseBuilder.buildResponse().status(200);
    } catch (error) {
      return ResponseBuilder.buildResponse()
        .status(500)
        .body({ error: 'Failed to delete AI assistant configuration.' });
    }
  }

  @Validate(AiAssistantDto)
  /**
   * Creates a new question for the assistant from policy script.
   *
   * @param req - The request object.
   * @returns A Promise that resolves to a ResponseBuilder object.
   */
  public async checkPolicyScript(req: Request, res: Response): Promise<ResponseBuilder> {
    try {
      const { prompt } = req.body;
      if (!prompt) {
        res.status(400).send({ error: 'Prompt text is required.' });
        return;
      }

      const policyScript = await this._aiAssistantService.getPolicyScript(
        parseInt(req.params.fwcloud),
        parseInt(req.params.firewall),
      );
      const config = await this._aiAssistantService.getAiCredentials();

      // Configure OpenAI client with API key
      this.openai = new OpenAI({ apiKey: config[0].apiKey });
      const completion = await this.openai.chat.completions.create({
        model: config[0].model,
        messages: [
          {
            role: 'user',
            content: `${prompt}\n${policyScript}`, // Concatenate prompt to the policy script
          },
        ],
        max_tokens: 350,
        n: 1,
      });

      const scriptResponse = completion.choices[0].message.content.trim();
      const formattedResponse = this.insertLineBreaks(scriptResponse, 120); // Set character quantity for each line at openAI API response

      return ResponseBuilder.buildResponse().status(200).body(formattedResponse);
    } catch (error) {
      console.error('Error:', error);
      return error;
    }
  }

  @Validate(AiAssistantDto)
  /**
   * Creates a new question for the assistant from compiled rules.
   *
   * @param req - The request object.
   * @returns A Promise that resolves to a ResponseBuilder object.
   */
  public async checkCompiledRules(req: Request, res: Response): Promise<ResponseBuilder> {
    try {
      const { prompt } = req.body;
      if (!prompt) {
        res.status(400).send({ error: 'Prompt text is required.' });
        return;
      }
      // Proccess rulesIds that URL includes
      const queryString = req.url.split('?')[1]; // Take ruleIds after "?" character
      const queryParams = queryString ? parse(queryString) : {}; // Parse querystring
      //console.log('this.firewall', this._firewall);
      const options = this._firewall.options;

      // Proccessr `rules[]` from queryParams
      const rulesIds: number[] = queryParams['rules[]']
        ? Array.isArray(queryParams['rules[]'])
          ? (queryParams['rules[]'] as string[]).map((id) => parseInt(id, 10))
          : [parseInt(queryParams['rules[]'] as string, 10)]
        : [];
      if (!req.params.fwcloud || !req.params.firewall) {
        throw new Error('Firewall or FwCloud is not defined');
      }
      const rule_data = await PolicyRule.getPolicy_r(req.dbCon, req.params.firewall, rulesIds);
      const rulesArray = [rule_data];
      const rulesCompile = PolicyCompiler.compile('IPTables', rulesArray);
      const rulesCompileString = JSON.stringify(rulesCompile);
      console.log('rulesCompile', rulesCompile);

      const configAI = await this._aiAssistantService.getAiCredentials();

      // Configure OpenAI client with API key
      this.openai = new OpenAI({ apiKey: configAI[0].apiKey });
      /*const completion = await this.openai.chat.completions.create({
        model: configAI[0].model,
        messages: [
          {
            role: 'user',
            content: `${prompt}\n${rulesCompileString}`, // Concatenate prompt to the rule(s) compilation
          },
        ],
        max_tokens: 350,
        n: 1,
      });

      const scriptResponse = completion.choices[0].message.content.trim();
      const formattedResponse = this.insertLineBreaks(scriptResponse, 120); // Set character quantity for each line at openAI API response

      console.log(formattedResponse);*/
      return ResponseBuilder.buildResponse().status(200).body('response' /*{ formattedResponse }*/);
    } catch (error) {
      console.error('Error:', error);
      return error;
    }
  }

  public insertLineBreaks(text, maxLineLength) {
    let result = '';
    let lineLength = 0;

    for (const word of text.split(' ')) {
      if (lineLength + word.length + 1 > maxLineLength) {
        result += '\n';
        lineLength = 0;
      }
      result += (lineLength === 0 ? '' : ' ') + word;
      lineLength += word.length + 1;
    }

    return result;
  }
}
