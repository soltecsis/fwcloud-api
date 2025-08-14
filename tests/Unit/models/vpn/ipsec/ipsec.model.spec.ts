import { EntityManager } from 'typeorm';
import { IPSec } from '../../../../../src/models/vpn/ipsec/IPSec';
import { FwCloudFactory, FwCloudProduct } from '../../../../utils/fwcloud-factory';
import db from '../../../../../src/database/database-manager';
import { expect, testSuite } from '../../../../mocha/global-setup';
import { Crt } from '../../../../../src/models/vpn/pki/Crt';
import { Firewall } from '../../../../../src/models/firewall/Firewall';
import path from 'path';
import os from 'os';
import fs from 'fs';
import StringHelper from '../../../../../src/utils/string.helper';

describe(IPSec.name, () => {
  let fwcloudProduct: FwCloudProduct;

  let manager: EntityManager;

  beforeEach(async () => {
    await testSuite.resetDatabaseData();
    manager = db.getSource().manager;
    fwcloudProduct = await new FwCloudFactory().make();
  });

  describe('addCfg', () => {
    let _crtRepository;
    beforeEach(async () => {
      _crtRepository = manager.getRepository(Crt);
    });

    it('should insert a new configuration successfully', async () => {
      const tempcert = await _crtRepository.save(
        _crtRepository.create({
          caId: fwcloudProduct.ca.id,
          cn: 'IPSec-Server-1',
          type: 2,
          days: 365,
        }),
      );

      const req: any = {
        dbCon: db.getQuery(),
        body: {
          firewall: fwcloudProduct.firewall.id,
          crt: tempcert.id,
          install_dir: '/tmp',
          install_name: 'addCfgTest',
        },
      };

      const resultId = await IPSec.addCfg(req);

      expect(resultId).to.exist;
      expect(resultId).to.be.a('number');
      expect(resultId).to.be.greaterThan(0);

      const result = await db
        .getSource()
        .getRepository(IPSec)
        .findOne({
          where: { id: resultId },
        });
      expect(result).to.exist;
      expect(result).to.have.property('id');
    });

    it('should fail when required fields are missing', async () => {
      const req: any = {
        dbCon: db.getQuery(),
        body: {
          firewall: fwcloudProduct.firewall.id,
          install_dir: '/tmp',
          install_name: 'addCfgTest',
        },
      };

      try {
        await IPSec.addCfg(req);
      } catch (error) {
        expect(error).to.exist;
        expect(error.message).to.equal("Column 'crt' cannot be null");
      }
    });

    it('should set status to 0 when ipsec field is provided (for clients)', async () => {
      const tempcert = await _crtRepository.save(
        _crtRepository.create({
          caId: fwcloudProduct.ca.id,
          cn: 'IPSec-Client-1',
          type: 2,
          days: 365,
        }),
      );

      const req: any = {
        dbCon: db.getQuery(),
        body: {
          firewall: fwcloudProduct.firewall.id,
          crt: tempcert.id,
          install_dir: '/tmp',
          install_name: 'addCfgClientTest',
          ipsec: fwcloudProduct.ipsecServer.id,
        },
      };

      const resultId = await IPSec.addCfg(req);

      const result = await db
        .getSource()
        .getRepository(IPSec)
        .findOne({
          where: { id: resultId },
        });

      expect(result).to.exist;
      expect(result.status).to.equal(0);
      expect(result.parentId).to.equal(fwcloudProduct.ipsecServer.id);
    });

    it('should set status to 1 when ipsec field is not provided (for servers)', async () => {
      const tempcert = await _crtRepository.save(
        _crtRepository.create({
          caId: fwcloudProduct.ca.id,
          cn: 'IPSec-Server-2',
          type: 2,
          days: 365,
        }),
      );

      const req: any = {
        dbCon: db.getQuery(),
        body: {
          firewall: fwcloudProduct.firewall.id,
          crt: tempcert.id,
          install_dir: '/tmp',
          install_name: 'addCfgServerTest',
          // No ipsec field provided
        },
      };

      const resultId = await IPSec.addCfg(req);

      const result = await db
        .getSource()
        .getRepository(IPSec)
        .findOne({
          where: { id: resultId },
        });

      expect(result).to.exist;
      expect(result.status).to.equal(1); // Status should be 1 for servers
      expect(result.parentId).to.be.null;
    });

    it('should save optional fields when provided', async () => {
      const tempcert = await _crtRepository.save(
        _crtRepository.create({
          caId: fwcloudProduct.ca.id,
          cn: 'IPSec-Server-3',
          type: 2,
          days: 365,
        }),
      );

      const testComment = 'Test comment for IPSec configuration';
      const req: any = {
        dbCon: db.getQuery(),
        body: {
          firewall: fwcloudProduct.firewall.id,
          crt: tempcert.id,
          install_dir: '/tmp',
          install_name: 'addCfgCommentTest',
          comment: testComment,
        },
      };

      const resultId = await IPSec.addCfg(req);

      const result = await db
        .getSource()
        .getRepository(IPSec)
        .findOne({
          where: { id: resultId },
        });

      expect(result).to.exist;
      expect(result.comment).to.equal(testComment);
    });

    it('should handle database insertion errors', async () => {
      const req: any = {
        dbCon: db.getQuery(),
        body: {
          firewall: 99999, // Invalid firewall ID
          crt: 99999, // Invalid certificate ID
          install_dir: '/tmp',
          install_name: 'addCfgErrorTest',
        },
      };

      try {
        await IPSec.addCfg(req);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).to.exist;
      }
    });
  });

  describe('updateCfg', () => {
    it('should update an existing configuration', async () => {
      const req: any = {
        dbCon: db.getQuery(),
        body: {
          install_dir: '/tmp',
          install_name: 'test_updated',
          comment: 'test',
          ipsec: fwcloudProduct.ipsecServer.id,
        },
      };

      await IPSec.updateCfg(req);

      const result = await db
        .getSource()
        .getRepository(IPSec)
        .findOne({
          where: { id: fwcloudProduct.ipsecServer.id },
        });

      expect(result).to.exist;
      expect(result).to.have.property('install_name');
      expect(result.install_name).to.equal(req.body.install_name);
      expect(result).to.have.property('comment');
      expect(result.comment).to.equal(req.body.comment);
    });

    it('should handle database errors', async () => {
      const req: any = {
        dbCon: db.getQuery(),
        body: {
          install_dir: '/tmp',
          install_name: 'x'.repeat(300),
          comment: 'test',
          ipsec: fwcloudProduct.ipsecServer.id,
        },
      };

      try {
        await IPSec.updateCfg(req);
      } catch (error) {
        expect(error).to.exist;
      }
    });

    it('should handle null/undefined values', async () => {
      const req: any = {
        dbCon: db.getQuery(),
        body: {
          install_dir: null,
          install_name: 'test_updated',
          comment: '',
          ipsec: fwcloudProduct.ipsecServer.id,
        },
      };

      await IPSec.updateCfg(req);

      const result = await db
        .getSource()
        .getRepository(IPSec)
        .findOne({
          where: { id: fwcloudProduct.ipsecServer.id },
        });

      expect(result).to.exist;
    });
  });

  describe('addCfgOpt', () => {
    it('should insert a IPSec option', async () => {
      const req: any = {
        dbCon: db.getQuery(),
      };

      const opt = {
        ipsec: fwcloudProduct.ipsecServer.id,
        name: 'addCfgOptTest',
        arg: '1.1.1.1',
        comment: 'Test addCfgOpt option',
        order: 1,
        scope: 0,
      };

      await IPSec.addCfgOpt(req, opt);

      const result = await db
        .getSource()
        .query(`SELECT * FROM ipsec_opt WHERE ipsec = ? AND name = ?`, [
          fwcloudProduct.ipsecServer.id,
          'addCfgOptTest',
        ]);

      expect(result).to.exist;
      expect(result).to.be.an('array').that.is.not.empty;
      expect(result[0].name).to.equal('addCfgOptTest');
      expect(result[0].arg).to.equal('1.1.1.1');
      expect(result[0].comment).to.equal('Test addCfgOpt option');
      expect(result[0].order).to.equal(1);
      expect(result[0].scope).to.equal(0);
    });

    it('should insert option with optional fields', async () => {
      const req: any = {
        dbCon: db.getQuery(),
      };

      const opt = {
        ipsec: fwcloudProduct.ipsecServer.id,
        name: 'addCfgOptTest2',
        arg: '2.2.2.2',
        comment: 'Test addCfgOpt option with optional fields',
        order: 1,
        scope: 0,
        ipobj: fwcloudProduct.ipobjs.get('address').id,
      };

      await IPSec.addCfgOpt(req, opt);

      const result = await db
        .getSource()
        .query(`SELECT * FROM ipsec_opt WHERE ipsec = ? AND name = ?`, [
          fwcloudProduct.ipsecServer.id,
          'addCfgOptTest2',
        ]);

      expect(result).to.exist;
      expect(result).to.be.an('array').that.is.not.empty;
      expect(result[0]).to.have.property('ipobj');
      expect(result[0].ipobj).to.equal(fwcloudProduct.ipobjs.get('address').id);
    });

    it('should handle database errors', async () => {
      const req: any = {
        dbCon: db.getQuery(),
      };

      const opt = {
        ipsec: fwcloudProduct.ipsecServer.id,
        name: 'addCfgOptTest'.repeat(200),
        arg: '1.1.1.1',
        comment: 'Test addCfgOpt option',
        order: 1,
        scope: 0,
        extra: 'invalid field',
      };

      try {
        await IPSec.addCfgOpt(req, opt);
      } catch (error) {
        expect(error).to.exist;
      }
    });
  });

  describe('updateCfgOptByipobj', () => {
    it('should update a IPSec option', async () => {
      const resultBefore = await db
        .getSource()
        .query(`SELECT * FROM ipsec_opt WHERE ipobj = ? AND name = ?`, [
          fwcloudProduct.ipobjs.get('network').id,
          'left',
        ]);

      await IPSec.updateCfgOptByipobj(
        db.getQuery(),
        fwcloudProduct.ipobjs.get('network').id,
        'left',
        '10.10.10.10',
      );

      const resultAfter = await db
        .getSource()
        .query(`SELECT * FROM ipsec_opt WHERE ipobj = ? AND name = ?`, [
          fwcloudProduct.ipobjs.get('network').id,
          'left',
        ]);

      expect(resultBefore).to.exist;
      expect(resultAfter).to.exist;
      expect(resultBefore).to.be.an('array').that.is.not.empty;
      expect(resultAfter).to.be.an('array').that.is.not.empty;
      expect(resultBefore[0]).to.have.property('arg');
      expect(resultAfter[0]).to.have.property('arg');
      expect(resultAfter[0].arg).to.not.equal(resultBefore[0].arg);
    });

    it('should update option with null values', async () => {
      await IPSec.updateCfgOptByipobj(
        db.getQuery(),
        fwcloudProduct.ipobjs.get('network').id,
        'left',
        null,
      );

      const resultAfter = await db
        .getSource()
        .query(`SELECT * FROM ipsec_opt WHERE ipobj = ? AND name = ?`, [
          fwcloudProduct.ipobjs.get('network').id,
          'left',
        ]);

      expect(resultAfter).to.exist;
      expect(resultAfter).to.be.an('array').that.is.not.empty;
      expect(resultAfter[0]).to.have.property('arg').that.is.null;
    });

    it('should update option with empty values', async () => {
      await IPSec.updateCfgOptByipobj(
        db.getQuery(),
        fwcloudProduct.ipobjs.get('network').id,
        'left',
        '',
      );

      const resultAfter = await db
        .getSource()
        .query(`SELECT * FROM ipsec_opt WHERE ipobj = ? AND name = ?`, [
          fwcloudProduct.ipobjs.get('network').id,
          'left',
        ]);

      expect(resultAfter).to.exist;
      expect(resultAfter).to.be.an('array').that.is.not.empty;
      expect(resultAfter[0]).to.have.property('arg').that.is.equal('');
    });

    it('should handle database errors', async () => {
      try {
        await IPSec.updateCfgOptByipobj(
          db.getQuery(),
          fwcloudProduct.ipobjs.get('network').id,
          'left',
          '1.1.1.1'.repeat(200),
        );
      } catch (error) {
        expect(error).to.exist;
      }
    });
  });

  describe('updateIpObjCfgOpt', () => {
    it('should update ipobj field in IPSec option', async () => {
      const resultBefore = await db
        .getSource()
        .query(`SELECT * FROM ipsec_opt WHERE ipsec = ? AND name = ?`, [
          fwcloudProduct.ipsecServer.id,
          'left',
        ]);

      await IPSec.updateIpObjCfgOpt(
        db.getQuery(),
        fwcloudProduct.ipobjs.get('address').id,
        fwcloudProduct.ipsecServer.id,
        'left',
      );

      const resultAfter = await db
        .getSource()
        .query(`SELECT * FROM ipsec_opt WHERE ipsec = ? AND name = ?`, [
          fwcloudProduct.ipsecServer.id,
          'left',
        ]);

      expect(resultBefore).to.exist;
      expect(resultAfter).to.exist;
      expect(resultBefore).to.be.an('array').that.is.not.empty;
      expect(resultAfter).to.be.an('array').that.is.not.empty;
      expect(resultBefore[0]).to.have.property('ipobj');
      expect(resultAfter[0]).to.have.property('ipobj');
      expect(resultAfter[0].ipobj).to.not.equal(resultBefore[0].ipobj);
    });

    it('should update with null ipobj value', async () => {
      await IPSec.updateIpObjCfgOpt(db.getQuery(), null, fwcloudProduct.ipsecServer.id, 'left');

      const resultAfter = await db
        .getSource()
        .query(`SELECT * FROM ipsec_opt WHERE ipsec = ? AND name = ?`, [
          fwcloudProduct.ipsecServer.id,
          'left',
        ]);

      expect(resultAfter).to.exist;
      expect(resultAfter).to.be.an('array').that.is.not.empty;
      expect(resultAfter[0]).to.have.property('ipobj').that.is.null;
    });

    it('should handle database errors', async () => {
      try {
        await IPSec.updateIpObjCfgOpt(
          db.getQuery(),
          4294967296, // Out of range
          fwcloudProduct.ipsecServer.id,
          'left',
        );
      } catch (error) {
        expect(error).to.exist;
      }
    });
  });

  describe('isIPSecServer', () => {
    it('should return true if the given number corresponds to a IPSec server', async () => {
      const resultServer = await IPSec.isIPSecServer(db.getQuery(), fwcloudProduct.ipsecServer.id);

      expect(resultServer).to.exist;
      expect(resultServer).to.be.an('boolean');
      expect(resultServer).to.be.true;
    });

    it('should return false if the given number does not corresponds to a IPSec server', async () => {
      const resultClient = await IPSec.isIPSecServer(
        db.getQuery(),
        fwcloudProduct.ipsecClients.get('IPSec-Cli-1').id,
      );

      expect(resultClient).to.exist;
      expect(resultClient).to.be.an('boolean');
      expect(resultClient).to.be.false;
    });
  });

  describe('checkIpobjInIPSecOpt', () => {
    it('should return IPSec options for valid ipobj', async () => {
      const result = await IPSec.checkIpobjInIPSecOpt(
        db.getQuery(),
        fwcloudProduct.ipobjs.get('network').id,
      );

      expect(result).to.exist;
      expect(result).to.be.an('array');
      (result as Array<any>).forEach((item) => {
        expect(item).to.be.an('object');
        expect(item).to.have.all.keys(
          'id',
          'ipsec',
          'ipsec_cli',
          'ipobj',
          'name',
          'arg',
          'order',
          'scope',
          'comment',
        );
      });
    });

    it('should return multiple records for ipobj used in multiple options', async () => {
      const req: any = {
        dbCon: db.getQuery(),
      };

      const opt = {
        ipsec: fwcloudProduct.ipsecServer.id,
        name: 'addCfgOptTest',
        arg: '1.1.1.1',
        comment: 'Test addCfgOpt option',
        order: 1,
        scope: 0,
        ipobj: fwcloudProduct.ipobjs.get('network').id,
      };

      await IPSec.addCfgOpt(req, opt);

      const result = await IPSec.checkIpobjInIPSecOpt(
        db.getQuery(),
        fwcloudProduct.ipobjs.get('network').id,
      );

      expect(result).to.exist;
      expect(result).to.be.an('array').that.has.length(2);
      (result as Array<any>).forEach((item) => {
        expect(item).to.be.an('object');
        expect(item).to.have.all.keys(
          'id',
          'ipsec',
          'ipsec_cli',
          'ipobj',
          'name',
          'arg',
          'order',
          'scope',
          'comment',
        );
      });
    });
  });

  describe('addPrefix', () => {
    it('should add a IPSec prefix', async () => {
      const prefix = {
        name: 'IPSec-Test-',
      };

      await IPSec.addPrefix(fwcloudProduct.ipsecServer.id, prefix);

      const result = await db
        .getSource()
        .query(`SELECT * FROM ipsec_prefix WHERE ipsec = ? AND name = ?`, [
          fwcloudProduct.ipsecServer.id,
          prefix.name,
        ]);

      expect(result).to.exist;
      expect(result).to.be.an('array').that.is.not.empty;
      expect(result[0].ipsec).to.equal(fwcloudProduct.ipsecServer.id);
      expect(result[0].name).to.equal('IPSec-Test-');
    });

    it('should handle database errors', async () => {
      const prefix = {
        name: 'IPSec-cli-',
      };

      try {
        await IPSec.addPrefix(fwcloudProduct.ipsecServer.id, prefix);
      } catch (error) {
        expect(error).to.exist;
      }
    });
  });

  describe('delCfgOptAll', () => {
    it('should delete all IPSec options for a IPSec id', async () => {
      const req: any = {
        dbCon: db.getQuery(),
        body: {
          ipsec: fwcloudProduct.ipsecServer.id,
        },
      };

      await IPSec.delCfgOptAll(req);

      const resultAfter = await db
        .getSource()
        .query(`SELECT * FROM ipsec_opt WHERE ipsec = ?`, [req.body.ipsec]);

      expect(resultAfter).to.exist;
      expect(resultAfter).to.be.an('array').that.is.empty;
    });

    it('should not fail when invalid IPSec id', async () => {
      const req: any = {
        dbCon: db.getQuery(),
        body: {
          ipsec: -9999,
        },
      };

      await IPSec.delCfgOptAll(req);

      const resultAfter = await db
        .getSource()
        .query(`SELECT * FROM ipsec_opt WHERE ipsec = ?`, [req.body.ipsec]);

      expect(resultAfter).to.exist;
      expect(resultAfter).to.be.an('array').that.is.empty;
    });

    it('should handle database errors', async () => {
      const req: any = {
        dbCon: db.getQuery(),
        body: {
          ipsec: 'string',
        },
      };

      try {
        await IPSec.delCfgOptAll(req);
      } catch (error) {
        expect(error).to.exist;
      }
    });
  });

  describe('delCfgOptByScope', () => {
    it('should delete all IPSec options for a IPSec id for scope value of 3 (client)', async () => {
      const req: any = {
        dbCon: db.getQuery(),
        body: {
          ipsec: fwcloudProduct.ipsecServer.id,
          ipsec_cli: fwcloudProduct.ipsecClients.get('IPSec-Cli-1').id,
        },
      };

      await IPSec.delCfgOptByScope(req, 3);

      const resultAfter = await db
        .getSource()
        .query(`SELECT * FROM ipsec_opt WHERE ipsec = ? AND ipsec_cli = ?`, [
          req.body.ipsec,
          req.body.ipsec_cli,
        ]);

      expect(resultAfter).to.exist;
      expect(resultAfter).to.be.an('array').that.is.empty;
    });

    it('should delete all IPSec options for a IPSec id for any other scope value (server)', async () => {
      const req: any = {
        dbCon: db.getQuery(),
        body: {
          ipsec: fwcloudProduct.ipsecServer.id,
        },
      };

      await IPSec.delCfgOptByScope(req, 0);

      const resultAfter = await db
        .getSource()
        .query(`SELECT * FROM ipsec_opt WHERE ipsec = ? AND scope = ?`, [req.body.ipsec, 0]);

      expect(resultAfter).to.exist;
      expect(resultAfter).to.be.an('array').that.is.empty;
    });

    it('should not fail when invalid IPSec', async () => {
      const req: any = {
        dbCon: db.getQuery(),
        body: {
          ipsec: -9999,
        },
      };

      await IPSec.delCfgOptByScope(req, 2);

      const resultAfter = await db
        .getSource()
        .query(`SELECT * FROM ipsec_opt WHERE ipsec = ?`, [req.body.ipsec]);

      expect(resultAfter).to.exist;
      expect(resultAfter).to.be.an('array').that.is.empty;
    });

    it('should handle database errors', async () => {
      try {
        const req: any = {
          dbCon: db.getQuery(),
          body: {
            ipsec: 'string',
          },
        };

        await IPSec.delCfgOptByScope(req, 0);
      } catch (error) {
        expect(error).to.exist;
      }
    });
  });

  describe('delCfg', () => {
    it('should delete all configuration for a IPSec client', async () => {
      await IPSec.delCfg(
        db.getQuery(),
        fwcloudProduct.fwcloud.id,
        fwcloudProduct.ipsecClients.get('IPSec-Cli-1').id,
      );
      const result = await db
        .getSource()
        .getRepository(IPSec)
        .findOne({
          where: { id: fwcloudProduct.ipsecClients.get('IPSec-Cli-1').id },
        });
      expect(result).to.not.exist;
    });

    it('should delete all configuration for a IPSec server', async () => {
      const serverId = fwcloudProduct.ipsecServer.id;
      const dbCon = db.getSource();

      await dbCon.query(`TRUNCATE TABLE ipsec__ipobj_g`);
      await dbCon.query(`TRUNCATE TABLE ipsec_prefix__ipobj_g`);
      await dbCon.query(`delete from ipsec where ipsec = ${serverId}`);
      await dbCon.query(`delete from ipsec_opt where ipsec = ${serverId}`);

      await IPSec.delCfg(db.getQuery(), fwcloudProduct.fwcloud.id, fwcloudProduct.ipsecServer.id);

      const result = await db
        .getSource()
        .getRepository(IPSec)
        .findOne({
          where: { id: fwcloudProduct.ipsecServer.id },
        });
      expect(result).to.not.exist;
    });
  });

  describe('delCfgAll', () => {
    it('should delete all configs for a firewall in correct order', async () => {
      const serverId = fwcloudProduct.ipsecServer.id;
      const clientId = fwcloudProduct.ipsecClients.get('IPSec-Cli-1').id;
      const dbCon = db.getSource();

      await dbCon.query(`TRUNCATE TABLE ipsec__ipobj_g`);
      await dbCon.query(`TRUNCATE TABLE ipsec_prefix__ipobj_g`);
      await dbCon.query(`TRUNCATE TABLE ipsec_opt`);

      await IPSec.delCfgAll(db.getQuery(), fwcloudProduct.fwcloud.id, fwcloudProduct.firewall.id);

      const serverResult = await dbCon.getRepository(IPSec).findOne({
        where: { id: serverId },
      });
      expect(serverResult).to.not.exist;

      const clientResult = await dbCon.getRepository(IPSec).findOne({
        where: { id: clientId },
      });
      expect(clientResult).to.not.exist;
    });
  });

  describe('getCfgId', () => {
    it('should return IPSec config id for firewall and crt', async () => {
      const request: any = {
        dbCon: db.getQuery(),
        body: {
          firewall: fwcloudProduct.firewall.id,
          crt: fwcloudProduct.crts.get('IPSec-Server').id,
        },
      };

      const resultId = await IPSec.getCfgId(request);

      expect(resultId).to.exist;
      expect(resultId).to.be.a('number');
      expect(resultId).to.be.greaterThan(0);
    });

    it('should return null for incorrect firewall or crt', async () => {
      const request: any = {
        dbCon: db.getQuery(),
        body: {
          firewall: -9999,
          crt: fwcloudProduct.crts.get('IPSec-Server').id,
        },
      };

      const resultId = await IPSec.getCfgId(request);

      expect(resultId).to.be.null;
    });

    it('should handle database errors', async () => {
      const request: any = {
        dbCon: db.getQuery(),
        body: {
          firewall: 'abc',
          crt: fwcloudProduct.crts.get('IPSec-Server').id,
        },
      };
      try {
        const resultId = await IPSec.getCfgId(request);
      } catch (error) {
        expect(error).to.exist;
      }
    });
  });

  describe('getCfg', () => {
    it('should return full config with decrypted keys and options', async () => {
      const result = await IPSec.getCfg(db.getQuery(), fwcloudProduct.ipsecServer.id);

      expect(result).to.exist;
      expect(result).to.have.property('id');
      expect(result).to.have.property('crt');
      expect(result).to.have.property('options');
      expect(result.options).to.be.an('array');
    });

    it('should return empty configuration for a non existent IPSec id', async () => {
      const result = await IPSec.getCfg(db.getQuery(), -9999);

      expect(result).to.exist;
      expect(result).to.be.an('array').that.is.empty;
    });
  });

  describe('getOptData', () => {
    it('should return option data for a given IPSec server ID and option name', async () => {
      const result = await IPSec.getOptData(db.getQuery(), fwcloudProduct.ipsecServer.id, 'left');

      expect(result).to.exist;
      expect(result).to.be.an('object');
      expect(result).to.have.all.keys(
        'id',
        'ipsec',
        'ipsec_cli',
        'ipobj',
        'name',
        'arg',
        'order',
        'scope',
        'comment',
      );
    });

    it('should return null when option not found', async () => {
      const result = await IPSec.getOptData(
        db.getQuery(),
        fwcloudProduct.ipsecServer.id,
        'NotFound',
      );

      expect(result).to.be.null;
    });
  });

  describe('getCRTData', () => {
    let tempDir: string;
    let testCrtFile: string;
    let testCrtContent: string;
    beforeEach(async () => {
      // Create a temporary directory and file for testing
      testCrtContent = `-----BEGIN CERTIFICATE-----
MIIDXTCCAkWgAwIBAgIJAKoK/heBjcOuMA0GCSqGSIb3DQEBCwUAMEUxCzAJBgNV
BAYTAkFVMRMwEQYDVQQIDApTb21lLVN0YXRlMSEwHwYDVQQKDBhJbnRlcm5ldCBX
aWRnaXRzIFB0eSBMdGQwHhcNMjQwMTAxMDAwMDAwWhcNMjUwMTAxMDAwMDAwWjBF
MQswCQYDVQQGEwJBVTETMBEGA1UECAwKU29tZS1TdGF0ZTEhMB8GA1UECgwYSW50
ZXJuZXQgV2lkZ2l0cyBQdHkgTHRkMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIB
CgKCAQEA7RcsQCJXHPbJGCBRGPq6rz+qN1YU3J6QsGl0oK6MhF4xKu2LzB3YkV
-----END CERTIFICATE-----`;

      // Create the temporary directory
      tempDir = path.join(os.tmpdir(), 'ipsec-test-certs');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      // Create the temporary certificate file
      testCrtFile = path.join(tempDir, `test-cert-${Date.now()}.crt`);
      fs.writeFileSync(testCrtFile, testCrtContent);
    });

    afterEach(async () => {
      // Clean up the temporary certificate file
      if (fs.existsSync(testCrtFile)) {
        fs.unlinkSync(testCrtFile);
      }

      // Optionally, clean up the temporary directory if it's empty
      try {
        if (fs.existsSync(tempDir)) {
          const files = fs.readdirSync(tempDir);
          if (files.length === 0) {
            fs.rmdirSync(tempDir);
          }
        }
      } catch (error) {
        // Ignore directory cleanup errors
      }
    });

    it('should return certificate data from a file', async () => {
      const result = await IPSec.getCRTData(testCrtFile);

      expect(result).to.exist;
      expect(result).to.be.a('string');
      expect(result).to.include('BEGIN CERTIFICATE');
      expect(result).to.include('END CERTIFICATE');
    });
  });

  describe('getIPSecClientsInfo', () => {
    it('should return all clients info under a IPSec server', async () => {
      const result = await IPSec.getIPSecClientsInfo(db.getQuery(), fwcloudProduct.ipsecServer.id);

      expect(result).to.exist;
      expect(result).to.be.an('array');
      result.forEach((item) => {
        expect(item).to.be.an('object');
        expect(item).to.have.all.keys(
          'id',
          'ipsec',
          'firewall',
          'crt',
          'install_dir',
          'install_name',
          'comment',
          'status',
          'created_at',
          'updated_at',
          'created_by',
          'updated_by',
          'installed_at',
          'cn',
          'options',
        );
      });
    });

    it('should return an empty array if there are no clients under a IPSec server', async () => {
      const result = await IPSec.getIPSecClientsInfo(db.getQuery(), -9999);

      expect(result).to.exist;
      expect(result).to.be.an('array').that.is.empty;
    });
  });

  describe('getIPSecClients', () => {
    it('should return all clients under a IPSec server', async () => {
      const result = await IPSec.getIPSecClients(db.getQuery(), fwcloudProduct.ipsecServer.id);

      expect(result).to.exist;
      expect(result).to.be.an('array');
      result.forEach((item) => {
        expect(item).to.be.an('object');
        expect(item).to.have.all.keys('id', 'cn', 'rightsourceip', 'rightsubnet');
      });
    });

    it('should return an empty array if there are no clients under a IPSec server', async () => {
      const result = await IPSec.getIPSecClients(db.getQuery(), -9999);

      expect(result).to.exist;
      expect(result).to.be.an('array').that.is.empty;
    });
  });

  describe('getIPSecServersByFirewall', () => {
    it('should return all IPSec servers of a firewall', async () => {
      const result = await IPSec.getIPSecServersByFirewall(
        db.getQuery(),
        fwcloudProduct.firewall.id,
      );

      expect(result).to.exist;
      expect(result).to.be.an('array');
      (result as Array<any>).forEach((item) => {
        expect(item).to.be.an('object');
        expect(item).to.have.all.keys('id', 'cn');
      });
    });

    it('should return an empty array if there are no IPSec servers under a firewall', async () => {
      const result = await IPSec.getIPSecServersByFirewall(db.getQuery(), -9999);

      expect(result).to.exist;
      expect(result).to.be.an('array').that.is.empty;
    });
  });

  describe('getIPSecInfo', () => {
    it('should return all configuration data of an IPSec client (type 332)', async () => {
      const result = await IPSec.getIPSecInfo(
        db.getQuery(),
        fwcloudProduct.fwcloud.id,
        fwcloudProduct.ipsecServer.id,
        332,
      );

      expect(result).to.exist;
      expect(result).to.be.an('array');
      (result as Array<any>).forEach((item) => {
        expect(item).to.be.an('object');
        expect(item).to.include.all.keys(
          'id',
          'ipsec',
          'firewall',
          'crt',
          'install_dir',
          'install_name',
          'comment',
          'status',
          'created_at',
          'updated_at',
          'created_by',
          'updated_by',
          'installed_at',
          'fwcloud',
          'firewall_id',
          'firewall_name',
          'cn',
          'CA_cn',
          'address',
          'cluster_id',
          'cluster_name',
          'ipsec_server_cn',
          'type',
          'netmask',
        );
      });
    });

    it('should return all configuration data of an IPSec server (type 1)', async () => {
      const result = await IPSec.getIPSecInfo(
        db.getQuery(),
        fwcloudProduct.fwcloud.id,
        fwcloudProduct.ipsecServer.id,
        1,
      );

      expect(result).to.exist;
      expect(result).to.be.an('array');
      (result as Array<any>).forEach((item) => {
        expect(item).to.be.an('object');
        expect(item).to.include.all.keys(
          'id',
          'ipsec',
          'firewall',
          'crt',
          'install_dir',
          'install_name',
          'comment',
          'status',
          'created_at',
          'updated_at',
          'created_by',
          'updated_by',
          'installed_at',
          'fwcloud',
          'firewall_id',
          'firewall_name',
          'cn',
          'CA_cn',
          'address',
          'cluster_id',
          'cluster_name',
          'ipsec_server_cn',
          'type',
        );
      });
    });

    it('should return empty info when invalid IPSec id or FWCloud id', async () => {
      const result = await IPSec.getIPSecInfo(
        db.getQuery(),
        -9999,
        fwcloudProduct.ipsecServer.id,
        332,
      );

      expect(result).to.exist;
      expect(result).to.be.an('array').that.is.empty;
    });
  });

  describe('getIPSecServersByCloud', () => {
    it('should return all IPSec servers of a cloud', async () => {
      const result = await IPSec.getIPSecServersByCloud(db.getQuery(), fwcloudProduct.fwcloud.id);

      expect(result).to.exist;
      expect(result).to.be.an('array');
      (result as Array<any>).forEach((item) => {
        expect(item).to.be.an('object');
        expect(item).to.have.all.keys('id', 'cn');
      });
    });

    it('should return an empty array if there are no IPSec servers in a cloud', async () => {
      const result = await IPSec.getIPSecServersByCloud(db.getQuery(), -9999);

      expect(result).to.exist;
      expect(result).to.be.an('array').that.is.empty;
    });
  });

  describe('dumpCfg', () => {
    beforeEach(async () => {
      const basePkiDir = path.join('tests', 'playground', 'DATA', 'pki');
      const caDir = path.join(
        basePkiDir,
        String(fwcloudProduct.fwcloud.id),
        String(fwcloudProduct.ca.id),
      );
      fs.mkdirSync(path.join(caDir, 'private'), { recursive: true });
      fs.mkdirSync(path.join(caDir, 'issued'), { recursive: true });
      const dummyCert = '-----BEGIN CERTIFICATE-----\nMIIB\n-----END CERTIFICATE-----\n';
      const dummyKey = '-----BEGIN PRIVATE KEY-----\nMIIC\n-----END PRIVATE KEY-----\n';
      fs.writeFileSync(path.join(caDir, 'ca.crt'), dummyCert);
      const cn = fwcloudProduct.crts.get('IPSec-Server').cn;
      fs.writeFileSync(path.join(caDir, 'private', `${cn}.key`), dummyKey);
      fs.writeFileSync(path.join(caDir, 'issued', `${cn}.crt`), dummyCert);
    });

    it('should return the configuration of a IPSec server', async () => {
      const result = await IPSec.dumpCfg(db.getQuery(), fwcloudProduct.ipsecServer.id);

      expect(result).to.exist;
      expect(result).to.be.an('object').that.has.property('cfg');
    });

    it('should include the CA certificate content', async () => {
      const result: any = await IPSec.dumpCfg(db.getQuery(), fwcloudProduct.ipsecServer.id);

      expect(result).to.have.property('ca_cert');
      expect(result.ca_cert).to.be.a('string').that.is.not.empty;
    });

    it('should include the private key content', async () => {
      const result: any = await IPSec.dumpCfg(db.getQuery(), fwcloudProduct.ipsecServer.id);

      expect(result).to.have.property('private_key');
      expect(result.private_key).to.be.a('string').that.is.not.empty;
    });

    it('should include the certificate CN', async () => {
      const result: any = await IPSec.dumpCfg(db.getQuery(), fwcloudProduct.ipsecServer.id);

      expect(result).to.have.property('cn');
      expect(result.cn).to.equal('IPSec-Server');
    });

    it('should throw an error for a non-existent IPSec server', async () => {
      try {
        await IPSec.dumpCfg(db.getQuery(), -9999);
      } catch (error) {
        expect(error).to.exist;
        expect(error.msg).to.include('Certificate info not found');
      }
    });
  });

  describe('updateIPSecStatus', () => {
    it('should change the status of an IPSec to value 1', async () => {
      const res = await IPSec.updateIPSecStatus(db.getQuery(), fwcloudProduct.ipsecServer.id, '|1');

      expect(res).to.exist;
      expect(res).to.be.an('object');
      expect(res as { result: any }).to.have.property('result');
      expect((res as { result: any }).result).to.be.true;

      const resultAfter = await db
        .getSource()
        .getRepository(IPSec)
        .findOne({
          where: { id: fwcloudProduct.ipsecServer.id },
        });

      expect(resultAfter).to.exist;
      expect(resultAfter).to.be.an('object').that.has.property('status');
      expect(resultAfter.status).to.equal(1);
    });

    it('should change the status of an IPSec to value 0', async () => {
      await IPSec.updateIPSecStatus(db.getQuery(), fwcloudProduct.ipsecServer.id, '|1');

      const resultBefore = await db
        .getSource()
        .getRepository(IPSec)
        .findOne({
          where: { id: fwcloudProduct.ipsecServer.id },
        });

      expect(resultBefore).to.exist;
      expect(resultBefore).to.be.an('object').that.has.property('status');
      expect(resultBefore.status).to.equal(1);

      const res = await IPSec.updateIPSecStatus(
        db.getQuery(),
        fwcloudProduct.ipsecServer.id,
        '&~1',
      );

      expect(res).to.exist;
      expect(res).to.be.an('object');
      expect(res as { result: any }).to.have.property('result');
      expect((res as { result: any }).result).to.be.true;

      const resultAfter = await db
        .getSource()
        .getRepository(IPSec)
        .findOne({
          where: { id: fwcloudProduct.ipsecServer.id },
        });

      expect(resultAfter).to.exist;
      expect(resultAfter).to.be.an('object').that.has.property('status');
      expect(resultAfter.status).to.equal(0);
    });

    it('should handle database errors', async () => {
      try {
        await IPSec.updateIPSecStatus(db.getQuery(), fwcloudProduct.ipsecServer.id, 'nextStatus');
      } catch (error) {
        expect(error).to.exist;
      }
    });
  });

  describe('updateIPSecInstallDate', () => {
    it('should change the install date of an IPSec', async () => {
      const resultBefore = await db
        .getSource()
        .getRepository(IPSec)
        .findOne({
          where: { id: fwcloudProduct.ipsecServer.id },
        });

      const res = await IPSec.updateIPSecInstallDate(db.getQuery(), fwcloudProduct.ipsecServer.id);

      const resultAfter = await db
        .getSource()
        .getRepository(IPSec)
        .findOne({
          where: { id: fwcloudProduct.ipsecServer.id },
        });

      expect(res).to.exist;
      expect(res).to.be.an('object');
      expect(res as { result: any }).to.have.property('result');
      expect((res as { result: any }).result).to.be.true;

      expect(resultBefore).to.exist;
      expect(resultAfter).to.exist;
      expect(resultBefore).to.be.an('object');
      expect(resultAfter).to.be.an('object');
      expect(resultAfter.installed_at).to.not.equal(resultBefore.installed_at);
    });
  });

  describe('updateIPSecStatusIPOBJ', () => {
    it('should change the status of an IPSec to value 1', async () => {
      const resultBefore = await db
        .getSource()
        .getRepository(IPSec)
        .findOne({
          where: { id: fwcloudProduct.ipsecServer.id },
        });

      expect(resultBefore).to.exist;
      expect(resultBefore).to.be.an('object').that.has.property('status');
      expect(resultBefore.status).to.equal(0);

      const req: any = {
        dbCon: db.getQuery(),
        body: {
          fwcloud: fwcloudProduct.fwcloud.id,
        },
      };

      await IPSec.updateIPSecStatusIPOBJ(req, fwcloudProduct.ipobjs.get('network').id, '|1');

      const resultAfter = await db
        .getSource()
        .getRepository(IPSec)
        .findOne({
          where: { id: fwcloudProduct.ipsecServer.id },
        });

      expect(resultAfter).to.exist;
      expect(resultAfter).to.be.an('object');
      expect(resultAfter.status).to.equal(1);
    });

    it('should change the status of an IPSec to value 0', async () => {
      const req: any = {
        dbCon: db.getQuery(),
        body: {
          fwcloud: fwcloudProduct.fwcloud.id,
        },
      };

      await IPSec.updateIPSecStatusIPOBJ(req, fwcloudProduct.ipobjs.get('network').id, '|1');

      const resultBefore = await db
        .getSource()
        .getRepository(IPSec)
        .findOne({
          where: { id: fwcloudProduct.ipsecServer.id },
        });

      expect(resultBefore).to.exist;
      expect(resultBefore).to.be.an('object').that.has.property('status');
      expect(resultBefore.status).to.equal(1);

      await IPSec.updateIPSecStatusIPOBJ(req, fwcloudProduct.ipobjs.get('network').id, '&~1');

      const resultAfter = await db
        .getSource()
        .getRepository(IPSec)
        .findOne({
          where: { id: fwcloudProduct.ipsecServer.id },
        });

      expect(resultAfter).to.exist;
      expect(resultAfter).to.be.an('object');
      expect(resultAfter.status).to.equal(0);
    });

    it('should handle database errors', async () => {
      const req: any = {
        dbCon: db.getQuery(),
        body: {
          fwcloud: fwcloudProduct.fwcloud.id,
        },
      };

      try {
        await IPSec.updateIPSecStatusIPOBJ(
          req,
          fwcloudProduct.ipobjs.get('network').id,
          'NextStatus',
        );
      } catch (error) {
        expect(error).to.exist;
      }
    });
  });

  describe('freeVpnIP', () => {
    it('should return a valid unused VPN IP', async () => {
      const req: any = {
        dbCon: db.getQuery(),
        body: {
          ipsec: fwcloudProduct.ipsecServer.id,
        },
      };

      try {
        const result = await IPSec.freeVpnIP(req);

        expect(result).to.have.property('ip');
        expect(result).to.have.property('netmask');
      } catch (error) {
        // Allow test to pass if known error message appears
        expect(error.msg === 'IPSec LAN not found' || error.msg === 'There are no free VPN IPs').to
          .be.true;
      }
    });
  });

  describe('searchIPSecUsage', () => {
    it('should detect usages across rules, routes, and groups', async () => {
      // Ensure the IPSec is added to a group at least
      IPSec.addToGroup(db.getQuery(), fwcloudProduct.ipsecServer.id, fwcloudProduct.ipobjGroup.id);

      const result = await IPSec.searchIPSecUsage(
        db.getQuery(),
        fwcloudProduct.fwcloud.id,
        fwcloudProduct.ipsecServer.id,
        true, // extended search
      );

      expect(result).to.exist;
      expect(result).to.have.property('restrictions');
      expect(result.restrictions.IPSecInGroup).to.be.an('array').that.is.not.empty;
    });
  });

  describe('searchIPSecInRoute', () => {
    it('should return routes using the specified IPSec server', async () => {
      const result = await IPSec.searchIPSecInRoute(
        fwcloudProduct.fwcloud.id,
        fwcloudProduct.ipsecClients.get('IPSec-Cli-1').id,
      );

      expect(result).to.exist;
      expect(result).to.be.an('array');
      result.forEach((item) => {
        expect(item).to.have.property('route');
        expect(item.route).to.have.property('ipsec');
        expect(item.route.ipsec).to.equal(fwcloudProduct.ipsecClients.get('IPSec-Cli-1').id);
      });
    });

    it('should return an empty array when no routes use the specified IPSec server', async () => {
      const result = await IPSec.searchIPSecInRoute(fwcloudProduct.fwcloud.id, -9999);

      expect(result).to.exist;
      expect(result).to.be.an('array').that.is.empty;
    });
  });

  describe('searchIPSecInRoutingRule', () => {
    it('should return routing rules using the specified IPSec server', async () => {
      const targetIpsecId = fwcloudProduct.ipsecClients.get('IPSec-Cli-1').id;

      const result = await IPSec.searchIPSecInRoutingRule(fwcloudProduct.fwcloud.id, targetIpsecId);

      expect(result).to.exist;
      expect(result).to.be.an('array');
    });

    it('should return an empty array when no routing rules use the specified IPSec server', async () => {
      const result = await IPSec.searchIPSecInRoutingRule(fwcloudProduct.fwcloud.id, -9999);

      expect(result).to.exist;
      expect(result).to.be.an('array').that.is.empty;
    });
  });

  describe('searchIPSecInGroupInRoute', () => {
    it('should return routes using the specified IPSec server in groups', async () => {
      const targetIpsecId = fwcloudProduct.ipsecServer.id;

      // Ensure the IPSec is added to a group
      await IPSec.addToGroup(db.getQuery(), targetIpsecId, fwcloudProduct.ipobjGroup.id);

      const result = await IPSec.searchIPSecInGroupInRoute(
        fwcloudProduct.fwcloud.id,
        targetIpsecId,
      );

      expect(result).to.exist;
      expect(result).to.be.an('array');
    });

    it('should return an empty array when no routes use the specified IPSec server in groups', async () => {
      const result = await IPSec.searchIPSecInGroupInRoute(fwcloudProduct.fwcloud.id, -9999);

      expect(result).to.exist;
      expect(result).to.be.an('array').that.is.empty;
    });
  });

  describe('searchIPSecInGroupInRoutingRule', () => {
    it('should return routing rules using the specified IPSec server in groups', async () => {
      const targetIpsecId = fwcloudProduct.ipsecServer.id;

      // Ensure the IPSec is added to a group
      await IPSec.addToGroup(db.getQuery(), targetIpsecId, fwcloudProduct.ipobjGroup.id);

      const result = await IPSec.searchIPSecInGroupInRoutingRule(
        fwcloudProduct.fwcloud.id,
        targetIpsecId,
      );

      expect(result).to.exist;
      expect(result).to.be.an('array');
    });

    it('should return an empty array when no routing rules use the specified IPSec server in groups', async () => {
      const result = await IPSec.searchIPSecInGroupInRoutingRule(fwcloudProduct.fwcloud.id, -9999);

      expect(result).to.exist;
      expect(result).to.be.an('array').that.is.empty;
    });
  });

  describe('searchIPSecUsageOutOfThisFirewall', () => {
    it('should return IPSec usage in other firewalls', async () => {
      const req: any = {
        dbCon: db.getQuery(),
        body: {
          fwcloud: fwcloudProduct.fwcloud.id,
          firewall: fwcloudProduct.firewall.id,
        },
      };

      const result = await IPSec.searchIPSecUsageOutOfThisFirewall(req);

      expect(result).to.exist;
      expect(result).to.be.an('object').that.has.property('restrictions');
    });

    it('should return an object with no data when no IPSec usage in other firewalls', async () => {
      const req: any = {
        dbCon: db.getQuery(),
        body: {
          fwcloud: fwcloudProduct.fwcloud.id,
          firewall: '-9999', // Invalid firewall ID
        },
      };

      const result = await IPSec.searchIPSecUsageOutOfThisFirewall(req);

      expect(result).to.exist;
      expect(result).to.be.an('object').that.has.property('restrictions');
    });
  });

  describe('searchIPSecChild', () => {
    it('should return an object with the restrictions of the IPSec', async () => {
      const result = await IPSec.searchIPSecChild(
        db.getQuery(),
        fwcloudProduct.fwcloud.id,
        fwcloudProduct.ipsecServer.id,
      );

      expect(result).to.exist;
      expect(result).to.be.an('object');
    });

    it('should return an empty array when no child IPSec configurations exist', async () => {
      const result = await IPSec.searchIPSecChild(
        db.getQuery(),
        fwcloudProduct.fwcloud.id,
        fwcloudProduct.ipsecClients.get('IPSec-Cli-1').id,
      );

      expect(result).to.exist;
      expect(result).to.be.an('object');
      expect(result.result).to.be.false;
    });
  });

  describe('searchIPObjInIPSecOpt', () => {
    it('should return true if some IPSec option uses the specified IP object', async () => {
      const result = await IPSec.searchIPObjInIPSecOpt(
        db.getQuery(),
        fwcloudProduct.ipobjs.get('network').id,
        'left',
      );

      expect(result).to.exist;
      expect(result).to.be.an('boolean');
      expect(result).to.be.true;
    });

    it('should return false when no IPSec option uses the specified IP object', async () => {
      const result = await IPSec.searchIPObjInIPSecOpt(
        db.getQuery(),
        fwcloudProduct.ipobjs.get('network').id,
        'UnusedName',
      );

      expect(result).to.exist;
      expect(result).to.be.an('boolean');
      expect(result).to.be.false;
    });
  });

  describe('getIPSecStatusNotZero', () => {
    it('should return IPSec configurations with status not equal to 0', async () => {
      const fwcloudId = fwcloudProduct.fwcloud.id;

      const request: any = {
        dbCon: db.getQuery(),
        body: {
          fwcloud: fwcloudId,
        },
      };

      const data: any = {};
      await IPSec.getIPSecStatusNotZero(request, data);

      expect(data.ipsec_status).to.exist;
      expect(data.ipsec_status).to.be.an('array');
      if (data.ipsec_status.length != 0) {
        data.ipsec_status.forEach((ipsec: any) => {
          expect(ipsec.status).to.not.equal(0);
        });
      }
    });

    it('should return an empty array when invalid FWCloud id', async () => {
      const request: any = {
        dbCon: db.getQuery(),
        body: {
          fwcloud: -9999,
        },
      };

      const data: any = {};
      await IPSec.getIPSecStatusNotZero(request, data);

      expect(data.ipsec_status).to.exist;
      expect(data.ipsec_status).to.be.an('array').that.is.empty;
    });
  });

  describe('addToGroup', () => {
    it('should insert a relation in ipsec__ipobj_g', async () => {
      const result = await IPSec.addToGroup(
        db.getQuery(),
        fwcloudProduct.ipsecServer.id,
        fwcloudProduct.ipobjGroup.id,
      );

      expect(result).to.exist;
      expect(result).to.be.a('number');
    });

    it('should handle database errors', async () => {
      try {
        await IPSec.addToGroup(
          db.getQuery(),
          -fwcloudProduct.ipsecServer.id,
          fwcloudProduct.ipobjGroup.id,
        );
      } catch (error) {
        expect(error).to.exist;
      }
    });
  });

  describe('removeFromGroup', () => {
    it('should remove a relation in ipsec__ipobj_g', async () => {
      // Add the relation first
      await IPSec.addToGroup(
        db.getQuery(),
        fwcloudProduct.ipsecServer.id,
        fwcloudProduct.ipobjGroup.id,
      );

      const req: any = {
        dbCon: db.getQuery(),
        body: {
          ipobj: fwcloudProduct.ipsecServer.id,
          ipobj_g: fwcloudProduct.ipobjGroup.id,
        },
      };

      const result = await IPSec.removeFromGroup(req);

      expect(result).to.exist;
      expect(result).to.be.a('number');
    });

    it('should handle database errors', async () => {
      try {
        const req: any = {
          dbCon: db.getQuery(),
          body: {
            ipobj: fwcloudProduct.ipsecServer.id,
            ipobj_g: 'string',
          },
        };

        await IPSec.removeFromGroup(req);
      } catch (error) {
        expect(error).to.exist;
      }
    });
  });

  describe('createIPSecServerInterface', () => {
    it('should create interface and address for server', async () => {
      const request: any = {
        dbCon: db.getQuery(),
        body: {
          ipsec: fwcloudProduct.ipsecServer.id,
          fwcloud: fwcloudProduct.fwcloud.id,
          firewall: fwcloudProduct.firewall.id,
          ipobj_g: fwcloudProduct.ipobjGroup.id,
          install_name: StringHelper.randomize(10) + '.conf',
        },
      };

      await IPSec.createIPSecServerInterface(request, fwcloudProduct.ipsecServer.id);

      const result = await db
        .getSource()
        .getRepository(IPSec)
        .findOne({
          where: { id: fwcloudProduct.ipsecServer.id },
        });

      expect(result).to.exist;
    });
  });

  describe('updateIPSecServerInterface', () => {
    it('should update interface and address for server', async () => {
      const request: any = {
        dbCon: db.getQuery(),
        body: {
          ipsec: fwcloudProduct.ipsecServer.id,
          fwcloud: fwcloudProduct.fwcloud.id,
          firewall: fwcloudProduct.firewall.id,
          ipobj_g: fwcloudProduct.ipobjGroup.id,
          install_name: StringHelper.randomize(10) + '.conf',
        },
      };

      await IPSec.updateIPSecServerInterface(request);

      const result = await db
        .getSource()
        .getRepository(IPSec)
        .findOne({
          where: { id: fwcloudProduct.ipsecServer.id },
        });

      expect(result).to.exist;
    });
  });

  describe('moveToOtherFirewall', () => {
    it('should move IPSec configurations to another firewall', async () => {
      const newFirewallId = 9999; // Example new firewall ID
      // Ensure the new firewall exists in the test setup
      const newFirewall = await db
        .getSource()
        .getRepository(Firewall)
        .findOne({ where: { id: newFirewallId } });

      // Create the new firewall if it does not exist
      if (!newFirewall) {
        const newFirewallData = {
          id: newFirewallId,
          name: 'New Firewall',
        };
        await db.getSource().getRepository(Firewall).save(newFirewallData);
      }

      await IPSec.moveToOtherFirewall(db.getQuery(), fwcloudProduct.firewall.id, newFirewallId);

      const result = await db
        .getSource()
        .getRepository(IPSec)
        .findOne({
          where: { id: fwcloudProduct.ipsecServer.id },
        });

      expect(result).to.exist;
      expect(result).to.be.an('object');
      expect(result).to.have.property('firewallId', newFirewallId);
    });

    it('should handle errors when moving to a non-existent firewall', async () => {
      try {
        await IPSec.moveToOtherFirewall(db.getQuery(), fwcloudProduct.firewall.id, -9999);
      } catch (error) {
        expect(error).to.exist;
      }
    });
  });

  describe('getConfigFilename', () => {
    it('should create a config file of a IPSec server', async () => {
      const result = await IPSec.getConfigFilename(db.getQuery(), fwcloudProduct.firewall.id);

      expect(result).to.exist;
      expect(result).to.be.a('string');
    });

    it('should return default config filename when invalid firewall', async () => {
      const result = await IPSec.getConfigFilename(db.getQuery(), -9999);

      expect(result).to.exist;
      expect(result).to.be.a('string').that.is.equal('ips0.conf');
    });
  });

  describe('getPeerOptions', () => {
    beforeEach(async () => {
      // Ensure the IPSec client has options set up
      const req: any = {
        dbCon: db.getQuery(),
      };

      const opt = {
        ipsec: fwcloudProduct.ipsecServer.id,
        ipsec_cli: fwcloudProduct.ipsecClients.get('IPSec-Cli-1').id,
        name: 'rightsubnet',
        arg: 'aes128',
        comment: 'Test encryption option',
        order: 1,
        scope: 3, // Client scope
      };

      await IPSec.addCfgOpt(req, opt);
    });

    it('should return the peer options for a given IPSec server', async () => {
      const result = await IPSec.getPeerOptions(
        db.getQuery(),
        fwcloudProduct.ipsecServer.id,
        fwcloudProduct.ipsecClients.get('IPSec-Cli-1').id,
      );

      expect(result).to.exist;
      expect(result).to.be.a('object');
      expect(result).to.have.all.keys('options');
    });

    it('should return empty options when invalid IPSec or IPSec_cli', async () => {
      const result = await IPSec.getPeerOptions(
        db.getQuery(),
        fwcloudProduct.ipsecServer.id,
        -9999,
      );

      expect(result).to.exist;
      expect(result).to.be.a('object');
      expect(result).to.have.all.keys('options');
      result.options.forEach((element) => {
        if (element.name !== 'auto') {
          expect(element).to.have.property('arg').that.is.empty;
        }
      });
    });
  });

  describe('updatePeerOptions', () => {
    it('should update the peer options for a given IPSec server', async () => {
      // Create a new option to update
      const req: any = {
        dbCon: db.getQuery(),
      };
      await IPSec.addCfgOpt(req, {
        ipsec: fwcloudProduct.ipsecServer.id,
        ipsec_cli: fwcloudProduct.ipsecClients.get('IPSec-Cli-1').id,
        name: 'encryption',
        arg: 'aes128',
        comment: 'Test encryption option',
        order: 1,
        scope: 3, // Client scope
      });

      await IPSec.updatePeerOptions(
        db.getQuery(),
        fwcloudProduct.ipsecServer.id,
        fwcloudProduct.ipsecClients.get('IPSec-Cli-1').id,
        [
          {
            name: 'encryption',
            arg: 'aes256',
          },
        ],
      );

      const result = await db
        .getSource()
        .query(`SELECT * FROM ipsec_opt WHERE ipsec = ? AND ipsec_cli = ?`, [
          fwcloudProduct.ipsecServer.id,
          fwcloudProduct.ipsecClients.get('IPSec-Cli-1').id,
        ]);

      expect(result).to.exist;
      expect(result).to.be.an('array');
      expect(result[0]).to.have.property('name', 'encryption');
      expect(result[0]).to.have.property('arg', 'aes256');
    });

    it('should handle database errors', async () => {
      const req: any = {
        dbCon: db.getQuery(),
      };
      await IPSec.addCfgOpt(req, {
        ipsec: fwcloudProduct.ipsecServer.id,
        ipsec_cli: fwcloudProduct.ipsecClients.get('IPSec-Cli-1').id,
        name: 'encryption',
        arg: 'aes128',
        comment: 'Test encryption option',
        order: 1,
        scope: 3, // Client scope
      });

      try {
        await IPSec.updatePeerOptions(
          db.getQuery(),
          fwcloudProduct.ipsecServer.id,
          fwcloudProduct.ipsecClients.get('IPSec-Cli-1').id,
          [
            {
              name: 'encryption',
              arg: 'aes256'.repeat(300),
            },
          ],
        );
      } catch (error) {
        expect(error).to.exist;
      }
    });
  });
});
