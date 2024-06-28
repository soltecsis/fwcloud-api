import { describeName, testSuite, expect } from "../../../mocha/global-setup";
import request = require("supertest");
import { _URL } from "../../../../src/fonaments/http/router/router.service";
import { User } from "../../../../src/models/user/User";
import { createUser, generateSession, attachSession, sleep } from "../../../utils/utils";
import { Application } from "../../../../src/Application";
import fwc_tree_node = require("../../../../src/models/tree/node");
import { FwCloud } from "../../../../src/models/fwcloud/FwCloud";
import { EntityManager } from "typeorm";
import StringHelper from "../../../../src/utils/string.helper";
import { FwCloudService } from "../../../../src/models/fwcloud/fwcloud.service";
import db from "../../../../src/database/database-manager";

describe(describeName('FwCloud Management E2E Tests'), () => {
	let app: Application;
	let fwCloud: FwCloud;
	let adminUser: User;
	let adminUserSessionId: string;
	let regularUser: User;
	let regularUserSessionId: string;
	let manager: EntityManager;

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

	let fwcData = {
		name: "TEST FWCloud", 
		image: "", 
		comment: "This is a little comment."
	};

	let fwcDataUpdate = {
		fwcloud: 0,
		name: "Modified TEST FWCloud", 
		image: "", 
		comment: "Modified - This is a little comment."
	};

	before(async () => {
		app = testSuite.app;
		manager = db.getSource().manager;
		regularUser = await createUser({role: 0});
		adminUser = await createUser({role: 1});
	});

	beforeEach(async() => {
		regularUserSessionId = generateSession(regularUser);
		adminUserSessionId = generateSession(adminUser);

		fwCloud = await (await app.getService<FwCloudService>(FwCloudService.name)).store(fwcData);
	});

	describe('FwCloudManagement',() => {
		describe('FwCloudManagement@show',() => {
			it('guest user shoult not get single fwcloud data', async () => {
				return await request(app.express)
					.put('/fwcloud/get')
					.send({ fwcloud: fwCloud.id })
					.expect(401);
			});

			it('guest user shoult not get all fwclouds data', async () => {
				return await request(app.express)
					.put('/fwcloud/all/get')
					.send({ fwcloud: fwCloud.id })
					.expect(401);
			});

			it('admin user should get single fwcloud data', async () => {
				return await request(app.express)
					.put('/fwcloud/get')
					.send({ fwcloud: fwCloud.id })
					.set('Cookie', [attachSession(adminUserSessionId)])
					.expect(200)
					.then(response => {
						expect(response.body).to.be.jsonSchema(fwcloudDataSchema); 
						expect(response.body).to.have.property("name").which.is.equal(fwcData.name);
						expect(response.body).to.have.property("image").which.is.equal(fwcData.image);
						expect(response.body).to.have.property("comment").which.is.equal(fwcData.comment);
					});
			});

			it('admin user should get all fwclouds data', async () => {
				return await request(app.express)
					.get('/fwcloud/all/get')
					.set('Cookie', [attachSession(adminUserSessionId)])
					.expect(200)
					.then(response => {
						expect(response.body).to.be.an('array').not.to.be.empty; 
						for (let item of response.body)
							expect(response.body).to.be.jsonSchema(item); 

						expect(response.body[0]).to.have.property("name").which.is.equal(fwcData.name);
						expect(response.body[0]).to.have.property("image").which.is.equal(fwcData.image);
						expect(response.body[0]).to.have.property("comment").which.is.equal(fwcData.comment);
					});
			});
		});

		describe('FwCloudManagement@delete',() => {
			it('guest user should not delete a fwcloud', async () => {
				fwcDataUpdate.fwcloud = fwCloud.id;
				return await request(app.express)
					.put('/fwcloud/del')
					.send({ fwcloud: fwCloud.id })
					.expect(401);
			});

			it('regular user should not delete a fwcloud', async () => {
				fwcDataUpdate.fwcloud = fwCloud.id;
				return await request(app.express)
					.put('/fwcloud/del')
					.send({ fwcloud: fwCloud.id })
					.set('Cookie', [attachSession(regularUserSessionId)])
					.expect(400, {fwcErr: 7000, msg: "FWCloud access not allowed"});
			});

			it('admin user should delete empty fwcloud', async () => {
				try{
					return await request(app.express)
					.put('/fwcloud/del')
					.send({ fwcloud: fwCloud.id })
						.set('Cookie', [attachSession(adminUserSessionId)])
						.expect(204);
				} catch (error) {
					console.log(error);
				}
			});

			it("delete fwcloud that doesn't exists", async () => {
				fwCloud = await manager.getRepository(FwCloud).save({
					name: StringHelper.randomize(10)
				});

				const id: number = fwCloud.id;

				await manager.getRepository(FwCloud).remove(fwCloud);

				return await request(app.express)
					.put('/fwcloud/del')
					.send({ fwcloud: id  })
					.set('Cookie', [attachSession(adminUserSessionId)])
					.expect(400,{fwcErr: 7000, msg: "FWCloud access not allowed"});
			});
		});

		describe('FwCloudManagement@limit',()=>{
			it('the limit is greater than the number of fwclouds', async () => {
				let numberFwclouds: number;
				await request(app.express)
					.get('/fwcloud/all/get')
					.set('Cookie', [attachSession(adminUserSessionId)])
					.then(response => {
						numberFwclouds = response.body.length
					});
				
				app.config.set('limits.fwclouds', numberFwclouds + 1);

				return await request(app.express)
					.post(_URL().getURL('fwclouds.store'))
					.send({
						name: StringHelper.randomize(10),
						image: '',
						comment: ''
					})
					.set('Cookie',[attachSession(adminUserSessionId)])
					.expect(201)
			})

			it('the limit is equals than the number of fwclouds',async ()=>{
				let numberFwclouds: number;
				await request(app.express)
					.get('/fwcloud/all/get')
					.set('Cookie', [attachSession(adminUserSessionId)])
					.then(response => { 
						numberFwclouds = response.body.length
					});
				
				app.config.set('limits.fwclouds', numberFwclouds);

				return await request(app.express)
					.post((_URL().getURL('fwclouds.store')))
					.send({
						name: StringHelper.randomize(10),
						image: '',
						comment: ''
					})
					.set('Cookie',[attachSession(adminUserSessionId)])
					.expect(403, {data:{"fwcErr": 8000, "msg": "The maximum of available FWClouds has been reached"},response:"Forbidden",status:403})
			})

			it('the limit is less than the number of fwclouds',async ()=>{
				let numberFwclouds: number;
				await request(app.express)
					.get('/fwcloud/all/get')
					.set('Cookie', [attachSession(adminUserSessionId)])
					.then(response => { 
						numberFwclouds = response.body.length
					});
				
				app.config.set('limits.fwclouds', numberFwclouds - 1);

				return await request(app.express)
					.post((_URL().getURL('fwclouds.store')))
					.send({
						name: StringHelper.randomize(10),
						image: '',
						comment: ''
					})
					.set('Cookie',[attachSession(adminUserSessionId)])
					.expect(403, {data:{"fwcErr": 8000, "msg": "The maximum of available FWClouds has been reached"},response:"Forbidden",status:403})
			})
		})
	});
});
