import { describeName, testSuite, expect } from "../../../mocha/global-setup";
import { IdManager } from "../../../../src/fwcloud-exporter/importer/terraformer/mapper/id-manager";
import { DatabaseService } from "../../../../src/database/database.service";
import { RepositoryService } from "../../../../src/database/repository.service";
import { FwCloud } from "../../../../src/models/fwcloud/FwCloud";

let databaseService: DatabaseService;
let repositoryService: RepositoryService;

describe(describeName('IdManager tests'), () => {
    beforeEach(async() => {
        databaseService = await testSuite.app.getService<DatabaseService>(DatabaseService.name);
        repositoryService = await testSuite.app.getService<RepositoryService>(RepositoryService.name);
    })
    describe('IdManager.make()', () => {
        it('Make should set the next id = 1 if the table is empty', async () => {
            const idManger: IdManager = await IdManager.make(databaseService.connection.createQueryRunner(), [{
                tableName: 'fwcloud',
                entityName: 'FwCloud'
            }]);

            expect(idManger["_ids"]).to.be.deep.equal({
                'fwcloud': {
                    id: 1
                }
            });
        });

        it('Make should set the next id = MAX()+1 if the table is not empty', async () => {
            await repositoryService.for(FwCloud).save({id: 100, name: 'test'});

            const idManger: IdManager = await IdManager.make(databaseService.connection.createQueryRunner(), [{
                tableName: 'fwcloud',
                entityName: 'FwCloud'
            }]);

            expect(idManger["_ids"]).to.be.deep.equal({
                'fwcloud': {
                    id: 101
                }
            });
        });

        it('Make should ignore tables without entityName', async () => {
            const idManger: IdManager = await IdManager.make(databaseService.connection.createQueryRunner(), [{
                tableName: 'fwcloud',
                entityName: null
            }]);

            expect(idManger["_ids"]).to.be.deep.equal({});
        });
    });

    describe('IdManager.getNewId()', () => {
        it('getNewId() should return the new id', async () => {
            await repositoryService.for(FwCloud).save({id: 100, name: 'test'});
    
            const idManger: IdManager = await IdManager.make(databaseService.connection.createQueryRunner(), [{
                tableName: 'fwcloud',
                entityName: 'FwCloud'
            }]);
    
            expect(idManger.getNewId('fwcloud', 'id')).to.be.deep.equal(101);
        });

        it('getNewId() should increment the id', async () => {
            await repositoryService.for(FwCloud).save({id: 100, name: 'test'});
    
            const idManger: IdManager = await IdManager.make(databaseService.connection.createQueryRunner(), [{
                tableName: 'fwcloud',
                entityName: 'FwCloud'
            }]);
    
            idManger.getNewId('fwcloud', 'id');

            expect(idManger["_ids"]).to.be.deep.equal({
                'fwcloud': {
                    id: 102
                }
            });
        });
    });
})