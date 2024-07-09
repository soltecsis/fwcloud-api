import { PolicyScript } from './../../../src/compiler/policy/PolicyScript';
import fs from 'fs';
import { Application } from '../../../src/Application';
import { Firewall } from '../../../src/models/firewall/Firewall';
import { FwCloud } from '../../../src/models/fwcloud/FwCloud';
import { User } from '../../../src/models/user/User';
import request = require('supertest');
import { describeName, expect, testSuite } from '../../mocha/global-setup';
import { createUser, generateSession, attachSession } from '../../utils/utils';
import { EntityManager } from 'typeorm';
import StringHelper from '../../../src/utils/string.helper';
import { IPObj } from '../../../src/models/ipobj/IPObj';
import { _URL } from '../../../src/fonaments/http/router/router.service';
import { PolicyRuleService } from '../../../src/policy-rule/policy-rule.service';
import db from '../../../src/database/database-manager';

describe(describeName('Policy-rules E2E Test'), () => {
  let app: Application;

  let loggedUser: User;
  let loggedUserSessionId: string;

  let adminUser: User;
  let adminUserSessionId: string;

  let fwCloud: FwCloud;
  let firewall: Firewall;
  let service: PolicyRuleService;
  let filePath: string;

  let manager: EntityManager;

  beforeEach(async () => {
    app = testSuite.app;
    manager = db.getSource().manager;

    loggedUser = await createUser({ role: 0 });
    loggedUserSessionId = generateSession(loggedUser);

    adminUser = await createUser({ role: 1 });
    adminUserSessionId = generateSession(adminUser);

    fwCloud = await manager
      .getRepository(FwCloud)
      .save(manager.getRepository(FwCloud).create({ name: StringHelper.randomize(10) }));
    const ipObj: IPObj = await manager.getRepository(IPObj).save(
      manager.getRepository(IPObj).create({
        name: 'test',
        address: '0.0.0.0',
        ipObjTypeId: 0,
      }),
    );
    firewall = await manager.getRepository(Firewall).save(
      manager.getRepository(Firewall).create({
        name: StringHelper.randomize(10),
        fwCloudId: fwCloud.id,
        install_ipobj: ipObj.id,
      }),
    );

    service = await app.getService<PolicyRuleService>(PolicyRuleService.name);

    await service.compile(firewall.fwCloudId, firewall.id);
    await service.content(firewall.fwCloudId, firewall.id);

    filePath = new PolicyScript(db.getQuery(), fwCloud.id, firewall.id).getScriptPath();
  });

  describe('PolicyRuleController@read', () => {
    it('guest user should not read a compiled file content of a firewall', async () => {
      return await request(app.express)
        .get(
          _URL().getURL('fwclouds.firewalls.policyRules.read', {
            fwcloud: firewall.fwCloudId,
            firewall: firewall.id,
          }),
        )
        .expect(401);
    });
    it('regular user should not read a compiled file content of a firewall if it does not belong to the fwcloud', async () => {
      return await request(app.express)
        .get(
          _URL().getURL('fwclouds.firewalls.policyRules.read', {
            fwcloud: firewall.fwCloudId,
            firewall: firewall.id,
          }),
        )
        .set('Cookie', [attachSession(loggedUserSessionId)])
        .expect(401);
    });
    it('regular user should read a compiled file content of a firewall if it does belong to the fwcloud', async () => {
      loggedUser.fwClouds = [fwCloud];
      await manager.getRepository(User).save(loggedUser);

      return await request(app.express)
        .get(
          _URL().getURL('fwclouds.firewalls.policyRules.read', {
            fwcloud: firewall.fwCloudId,
            firewall: firewall.id,
          }),
        )
        .set('Cookie', [attachSession(loggedUserSessionId)])
        .expect(200);
    });
    it('admin user should read a compiled file content of a firewall', async () => {
      return await request(app.express)
        .get(
          _URL().getURL('fwclouds.firewalls.policyRules.read', {
            fwcloud: firewall.fwCloudId,
            firewall: firewall.id,
          }),
        )
        .set('Cookie', [attachSession(adminUserSessionId)])
        .expect(200);
    });
    it('404 should be thrown if the file content does not exist', async () => {
      fs.unlinkSync(filePath);

      return await request(app.express)
        .get(
          _URL().getURL('fwclouds.firewalls.policyRules.read', {
            fwcloud: firewall.fwCloudId,
            firewall: firewall.id,
          }),
        )
        .set('Cookie', [attachSession(adminUserSessionId)])
        .expect(404);
    });
  });
  describe('PolicyRuleController@download', () => {
    it('guest user should not download a compiled file content of a firewall', async () => {
      return await request(app.express)
        .post(
          _URL().getURL('fwclouds.firewalls.policyRules.download', {
            fwcloud: firewall.fwCloudId,
            firewall: firewall.id,
          }),
        )
        .expect(401);
    });
    it('regular user should not download a compiled file content of a firewall if it does not belong to the fwcloud', async () => {
      return await request(app.express)
        .post(
          _URL().getURL('fwclouds.firewalls.policyRules.download', {
            fwcloud: firewall.fwCloudId,
            firewall: firewall.id,
          }),
        )
        .set('Cookie', [attachSession(loggedUserSessionId)])
        .expect(401);
    });
    it('regular user should download a compiled file content of a firewall if it does belong to the fwcloud', async () => {
      loggedUser.fwClouds = [fwCloud];
      await manager.getRepository(User).save(loggedUser);

      return await request(app.express)
        .post(
          _URL().getURL('fwclouds.firewalls.policyRules.download', {
            fwcloud: firewall.fwCloudId,
            firewall: firewall.id,
          }),
        )
        .set('Cookie', [attachSession(loggedUserSessionId)])
        .expect(200)
        .expect((response) => {
          expect(response.header['content-type']).to.have.string('text/plain');
        });
    });
    it('admin user should download a compiled file content of a firewall', async () => {
      return await request(app.express)
        .post(
          _URL().getURL('fwclouds.firewalls.policyRules.download', {
            fwcloud: firewall.fwCloudId,
            firewall: firewall.id,
          }),
        )
        .set('Cookie', [attachSession(adminUserSessionId)])
        .expect(200)
        .expect((response) => {
          expect(response.header['content-type']).to.have.string('text/plain');
        });
    });
    it('check the download content is the compiled file content', async () => {
      return await request(app.express)
        .post(
          _URL().getURL('fwclouds.firewalls.policyRules.download', {
            fwcloud: firewall.fwCloudId,
            firewall: firewall.id,
          }),
        )
        .set('Cookie', [attachSession(adminUserSessionId)])
        .expect(200)
        .expect((response) => {
          expect(response.text).to.eq(fs.readFileSync(filePath).toString());
        });
    });
  });
});
