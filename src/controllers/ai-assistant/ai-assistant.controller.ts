import { Request } from 'express';
import { Controller } from '../../fonaments/http/controller';
import { ResponseBuilder } from '../../fonaments/http/response-builder';

import { Validate } from '../../decorators/validate.decorator';
import { OpenAI } from 'openai';
import config from '../../config/config';
import { PolicyRuleService } from '../../policy-rule/policy-rule.service';
import { AIassistantService } from '../../models/ai-assistant/ai-assistant.service';
import { parse } from 'querystring';

export class AIassistantController extends Controller {
  private _policyRuleService: PolicyRuleService;
  private openaiApiKey: string;
  private openai: OpenAI;

  //constructor(app: Application) {
  //super(app);
  async make(): Promise<void> {
    this._policyRuleService = await this._app.getService<PolicyRuleService>(PolicyRuleService.name);

    //this._AIassistantService = new AIassistantService(app);
    this.openai = new OpenAI({
      apiKey: config._instance.openai_assistant.openai.apiKey,
      organization: config._instance.openai_assistant.openai.organization,
    });
  }

  // Function to set the OpenAI API key
  @Validate()
  public async setOpenaiApiKey(key: string): Promise<ResponseBuilder> {
    //this.openaiApiKey = key;
    await AIassistantService.UpdateOpenAiApiKey(key);
    return ResponseBuilder.buildResponse().status(200);
  }

  // Function to get the OpenAI API key
  @Validate()
  public async getOpenaiApiKey(req: Request): Promise<ResponseBuilder> {
    try {
      const apiKey = await AIassistantService.GetOpenAiApiKey(+req.params.apiKey);

      return ResponseBuilder.buildResponse().status(200).body({
        apiKey: apiKey,
      });
    } catch (error) {
      console.error('Error obteniendo la API Key:', error);
      throw new Error('Error al obtener la clave API.');
    }
  }

  @Validate()
  public async deleteOpenAiApiKey(req: Request): Promise<ResponseBuilder> {
    try {
      await AIassistantService.GetOpenAiApiKey(+req.params.apiKey);

      return ResponseBuilder.buildResponse().status(204);
    } catch (error) {
      console.error('Error al eliminar la clave API:', error);
      throw new Error('Error al procesar la solicitud para eliminar la clave API.');
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

  @Validate(/*AIassistantDto*/)
  /**
   * Creates a new question for the assistant.
   *
   * @param req - The request object.
   * @returns A Promise that resolves to a ResponseBuilder object.
   */
  public async checkPolicyScript(request: Request): Promise<ResponseBuilder> {
    try {
      const prompt = request.body.message;

      // Llamar al servicio para obtener el contenido del script
      const policyScript = await this._policyRuleService.content(
        parseInt(request.params.fwcloud, 10),
        parseInt(request.params.firewall, 10),
      );

      // Crear la solicitud de completions usando OpenAI
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'user',
            content: `${prompt}\n${policyScript}`, // Construcción del mensaje
          },
        ],
        max_tokens: 350,
        n: 1,
      });

      const scriptResponse = completion.choices[0].message.content.trim();
      const formattedResponse = this.insertLineBreaks(scriptResponse, 100); // Set character quantity for each line at openAI API response

      console.log(completion.choices[0].message.content.trim());
      return ResponseBuilder.buildResponse().status(200).body({ formattedResponse });
    } catch (error) {
      console.error('Error:', error);
      return error;
    }
  }

  @Validate(/*AIassistantDto*/)
  /**
   * Creates a new question for the assistant.
   *
   * @param req - The request object.
   * @returns A Promise that resolves to a ResponseBuilder object.
   */
  public async checkCompiledRules(request: Request): Promise<ResponseBuilder> {
    try {
      console.log('entra');
      //const prompt = request.params.messages;
      const prompt = request.body.message; // Si viene en el body, cámbialo.
      // Procesar rulesIds que vienen en query string.
      const queryString = request.url.split('?')[1]; // Tomar la parte después de "?"
      const queryParams = queryString ? parse(queryString) : {}; // Parsear el querystring

      // Procesar `rules[]` del queryParams
      const rulesIds: number[] = queryParams['rules[]']
        ? Array.isArray(queryParams['rules[]'])
          ? (queryParams['rules[]'] as string[]).map((id) => parseInt(id, 10))
          : [parseInt(queryParams['rules[]'] as string, 10)]
        : [];

      if (!request.params.fwcloud || !request.params.firewallId) {
        throw new Error('Firewall or FwCloud is not defined');
      }
      const rulesToCheck = await this._policyRuleService.content(
        parseInt(request.params.fwcloud),
        parseInt(request.params.firewall),
      );
      rulesIds;
      console.log('request', request);
      console.log('rulesIds', rulesIds);
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'user',
            content: prompt + '\n' + rulesToCheck, // Add the script to the prompt,
          },
        ],
        max_tokens: 350,
        n: 1,
      });
      const scriptResponse = completion.choices[0].message.content.trim();
      const formattedResponse = this.insertLineBreaks(scriptResponse, 100); // Set character quantity for each line at openAI API response

      console.log(completion.choices[0].message.content.trim());
      return ResponseBuilder.buildResponse().status(200).body({ formattedResponse });
    } catch (error) {
      console.error('Error:', error);
      return error;
    }
  }
}
