import { Request } from 'express';
import { Application } from '../../Application';
import { Controller } from "../../fonaments/http/controller";
import { ResponseBuilder } from '../../fonaments/http/response-builder';

import { Validate } from "../../decorators/validate.decorator";
import { Firewall } from '../../models/firewall/Firewall';
import { FwCloud } from '../../models/fwcloud/FwCloud';
import { OpenAI } from 'openai';
import config from '../../config/config';
import { AIassistantService } from '../../models/ai-assistant/ai-assistant.service';


export class AIassistantController extends Controller {
  protected _firewall: Firewall;
  protected _fwCloud: FwCloud;
  private _AIassistantService: AIassistantService;
  private openaiApiKey: string;
  private openai: OpenAI;
 
  constructor(app: Application) {
    super(app);
    this._AIassistantService = new AIassistantService(app);

    this.openai = new OpenAI({
      apiKey: config.openai_assistant.openai.apiKey,
      organization: config.openai_assistant.openai.organization,
      });
  }

  // Function to set the OpenAI API key
  public setOpenaiApiKey(key: string) {
    this.openaiApiKey = key;
  }
  // Function to get the OpenAI API key
  public getOpenaiApiKey() {
    return this.openaiApiKey;
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
      const prompt = "Is there any security issue related to the firewall policy loaded by this script? I don't want that you analyze the script, I want that you analyze the firewall policy generated by the script.";     

      const policyScript = await this._AIassistantService.getPolicyScript(parseInt(request.params.fwcloud), parseInt(request.params.firewall));

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {                                                                                                                                                                                                                                                                                                                                                                                                                                           
            role: 'user',
            content:  prompt + '\n' + policyScript, // Add the script to the prompt,
          },       
        ],        
        max_tokens: 350,
        n: 1          
      });        
      const scriptResponse = completion.choices[0].message.content.trim();
      const formattedResponse = this.insertLineBreaks(scriptResponse, 100); // Set character quantity for each line at openAI API response

      console.log(completion.choices[0].message.content.trim());
      return ResponseBuilder.buildResponse().status(200).body({ formattedResponse });
    } catch (error) {
      console.error('Error:', error)
      return error;
    }
  }
  
 /* @Validate()
  public async chat(req: Request): Promise<ResponseBuilder> {
    const { message } = req.body;
   
    try {
      console.log('Received message:', message);
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'user',
            content: message,
          },       
        ]       
      });     

      const response = completion.choices[0].message.content.trim();

      console.log("ChatGPT response:", response);
      return ResponseBuilder.buildResponse().status(200).body({ response });

    } catch (error) {
      //console.error('Error:', error);
      console.error('Error status:', error.response?.status);
      console.error('Error data:', error.response?.data);
      console.error('Error headers:', error.response?.headers);
      console.error('Error message:', error.message);
      return ResponseBuilder.buildResponse().status(500).body({ error: `Internal server error: ${error.response.data.message}` });
    }
  }*/
}