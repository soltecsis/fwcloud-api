import { EntityManager, Repository } from 'typeorm';
import { AICredentials } from './ai-assistant-credentials.model';

export class AIAssistantRepository extends Repository<AICredentials> {
  constructor(manager?: EntityManager) {
    super(AICredentials, manager);
  }
}
