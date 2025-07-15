import { EntityManager } from 'typeorm';
import { IPSec } from '../../../../../src/models/vpn/ipsec/IPSec';
import { FwCloudFactory, FwCloudProduct } from '../../../../utils/fwcloud-factory';
import db from '../../../../../src/database/database-manager';
import { expect } from '../../../../mocha/global-setup';
import { Crt } from '../../../../../src/models/vpn/pki/Crt';

describe(IPSec.name, () => {
  let fwcloudProduct: FwCloudProduct;

  let manager: EntityManager;

  beforeEach(async () => {
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
  });

  describe('updateCfgOpt', () => {
    it('should update a IPSec option', async () => {
      const resultBefore = await db
        .getSource()
        .query(`SELECT * FROM ipsec_opt WHERE ipsec = ? AND name = ?`, [
          fwcloudProduct.ipsecServer.id,
          'Address',
        ]);

      await IPSec.updateCfgOpt(
        db.getQuery(),
        fwcloudProduct.ipsecServer.id,
        'Address',
        '10.10.10.10',
      );

      const resultAfter = await db
        .getSource()
        .query(`SELECT * FROM ipsec_opt WHERE ipsec = ? AND name = ?`, [
          fwcloudProduct.ipsecServer.id,
          'Address',
        ]);

      expect(resultBefore).to.exist;
      expect(resultAfter).to.exist;
      expect(resultBefore).to.be.an('array').that.is.not.empty;
      expect(resultAfter).to.be.an('array').that.is.not.empty;
      expect(resultBefore[0]).to.have.property('arg');
      expect(resultAfter[0]).to.have.property('arg');
      expect(resultAfter[0].arg).to.not.equal(resultBefore[0].arg);
    });
  });

  describe('updateCfgOptByipobj', () => {
    it('should update a IPSec option', async () => {
      const resultBefore = await db
        .getSource()
        .query(`SELECT * FROM ipsec_opt WHERE ipobj = ? AND name = ?`, [
          fwcloudProduct.ipobjs.get('network').id,
          'Address',
        ]);

      await IPSec.updateCfgOptByipobj(
        db.getQuery(),
        fwcloudProduct.ipobjs.get('network').id,
        'Address',
        '10.10.10.10',
      );

      const resultAfter = await db
        .getSource()
        .query(`SELECT * FROM ipsec_opt WHERE ipobj = ? AND name = ?`, [
          fwcloudProduct.ipobjs.get('network').id,
          'Address',
        ]);

      expect(resultBefore).to.exist;
      expect(resultAfter).to.exist;
      expect(resultBefore).to.be.an('array').that.is.not.empty;
      expect(resultAfter).to.be.an('array').that.is.not.empty;
      expect(resultBefore[0]).to.have.property('arg');
      expect(resultAfter[0]).to.have.property('arg');
      expect(resultAfter[0].arg).to.not.equal(resultBefore[0].arg);
    });
  });

  describe('updateIpObjCfgOpt', () => {
    it('should change a IPSec option from the given IPSec', async () => {
      const resultBefore = await db
        .getSource()
        .query(`SELECT * FROM ipsec_opt WHERE ipsec = ? AND name = ?`, [
          fwcloudProduct.ipsecServer.id,
          'Address',
        ]);

      await IPSec.updateIpObjCfgOpt(
        db.getQuery(),
        fwcloudProduct.ipobjs.get('address').id,
        fwcloudProduct.ipsecServer.id,
        'Address',
      );

      const resultAfter = await db
        .getSource()
        .query(`SELECT * FROM ipsec_opt WHERE ipsec = ? AND name = ?`, [
          fwcloudProduct.ipsecServer.id,
          'Address',
        ]);

      expect(resultBefore).to.exist;
      expect(resultAfter).to.exist;
      expect(resultBefore).to.be.an('array').that.is.not.empty;
      expect(resultAfter).to.be.an('array').that.is.not.empty;
      expect(resultBefore[0]).to.have.property('ipobj');
      expect(resultAfter[0]).to.have.property('ipobj');
      expect(resultAfter[0].ipobj).to.not.equal(resultBefore[0].ipobj);
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
    it('should return an array of ipobj options for a given IPSec configuration', async () => {
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
  });

  describe('delCfgOptAll', () => {});

  describe('delCfgOptByScope', () => {});

  describe('delCfg', () => {});

  describe('delCfgAll', () => {});

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
  });

  describe('getOptData', () => {
    it('should return option data for a given IPSec server ID and data name', async () => {
      const result = await IPSec.getOptData(
        db.getQuery(),
        fwcloudProduct.ipsecServer.id,
        'Address',
      );

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
  });

  describe('getCRTData', () => {});

  describe('getIPSecClientsInfo', () => {
    it('should return all clients info under a IPSec server', async () => {
      const result = await IPSec.getIPSecClientsInfo(db.getQuery(), fwcloudProduct.ipsecServer.id);

      expect(result).to.exist;
      expect(result).to.be.an('array');
    });
  });

  describe('getIPSecClients', () => {
    it('should return all clients under a IPSec server', async () => {
      const result = await IPSec.getIPSecClients(db.getQuery(), fwcloudProduct.ipsecServer.id);

      expect(result).to.exist;
      expect(result).to.be.an('array');
      result.forEach((item) => {
        expect(item).to.be.an('object');
        expect(item).to.have.all.keys('id', 'cn', 'allowedips');
      });
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
  });

  describe('getIPSecInfo', () => {
    it('should return all configuration data of an IPSec client', async () => {
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
          'public_key',
          'private_key',
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
        if (item.type === 332) {
          expect(item).to.have.property('netmask');
        }
      });
    });
  });

  describe('getIPSecServersByCloud', () => {
    it('should return all IPSec servers of a cloud', async () => {
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
  });

  describe('dumpCfg', () => {});

  describe('updateIPSecStatus', () => {
    it('should change the status of an IPSec', async () => {
      const resultBefore = await db
        .getSource()
        .getRepository(IPSec)
        .findOne({
          where: { id: fwcloudProduct.ipsecServer.id },
        });

      const res = await IPSec.updateIPSecStatus(db.getQuery(), fwcloudProduct.ipsecServer.id, '|1');

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
      expect(resultAfter.status).to.not.equal(resultBefore.status);
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
    it('should change the status of an IPSec', async () => {
      const resultBefore = await db
        .getSource()
        .getRepository(IPSec)
        .findOne({
          where: { id: fwcloudProduct.ipsecServer.id },
        });

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

      expect(resultBefore).to.exist;
      expect(resultAfter).to.exist;
      expect(resultBefore).to.be.an('object');
      expect(resultAfter).to.be.an('object');
      expect(resultAfter.status).to.not.equal(resultBefore.status);
    });
  });

  describe('freeVpnIP', () => {});

  describe('searchIPSecUsage', () => {});

  describe('searchIPSecInRoute', () => {});

  describe('searchIPSecInRoutingRule', () => {});

  describe('searchIPSecInGroupInRoute', () => {});

  describe('searchIPSecInGroupInRoutingRule', () => {});

  describe('searchIPSecUsageOutOfThisFirewall', () => {});

  describe('searchIPSecChild', () => {});

  describe('searchIPObjInIPSecOpt', () => {});

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
  });

  describe('removeFromGroup', () => {});

  describe('handleIPSecInterface', () => {});

  describe('createIPSecServerInterface', () => {});

  describe('updateIPSecServerInterface', () => {});

  describe('moveToOtherFirewall', () => {});

  describe('getConfigFilename', () => {
    it('should create a config file of a IPSec server', async () => {
      const result = await IPSec.getConfigFilename(db.getQuery(), fwcloudProduct.firewall.id);

      expect(result).to.exist;
      expect(result).to.be.a('string');
    });
  });

  describe('getPeerOptions', () => {
    it('should return the peer options for a given IPSec server', async () => {
      const result = await IPSec.getPeerOptions(
        db.getQuery(),
        fwcloudProduct.ipsecServer.id,
        fwcloudProduct.ipsecClients.get('IPSec-Cli-1').id,
      );

      expect(result).to.exist;
      expect(result).to.be.a('object');
      expect(result).to.have.all.keys('publicKey', 'options');
    });
  });

  describe('updatePeerOptions', () => {});
});
