/*!
    Copyright 2024 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
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
import { Application } from '../../Application';
import { Service } from '../../fonaments/services/service';
import { PolicyRuleService } from '../../policy-rule/policy-rule.service';
import OpenAI from 'openai';
import { AIAssistantRepository } from './ai-assistant.repository';
import { DatabaseService } from '../../database/database.service';
import { Repository } from 'typeorm';
import { AI } from './ai-assistant.model';
import { AIModel } from './ai-assistant-models.model';

class CredentialDto {
  apiKey: string;
  model: string;
  ai: string;

  constructor(apiKey: string, modelName: string, aiName: string) {
    this.apiKey = apiKey;
    this.model = modelName;
    this.ai = aiName;
  }
}

const utilsModel = require('../../utils/utils');

export class AIAssistantService extends Service {
  private _aiAssistantRepository: AIAssistantRepository;
  private _aiRepository: Repository<AI>;
  private _aiModelRepository: Repository<AIModel>;
  protected _PolicyRuleService: PolicyRuleService;
  protected _databaseService: DatabaseService;

  constructor(app: Application) {
    super(app);
    this._PolicyRuleService = new PolicyRuleService(app);
  }

  public async build(): Promise<Service> {
    this._databaseService = await this._app.getService<DatabaseService>(DatabaseService.name);
    this._aiAssistantRepository = new AIAssistantRepository(
      this._databaseService.dataSource.manager,
    );

    this._aiRepository = this._databaseService.dataSource.manager.getRepository(AI);
    this._aiModelRepository = this._databaseService.dataSource.manager.getRepository(AIModel);

    return this;
  }

  public async getAiCredentials() {
    try {
      const credentials = await this._aiAssistantRepository.find({
        relations: ['model', 'model.ai'],
      });

      if (!credentials || credentials.length === 0) {
        return [];
      }

      return Promise.all(
        credentials.map(async (credential) => {
          return new CredentialDto(
            utilsModel.decrypt(credential.apiKey),
            credential.model.name,
            credential.model.ai.name,
          );
        }),
      );
    } catch (error) {
      console.error('Error fetching AI assistant configuration:', error);
      throw new Error('Failed to fetch AI assistant configuration.');
    }
  }

  async updateOrCreateAiCredentials(
    aiName: string,
    modelName: string,
    apiKey: string,
  ): Promise<CredentialDto> {
    try {
      // Find the AI by its name.
      const ai = await this._aiRepository.findOne({ where: { name: aiName } });
      if (!ai) {
        throw new Error(`AI with name '${aiName}' not found.`);
      }

      // Find the model associated with the AI.
      const model = await this._aiModelRepository.findOne({
        where: { name: modelName, aiId: ai.id }, // Direct relationship with aiId.
        relations: ['ai'], // Include the relationship with AI.
      });
      if (!model) {
        throw new Error(`Model with name '${modelName}' for AI '${aiName}' not found.`);
      }

      // Search for the existing credentials for the model.
      let credential = await this._aiAssistantRepository.findOne({
        where: {},
      });

      if (credential) {
        // Update the API Key if it already exists.
        credential.apiKey = apiKey;
        credential.model = model;
      } else {
        // Create new credentials if they do not exist.
        credential = this._aiAssistantRepository.create({
          apiKey: apiKey,
          aiModelId: model.id,
          model,
        });
      }

      // Save the credentials in the database.
      await this._aiAssistantRepository.save(credential);
      // Return the DTO with the updated data.
      return new CredentialDto(credential.apiKey, model.name, ai.name);
    } catch (error) {
      console.error('Error updating or creating AI assistant credentials:', error);
      throw new Error('Failed to update or create AI assistant credentials.');
    }
  }

  async deleteAllAiCredentials(): Promise<string> {
    try {
      // Delete all entries from the `ai_credentials` table
      await this._aiAssistantRepository.clear();

      return 'All AI credentials successfully deleted.';
    } catch (error) {
      console.error('Error deleting all AI assistant credentials:', error);
      throw new Error('Failed to delete all AI assistant credentials.');
    }
  }

  async getPolicyScript(fwcloud: number, firewallId: number) {
    if (!fwcloud || !firewallId) {
      throw new Error('Firewall or FwCloud is not defined');
    }
    return await this._PolicyRuleService.content(fwcloud, firewallId);
  }

  async getResponse(apiKey: string, model: string, prompt: string): Promise<string> {
    try {
      const openai = new OpenAI({
        apiKey: apiKey,
      });
      const completion = await openai.chat.completions.create({
        model: model,
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: prompt },
        ],
      });

      return (
        this.insertLineBreaks(completion.choices[0].message?.content.trim(), 120) ||
        'No response received.'
      );
    } catch (error) {
      throw new Error(`Error communicating with OpenAI API: ${error}`);
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
