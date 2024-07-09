/*!
    Copyright 2023 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
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
import { Application } from '../../../../../src/Application';
import { Firewall } from '../../../../../src/models/firewall/Firewall';
import { FwCloud } from '../../../../../src/models/fwcloud/FwCloud';
import { KeepalivedRule } from '../../../../../src/models/system/keepalived/keepalived_r/keepalived_r.model';
import { User } from '../../../../../src/models/user/User';
import { expect, testSuite } from '../../../../mocha/global-setup';
import { attachSession, createUser, generateSession } from '../../../../utils/utils';
import { KeepalivedRuleService } from '../../../../../src/models/system/keepalived/keepalived_r/keepalived_r.service';
import { FwCloudFactory, FwCloudProduct } from '../../../../utils/fwcloud-factory';
import { KeepalivedController } from '../../../../../src/controllers/system/keepalived/keepalived.controller';
import request = require('supertest');
import { _URL } from '../../../../../src/fonaments/http/router/router.service';
import { KeepalivedGroup } from '../../../../../src/models/system/keepalived/keepalived_g/keepalived_g.model';
import { EntityManager } from 'typeorm';
import { KeepalivedRuleCopyDto } from '../../../../../src/controllers/system/keepalived/dto/copy.dto';
import { Offset } from '../../../../../src/offset';
import { KeepalivedRuleBulkUpdateDto } from '../../../../../src/controllers/system/keepalived/dto/bulk-update.dto';
import db from '../../../../../src/database/database-manager';

describe('KeepalivedRule E2E Tests', () => {
  let app: Application;
  let loggedUser: User;
  let loggedUserSessionId: string;

  let adminUser: User;
  let adminUserSessionId: string;

  let fwcProduct: FwCloudProduct;
  let fwCloud: FwCloud;
  let firewall: Firewall;
  let group: KeepalivedGroup;

  let keepalivedRuleServiceInstance: KeepalivedRuleService;
  let manager: EntityManager;

  beforeEach(async () => {
    app = testSuite.app;
    manager = db.getSource().manager;
    await testSuite.resetDatabaseData();

    loggedUser = await createUser({ role: 0 });
    loggedUserSessionId = generateSession(loggedUser);

    adminUser = await createUser({ role: 1 });
    adminUserSessionId = generateSession(adminUser);

    keepalivedRuleServiceInstance = await app.getService(KeepalivedRuleService.name);

    fwcProduct = await new FwCloudFactory().make();

    fwCloud = fwcProduct.fwcloud;

    firewall = fwcProduct.firewall;

    group = await manager.getRepository(KeepalivedGroup).save(
      manager.getRepository(KeepalivedGroup).create({
        name: 'group',
        firewall: firewall,
      }),
    );
  });

  describe(KeepalivedController.name, () => {
    describe('@index', () => {
      let KeepalivedRule: KeepalivedRule;

      beforeEach(async () => {
        KeepalivedRule = await keepalivedRuleServiceInstance.store({
          active: true,
          group: group.id,
          firewallId: firewall.id,
          comment: 'comment',
          rule_order: 1,
        });
      });

      it('guest user should not see Keepalived rules', async () => {
        return await request(app.express)
          .get(
            _URL().getURL('fwclouds.firewalls.system.keepalived.index', {
              fwcloud: fwCloud.id,
              firewall: firewall.id,
            }),
          )
          .set('Cookie', [attachSession(loggedUserSessionId)])
          .expect(401);
      });

      it('regular user which does not belong to the fwcloud should not see Keepalived rules', async () => {
        return await request(app.express)
          .get(
            _URL().getURL('fwclouds.firewalls.system.keepalived.index', {
              fwcloud: fwCloud.id,
              firewall: firewall.id,
            }),
          )
          .set('Cookie', [attachSession(loggedUserSessionId)])
          .expect(401);
      });

      it('regular user which belongs to the fwcloud should see Keepalived rules', async () => {
        loggedUser.fwClouds = [fwCloud];
        await manager.getRepository(User).save(loggedUser);

        return await request(app.express)
          .get(
            _URL().getURL('fwclouds.firewalls.system.keepalived.index', {
              fwcloud: fwCloud.id,
              firewall: firewall.id,
            }),
          )
          .set('Cookie', [attachSession(loggedUserSessionId)])
          .expect(200)
          .then((response) => {
            expect(response.body.data).to.have.length(1);
          });
      });

      it('admin user should see Keepalived rules', async () => {
        return await request(app.express)
          .get(
            _URL().getURL('fwclouds.firewalls.system.keepalived.index', {
              fwcloud: fwCloud.id,
              firewall: firewall.id,
            }),
          )
          .set('Cookie', [attachSession(adminUserSessionId)])
          .expect(200)
          .then((response) => {
            expect(response.body.data).to.have.length(1);
          });
      });
    });

    describe('@grid', () => {
      let KeepalivedRule: KeepalivedRule;

      beforeEach(async () => {
        KeepalivedRule = await keepalivedRuleServiceInstance.store({
          active: true,
          group: group.id,
          firewallId: firewall.id,
          comment: 'comment',
          rule_order: 1,
        });
      });

      it('guest user should not see Keepalived rules grid', async () => {
        return await request(app.express)
          .get(
            _URL().getURL('fwclouds.firewalls.system.keepalived.grid', {
              fwcloud: fwCloud.id,
              firewall: firewall.id,
            }),
          )
          .set('Cookie', [attachSession(loggedUserSessionId)])
          .expect(401);
      });

      it('regular user which does not belong to the fwcloud should not see Keepalived rules grid', async () => {
        return await request(app.express)
          .get(
            _URL().getURL('fwclouds.firewalls.system.keepalived.grid', {
              fwcloud: fwCloud.id,
              firewall: firewall.id,
            }),
          )
          .set('Cookie', [attachSession(loggedUserSessionId)])
          .expect(401);
      });

      it('regular user which belongs to the fwcloud should see Keepalived rules grid', async () => {
        loggedUser.fwClouds = [fwCloud];
        await manager.getRepository(User).save(loggedUser);

        return await request(app.express)
          .get(
            _URL().getURL('fwclouds.firewalls.system.keepalived.grid', {
              fwcloud: fwCloud.id,
              firewall: firewall.id,
            }),
          )
          .set('Cookie', [attachSession(loggedUserSessionId)])
          .expect(200)
          .then((response) => {
            expect(response.body.data[0].id).to.deep.equal(KeepalivedRule.id);
          });
      });

      it('admin user should see Keepalived rules grid', async () => {
        return await request(app.express)
          .get(
            _URL().getURL('fwclouds.firewalls.system.keepalived.grid', {
              fwcloud: fwCloud.id,
              firewall: firewall.id,
            }),
          )
          .set('Cookie', [attachSession(adminUserSessionId)])
          .expect(200)
          .then((response) => {
            expect(response.body.data[0].id).to.deep.equal(KeepalivedRule.id);
          });
      });
    });

    describe('@create', () => {
      it('guest user should not create a Keepalived rule', async () => {
        return await request(app.express)
          .post(
            _URL().getURL('fwclouds.firewalls.system.keepalived.store', {
              fwcloud: fwCloud.id,
              firewall: firewall.id,
            }),
          )
          .send({
            active: true,
            groupId: group.id,
            firewallId: firewall.id,
            cfg_text: 'cfg_text',
            comment: 'comment',
          })
          .expect(401);
      });

      it('regular user which does not belong to the fwcloud should not create a Keepalived rule', async () => {
        return await request(app.express)
          .post(
            _URL().getURL('fwclouds.firewalls.system.keepalived.store', {
              fwcloud: fwCloud.id,
              firewall: firewall.id,
            }),
          )
          .set('Cookie', [attachSession(loggedUserSessionId)])
          .send({
            active: true,
            groupId: group.id,
            firewallId: firewall.id,
            cfg_text: 'cfg_text',
            comment: 'comment',
          })
          .expect(401);
      });

      it('regular user which belongs to the fwcloud should create a Keepalived rule', async () => {
        loggedUser.fwClouds = [fwCloud];
        await manager.getRepository(User).save(loggedUser);

        return await request(app.express)
          .post(
            _URL().getURL('fwclouds.firewalls.system.keepalived.store', {
              fwcloud: fwCloud.id,
              firewall: firewall.id,
            }),
          )
          .set('Cookie', [attachSession(loggedUserSessionId)])
          .send({
            active: true,
            groupId: group.id,
            firewallId: firewall.id,
            cfg_text: 'cfg_text',
            comment: 'comment',
          })
          .expect(201)
          .then((response) => {
            expect(response.body.data).to.have.property('id');
          });
      });

      it('admin user should create a Keepalived rule', async () => {
        return await request(app.express)
          .post(
            _URL().getURL('fwclouds.firewalls.system.keepalived.store', {
              fwcloud: fwCloud.id,
              firewall: firewall.id,
            }),
          )
          .set('Cookie', [attachSession(adminUserSessionId)])
          .send({
            active: true,
            groupId: group.id,
            firewallId: firewall.id,
            cfg_text: 'cfg_text',
            comment: 'comment',
          })
          .expect(201)
          .then((response) => {
            expect(response.body.data).to.have.property('id');
          });
      });
    });

    describe('@copy', () => {
      let KeepalivedRule1: KeepalivedRule;
      let KeepalivedRule2: KeepalivedRule;
      let data: KeepalivedRuleCopyDto;

      beforeEach(async () => {
        KeepalivedRule1 = await keepalivedRuleServiceInstance.store({
          active: true,
          group: group.id,
          firewallId: firewall.id,
          comment: 'comment',
          rule_order: 1,
        });
        KeepalivedRule2 = await keepalivedRuleServiceInstance.store({
          active: true,
          group: group.id,
          firewallId: firewall.id,
          comment: 'comment',
          rule_order: 2,
        });
        data = {
          rules: [KeepalivedRule1.id, KeepalivedRule2.id],
          to: KeepalivedRule1.id,
          offset: Offset.Below,
        } as KeepalivedRuleCopyDto;
      });

      it('guest user should not copy a Keepalived rule', async () => {
        return await request(app.express)
          .post(
            _URL().getURL('fwclouds.firewalls.system.keepalived.copy', {
              fwcloud: fwCloud.id,
              firewall: firewall.id,
            }),
          )
          .send(data)
          .expect(401);
      });

      it('regular user which does not belong to the fwcloud should not copy a Keepalived rule', async () => {
        return await request(app.express)
          .post(
            _URL().getURL('fwclouds.firewalls.system.keepalived.copy', {
              fwcloud: fwCloud.id,
              firewall: firewall.id,
            }),
          )
          .set('Cookie', [attachSession(loggedUserSessionId)])
          .send(data)
          .expect(401);
      });

      it('regular user which belongs to the fwcloud should copy a Keepalived rule', async () => {
        loggedUser.fwClouds = [fwCloud];
        await manager.getRepository(User).save(loggedUser);

        return await request(app.express)
          .post(
            _URL().getURL('fwclouds.firewalls.system.keepalived.copy', {
              fwcloud: fwCloud.id,
              firewall: firewall.id,
            }),
          )
          .set('Cookie', [attachSession(loggedUserSessionId)])
          .send(data)
          .expect(201)
          .then((response) => {
            expect(response.body.data).to.have.length(2);
          });
      });

      it('admin user should copy a Keepalived rule', async () => {
        return await request(app.express)
          .post(
            _URL().getURL('fwclouds.firewalls.system.keepalived.copy', {
              fwcloud: fwCloud.id,
              firewall: firewall.id,
            }),
          )
          .set('Cookie', [attachSession(adminUserSessionId)])
          .send(data)
          .expect(201)
          .then((response) => {
            expect(response.body.data).to.have.length(2);
          });
      });
    });

    describe('@update', () => {
      let keepalivedRule: KeepalivedRule;

      beforeEach(async () => {
        keepalivedRule = await keepalivedRuleServiceInstance.store({
          active: true,
          group: group.id,
          firewallId: firewall.id,
          comment: 'comment',
          rule_order: 1,
        });
      });

      it('guest user should not update a Keepalived rule', async () => {
        return await request(app.express)
          .put(
            _URL().getURL('fwclouds.firewalls.system.keepalived.update', {
              fwcloud: fwCloud.id,
              firewall: firewall.id,
              keepalived: keepalivedRule.id,
            }),
          )
          .send({
            active: false,
            cfg_text: 'cfg_text',
            comment: 'comment',
          })
          .expect(401);
      });

      it('regular user which does not belong to the fwcloud should not update a Keepalived rule', async () => {
        return await request(app.express)
          .put(
            _URL().getURL('fwclouds.firewalls.system.keepalived.update', {
              fwcloud: fwCloud.id,
              firewall: firewall.id,
              keepalived: keepalivedRule.id,
            }),
          )
          .set('Cookie', [attachSession(loggedUserSessionId)])
          .send({
            active: false,
            cfg_text: 'cfg_text',
            comment: 'comment',
          })
          .expect(401);
      });

      it('regular user which belongs to the fwcloud should update a Keepalived rule', async () => {
        loggedUser.fwClouds = [fwCloud];
        await manager.getRepository(User).save(loggedUser);

        return await request(app.express)
          .put(
            _URL().getURL('fwclouds.firewalls.system.keepalived.update', {
              fwcloud: fwCloud.id,
              firewall: firewall.id,
              keepalived: keepalivedRule.id,
            }),
          )
          .set('Cookie', [attachSession(loggedUserSessionId)])
          .send({
            active: false,
            cfg_text: 'cfg_text',
            comment: 'comment',
          })
          .expect(200)
          .then((response) => {
            expect(response.body.data).to.have.property('id');
          });
      });

      it('admin user should update a Keepalived rule', async () => {
        return await request(app.express)
          .put(
            _URL().getURL('fwclouds.firewalls.system.keepalived.update', {
              fwcloud: fwCloud.id,
              firewall: firewall.id,
              keepalived: keepalivedRule.id,
            }),
          )
          .set('Cookie', [attachSession(adminUserSessionId)])
          .send({
            active: false,
            cfg_text: 'cfg_text',
            comment: 'comment',
          })
          .expect(200)
          .then((response) => {
            expect(response.body.data).to.have.property('id');
          });
      });
    });

    describe('@remove', () => {
      let keepalivedRule: KeepalivedRule;

      beforeEach(async () => {
        keepalivedRule = await keepalivedRuleServiceInstance.store({
          active: true,
          group: group.id,
          firewallId: firewall.id,
          comment: 'comment',
          rule_order: 1,
        });
      });

      it('guest user should not remove a Keepalived rule', async () => {
        return await request(app.express)
          .delete(
            _URL().getURL('fwclouds.firewalls.system.keepalived.delete', {
              fwcloud: fwCloud.id,
              firewall: firewall.id,
              keepalived: keepalivedRule.id,
            }),
          )
          .expect(401);
      });

      it('regular user which does not belong to the fwcloud should not remove a Keepalived rule', async () => {
        return await request(app.express)
          .delete(
            _URL().getURL('fwclouds.firewalls.system.keepalived.delete', {
              fwcloud: fwCloud.id,
              firewall: firewall.id,
              keepalived: keepalivedRule.id,
            }),
          )
          .set('Cookie', [attachSession(loggedUserSessionId)])
          .expect(401);
      });

      it('regular user which belongs to the fwcloud should remove a Keepalived rule', async () => {
        loggedUser.fwClouds = [fwCloud];
        await manager.getRepository(User).save(loggedUser);

        return await request(app.express)
          .delete(
            _URL().getURL('fwclouds.firewalls.system.keepalived.delete', {
              fwcloud: fwCloud.id,
              firewall: firewall.id,
              keepalived: keepalivedRule.id,
            }),
          )
          .set('Cookie', [attachSession(loggedUserSessionId)])
          .expect(200)
          .then((response) => {
            expect(response.body.data).to.have.property('id');
          });
      });

      it('admin user should remove a Keepalived rule', async () => {
        return await request(app.express)
          .delete(
            _URL().getURL('fwclouds.firewalls.system.keepalived.delete', {
              fwcloud: fwCloud.id,
              firewall: firewall.id,
              keepalived: keepalivedRule.id,
            }),
          )
          .set('Cookie', [attachSession(adminUserSessionId)])
          .expect(200)
          .then((response) => {
            expect(response.body.data).to.have.property('id');
          });
      });
    });

    describe('@show', () => {
      let keepalivedRule: KeepalivedRule;

      beforeEach(async () => {
        keepalivedRule = await keepalivedRuleServiceInstance.store({
          active: true,
          group: group.id,
          firewallId: firewall.id,
          comment: 'comment',
          rule_order: 1,
        });
      });

      it('guest user should not see a Keepalived rule', async () => {
        return await request(app.express)
          .get(
            _URL().getURL('fwclouds.firewalls.system.keepalived.show', {
              fwcloud: fwCloud.id,
              firewall: firewall.id,
              keepalived: keepalivedRule.id,
            }),
          )
          .expect(401);
      });

      it('regular user which does not belong to the fwcloud should not see a Keepalived rule', async () => {
        return await request(app.express)
          .get(
            _URL().getURL('fwclouds.firewalls.system.keepalived.show', {
              fwcloud: fwCloud.id,
              firewall: firewall.id,
              keepalived: keepalivedRule.id,
            }),
          )
          .set('Cookie', [attachSession(loggedUserSessionId)])
          .expect(401);
      });

      it('regular user which belongs to the fwcloud should see a Keepalived rule', async () => {
        loggedUser.fwClouds = [fwCloud];
        await manager.getRepository(User).save(loggedUser);

        return await request(app.express)
          .get(
            _URL().getURL('fwclouds.firewalls.system.keepalived.show', {
              fwcloud: fwCloud.id,
              firewall: firewall.id,
              keepalived: keepalivedRule.id,
            }),
          )
          .set('Cookie', [attachSession(loggedUserSessionId)])
          .expect(200)
          .then((response) => {
            expect(response.body.data).to.have.property('id');
          });
      });

      it('admin user should see a Keepalived rule', async () => {
        return await request(app.express)
          .get(
            _URL().getURL('fwclouds.firewalls.system.keepalived.show', {
              fwcloud: fwCloud.id,
              firewall: firewall.id,
              keepalived: keepalivedRule.id,
            }),
          )
          .set('Cookie', [attachSession(adminUserSessionId)])
          .expect(200)
          .then((response) => {
            expect(response.body.data).to.have.property('id');
          });
      });
    });

    describe('@move', () => {
      let KeepalivedRule1: KeepalivedRule;
      let KeepalivedRule2: KeepalivedRule;
      let KeepalivedRule3: KeepalivedRule;
      let KeepalivedRule4: KeepalivedRule;
      let data: KeepalivedRuleCopyDto;

      beforeEach(async () => {
        KeepalivedRule1 = await keepalivedRuleServiceInstance.store({
          active: true,
          group: group.id,
          firewallId: firewall.id,
          comment: 'comment',
          rule_order: 1,
        });
        KeepalivedRule2 = await keepalivedRuleServiceInstance.store({
          active: true,
          group: group.id,
          firewallId: firewall.id,
          comment: 'comment',
          rule_order: 2,
        });
        KeepalivedRule3 = await keepalivedRuleServiceInstance.store({
          active: true,
          group: group.id,
          firewallId: firewall.id,
          comment: 'comment',
          rule_order: 3,
        });
        KeepalivedRule4 = await keepalivedRuleServiceInstance.store({
          active: true,
          group: group.id,
          firewallId: firewall.id,
          comment: 'comment',
          rule_order: 4,
        });
        data = {
          rules: [KeepalivedRule1.id, KeepalivedRule2.id],
          to: KeepalivedRule3.rule_order,
          offset: Offset.Above,
        } as KeepalivedRuleCopyDto;
      });

      it('guest user should not move a Keepalived rule', async () => {
        return await request(app.express)
          .put(
            _URL().getURL('fwclouds.firewalls.system.keepalived.move', {
              fwcloud: fwCloud.id,
              firewall: firewall.id,
            }),
          )
          .send(data)
          .expect(401);
      });

      it('regular user which does not belong to the fwcloud should not move a Keepalived rule', async () => {
        return await request(app.express)
          .put(
            _URL().getURL('fwclouds.firewalls.system.keepalived.move', {
              fwcloud: fwCloud.id,
              firewall: firewall.id,
            }),
          )
          .set('Cookie', [attachSession(loggedUserSessionId)])
          .send(data)
          .expect(401);
      });

      it('regular user which belongs to the fwcloud should move a Keepalived rule', async () => {
        loggedUser.fwClouds = [fwCloud];
        await manager.getRepository(User).save(loggedUser);

        await request(app.express)
          .put(
            _URL().getURL('fwclouds.firewalls.system.keepalived.move', {
              fwcloud: fwCloud.id,
              firewall: firewall.id,
            }),
          )
          .set('Cookie', [attachSession(loggedUserSessionId)])
          .send(data)
          .expect(200)
          .then((response) => {
            expect(response.body.data).to.have.length(2);
          });

        expect(
          (
            await manager
              .getRepository(KeepalivedRule)
              .findOneOrFail({ where: { id: KeepalivedRule1.id } })
          ).rule_order,
        ).to.equal(1);
        expect(
          (
            await manager
              .getRepository(KeepalivedRule)
              .findOneOrFail({ where: { id: KeepalivedRule2.id } })
          ).rule_order,
        ).to.equal(2);
        expect(
          (
            await manager
              .getRepository(KeepalivedRule)
              .findOneOrFail({ where: { id: KeepalivedRule3.id } })
          ).rule_order,
        ).to.equal(3);
        expect(
          (
            await manager
              .getRepository(KeepalivedRule)
              .findOneOrFail({ where: { id: KeepalivedRule4.id } })
          ).rule_order,
        ).to.equal(4);
      });

      it('admin user should move a Keepalived rule', async () => {
        await request(app.express)
          .put(
            _URL().getURL('fwclouds.firewalls.system.keepalived.move', {
              fwcloud: fwCloud.id,
              firewall: firewall.id,
            }),
          )
          .set('Cookie', [attachSession(adminUserSessionId)])
          .send(data)
          .expect(200)
          .then((response) => {
            expect(response.body.data).to.have.length(2);
          });

        expect(
          (
            await manager
              .getRepository(KeepalivedRule)
              .findOneOrFail({ where: { id: KeepalivedRule1.id } })
          ).rule_order,
        ).to.equal(1);
        expect(
          (
            await manager
              .getRepository(KeepalivedRule)
              .findOneOrFail({ where: { id: KeepalivedRule2.id } })
          ).rule_order,
        ).to.equal(2);
        expect(
          (
            await manager
              .getRepository(KeepalivedRule)
              .findOneOrFail({ where: { id: KeepalivedRule3.id } })
          ).rule_order,
        ).to.equal(3);
        expect(
          (
            await manager
              .getRepository(KeepalivedRule)
              .findOneOrFail({ where: { id: KeepalivedRule4.id } })
          ).rule_order,
        ).to.equal(4);
      });
    });

    describe('@bulkUpdate', () => {
      let rule1: KeepalivedRule;
      let rule2: KeepalivedRule;
      const data: KeepalivedRuleBulkUpdateDto = {
        active: false,
        style: 'style',
      };

      beforeEach(async () => {
        rule1 = await keepalivedRuleServiceInstance.store({
          active: true,
          group: group.id,
          firewallId: firewall.id,
          comment: 'comment',
          rule_order: 1,
        });
        rule2 = await keepalivedRuleServiceInstance.store({
          active: true,
          group: group.id,
          firewallId: firewall.id,
          comment: 'comment',
          rule_order: 2,
        });
      });

      it('guest user should not bulk update a Keepalived rule', async () => {
        return await request(app.express)
          .put(
            _URL().getURL('fwclouds.firewalls.system.keepalived.bulkUpdate', {
              fwcloud: fwCloud.id,
              firewall: firewall.id,
            }),
          )
          .query({
            rules: [rule1.id, rule2.id],
          })
          .send(data)
          .expect(401);
      });

      it('regular user which does not belong to the fwcloud should not bulk update a Keepalived rule', async () => {
        return await request(app.express)
          .put(
            _URL().getURL('fwclouds.firewalls.system.keepalived.bulkUpdate', {
              fwcloud: fwCloud.id,
              firewall: firewall.id,
            }),
          )
          .set('Cookie', [attachSession(loggedUserSessionId)])
          .query({
            rules: [rule1.id, rule2.id],
          })
          .send(data)
          .expect(401);
      });

      it('regular user which belongs to the fwcloud should bulk update a Keepalived rule', async () => {
        loggedUser.fwClouds = [fwCloud];
        await manager.getRepository(User).save(loggedUser);

        await request(app.express)
          .put(
            _URL().getURL('fwclouds.firewalls.system.keepalived.bulkUpdate', {
              fwcloud: fwCloud.id,
              firewall: firewall.id,
            }),
          )
          .set('Cookie', [attachSession(loggedUserSessionId)])
          .query({
            rules: [rule1.id, rule2.id],
          })
          .send(data)
          .expect(200)
          .then((response) => {
            expect(response.body.data).to.have.length(2);
          });

        expect(
          (await manager.getRepository(KeepalivedRule).findOneOrFail({ where: { id: rule1.id } }))
            .active,
        ).to.equal(false);
        expect(
          (await manager.getRepository(KeepalivedRule).findOneOrFail({ where: { id: rule2.id } }))
            .active,
        ).to.equal(false);
      });

      it('admin user should bulk update a Keepalived rule', async () => {
        await request(app.express)
          .put(
            _URL().getURL('fwclouds.firewalls.system.keepalived.bulkUpdate', {
              fwcloud: fwCloud.id,
              firewall: firewall.id,
            }),
          )
          .set('Cookie', [attachSession(adminUserSessionId)])
          .query({
            rules: [rule1.id, rule2.id],
          })
          .send(data)
          .expect(200)
          .then((response) => {
            expect(response.body.data).to.have.length(2);
          });

        expect(
          (await manager.getRepository(KeepalivedRule).findOneOrFail({ where: { id: rule1.id } }))
            .active,
        ).to.equal(false);
        expect(
          (await manager.getRepository(KeepalivedRule).findOneOrFail({ where: { id: rule2.id } }))
            .active,
        ).to.equal(false);
      });
    });

    describe('@bulkRemove', () => {
      let rule1: KeepalivedRule;
      let rule2: KeepalivedRule;

      beforeEach(async () => {
        rule1 = await keepalivedRuleServiceInstance.store({
          active: true,
          group: group.id,
          firewallId: firewall.id,
          comment: 'comment',
          rule_order: 1,
        });
        rule2 = await keepalivedRuleServiceInstance.store({
          active: true,
          group: group.id,
          firewallId: firewall.id,
          comment: 'comment',
          rule_order: 2,
        });
      });

      it('guest user should not bulk remove a Keepalived rule', async () => {
        return await request(app.express)
          .delete(
            _URL().getURL('fwclouds.firewalls.system.keepalived.bulkRemove', {
              fwcloud: fwCloud.id,
              firewall: firewall.id,
            }),
          )
          .query({
            rules: [rule1.id, rule2.id],
          })
          .expect(401);
      });

      it('regular user which does not belong to the fwcloud should not bulk remove a Keepalived rule', async () => {
        return await request(app.express)
          .delete(
            _URL().getURL('fwclouds.firewalls.system.keepalived.bulkRemove', {
              fwcloud: fwCloud.id,
              firewall: firewall.id,
            }),
          )
          .set('Cookie', [attachSession(loggedUserSessionId)])
          .query({
            rules: [rule1.id, rule2.id],
          })
          .expect(401);
      });

      it('regular user which belongs to the fwcloud should bulk remove a Keepalived rule', async () => {
        loggedUser.fwClouds = [fwCloud];
        await manager.getRepository(User).save(loggedUser);

        await request(app.express)
          .delete(
            _URL().getURL('fwclouds.firewalls.system.keepalived.bulkRemove', {
              fwcloud: fwCloud.id,
              firewall: firewall.id,
            }),
          )
          .set('Cookie', [attachSession(loggedUserSessionId)])
          .query({
            rules: [rule1.id, rule2.id],
          })
          .expect(200)
          .then((response) => {
            expect(response.body.data).to.have.length(2);
          });

        expect(await manager.getRepository(KeepalivedRule).findOne({ where: { id: rule1.id } })).to
          .be.null;
        expect(await manager.getRepository(KeepalivedRule).findOne({ where: { id: rule2.id } })).to
          .be.null;
      });

      it('admin user should bulk remove a Keepalived rule', async () => {
        await request(app.express)
          .delete(
            _URL().getURL('fwclouds.firewalls.system.keepalived.bulkRemove', {
              fwcloud: fwCloud.id,
              firewall: firewall.id,
            }),
          )
          .set('Cookie', [attachSession(adminUserSessionId)])
          .query({
            rules: [rule1.id, rule2.id],
          })
          .expect(200)
          .then((response) => {
            expect(response.body.data).to.have.length(2);
          });

        expect(await manager.getRepository(KeepalivedRule).findOne({ where: { id: rule1.id } })).to
          .be.null;
        expect(await manager.getRepository(KeepalivedRule).findOne({ where: { id: rule2.id } })).to
          .be.null;
      });
    });
  });
});
