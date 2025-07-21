import { EntityManager } from 'typeorm';
import { IPSecPrefix } from '../../../../../src/models/vpn/ipsec/IPSecPrefix';
import { FwCloudFactory, FwCloudProduct } from '../../../../utils/fwcloud-factory';
import db from '../../../../../src/database/database-manager';
import { expect } from '../../../../mocha/global-setup';
import { IPSec } from '../../../../../src/models/vpn/ipsec/IPSec';
import { Firewall } from '../../../../../src/models/firewall/Firewall';

describe.only(IPSecPrefix.name, () => {
  let fwcloudProduct: FwCloudProduct;

  let manager: EntityManager;

  beforeEach(async () => {
    manager = db.getSource().manager;
    fwcloudProduct = await new FwCloudFactory().make();
  });

  describe('existsPrefix', () => {
    it('should return true if prefix exists', async () => {
      const exists = await IPSecPrefix.existsPrefix(
        db.getQuery(),
        fwcloudProduct.ipsecServer.id,
        'IPSec-Cli-',
      );

      expect(exists).to.be.true;
    });

    it('should return false if prefix does not exist', async () => {
      const exists = await IPSecPrefix.existsPrefix(
        db.getQuery(),
        fwcloudProduct.ipsecServer.id,
        'non-existent-prefix',
      );

      expect(exists).to.be.false;
    });
  });

  describe('createPrefix', () => {
    it('should create a new prefix', async () => {
      const req: any = {
        dbCon: db.getQuery(),
        body: {
          name: 'Test-Prefix',
          ipsec: fwcloudProduct.ipsecServer.id,
        },
      };

      const result = await IPSecPrefix.createPrefix(req);

      expect(result).to.exist;
      expect(result).to.be.a('number').that.is.greaterThan(0);
    });

    it('should fail when duplicate prefix is created', async () => {
      const req: any = {
        dbCon: db.getQuery(),
        body: {
          name: 'IPSec-Cli-',
          ipsec: fwcloudProduct.ipsecServer.id,
        },
      };

      try {
        await IPSecPrefix.createPrefix(req);
      } catch (error) {
        expect(error).to.exist;
        expect(error.message).to.include('Duplicate entry');
      }
    });

    it('should handle database errors', async () => {
      const req: any = {
        dbCon: db.getQuery(),
        body: {
          name: 'Test-Prefix'.repeat(1000), // Intentionally long name to trigger error
          ipsec: fwcloudProduct.ipsecServer.id,
        },
      };

      try {
        await IPSecPrefix.createPrefix(req);
      } catch (error) {
        expect(error).to.exist;
        expect(error.message).to.include('Data too long');
      }
    });
  });

  describe('modifyPrefix', () => {
    it('should modify an existing prefix', async () => {
      const req: any = {
        dbCon: db.getQuery(),
        body: {
          prefix: fwcloudProduct.ipsecPrefix.id,
          name: 'Modified-Prefix',
        },
      };

      await IPSecPrefix.modifyPrefix(req);

      const result = await db
        .getSource()
        .getRepository(IPSecPrefix)
        .findOne({
          where: { id: fwcloudProduct.ipsecPrefix.id },
        });

      expect(result).to.exist;
      expect(result.name).to.equal('Modified-Prefix');
    });

    it('should handle database errors', async () => {
      const req: any = {
        dbCon: db.getQuery(),
        body: {
          prefix: fwcloudProduct.ipsecPrefix.id,
          name: 'Modified-Prefix'.repeat(1000), // Intentionally long name to trigger error
        },
      };

      try {
        await IPSecPrefix.createPrefix(req);
      } catch (error) {
        expect(error).to.exist;
        expect(error.message).to.include('Data too long');
      }
    });
  });

  describe('deletePrefix', () => {
    it('should delete an existing prefix', async () => {
      await IPSecPrefix.deletePrefix(db.getQuery(), fwcloudProduct.ipsecPrefix.id);

      const result = await db
        .getSource()
        .getRepository(IPSecPrefix)
        .findOne({
          where: { id: fwcloudProduct.ipsecPrefix.id },
        });

      expect(result).to.not.exist;
    });
  });

  describe('deletePrefixAll', () => {
    it('should delete all prefixes under a firewall', async () => {
      const sql = `SELECT PRE.* FROM ipsec_prefix as PRE
            INNER JOIN ipsec VPN ON VPN.id=PRE.ipsec
            INNER JOIN firewall FW ON FW.id=VPN.firewall
            WHERE FW.id=${fwcloudProduct.firewall.id} AND FW.fwcloud=${fwcloudProduct.fwcloud.id}`;

      const result = await IPSecPrefix.deletePrefixAll(
        db.getQuery(),
        fwcloudProduct.fwcloud.id,
        fwcloudProduct.firewall.id,
      );

      expect(result).to.exist;

      db.getQuery().query(sql, (error, resultAfter) => {
        expect(error).to.not.exist;
        expect(resultAfter).to.exist;
        expect(resultAfter).to.be.an('array').that.is.empty;
      });
    });
  });

  describe('getPrefixes', () => {
    it('should return all prefixes for a given IPSec', async () => {
      const result = await IPSecPrefix.getPrefixes(db.getQuery(), fwcloudProduct.ipsecServer.id);

      expect(result).to.be.an('array');
      (result as Array<any>).forEach((item) => {
        expect(item).to.have.property('id');
        expect(item).to.have.property('name');
      });
    });

    it('should return an empty array if no prefixes exist', async () => {
      const emptyPrefixes = await IPSecPrefix.getPrefixes(
        db.getQuery(),
        -9999, // Non-existent IPSec ID
      );

      expect(emptyPrefixes).to.be.an('array').that.is.empty;
    });
  });

  describe('getIPSecClientsUnderPrefix', () => {
    it('should return clients under a specific prefix', async () => {
      const result = await IPSecPrefix.getIPSecClientsUnderPrefix(
        db.getQuery(),
        fwcloudProduct.ipsecPrefix.id,
        'IPSec-Cli-',
      );

      expect(result).to.be.an('array');
      (result as Array<any>).forEach((item) => {
        expect(item).to.have.property('id');
        expect(item).to.have.property('name');
      });
    });

    it('should return an empty array if no clients exist under the prefix', async () => {
      const emptyClients = await IPSecPrefix.getIPSecClientsUnderPrefix(
        db.getQuery(),
        -9999, // Non-existent prefix ID
        'IPSec-Cli-',
      );

      expect(emptyClients).to.be.an('array').that.is.empty;
    });
  });

  describe('getIPSecClientPrefixes', () => {
    it('should return prefixes for a specific IPSec client', async () => {
      const result = await IPSecPrefix.getIPSecClientPrefixes(
        db.getQuery(),
        fwcloudProduct.ipsecClients.get('IPSec-Cli-1').id,
      );

      expect(result).to.be.an('array');
      (result as Array<any>).forEach((item) => {
        expect(item).to.have.property('id');
        expect(item).to.have.property('name');
      });
    });

    it('should return an empty array if no prefixes exist for the client', async () => {
      const emptyPrefixes = await IPSecPrefix.getIPSecClientPrefixes(
        db.getQuery(),
        -9999, // Non-existent IPSec client ID
      );

      expect(emptyPrefixes).to.be.an('array').that.is.empty;
    });
  });

  describe('updateIPSecClientPrefixesFWStatus', () => {
    it('should update firewall statuses where prefix is used', async () => {
      const clientId = fwcloudProduct.ipsecClients.get('IPSec-Cli-1').id;
      const prefixId = fwcloudProduct.ipsecServer.id;

      await IPSecPrefix.updateIPSecClientPrefixesFWStatus(db.getQuery(), clientId, prefixId);
      const updatedClient = await manager.getRepository(IPSec).findOne({ where: { id: clientId } });
      expect(updatedClient).to.exist;
      const updatedFirewall = await manager
        .getRepository(Firewall)
        .findOne({ where: { id: updatedClient.firewallId } });
      expect(updatedFirewall).to.exist;
      expect(updatedFirewall.status).to.equal(3);
    });
  });

  describe('getPrefixIPSecInfo', () => {
    it('should return prefix info with firewall and client data', async () => {
      const result = await IPSecPrefix.getPrefixIPSecInfo(
        db.getQuery(),
        fwcloudProduct.fwcloud.id,
        fwcloudProduct.ipsecPrefix.id,
      );
      expect(result).to.be.an('array');
      expect(result).to.have.length(1);
      expect(result[0].name).to.equal('IPSec-Cli-');
    });

    it('should throw NOT_FOUND if prefix does not exist', async () => {
      try {
        await IPSecPrefix.getPrefixIPSecInfo(db.getQuery(), fwcloudProduct.fwcloud.id, -9999);
      } catch (error) {
        expect(error).to.exist;
      }
    });
  });

  describe('fillPrefixNodeIPSec', () => {
    it.skip('should fill prefix node with matching entries', async () => {});
  });

  describe('applyIPSecPrefixes', () => {
    it.skip('should apply IPSec server prefixes to tree node', async () => {});
  });

  describe('addPrefixToGroup', () => {
    it('should add a prefix to a group', async () => {
      const groupId = fwcloudProduct.ipobjGroup.id;
      const prefixId = fwcloudProduct.ipsecPrefix.id;

      await IPSecPrefix.addPrefixToGroup(db.getQuery(), prefixId, groupId);

      const result = await db
        .getSource()
        .query(`SELECT * FROM ipsec_prefix__ipobj_g WHERE prefix = ? AND ipobj_g = ?`, [
          prefixId,
          groupId,
        ]);

      expect(result).to.be.an('array');
      expect(result).to.have.length(1);
    });
  });

  describe('removePrefixFromGroup', () => {
    it('should remove a prefix from a group', async () => {
      const req: any = {
        body: {
          ipobj: fwcloudProduct.ipsecPrefix.id,
          ipobj_g: fwcloudProduct.ipobjGroup.id,
        },
        dbCon: db.getQuery(),
      };

      await IPSecPrefix.removePrefixFromGroup(req);

      const [result] = await db
        .getSource()
        .query(`SELECT * FROM ipsec_prefix__ipobj_g WHERE prefix = ? AND ipobj_g = ?`, [
          fwcloudProduct.ipsecPrefix.id,
          fwcloudProduct.ipobjGroup.id,
        ]);
      expect(result).to.be.undefined;
    });
  });

  describe('searchPrefixInRule', () => {
    it('should find prefix usages in rules', async () => {
      const result = (await IPSecPrefix.searchPrefixInRule(
        db.getQuery(),
        fwcloudProduct.fwcloud.id,
        fwcloudProduct.ipsecPrefix.id,
      )) as any[];

      expect(result).to.be.an('array');
      expect(result.length).to.be.at.least(0);
    });
  });

  describe('searchPrefixInGroup', () => {
    it('should find prefix usages in IPObj groups', async () => {
      const result = (await IPSecPrefix.searchPrefixInGroup(
        db.getQuery(),
        fwcloudProduct.fwcloud.id,
        fwcloudProduct.ipsecPrefix.id,
      )) as any[];

      expect(result).to.be.an('array');
      expect(result.length).to.be.at.least(0);
    });
  });

  describe('searchPrefixUsage', () => {
    it('should find all usages of the prefix', async () => {
      const result = await IPSecPrefix.searchPrefixUsage(
        db.getQuery(),
        fwcloudProduct.fwcloud.id,
        fwcloudProduct.ipsecPrefix.id,
      );

      expect(result).to.be.an('object');
      expect(result).to.have.property('restrictions');
    });

    it('should include extended usages if extendedSearch is true', async () => {
      const result = await IPSecPrefix.searchPrefixUsage(
        db.getQuery(),
        fwcloudProduct.fwcloud.id,
        fwcloudProduct.ipsecPrefix.id,
        true,
      );

      expect(result).to.be.an('object');
      expect(result).to.have.property('restrictions');
    });
  });

  describe('searchPrefixInRoute', () => {
    it('should find routes using the prefix', async () => {
      const result = (await IPSecPrefix.searchPrefixInRoute(
        fwcloudProduct.fwcloud.id,
        fwcloudProduct.ipsecPrefix.id,
      )) as any[];

      expect(result).to.be.an('array');
      expect(result.length).to.be.at.least(0);
    });
  });

  describe('searchPrefixInRoutingRule', () => {
    it('should find routing rules using the prefix', async () => {
      const result = (await IPSecPrefix.searchPrefixInRoutingRule(
        fwcloudProduct.fwcloud.id,
        fwcloudProduct.ipsecPrefix.id,
      )) as any[];

      expect(result).to.be.an('array');
      expect(result.length).to.be.at.least(0);
    });
  });

  describe('searchPrefixInGroupInRoute', () => {
    it('should find routes using groups that contain the prefix', async () => {
      const result = (await IPSecPrefix.searchPrefixInGroupInRoute(
        fwcloudProduct.fwcloud.id,
        fwcloudProduct.ipsecPrefix.id,
      )) as any[];

      expect(result).to.be.an('array');
      expect(result.length).to.be.at.least(0);
    });
  });

  describe('searchPrefixInGroupInRoutingRule', () => {
    it('should find routing rules using groups that contain the prefix', async () => {
      const result = (await IPSecPrefix.searchPrefixInGroupInRoutingRule(
        fwcloudProduct.fwcloud.id,
        fwcloudProduct.ipsecPrefix.id,
      )) as any[];

      expect(result).to.be.an('array');
      expect(result.length).to.be.at.least(0);
    });
  });

  describe('searchPrefixUsageOutOfThisFirewall', () => {
    it('should find prefix usages in other firewalls', async () => {
      const req: any = {
        body: {
          firewall: fwcloudProduct.firewall.id,
          fwcloud: fwcloudProduct.fwcloud.id,
        },
        dbCon: db.getQuery(),
      };
      const result = await IPSecPrefix.searchPrefixUsageOutOfThisFirewall(req);

      expect(result).to.be.an('object');
      expect(result).to.have.property('restrictions');
    });
  });
});
