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
import { PolicyCompiler } from '../../compiler/policy/PolicyCompiler';
import { PolicyRule } from '../../models/policy/PolicyRule';

const utilsModel = require('../../utils/utils');

export class AIassistantController extends Controller {
  private _aiAssistantService: AIAssistantService;
  protected _firewall: Firewall;
  protected _fwCloud: FwCloud;

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

      const config = await this._aiAssistantService.updateOrCreateAiCredentials(
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
      await this._aiAssistantService.deleteAllAiCredentials();
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

      const response = await this._aiAssistantService.getResponse(
        config[0].apiKey,
        config[0].model,
        prompt + '\n' + policyScript,
      );

      return ResponseBuilder.buildResponse().status(200).body(response);
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
      const queryParams = queryString ? parse(queryString) : {}; // x querystring

      const options = this._firewall.options;

      // Proccess `rules[]` from queryParams
      const rulesIds: number[] = queryParams['rules[]']
        ? Array.isArray(queryParams['rules[]'])
          ? (queryParams['rules[]'] as string[]).map((id) => parseInt(id, 10))
          : [parseInt(queryParams['rules[]'] as string, 10)]
        : [];
      if (!req.params.fwcloud || !req.params.firewall) {
        throw new Error('Firewall or FwCloud is not defined');
      }

      const rules_data = await PolicyRule.getPolicyData(
        'compiler',
        req.dbCon,
        Number(req.params.fwcloud),
        Number(req.params.firewall),
        1,
        rulesIds,
        null,
      );

      const rulesCompile = await PolicyCompiler.compile(
        options == 4099 ? 'NFTables' : 'IPTables',
        rules_data,
      );
      const rulesCompileString = JSON.stringify(rulesCompile);

      const configAI = await this._aiAssistantService.getAiCredentials();

      const response = await this._aiAssistantService.getResponse(
        configAI[0].apiKey,
        configAI[0].model,
        prompt + '\n' + rulesCompileString,
      );

      return ResponseBuilder.buildResponse().status(200).body(response);
    } catch (error) {
      console.error('Error:', error);
      return error;
    }
  }
}
