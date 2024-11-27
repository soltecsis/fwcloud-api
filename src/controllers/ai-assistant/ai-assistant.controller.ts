import { Request, Response } from 'express';
import { Application } from '../../Application';
import { Controller } from '../../fonaments/http/controller';
import { ResponseBuilder } from '../../fonaments/http/response-builder';
import { Validate } from '../../decorators/validate.decorator';
import { AIassistantService } from '../../models/ai-assistant/ai-assistant.service';
import { AiAssistantDto } from './dto/ai-assistant.dto';

export class AIassistantController extends Controller {
  private _AIassistantService: AIassistantService;

  constructor(app: Application) {
    super(app);
    this._AIassistantService = new AIassistantService(app);
  }

  @Validate(AiAssistantDto)
  public async checkPolicyScript(req: Request, res: Response): Promise<ResponseBuilder> {
    try {
      const { prompt } = req.body;
      if (!prompt) {
        res.status(400).send({ error: 'Prompt text is required.' });
        return;
      }

      const policyScript = await this._AIassistantService.getPolicyScript(
        parseInt(req.params.fwcloud),
        parseInt(req.params.firewall),
      );

      const response = await this._AIassistantService.getResponse(prompt + '\n' + policyScript);

      console.log(response);
      return ResponseBuilder.buildResponse().status(200).body(response);
    } catch (error) {
      console.error('Error:', error);
      return error;
    }
  }

  @Validate(AiAssistantDto)
  public async getResponse(req: Request, res: Response): Promise<void> {
    try {
      const { prompt } = req.body;
      if (!prompt) {
        res.status(400).send({ error: 'Prompt text is required.' });
        return;
      }
      const response = await this._AIassistantService.getResponse(prompt);

      res.status(200).send({ response });
    } catch (error) {
      res.status(500).send({ error: 'Failed to fetch response from OpenAI.' });
    }
  }
}
