import { describeName, testSuite, expect } from "../../../mocha/global-setup";
import request = require("supertest");
import { _URL } from "../../../../src/fonaments/http/router/router.service";
import { FwCloud } from "../../../../src/models/fwcloud/FwCloud";
import { Tree } from "../../../../src/models/tree/Tree";
import StringHelper from "../../../../src/utils/string.helper";
import { getRepository } from "typeorm";
import { User } from "../../../../src/models/user/User";
import { createUser, generateSession, attachSession, sleep } from "../../../utils/utils";
import { Application } from "../../../../src/Application";
import fwc_tree_node = require("../../../../src/models/tree/node");
import { FwcTree } from "../../../../src/models/tree/fwc-tree.model";

describe(describeName('Ipobj duplicity E2E Tests'), () => {
	let app: Application;
	let fwCloud: FwCloud;
	let fwcTree: Tree;
	let fwcTreeNode: fwc_tree_node;
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
		regularUser = await createUser({role: 0});
		adminUser = await createUser({role: 1});

		fwCloud = await getRepository(FwCloud).save(getRepository(FwCloud).create({name: StringHelper.randomize(10)}));
		//fwcTree = await getRepository(Tree).find({fwcloud:fwCloud.id});
	});

	beforeEach(async() => {
		regularUserSessionId = generateSession(regularUser);
		adminUserSessionId = generateSession(adminUser);
	});

	describe('IpobjDuplicity',() => {
		describe('IpobjDuplicity@address',() => {			
			it('guest user should not create a fwcloud', async () => {
				return await request(app.express)
					.post('/fwcloud')
					.send(fwcData)
					.expect(401);
			});
		});
	});
});
