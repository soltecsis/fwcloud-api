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
import { AICredentials } from './ai-assistant-credentials.model';

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

export class AIAssistantService extends Service {
  protected _aiAssistantRepository: AIAssistantRepository;
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

    return this;
  }

  public async getAiCredentials() {
    try {
      const credentials = await this._aiAssistantRepository.find({
        relations: ['model', 'model.ai'],
      });

      if (!credentials || credentials.length === 0) {
        throw new Error('No AI assistant configuration found.');
      }
      return credentials.map(
        (credential) =>
          new CredentialDto(credential.apiKey, credential.model.name, credential.model.ai.name),
      );
    } catch (error) {
      console.error('Error fetching AI assistant configuration:', error);
      throw new Error('Failed to fetch AI assistant configuration.');
    }
  }

  async upateOrCreateAiCredentials(aiName: string, modelName: string, apiKey: string) {}

  async deleteAiCredentials(credentials: AICredentials) {}

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
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: prompt },
        ],
      });
      console.log('Completion', completion.choices[0].message?.content);
      return completion.choices[0].message?.content || 'No response received.';
    } catch (error) {
      console.error('Error communicating with OpenAI API:', error);
      throw new Error('Failed to fetch response from OpenAI API.');
    }
  }
}
