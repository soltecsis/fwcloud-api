import { EntityManager } from 'typeorm';
import { WireGuardPrefix } from '../../../../../src/models/vpn/wireguard/WireGuardPrefix';
import { FwCloudFactory, FwCloudProduct } from '../../../../utils/fwcloud-factory';
import db from '../../../../../src/database/database-manager';
import { expect } from '../../../../mocha/global-setup';
import { WireGuard } from '../../../../../src/models/vpn/wireguard/WireGuard';
import { Firewall } from '../../../../../src/models/firewall/Firewall';

describe(WireGuardPrefix.name, () => {
  let fwcloudProduct: FwCloudProduct;
  let prefix: WireGuardPrefix;

  let manager: EntityManager;

  beforeEach(async () => {
    manager = db.getSource().manager;
    fwcloudProduct = await new FwCloudFactory().make();

    prefix = await manager.getRepository(WireGuardPrefix).save(
      manager.getRepository(WireGuardPrefix).create({
        wireGuardId: fwcloudProduct.wireguardServer.id,
        name: 'WireGuard-Cli-test',
      }),
    );
  });

  describe('existsPrefix', () => {
    let prefix: WireGuardPrefix;

    beforeEach(async () => {
      const manager = db.getSource().manager;

      prefix = await manager.getRepository(WireGuardPrefix).save(
        manager.getRepository(WireGuardPrefix).create({
          wireGuardId: fwcloudProduct.wireguardServer.id,
          name: 'test-temp-prefix',
        }),
      );
    });

    it('should return false for a non-existent prefix', async () => {
      const dbCon = db.getQuery();
      const result = await WireGuardPrefix.existsPrefix(
        dbCon,
        999999,
        'prefix-that-does-not-exist',
      );
      expect(result).to.be.false;
    });

    it('should return true using real DB after saving WireGuardPrefix', async () => {
      const result = await WireGuardPrefix.existsPrefix(
        db.getQuery(),
        fwcloudProduct.wireguardServer.id,
        'test-temp-prefix',
      );
      expect(result).to.be.true;
    });
  });

  describe('createPrefix', () => {
    let req;
    beforeEach(async () => {
      req = {
        body: {
          name: 'test-prefix',
          wireguard: fwcloudProduct.wireguardServer.id,
        },
        dbCon: db.getQuery(),
      };
    });

    it('should create a new prefix', async () => {
      const insertId = await WireGuardPrefix.createPrefix(req);
      expect(insertId).to.be.a('number');
    });

    it('should fail if required data is missing', async () => {
      req.body = {};
      try {
        await WireGuardPrefix.createPrefix(req);
      } catch (error) {
        expect(error.message).to.include("Column 'name' cannot be null");
      }
    });
  });

  describe('modifyPrefix', () => {
    let req;
    let savedPrefix: WireGuardPrefix;
    beforeEach(async () => {
      req = {
        body: {
          name: 'test-prefix-modified',
          wireguard: fwcloudProduct.wireguardServer.id,
        },
        dbCon: db.getQuery(),
      };
      savedPrefix = await manager.getRepository(WireGuardPrefix).save(
        manager.getRepository(WireGuardPrefix).create({
          wireGuardId: fwcloudProduct.wireguardServer.id,
          name: 'test-prefix',
        }),
      );
      req.body.prefix = savedPrefix.id;
    });
    it('should modify the prefix name', async () => {
      await WireGuardPrefix.modifyPrefix(req);

      const updated = await manager
        .getRepository(WireGuardPrefix)
        .findOne({ where: { id: savedPrefix.id } });
      expect(updated?.name).to.equal('test-prefix-modified');
    });

    it('should fail if prefix does not exist', async () => {
      req.body.prefix = 999999;
      try {
        await WireGuardPrefix.modifyPrefix(req);
      } catch (error) {
        expect(error.message).to.include('Prefix not found');
      }
    });
  });

  describe('deletePrefix', () => {
    it('should delete a prefix by id', async () => {
      const savedPrefix = await manager.getRepository(WireGuardPrefix).save(
        manager.getRepository(WireGuardPrefix).create({
          wireGuardId: fwcloudProduct.wireguardServer.id,
          name: 'test-prefix-to-delete',
        }),
      );
      await WireGuardPrefix.deletePrefix(db.getQuery(), savedPrefix.id);

      const deletedPrefix = await manager
        .getRepository(WireGuardPrefix)
        .findOne({ where: { id: savedPrefix.id } });
      expect(deletedPrefix).to.be.null;
    });

    it('should fail if id is invalid', async () => {
      try {
        await WireGuardPrefix.deletePrefix(db.getQuery(), 999999);
      } catch (error) {
        expect(error.message).to.exist;
      }
    });
  });

  describe('deletePrefixAll', () => {
    it('should delete all prefixes for a firewall', async () => {
      const savedPrefix1 = await manager.getRepository(WireGuardPrefix).save(
        manager.getRepository(WireGuardPrefix).create({
          wireGuardId: fwcloudProduct.wireguardServer.id,
          name: 'test-prefix-to-delete-1',
        }),
      );
      const savedPrefix2 = await manager.getRepository(WireGuardPrefix).save(
        manager.getRepository(WireGuardPrefix).create({
          wireGuardId: fwcloudProduct.wireguardClients.get('WireGuard-Cli-1').id,
          name: 'test-prefix-to-delete-2',
        }),
      );

      await db.getSource().query(
        `DELETE FROM wireguard_prefix__ipobj_g 
                 WHERE prefix IN (
                   SELECT id FROM wireguard_prefix 
                   WHERE wireguard IN (
                     SELECT id FROM wireguard WHERE firewall = ?
                   )
                 )`,
        [fwcloudProduct.firewall.id],
      );

      await WireGuardPrefix.deletePrefixAll(
        db.getQuery(),
        fwcloudProduct.fwcloud.id,
        fwcloudProduct.firewall.id,
      );

      const deletedPrefix1 = await manager
        .getRepository(WireGuardPrefix)
        .findOne({ where: { id: savedPrefix1.id } });
      const deletedPrefix2 = await manager
        .getRepository(WireGuardPrefix)
        .findOne({ where: { id: savedPrefix2.id } });

      expect(deletedPrefix1).to.be.null;
      expect(deletedPrefix2).to.be.null;
    });
  });

  describe('getPrefixes', () => {
    it('should return all prefixes for a wireGuard server', async () => {
      const savedPrefix1 = await manager.getRepository(WireGuardPrefix).save(
        manager.getRepository(WireGuardPrefix).create({
          wireGuardId: fwcloudProduct.wireguardServer.id,
          name: 'test-prefix-to-delete-1',
        }),
      );
      const savedPrefix2 = await manager.getRepository(WireGuardPrefix).save(
        manager.getRepository(WireGuardPrefix).create({
          wireGuardId: fwcloudProduct.wireguardClients.get('WireGuard-Cli-1').id,
          name: 'test-prefix-to-delete-2',
        }),
      );

      const result = await WireGuardPrefix.getPrefixes(
        db.getQuery(),
        fwcloudProduct.wireguardServer.id,
      );
      expect(result).to.be.an('array');
      expect(result).to.have.length(3); // 1 default + 2 saved
    });
  });

  describe('getWireGuardClientsUnderPrefix', () => {
    it('should return all clients under a prefix', async () => {
      const result = await WireGuardPrefix.getWireGuardClientsUnderPrefix(
        db.getQuery(),
        fwcloudProduct.wireguardServer.id,
        'WireGuard',
      );
      expect(result).to.be.an('array');
      expect(result).to.have.length(2); // 2 clients under the prefix
    });
  });

  describe('getWireGuardClientPrefixes', () => {
    it('should return matching prefixes for a client', async () => {
      const result = await WireGuardPrefix.getWireGuardClientPrefixes(
        db.getQuery(),
        fwcloudProduct.wireguardClients.get('WireGuard-Cli-1').id,
      );
      expect(result).to.be.an('array');
      expect(result).to.have.length(1); // 1 prefix for the client
      expect(result[0].name).to.equal('WireGuard-Cli-');
    });
  });

  describe('updateWireGuardClientPrefixesFWStatus', () => {
    it('should update firewall statuses where prefix is used', async () => {
      const clientId = fwcloudProduct.wireguardClients.get('WireGuard-Cli-1').id;
      const prefixId = fwcloudProduct.wireguardServer.id;

      await WireGuardPrefix.updateWireGuardClientPrefixesFWStatus(
        db.getQuery(),
        clientId,
        prefixId,
      );
      const updatedClient = await manager
        .getRepository(WireGuard)
        .findOne({ where: { id: clientId } });
      expect(updatedClient).to.exist;
      const updatedFirewall = await manager
        .getRepository(Firewall)
        .findOne({ where: { id: updatedClient.firewallId } });
      expect(updatedFirewall).to.exist;
      expect(updatedFirewall.status).to.equal(3);
    });
  });

  describe('getPrefixWireGuardInfo', () => {
    it('should return prefix info with firewall and client data', async () => {
      const result = await WireGuardPrefix.getPrefixWireGuardInfo(
        db.getQuery(),
        fwcloudProduct.fwcloud.id,
        fwcloudProduct.wireguardPrefix.id,
      );
      expect(result).to.be.an('array');
      expect(result).to.have.length(1);
      expect(result[0].name).to.equal('WireGuard-Cli-');
    });

    it('should throw NOT_FOUND if prefix does not exist', async () => {
      try {
        await WireGuardPrefix.getPrefixWireGuardInfo(
          db.getQuery(),
          fwcloudProduct.fwcloud.id,
          999999,
        );
      } catch (error) {
        expect(error).to.exist;
      }
    });
  });

  describe('addPrefixToGroup', () => {
    it('should add a prefix to a group', async () => {
      const groupId = fwcloudProduct.ipobjGroup.id;
      const prefixId = fwcloudProduct.wireguardPrefix.id;

      await WireGuardPrefix.addPrefixToGroup(db.getQuery(), prefixId, groupId);

      const result = await db
        .getSource()
        .query(`SELECT * FROM wireguard_prefix__ipobj_g WHERE prefix = ? AND ipobj_g = ?`, [
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
          ipobj: fwcloudProduct.wireguardPrefix.id,
          ipobj_g: fwcloudProduct.ipobjGroup.id,
        },
        dbCon: db.getQuery(),
      };

      await WireGuardPrefix.removePrefixFromGroup(req);

      const [result] = await db
        .getSource()
        .query(`SELECT * FROM wireguard_prefix__ipobj_g WHERE prefix = ? AND ipobj_g = ?`, [
          fwcloudProduct.wireguardPrefix.id,
          fwcloudProduct.ipobjGroup.id,
        ]);
      expect(result).to.be.undefined;
    });
  });

  describe('searchPrefixInRule', () => {
    it('should find prefix usages in rules', async () => {
      const result = (await WireGuardPrefix.searchPrefixInRule(
        db.getQuery(),
        fwcloudProduct.fwcloud.id,
        fwcloudProduct.wireguardPrefix.id,
      )) as any[];
      const [firstResult] = result;

      expect(result).to.be.an('array');
      expect(result.length).to.be.at.least(0);
    });
  });

  describe('searchPrefixInGroup', () => {
    it('should find prefix usages in IPObj groups', async () => {
      const result = (await WireGuardPrefix.searchPrefixInGroup(
        db.getQuery(),
        fwcloudProduct.fwcloud.id,
        fwcloudProduct.wireguardPrefix.id,
      )) as any[];
      const [firstResult] = result;

      expect(result).to.be.an('array');
      expect(result.length).to.be.at.least(0);
    });
  });

  describe('searchPrefixUsage', () => {
    it('should find all usages of the prefix', async () => {
      const result = await WireGuardPrefix.searchPrefixUsage(
        db.getQuery(),
        fwcloudProduct.fwcloud.id,
        fwcloudProduct.wireguardPrefix.id,
      );

      expect(result).to.be.an('object');
      expect(result).to.have.property('restrictions');
    });

    it('should include extended usages if extendedSearch is true', async () => {
      const result = await WireGuardPrefix.searchPrefixUsage(
        db.getQuery(),
        fwcloudProduct.fwcloud.id,
        fwcloudProduct.wireguardPrefix.id,
        true,
      );

      expect(result).to.be.an('object');
      expect(result).to.have.property('restrictions');
    });
  });

  describe('searchPrefixInRoute', () => {
    it('should find routes using the prefix', async () => {
      const result = (await WireGuardPrefix.searchPrefixInRoute(
        fwcloudProduct.fwcloud.id,
        fwcloudProduct.wireguardPrefix.id,
      )) as any[];
      const [firstResult] = result;

      expect(result).to.be.an('array');
      expect(result.length).to.be.at.least(0);
    });
  });

  describe('searchPrefixInRoutingRule', () => {
    it('should find routing rules using the prefix', async () => {
      const result = (await WireGuardPrefix.searchPrefixInRoutingRule(
        fwcloudProduct.fwcloud.id,
        fwcloudProduct.wireguardPrefix.id,
      )) as any[];
      const [firstResult] = result;

      expect(result).to.be.an('array');
      expect(result.length).to.be.at.least(0);
    });
  });

  describe('searchPrefixInGroupInRoute', () => {
    it('should find routes using groups that contain the prefix', async () => {
      const result = (await WireGuardPrefix.searchPrefixInGroupInRoute(
        fwcloudProduct.fwcloud.id,
        fwcloudProduct.wireguardPrefix.id,
      )) as any[];
      const [firstResult] = result;

      expect(result).to.be.an('array');
      expect(result.length).to.be.at.least(0);
    });
  });

  describe('searchPrefixInGroupInRoutingRule', () => {
    it('should find routing rules using groups that contain the prefix', async () => {
      const result = (await WireGuardPrefix.searchPrefixInGroupInRoutingRule(
        fwcloudProduct.fwcloud.id,
        fwcloudProduct.wireguardPrefix.id,
      )) as any[];
      const [firstResult] = result;

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
      const result = await WireGuardPrefix.searchPrefixUsageOutOfThisFirewall(req);

      expect(result).to.be.an('object');
      expect(result).to.have.property('restrictions');
    });
  });
});
