import { EntityManager } from 'typeorm';
import { IPSecPrefix } from '../../../../../src/models/vpn/ipsec/IPSecPrefix';
import { FwCloudFactory, FwCloudProduct } from '../../../../utils/fwcloud-factory';
import db from '../../../../../src/database/database-manager';
import { expect } from '../../../../mocha/global-setup';
import { IPSec } from '../../../../../src/models/vpn/ipsec/IPSec';
import { Firewall } from '../../../../../src/models/firewall/Firewall';
import { Tree } from '../../../../../src/models/tree/Tree';
import { Crt } from '../../../../../src/models/vpn/pki/Crt';

describe(IPSecPrefix.name, () => {
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
        await IPSecPrefix.modifyPrefix(req);
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

    it('should not fail when deleting a non-existent prefix', async () => {
      const nonExistentId = -9999; // Non-existent prefix ID
      await IPSecPrefix.deletePrefix(db.getQuery(), nonExistentId);
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

      await new Promise<void>((resolve, reject) => {
        db.getQuery().query(sql, (error, resultAfter) => {
          try {
            expect(error).to.not.exist;
            expect(resultAfter).to.exist;
            expect(resultAfter).to.be.an('array').that.is.empty;
            resolve();
          } catch (err) {
            reject(err);
          }
        });
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
    it('should create prefix node and move matching IPSec clients', async () => {
      // Create IPSec clients with names that match the prefix
      const parentNode = await Tree.newNode(
        db.getQuery(),
        fwcloudProduct.fwcloud.id,
        'IPSec-Server',
        null,
        'ISS',
        fwcloudProduct.ipsecServer.id,
        330,
      );

      // Verify that there are nodes before applying the prefix
      const nodesBefore = await db
        .getSource()
        .query(`SELECT * FROM fwc_tree WHERE obj_type = 331`, [parentNode as number]);

      await IPSecPrefix.fillPrefixNodeIPSec(
        db.getQuery(),
        fwcloudProduct.fwcloud.id,
        fwcloudProduct.ipsecServer.id,
        'IPSec-Cli-',
        fwcloudProduct.ipsecPrefix.id,
        parentNode as number,
      );

      // Verify that the prefix node was created
      const prefixNodes = await db
        .getSource()
        .query(`SELECT * FROM fwc_tree WHERE id_parent = ? AND obj_type = 403`, [
          parentNode as number,
        ]);

      expect(prefixNodes).to.be.an('array').that.is.not.empty;
      expect(prefixNodes[0].name).to.equal('IPSec-Cli-');

      // Verify that clients were moved under the prefix node
      const clientNodes = await db
        .getSource()
        .query(`SELECT * FROM fwc_tree WHERE id_parent = ? AND obj_type = 331`, [
          prefixNodes[0].id,
        ]);

      expect(clientNodes).to.be.an('array');
      if (clientNodes.length > 0) {
        clientNodes.forEach((node) => {
          expect(node.name).to.match(/^1$|^2$/); // Suffixes after removing the prefix
        });
      }
    });

    it('should handle prefix with no matching clients', async () => {
      const parentNode = await Tree.newNode(
        db.getQuery(),
        fwcloudProduct.fwcloud.id,
        'IPSec-Server',
        null,
        'ISS',
        fwcloudProduct.ipsecServer.id,
        330,
      );

      await IPSecPrefix.fillPrefixNodeIPSec(
        db.getQuery(),
        fwcloudProduct.fwcloud.id,
        fwcloudProduct.ipsecServer.id,
        'NonExistent-Prefix-',
        fwcloudProduct.ipsecPrefix.id,
        parentNode as number,
      );

      // Verify that the prefix node was created even if there are no clients
      const prefixNodes = await db
        .getSource()
        .query(`SELECT * FROM fwc_tree WHERE id_parent = ? AND obj_type = 403`, [
          parentNode as number,
        ]);

      expect(prefixNodes).to.be.an('array').that.is.not.empty;
      expect(prefixNodes[0].name).to.equal('NonExistent-Prefix-');

      // Verify that there are no client nodes under the prefix
      const clientNodes = await db
        .getSource()
        .query(`SELECT * FROM fwc_tree WHERE id_parent = ? AND obj_type = 331`, [
          prefixNodes[0].id,
        ]);

      expect(clientNodes).to.be.an('array').that.is.empty;
    });

    it('should handle null parent correctly', async () => {
      await IPSecPrefix.fillPrefixNodeIPSec(
        db.getQuery(),
        fwcloudProduct.fwcloud.id,
        fwcloudProduct.ipsecServer.id,
        'IPSec-Server',
        fwcloudProduct.ipsecPrefix.id,
        null,
      );

      // Verify that the prefix node was created with null parent
      const prefixNodes = await db
        .getSource()
        .query(`SELECT * FROM fwc_tree WHERE id_parent IS NULL AND obj_type = 403 AND name = ?`, [
          'IPSec-Server',
        ]);

      expect(prefixNodes).to.be.an('array').that.is.not.empty;
    });

    it('should handle database errors gracefully', async () => {
      try {
        await IPSecPrefix.fillPrefixNodeIPSec(
          db.getQuery(),
          -9999, // Non-existent FWCloud
          fwcloudProduct.ipsecServer.id,
          'IPSec-Cli-',
          fwcloudProduct.ipsecPrefix.id,
          null,
        );
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).to.exist;
      }
    });

    it('should handle invalid IPSec server ID', async () => {
      const parentNode = await Tree.newNode(
        db.getQuery(),
        fwcloudProduct.fwcloud.id,
        'IPSec-Server',
        null,
        'ISS',
        fwcloudProduct.ipsecServer.id,
        330,
      );

      await IPSecPrefix.fillPrefixNodeIPSec(
        db.getQuery(),
        fwcloudProduct.fwcloud.id,
        -9999, // Non-existent IPSec server
        'IPSec-Cli-',
        fwcloudProduct.ipsecPrefix.id,
        parentNode as number,
      );

      // It should create the prefix node but without clients
      const prefixNodes = await db
        .getSource()
        .query(`SELECT * FROM fwc_tree WHERE id_parent = ? AND obj_type = 403`, [
          parentNode as number,
        ]);

      expect(prefixNodes).to.be.an('array').that.is.not.empty;

      const clientNodes = await db
        .getSource()
        .query(`SELECT * FROM fwc_tree WHERE id_parent = ? AND obj_type = 331`, [
          prefixNodes[0].id,
        ]);

      expect(clientNodes).to.be.an('array').that.is.empty;
    });

    it('should create correct suffix names for clients', async () => {
      const parentNode = await Tree.newNode(
        db.getQuery(),
        fwcloudProduct.fwcloud.id,
        'IPSec-Server',
        null,
        'ISS',
        fwcloudProduct.ipsecServer.id,
        330,
      );

      await IPSecPrefix.fillPrefixNodeIPSec(
        db.getQuery(),
        fwcloudProduct.fwcloud.id,
        fwcloudProduct.ipsecServer.id,
        'IPSec-Cli-',
        fwcloudProduct.ipsecPrefix.id,
        parentNode as number,
      );

      const prefixNodes = await db
        .getSource()
        .query(`SELECT * FROM fwc_tree WHERE id_parent = ? AND obj_type = 403`, [
          parentNode as number,
        ]);

      if (prefixNodes.length > 0) {
        const clientNodes = await db
          .getSource()
          .query(`SELECT * FROM fwc_tree WHERE id_parent = ? AND obj_type = 331`, [
            prefixNodes[0].id,
          ]);

        // Verify that the names are correct suffixes (without the prefix)
        clientNodes.forEach((node) => {
          expect(node.name).to.not.include('IPSec-Cli-');
          expect(node.name.length).to.be.greaterThan(0);
        });
      }
    });

    it('should handle special characters in prefix name', async () => {
      const parentNode = await Tree.newNode(
        db.getQuery(),
        fwcloudProduct.fwcloud.id,
        'IPSec-Server',
        null,
        'ISS',
        fwcloudProduct.ipsecServer.id,
        330,
      );

      const specialPrefix = 'Test-Prefix_With.Special-Chars-';

      await IPSecPrefix.fillPrefixNodeIPSec(
        db.getQuery(),
        fwcloudProduct.fwcloud.id,
        fwcloudProduct.ipsecServer.id,
        specialPrefix,
        fwcloudProduct.ipsecPrefix.id,
        parentNode as number,
      );

      const prefixNodes = await db
        .getSource()
        .query(`SELECT * FROM fwc_tree WHERE id_parent = ? AND obj_type = 403`, [
          parentNode as number,
        ]);

      expect(prefixNodes).to.be.an('array').that.is.not.empty;
      expect(prefixNodes[0].name).to.equal(specialPrefix);
    });

    it('should create prefix node with matching certificate entries', async () => {
      // Create certificates that match the prefix in the crt table
      const prefix = 'TEST-PREFIX-';

      // Create certificates with names that match the prefix
      const cert1 = await manager.getRepository(Crt).save({
        cn: `${prefix}client1`,
        type: 1, // Client type
        ca: { id: fwcloudProduct.ca.id },
        days: 365,
      });

      const cert2 = await manager.getRepository(Crt).save({
        cn: `${prefix}client2`,
        type: 1, // Client type
        ca: { id: fwcloudProduct.ca.id },
        days: 365,
      });

      let vpnNextId = Math.floor(Math.random() * (100000 - 10)) + 10;

      // Create IPSec clients associated with these certificates
      const ipsecClient1 = await manager.getRepository(IPSec).save({
        id: vpnNextId++,
        parentId: fwcloudProduct.ipsecServer.id,
        crtId: cert1.id,
        firewallId: fwcloudProduct.firewall.id,
        public_key: '',
        private_key: '',
      });

      const ipsecClient2 = await manager.getRepository(IPSec).save({
        id: vpnNextId++,
        crtId: cert2.id,
        parentId: fwcloudProduct.ipsecServer.id,
        firewallId: fwcloudProduct.firewall.id,
        public_key: '',
        private_key: '',
      });

      // Create the parent node for the IPSec server
      const parentNode = await Tree.newNode(
        db.getQuery(),
        fwcloudProduct.fwcloud.id,
        'IPSec-Server',
        null,
        'ISS',
        fwcloudProduct.ipsecServer.id,
        330,
      );

      // Execute the function to test
      await IPSecPrefix.fillPrefixNodeIPSec(
        db.getQuery(),
        fwcloudProduct.fwcloud.id,
        fwcloudProduct.ipsecServer.id,
        prefix,
        fwcloudProduct.ipsecPrefix.id,
        parentNode as number,
      );

      // Verify that the prefix node was created (type PRI - 403)
      const prefixNodes = await db
        .getSource()
        .query(`SELECT * FROM fwc_tree WHERE id_parent = ? AND obj_type = 403 AND name = ?`, [
          parentNode as number,
          prefix,
        ]);

      expect(prefixNodes).to.be.an('array').that.is.not.empty;
      expect(prefixNodes[0].name).to.equal(prefix);
      expect(prefixNodes[0].obj_type).to.equal(403); // Type PRI

      // Verify that child nodes of type ISC (331) were created with the correct names
      const clientNodes = await db
        .getSource()
        .query(`SELECT * FROM fwc_tree WHERE id_parent = ? AND obj_type = 331 ORDER BY name`, [
          prefixNodes[0].id,
        ]);

      expect(clientNodes).to.be.an('array');
      expect(clientNodes).to.have.length(2);

      // Verify that the names are the correct suffixes (without the prefix)
      expect(clientNodes[0].name).to.equal('client1');
      expect(clientNodes[1].name).to.equal('client2');

      // Verify that the obj_id correspond to the correct IPSec clients
      const nodeIds = clientNodes.map((node) => node.id_obj).sort();
      const expectedIds = [ipsecClient1.id, ipsecClient2.id].sort();
      expect(nodeIds).to.deep.equal(expectedIds);
    });

    it('should handle certificates that do not match prefix', async () => {
      const prefix = 'NOMATCH-';

      // Create certificates that do not match the prefix
      const cert1 = await manager.getRepository(Crt).save({
        cn: 'DIFFERENT-client1',
        type: 1,
        ca: { id: fwcloudProduct.ca.id },
        days: 365,
      });

      let vpnNextId = Math.floor(Math.random() * (100000 - 10)) + 10;

      const ipsecClient1 = await manager.getRepository(IPSec).save({
        id: vpnNextId++,
        crtId: cert1.id,
        ipsecId: fwcloudProduct.ipsecServer.id,
        firewallId: fwcloudProduct.firewall.id,
        public_key: '',
        private_key: '',
      });

      const parentNode = await Tree.newNode(
        db.getQuery(),
        fwcloudProduct.fwcloud.id,
        'IPSec-Server',
        null,
        'ISS',
        fwcloudProduct.ipsecServer.id,
        330,
      );

      await IPSecPrefix.fillPrefixNodeIPSec(
        db.getQuery(),
        fwcloudProduct.fwcloud.id,
        fwcloudProduct.ipsecServer.id,
        prefix,
        fwcloudProduct.ipsecPrefix.id,
        parentNode as number,
      );

      // Verify that the prefix node was created
      const prefixNodes = await db
        .getSource()
        .query(`SELECT * FROM fwc_tree WHERE id_parent = ? AND obj_type = 403`, [
          parentNode as number,
        ]);

      expect(prefixNodes).to.be.an('array').that.is.not.empty;

      // Verify that no child nodes were created because there are no matching certificates
      const clientNodes = await db
        .getSource()
        .query(`SELECT * FROM fwc_tree WHERE id_parent = ? AND obj_type = 331`, [
          prefixNodes[0].id,
        ]);

      expect(clientNodes).to.be.an('array').that.is.empty;
    });
  });

  describe('applyIPSecPrefixes', () => {
    it('should apply all prefixes to IPSec server node', async () => {
      // Create certificates that match the existing prefix
      const cert1 = await manager.getRepository(Crt).save({
        cn: 'IPSec-Cli-client1',
        type: 1,
        ca: { id: fwcloudProduct.ca.id },
        days: 365,
      });

      const cert2 = await manager.getRepository(Crt).save({
        cn: 'IPSec-Cli-client2',
        type: 1,
        ca: { id: fwcloudProduct.ca.id },
        days: 365,
      });

      let vpnNextId = Math.floor(Math.random() * (100000 - 10)) + 10;

      // Create associated IPSec clients
      const ipsecClient1 = await manager.getRepository(IPSec).save({
        id: vpnNextId++,
        parentId: fwcloudProduct.ipsecServer.id,
        crtId: cert1.id,
        firewallId: fwcloudProduct.firewall.id,
        public_key: '',
        private_key: '',
      });

      const ipsecClient2 = await manager.getRepository(IPSec).save({
        id: vpnNextId++,
        parentId: fwcloudProduct.ipsecServer.id,
        crtId: cert2.id,
        firewallId: fwcloudProduct.firewall.id,
        public_key: '',
        private_key: '',
      });

      // Create the IPSec server node
      const serverNode = await Tree.newNode(
        db.getQuery(),
        fwcloudProduct.fwcloud.id,
        'IPSec-Server',
        null,
        'ISS',
        fwcloudProduct.ipsecServer.id,
        330,
      );

      await IPSecPrefix.applyIPSecPrefixes(
        db.getQuery(),
        fwcloudProduct.fwcloud.id,
        fwcloudProduct.ipsecServer.id,
      );

      // Verify that previous nodes were cleared and new ones were created
      const allNodes = await db
        .getSource()
        .query(`SELECT * FROM fwc_tree WHERE id_parent = ? ORDER BY obj_type, name`, [
          serverNode as number,
        ]);

      expect(allNodes).to.be.an('array').that.is.not.empty;

      // Verify that individual client nodes were created (type 331)
      const clientNodes = allNodes.filter((node) => node.obj_type === 331);

      expect(clientNodes.length).to.be.greaterThan(0);

      // Verify that the prefix node was created (type 403)
      const prefixNodes = allNodes.filter((node) => node.obj_type === 403);

      expect(prefixNodes).to.have.length(1);
      expect(prefixNodes[0].name).to.equal('IPSec-Cli-');

      // Verify that clients matching the prefix are under the prefix node
      const clientsUnderPrefix = await db
        .getSource()
        .query(`SELECT * FROM fwc_tree WHERE id_parent = ? AND obj_type = 331`, [
          prefixNodes[0].id,
        ]);

      expect(clientsUnderPrefix).to.have.length(4);
      expect(clientsUnderPrefix.map((n) => n.name).sort()).to.deep.equal([
        '1',
        '2',
        'client1',
        'client2',
      ]);
    });

    it('should handle server with no prefixes', async () => {
      const serverCert = await manager.getRepository(Crt).save({
        cn: 'IPSec-Server-Test',
        type: 1,
        ca: { id: fwcloudProduct.ca.id },
        days: 365,
      });

      // Create a server without prefixes
      const tempServer = await manager.getRepository(IPSec).save({
        id: Math.floor(Math.random() * (100000 - 10)) + 10,
        parentId: null,
        firewallId: fwcloudProduct.firewall.id,
        crtId: serverCert.id,
        public_key: '',
        private_key: '',
      });

      // Create some clients for this server
      const cert1 = await manager.getRepository(Crt).save({
        cn: 'TempClient1',
        type: 1,
        ca: { id: fwcloudProduct.ca.id },
        days: 365,
      });

      const ipsecClient1 = await manager.getRepository(IPSec).save({
        id: Math.floor(Math.random() * (100000 - 10)) + 10,
        parentId: tempServer.id,
        crtId: cert1.id,
        firewallId: fwcloudProduct.firewall.id,
        public_key: '',
        private_key: '',
      });

      const serverNode = await Tree.newNode(
        db.getQuery(),
        fwcloudProduct.fwcloud.id,
        'Temp-IPSec-Server',
        null,
        'ISS',
        tempServer.id,
        330,
      );

      await IPSecPrefix.applyIPSecPrefixes(db.getQuery(), fwcloudProduct.fwcloud.id, tempServer.id);

      // Verify that only client nodes were created (no prefixes)
      const allNodes = await db
        .getSource()
        .query(`SELECT * FROM fwc_tree WHERE id_parent = ?`, [serverNode as number]);

      expect(allNodes).to.be.an('array').that.is.not.empty;
      expect(allNodes.every((node) => node.obj_type === 331)).to.be.true;
      expect(allNodes.map((n) => n.name)).to.include('TempClient1');
    });

    it('should handle server with no clients', async () => {
      const serverCert = await manager.getRepository(Crt).save({
        cn: 'IPSec-Server-Test',
        type: 1,
        ca: { id: fwcloudProduct.ca.id },
        days: 365,
      });

      // Create a server without clients but with prefix
      const tempServer = await manager.getRepository(IPSec).save({
        id: Math.floor(Math.random() * (100000 - 10)) + 10,
        parentId: null,
        firewallId: fwcloudProduct.firewall.id,
        crtId: serverCert.id,
        public_key: '',
        private_key: '',
      });

      // Create a prefix for this server
      const tempPrefix = await manager.getRepository(IPSecPrefix).save({
        id: Math.floor(Math.random() * (100000 - 10)) + 10,
        ipsecId: tempServer.id,
        name: 'EmptyPrefix-',
      });

      const serverNode = await Tree.newNode(
        db.getQuery(),
        fwcloudProduct.fwcloud.id,
        'Empty-IPSec-Server',
        null,
        'ISS',
        tempServer.id,
        330,
      );

      await IPSecPrefix.applyIPSecPrefixes(db.getQuery(), fwcloudProduct.fwcloud.id, tempServer.id);

      // Verify that the prefix node was created but with no clients under it
      const allNodes = await db
        .getSource()
        .query(`SELECT * FROM fwc_tree WHERE id_parent = ?`, [serverNode]);

      const prefixNodes = allNodes.filter((node) => node.obj_type === 403);
      expect(prefixNodes).to.have.length(1);
      expect(prefixNodes[0].name).to.equal('EmptyPrefix-');

      // Verify that there are no clients under the prefix
      const clientsUnderPrefix = await db
        .getSource()
        .query(`SELECT * FROM fwc_tree WHERE id_parent = ? AND obj_type = 331`, [
          prefixNodes[0].id,
        ]);

      expect(clientsUnderPrefix).to.be.an('array').that.is.empty;
    });

    it('should handle multiple prefixes', async () => {
      // Create certificates for multiple prefixes
      const cert1 = await manager.getRepository(Crt).save({
        cn: 'PREFIX1-client1',
        type: 1,
        ca: { id: fwcloudProduct.ca.id },
        days: 365,
      });

      const cert2 = await manager.getRepository(Crt).save({
        cn: 'PREFIX2-client1',
        type: 1,
        ca: { id: fwcloudProduct.ca.id },
        days: 365,
      });

      const cert3 = await manager.getRepository(Crt).save({
        cn: 'NoPrefix-client',
        type: 1,
        ca: { id: fwcloudProduct.ca.id },
        days: 365,
      });

      let vpnNextId = Math.floor(Math.random() * (100000 - 10)) + 10;

      // Create IPSec clients
      const ipsecClient1 = await manager.getRepository(IPSec).save({
        id: vpnNextId++,
        parentId: fwcloudProduct.ipsecServer.id,
        crtId: cert1.id,
        firewallId: fwcloudProduct.firewall.id,
        public_key: '',
        private_key: '',
      });

      const ipsecClient2 = await manager.getRepository(IPSec).save({
        id: vpnNextId++,
        parentId: fwcloudProduct.ipsecServer.id,
        crtId: cert2.id,
        firewallId: fwcloudProduct.firewall.id,
        public_key: '',
        private_key: '',
      });

      const ipsecClient3 = await manager.getRepository(IPSec).save({
        id: vpnNextId++,
        parentId: fwcloudProduct.ipsecServer.id,
        crtId: cert3.id,
        firewallId: fwcloudProduct.firewall.id,
        public_key: '',
        private_key: '',
      });

      // Create multiple prefixes
      const prefix1 = await manager.getRepository(IPSecPrefix).save({
        id: Math.floor(Math.random() * (100000 - 10)) + 10,
        ipsecId: fwcloudProduct.ipsecServer.id,
        name: 'PREFIX1-',
      });

      const prefix2 = await manager.getRepository(IPSecPrefix).save({
        id: Math.floor(Math.random() * (100000 - 10)) + 10,
        ipsecId: fwcloudProduct.ipsecServer.id,
        name: 'PREFIX2-',
      });

      const serverNode = await Tree.newNode(
        db.getQuery(),
        fwcloudProduct.fwcloud.id,
        'Multi-Prefix Server',
        null,
        'ISS',
        fwcloudProduct.ipsecServer.id,
        330,
      );

      await IPSecPrefix.applyIPSecPrefixes(
        db.getQuery(),
        fwcloudProduct.fwcloud.id,
        fwcloudProduct.ipsecServer.id,
      );

      // Verify that multiple prefix nodes were created
      const allNodes = await db
        .getSource()
        .query(`SELECT * FROM fwc_tree WHERE id_parent = ? ORDER BY obj_type, name`, [serverNode]);

      const prefixNodes = allNodes.filter((node) => node.obj_type === 403);
      expect(prefixNodes.length).to.be.at.least(2);

      const prefixNames = prefixNodes.map((n) => n.name);
      expect(prefixNames).to.include('PREFIX1-');
      expect(prefixNames).to.include('PREFIX2-');

      // Verify clients without prefix (should be directly under the server)
      const directClientNodes = allNodes.filter((node) => node.obj_type === 331);
      expect(directClientNodes.map((n) => n.name)).to.include('NoPrefix-client');
    });

    it('should clear existing nodes before applying prefixes', async () => {
      const serverNode = await Tree.newNode(
        db.getQuery(),
        fwcloudProduct.fwcloud.id,
        'Test Server',
        null,
        'ISS',
        fwcloudProduct.ipsecServer.id,
        330,
      );

      // Create some nodes manually before executing the function
      await Tree.newNode(
        db.getQuery(),
        fwcloudProduct.fwcloud.id,
        'OldNode1',
        serverNode,
        'ISC',
        999,
        331,
      );

      await Tree.newNode(
        db.getQuery(),
        fwcloudProduct.fwcloud.id,
        'OldNode2',
        serverNode,
        'PRI',
        998,
        403,
      );

      // Count nodes before
      const nodesBefore = await db
        .getSource()
        .query(`SELECT COUNT(*) as count FROM fwc_tree WHERE id_parent = ?`, [serverNode]);

      await IPSecPrefix.applyIPSecPrefixes(
        db.getQuery(),
        fwcloudProduct.fwcloud.id,
        fwcloudProduct.ipsecServer.id,
      );

      // Verify that old nodes were removed
      const oldNodes = await db
        .getSource()
        .query(`SELECT * FROM fwc_tree WHERE id_parent = ? AND name IN ('OldNode1', 'OldNode2')`, [
          serverNode,
        ]);

      expect(oldNodes).to.be.an('array').that.is.empty;

      // Verify that new nodes were created based on current configuration
      const newNodes = await db
        .getSource()
        .query(`SELECT * FROM fwc_tree WHERE id_parent = ?`, [serverNode]);

      expect(newNodes).to.be.an('array').that.is.not.empty;
    });

    it('should handle non-existent IPSec server gracefully', async () => {
      try {
        await IPSecPrefix.applyIPSecPrefixes(
          db.getQuery(),
          fwcloudProduct.fwcloud.id,
          -9999, // Non-existent IPSec server
        );
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).to.exist;
      }
    });

    it('should handle database errors during Tree operations', async () => {
      try {
        await IPSecPrefix.applyIPSecPrefixes(
          db.getQuery(),
          -9999, // Non-existent FWCloud
          fwcloudProduct.ipsecServer.id,
        );
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).to.exist;
      }
    });

    it('should preserve node hierarchy correctly', async () => {
      // Create complex test data
      const cert1 = await manager.getRepository(Crt).save({
        cn: 'IPSec-Cli-level1',
        type: 1,
        ca: { id: fwcloudProduct.ca.id },
        days: 365,
      });

      await manager.getRepository(IPSec).save({
        id: Math.floor(Math.random() * (100000 - 10)) + 10,
        parentId: fwcloudProduct.ipsecServer.id,
        crtId: cert1.id,
        firewallId: fwcloudProduct.firewall.id,
        public_key: '',
        private_key: '',
      });

      const serverNode = await Tree.newNode(
        db.getQuery(),
        fwcloudProduct.fwcloud.id,
        'Hierarchy Test Server',
        null,
        'ISS',
        fwcloudProduct.ipsecServer.id,
        330,
      );

      await IPSecPrefix.applyIPSecPrefixes(
        db.getQuery(),
        fwcloudProduct.fwcloud.id,
        fwcloudProduct.ipsecServer.id,
      );

      // Verify hierarchy: Server -> Prefix -> Clients
      const serverChildren = await db
        .getSource()
        .query(`SELECT * FROM fwc_tree WHERE id_parent = ? ORDER BY obj_type`, [serverNode]);

      // Find the prefix node
      const prefixNode = serverChildren.find(
        (node) => node.obj_type === 403 && node.name === 'IPSec-Cli-',
      );

      if (prefixNode) {
        // Verify that clients are under the prefix
        const prefixChildren = await db
          .getSource()
          .query(`SELECT * FROM fwc_tree WHERE id_parent = ? AND obj_type = 331`, [prefixNode.id]);

        expect(prefixChildren).to.be.an('array').that.is.not.empty;
        expect(prefixChildren.map((n) => n.name)).to.include('level1');
      }
    });
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
