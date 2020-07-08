import { describeName, testSuite, expect } from "../../../mocha/global-setup";
import request = require("supertest");
import { _URL } from "../../../../src/fonaments/http/router/router.service";
import { FwCloud } from "../../../../src/models/fwcloud/FwCloud";
import StringHelper from "../../../../src/utils/string.helper";
import { getRepository } from "typeorm";
import { User } from "../../../../src/models/user/User";
import { createUser, generateSession, attachSession, sleep } from "../../../utils/utils";
import { Application } from "../../../../src/Application";
import fwc_tree_node = require("../../../../src/models/tree/node");

describe.only(describeName('FwCloud Management E2E Tests'), () => {
    let app: Application;
    let fwCloud: FwCloud;
    let adminUser: User;
    let adminUserSessionId: string;
    let regularUser: User;
    let regularUserSessionId: string;

    const fwcloudCreationSchema = {
        title: 'fwcloud management schema',
        type: 'object',
        required: ['insertId'],
        properties: {
          insertId: { type: 'number', minimum: 1 }
        }
    };

    const fwcloudDataSchema = {
        title: 'fwcloud management schema',
        type: 'object',
        required: ['id','name','image','comment','created_at','updated_at','created_by','updated_by','locked_at','locked_by','locked'],
        properties: {
          id: { type: 'number', minimum: 1 },
          name: { type: 'string' },
          image: { type: 'string' },
          comment: { type: 'string' },
          created_at: { type: 'string' },
          updated_at: { type: 'string' },
          created_by: { type: 'number' },
          updated_by: { type: 'number' },
          locked_at: { type: ['number','null'] },
          locked_by: { type: ['number','null'] },
          locked: { type: 'number' }
        }
    };

    const fwcData = {
        name: "TEST FWCloud", 
        image: "", 
        comment: "This is a little comment."
    };

    before(async () => {
        app = testSuite.app;
        regularUser = await createUser({role: 0});
        adminUser = await createUser({role: 1});
    });

    beforeEach(async() => {
        regularUserSessionId = generateSession(regularUser);
        adminUserSessionId = generateSession(adminUser);
    });

    describe('FwCloudManagement',() => {
        describe('FwCloudManagement@create',() => {
            
            it('admin user should create a fwcloud', async () => {
                return await request(app.express)
                    .post('/fwcloud')
                    .send(fwcData)
                    .set('Cookie', [attachSession(adminUserSessionId)])
                    .expect('Content-Type', /json/)
                    .expect(200)
                    .then(response => {
                        expect(response.body).to.be.jsonSchema(fwcloudCreationSchema); 
                        expect(response.body).to.have.property("insertId").which.is.a('number').above(0).and.satisfy(Number.isInteger);
                        fwCloud = response.body.insertId;
                    });
            });

            it('regular user should not be able to create a fwcloud', async () => {
                return await request(app.express)
                    .post('/fwcloud')
                    .send(fwcData)
                    .set('Cookie', [attachSession(regularUserSessionId)])
                    .expect(400, {fwcErr: 1008, msg: "You are not an admin user"});
            });

            it('get single fwcloud data', async () => {
                return await request(app.express)
                    .put('/fwcloud/get')
                    .send({ fwcloud: fwCloud })
                    .set('Cookie', [attachSession(adminUserSessionId)])
                    .expect(200)
                    .then(response => {
                        //console.log(response.body);
                        expect(response.body).to.be.jsonSchema(fwcloudDataSchema); 
                        expect(response.body).to.have.property("name").which.is.equal(fwcData.name);
                        expect(response.body).to.have.property("image").which.is.equal(fwcData.image);
                        expect(response.body).to.have.property("comment").which.is.equal(fwcData.comment);
                    });
            });

            it('get all fwclouds data', async () => {
                return await request(app.express)
                    .get('/fwcloud/all/get')
                    .set('Cookie', [attachSession(adminUserSessionId)])
                    .expect(200)
                    .then(response => {
                        //console.log(response.body);
                        expect(response.body).to.be.an('array').not.to.be.empty; 
                        for (let item of response.body)
                            expect(response.body).to.be.jsonSchema(item); 

                        expect(response.body[0]).to.have.property("name").which.is.equal(fwcData.name);
                        expect(response.body[0]).to.have.property("image").which.is.equal(fwcData.image);
                        expect(response.body[0]).to.have.property("comment").which.is.equal(fwcData.comment);
                    });

        });
    });
});