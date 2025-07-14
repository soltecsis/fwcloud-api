import { EntityManager } from 'typeorm';
import { IPSec } from '../../../../../src/models/vpn/ipsec/IPSec';
import { FwCloudFactory, FwCloudProduct } from '../../../../utils/fwcloud-factory';
import db from '../../../../../src/database/database-manager';
import { expect } from '../../../../mocha/global-setup';

describe(IPSec.name, () => {
  let fwcloudProduct: FwCloudProduct;

  let manager: EntityManager;

  beforeEach(async () => {
    manager = db.getSource().manager;
    fwcloudProduct = await new FwCloudFactory().make();
  });

  describe('addCfg', () => {});

  describe('updateCfg', () => {});

  describe('addCfgOpt', () => {});

  describe('updateCfgOpt', () => {});

  describe('updateCfgOptByipobj', () => {});

  describe('updateIpObjCfgOpt', () => {});

  describe('isIPSecServer', () => {});

  describe('checkIpobjInIPSecOpt', () => {});

  describe('addPrefix', () => {});

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
    it('should ', async () => {
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

  describe('updateIPSecStatus', () => {});

  describe('updateIPSecInstallDate', () => {});

  describe('updateIPSecStatusIPOBJ', () => {});

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

  describe('addToGroup', () => {});

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
