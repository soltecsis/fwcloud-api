import { EntityManager, Repository } from 'typeorm';
import { AIAssistantService } from '../../../src/models/ai-assistant/ai-assistant.service';
import { Firewall } from '../../../src/models/firewall/Firewall';
import { FwCloud } from '../../../src/models/fwcloud/FwCloud';
import db from '../../../src/database/database-manager';
import { expect, testSuite } from '../../mocha/global-setup';
import StringHelper from '../../../src/utils/string.helper';
import sinon from 'sinon';
import { DatabaseService } from '../../../src/database/database.service';
import { AIAssistantRepository } from '../../../src/models/ai-assistant/ai-assistant.repository';
import { AIModel } from '../../../src/models/ai-assistant/ai-assistant-models.model';
import { AI } from '../../../src/models/ai-assistant/ai-assistant.model';
import { AICredentials } from '../../../src/models/ai-assistant/ai-assistant-credentials.model';
import { beforeEach } from 'mocha';

const utilsModel = require('../../../src/utils/utils');

describe(AIAssistantService.name, () => {
  let service: AIAssistantService;
  let fwCloud: FwCloud;
  let firewall: Firewall;
  let manager: EntityManager;

  beforeEach(async () => {
    manager = db.getSource().manager;
    await testSuite.resetDatabaseData();

    service = await testSuite.app.getService<AIAssistantService>(AIAssistantService.name);

    fwCloud = await manager.getRepository(FwCloud).save(
      manager.getRepository(FwCloud).create({
        name: StringHelper.randomize(10),
      }),
    );

    firewall = await manager.getRepository(Firewall).save(
      manager.getRepository(Firewall).create({
        name: StringHelper.randomize(10),
        fwCloudId: fwCloud.id,
      }),
    );
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('getAiCredentials', () => {
    let aiAssistantRepositoryStub: sinon.SinonStubbedInstance<AIAssistantRepository>;
    let databaseServiceStub: sinon.SinonStubbedInstance<DatabaseService>;
    let decryptStub: sinon.SinonStub;

    beforeEach(() => {
      aiAssistantRepositoryStub = sinon.createStubInstance(AIAssistantRepository);
      databaseServiceStub = sinon.createStubInstance(DatabaseService);
      decryptStub = sinon.stub(utilsModel, 'decrypt').callsFake((value) => {
        if (typeof value === 'string') {
          return `decrypted-${value}`;
        }
        if (typeof value === 'number') {
          return `decrypted-${value.toString()}`;
        }
        if (typeof value === 'object' && value !== null) {
          return `decrypted-${JSON.stringify(value)}`;
        }
      });

      (service as any)._aiAssistantRepository = aiAssistantRepositoryStub;
      (service as any)._databaseService = databaseServiceStub;
    });

    it('should return an empty array if no credentials are found', async () => {
      aiAssistantRepositoryStub.find.resolves([]);

      const result = await service.getAiCredentials();

      expect(result).to.deep.equal([]);
      expect(
        aiAssistantRepositoryStub.find.calledOnceWithExactly({
          relations: ['model', 'model.ai'],
        }),
      ).to.be.true;
    });

    it('should return a list of credentials mapped to the AI model', async () => {
      aiAssistantRepositoryStub.find.resolves([
        {
          id: 1,
          aiModelId: 1,
          apiKey: 'mockApiKey',
          model: {
            id: 1,
            aiId: 1,
            name: 'mockModel',
            ai: {
              id: 1,
              name: 'mockAI',
              models: [],
            },
            credentials: [],
          },
        },
      ]);

      const result = await service.getAiCredentials();

      expect(result).to.deep.equal([
        {
          apiKey: 'decrypted-mockApiKey',
          model: 'mockModel',
          ai: 'mockAI',
        },
      ]);

      expect(
        aiAssistantRepositoryStub.find.calledOnceWithExactly({
          relations: ['model', 'model.ai'],
        }),
      ).to.be.true;
      expect(decryptStub.calledOnceWithExactly('mockApiKey')).to.be.true;
    });

    it('should throw an error if the database query fails', async () => {
      sinon.stub(console, 'error');
      aiAssistantRepositoryStub.find.rejects(new Error('mockError'));

      await expect(service.getAiCredentials()).to.be.rejectedWith(
        'Failed to fetch AI assistant configuration.',
      );
      expect(
        aiAssistantRepositoryStub.find.calledOnceWithExactly({
          relations: ['model', 'model.ai'],
        }),
      ).to.be.true;
    });
  });

  describe('updateOrCreateAiCredentials', () => {
    let aiRepositoryStub: sinon.SinonStubbedInstance<Repository<AI>>;
    let aiModelRepositoryStub: sinon.SinonStubbedInstance<Repository<AIModel>>;
    let aiAssistantRepositoryStub: sinon.SinonStubbedInstance<AIAssistantRepository>;

    const mockAI: AI = { id: 1, name: 'mockAI' } as AI;
    const mockModel: AIModel = { id: 1, aiId: 1, name: 'mockModel', ai: mockAI } as AIModel;

    beforeEach(() => {
      aiRepositoryStub = sinon.createStubInstance(Repository) as sinon.SinonStubbedInstance<
        Repository<AI>
      >;
      aiModelRepositoryStub = sinon.createStubInstance(Repository) as sinon.SinonStubbedInstance<
        Repository<AIModel>
      >;
      aiAssistantRepositoryStub = sinon.createStubInstance(AIAssistantRepository);

      (service as any)._aiRepository = aiRepositoryStub;
      (service as any)._aiModelRepository = aiModelRepositoryStub;
      (service as any)._aiAssistantRepository = aiAssistantRepositoryStub;

      sinon.stub(console, 'error');
    });

    afterEach(() => {
      sinon.restore();
    });

    it('should throw an error if the AI is not found', async () => {
      aiRepositoryStub.findOne.resolves(null);

      await expect(
        service.updateOrCreateAiCredentials('invalidAI', 'mockModel', 'mockApiKey'),
      ).to.be.rejectedWith('Failed to update or create AI assistant credentials');

      expect(aiRepositoryStub.findOne.calledOnceWithExactly({ where: { name: 'invalidAI' } })).to.be
        .true;
    });

    it('should throw an error if model is not found', async () => {
      aiRepositoryStub.findOne.resolves(mockAI);
      aiModelRepositoryStub.findOne.resolves(null);

      await expect(
        service.updateOrCreateAiCredentials('mockAI', 'invalidModel', 'mockApiKey'),
      ).to.be.rejectedWith('Failed to update or create AI assistant credentials');
    });

    it('should upate the credentials if they already exist', async () => {
      const existingCredential = {
        id: 1,
        apiKey: 'oldApiKey',
        aiModelId: mockModel.id,
        model: mockModel,
      } as AICredentials;

      aiRepositoryStub.findOne.resolves(mockAI);
      aiModelRepositoryStub.findOne.resolves(mockModel);
      aiAssistantRepositoryStub.findOne.resolves(existingCredential);

      const result = await service.updateOrCreateAiCredentials('mockAI', 'mockModel', 'newApiKey');

      expect(aiAssistantRepositoryStub.findOne.calledOnce).to.be.true;
      expect(
        aiAssistantRepositoryStub.save.calledOnceWithExactly({
          ...existingCredential,
          apiKey: 'newApiKey',
          model: mockModel,
        }),
      ).to.be.true;

      expect(result).to.deep.equal({
        apiKey: 'newApiKey',
        model: 'mockModel',
        ai: 'mockAI',
      });
    });

    it('should create new credentials if they do not exist', async () => {
      const newCredential: AICredentials = {
        id: 1,
        apiKey: 'newApiKey',
        aiModelId: mockModel.id,
        model: mockModel,
      };
      aiRepositoryStub.findOne.resolves(mockAI); // Encuentra la AI
      aiModelRepositoryStub.findOne.resolves(mockModel); // Encuentra el modelo
      aiAssistantRepositoryStub.findOne.resolves(null); // No encuentra credenciales existentes
      aiAssistantRepositoryStub.create.returns(newCredential); // Mock de creación

      const result = await service.updateOrCreateAiCredentials('mockAI', 'mockModel', 'newApiKey');

      expect(result).to.deep.equal({
        apiKey: 'newApiKey',
        model: 'mockModel',
        ai: 'mockAI',
      });
    });

    it('should throw an error if something fails', async () => {
      aiRepositoryStub.findOne.rejects(new Error('Database error')); // Simula un fallo en la consulta

      await expect(
        service.updateOrCreateAiCredentials('mockAI', 'mockModel', 'mockApiKey'),
      ).to.be.rejectedWith('Failed to update or create AI assistant credentials.');

      expect(aiRepositoryStub.findOne.calledOnceWithExactly({ where: { name: 'mockAI' } })).to.be
        .true;
    });
  });

  describe('deleteAllAiCredentials', () => {
    let aiAssistantRepositoryStub: sinon.SinonStubbedInstance<AIAssistantRepository>;
    let consoleErrorStub: sinon.SinonStub;

    beforeEach(() => {
      aiAssistantRepositoryStub = sinon.createStubInstance(AIAssistantRepository);
      (service as any)._aiAssistantRepository = aiAssistantRepositoryStub;
      consoleErrorStub = sinon.stub(console, 'error');
    });

    it('should delete all AI credentials successfully', async () => {
      aiAssistantRepositoryStub.clear.resolves();

      const result = await service.deleteAllAiCredentials();

      expect(result).to.equal('All AI credentials successfully deleted.');
      expect(aiAssistantRepositoryStub.clear.calledOnce).to.be.true;
    });

    it('should throw an error if clear fails', async () => {
      aiAssistantRepositoryStub.clear.rejects(new Error('Database error'));

      await expect(service.deleteAllAiCredentials()).to.be.rejectedWith(
        'Failed to delete all AI assistant credentials.',
      );

      expect(aiAssistantRepositoryStub.clear.calledOnce).to.be.true;
    });

    it('should log an error if clear fails', async () => {
      const error = new Error('Database error');
      aiAssistantRepositoryStub.clear.rejects(error);

      await expect(service.deleteAllAiCredentials()).to.be.rejectedWith(
        'Failed to delete all AI assistant credentials.',
      );

      expect(
        consoleErrorStub.calledOnceWithExactly(
          'Error deleting all AI assistant credentials:',
          error,
        ),
      ).to.be.true;
    });
  });
});
