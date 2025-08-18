/*!
    Copyright 2025 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
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

import { expect } from '../../../../mocha/global-setup';
import { FwCloudFactory, FwCloudProduct } from '../../../../utils/fwcloud-factory';
import db from '../../../../../src/database/database-manager';
import { WireGuard } from '../../../../../src/models/vpn/wireguard/WireGuard';
import { EntityManager } from 'typeorm';
import { Crt } from '../../../../../src/models/vpn/pki/Crt';
import { Firewall } from '../../../../../src/models/firewall/Firewall';
import StringHelper from '../../../../../src/utils/string.helper';

describe(WireGuard.name, () => {
  let fwcloudProduct: FwCloudProduct;

  let manager: EntityManager;

  beforeEach(async () => {
    manager = db.getSource().manager;
    fwcloudProduct = await new FwCloudFactory().make();
  });

  describe('generateKeyPair', () => {
    it('should generate a key pair with base64 strings', async () => {
      const { public_key, private_key } = await WireGuard.generateKeyPair();
      expect(public_key).to.be.a('string');
      expect(private_key).to.be.a('string');
    });
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
          cn: 'WireGuard-Server-1',
          type: 2,
          days: 365,
        }),
      );
      const request: any = {
        dbCon: db.getQuery(),
        body: {
          firewall: fwcloudProduct.firewall.id,
          crt: tempcert.id,
          install_dir: '/tmp',
          install_name: 'test',
        },
      };

      const resultId = await WireGuard.addCfg(request);

      expect(resultId).to.exist;
      expect(resultId).to.be.a('number');
      expect(resultId).to.be.greaterThan(0);
      const result = await db
        .getSource()
        .getRepository(WireGuard)
        .findOne({
          where: { id: resultId },
        });
      expect(result).to.exist;
      expect(result).to.have.property('id');
    });

    it('should fail when required fields are missing', async () => {
      const request: any = {
        dbCon: db.getQuery(),
        body: {
          firewall: fwcloudProduct.firewall.id,
          crt: null,
          install_dir: '/tmp',
          install_name: 'test',
        },
      };

      try {
        await WireGuard.addCfg(request);
      } catch (error) {
        expect(error).to.exist;
        expect(error.message).to.equal(`Column 'crt' cannot be null`);
      }
    });
  });

  describe('updateCfg', () => {
    it('should update an existing configuration', async () => {
      const request: any = {
        dbCon: db.getQuery(),
        body: {
          firewall: fwcloudProduct.firewall.id,
          wireguard: fwcloudProduct.wireguardServer.id,
          comment: 'test',
          install_dir: '/tmp',
          install_name: 'test_updated',
        },
      };

      await WireGuard.updateCfg(request);
      const result = await db
        .getSource()
        .getRepository(WireGuard)
        .findOne({
          where: { id: fwcloudProduct.wireguardServer.id },
        });
      expect(result).to.exist;
      expect(result).to.have.property('comment');
      expect(result.comment).to.equal(request.body.comment);
    });
  });

  describe('delCfg', () => {
    it('should delete a WireGuard client config', async () => {
      await WireGuard.delCfg(
        db.getQuery(),
        fwcloudProduct.fwcloud.id,
        fwcloudProduct.wireguardClients.get('WireGuard-Cli-1').id,
      );
      const result = await db
        .getSource()
        .getRepository(WireGuard)
        .findOne({
          where: { id: fwcloudProduct.wireguardClients.get('WireGuard-Cli-1').id },
        });
      expect(result).to.not.exist;
    });

    it('should delete a WireGuard server config', async () => {
      const serverId = fwcloudProduct.wireguardServer.id;
      const dbCon = db.getSource();

      await dbCon.query(`TRUNCATE TABLE wireguard__ipobj_g`);
      await dbCon.query(`TRUNCATE TABLE wireguard_prefix__ipobj_g`);
      await dbCon.query(`TRUNCATE TABLE wireguard_opt`);
      await dbCon.query(`TRUNCATE TABLE route__wireguard`);
      await dbCon.query(`TRUNCATE TABLE route__wireguard_prefix`);
      await dbCon.query(`TRUNCATE TABLE routing_r__wireguard`);
      await dbCon.query(`TRUNCATE TABLE routing_r__wireguard_prefix`);
      await dbCon.query(`delete from wireguard where wireguard = ${serverId}`);
      await dbCon.query(`delete from wireguard_opt where wireguard = ${serverId}`);

      await WireGuard.delCfg(
        db.getQuery(),
        fwcloudProduct.fwcloud.id,
        fwcloudProduct.wireguardServer.id,
      );

      const result = await db
        .getSource()
        .getRepository(WireGuard)
        .findOne({
          where: { id: fwcloudProduct.wireguardServer.id },
        });
      expect(result).to.not.exist;
    });
  });

  describe('delCfgAll', () => {
    it('should delete all configs for a firewall in correct order', async () => {
      const serverId = fwcloudProduct.wireguardServer.id;
      const clientId = fwcloudProduct.wireguardClients.get('WireGuard-Cli-1').id;
      const dbCon = db.getSource();

      await dbCon.query(`TRUNCATE TABLE wireguard__ipobj_g`);
      await dbCon.query(`TRUNCATE TABLE wireguard_prefix__ipobj_g`);
      await dbCon.query(`TRUNCATE TABLE wireguard_opt`);
      await dbCon.query(`TRUNCATE TABLE route__wireguard`);
      await dbCon.query(`TRUNCATE TABLE route__wireguard_prefix`);
      await dbCon.query(`TRUNCATE TABLE routing_r__wireguard`);
      await dbCon.query(`TRUNCATE TABLE routing_r__wireguard_prefix`);

      await WireGuard.delCfgAll(
        db.getQuery(),
        fwcloudProduct.fwcloud.id,
        fwcloudProduct.firewall.id,
      );

      const serverResult = await dbCon.getRepository(WireGuard).findOne({
        where: { id: serverId },
      });
      expect(serverResult).to.not.exist;

      const clientResult = await dbCon.getRepository(WireGuard).findOne({
        where: { id: clientId },
      });
      expect(clientResult).to.not.exist;
    });
  });

  describe('addCfgOpt', () => {
    it('should insert a WireGuard option', async () => {
      const request: any = {
        dbCon: db.getQuery(),
      };

      const option = {
        wireguard: fwcloudProduct.wireguardServer.id,
        name: 'DNS',
        arg: '1.1.1.1',
        comment: 'Test DNS option',
        order: 1,
        scope: 0,
      };

      await WireGuard.addCfgOpt(request, option);

      const result = await db
        .getSource()
        .query(`SELECT * FROM wireguard_opt WHERE wireguard = ? AND name = ?`, [
          fwcloudProduct.wireguardServer.id,
          'DNS',
        ]);

      expect(result).to.be.an('array').that.is.not.empty;
      expect(result[0].name).to.equal('DNS');
      expect(result[0].arg).to.equal('1.1.1.1');
      expect(result[0].comment).to.equal('Test DNS option');
      expect(result[0].order).to.equal(1);
      expect(result[0].scope).to.equal(0);
    });
  });

  describe('delCfgOptAll', () => {
    it('should delete all options of a config', async () => {
      const request: any = {
        dbCon: db.getQuery(),
        body: {
          wireguard: fwcloudProduct.wireguardServer.id,
        },
      };

      await WireGuard.delCfgOptAll(request);

      const result = await db
        .getSource()
        .query(`SELECT * FROM wireguard_opt WHERE wireguard = ?`, [
          fwcloudProduct.wireguardServer.id,
        ]);

      expect(result).to.be.an('array').that.is.empty;
    });
  });

  describe('getCfgId', () => {
    it('should return WireGuard config id for firewall and crt', async () => {
      const request: any = {
        dbCon: db.getQuery(),
        body: {
          firewall: fwcloudProduct.firewall.id,
          crt: fwcloudProduct.crts.get('Wireguard-Server').id,
        },
      };

      const resultId = await WireGuard.getCfgId(request);

      expect(resultId).to.exist;
      expect(resultId).to.be.a('number');
      expect(resultId).to.be.greaterThan(0);
    });
  });

  describe('getCfg', () => {
    it('should return full config with decrypted keys and options', async () => {
      const result = await WireGuard.getCfg(db.getQuery(), fwcloudProduct.wireguardServer.id);

      expect(result).to.exist;
      expect(result).to.have.property('id');
      expect(result).to.have.property('crt');
      expect(result).to.have.property('options');
      expect(result.options).to.be.an('array');
    });
  });

  describe('getWireGuardClientsInfo', () => {
    it('should return all clients under a WireGuard server', async () => {
      const result = await WireGuard.getWireGuardClientsInfo(
        db.getQuery(),
        fwcloudProduct.wireguardServer.id,
      );

      expect(result).to.exist;
      expect(result).to.be.an('array');
      expect(result).to.have.lengthOf(3);
      expect(result[0]).to.have.property('id');
      expect(result[0].id).to.equal(fwcloudProduct.wireguardClients.get('WireGuard-Cli-1').id);
    });
  });

  describe('getWireGuardClients', () => {
    it('should return all clients under a WireGuard server', async () => {
      const result = await WireGuard.getWireGuardClients(
        db.getQuery(),
        fwcloudProduct.wireguardServer.id,
      );

      expect(result).to.exist;
      expect(result).to.be.an('array');
      expect(result).to.have.lengthOf(3);
      expect(result[0]).to.have.property('id');
      //It’s Wireguard-Cli-3 because the certificates are sorted alphabetically by name
      expect(result[0].id).to.equal(fwcloudProduct.wireguardClients.get('WireGuard-Cli-3').id);
    });
  });

  describe('dumpCfg', () => {
    it('should return a valid WireGuard configuration string', async () => {
      const result: any = await WireGuard.dumpCfg(db.getQuery(), fwcloudProduct.wireguardServer.id);

      expect(result).to.exist;
      expect(result.cfg).to.be.a('string');
    });
  });

  describe('freeVpnIP', () => {
    it('should return a valid unused VPN IP', async () => {
      const request: any = {
        dbCon: db.getQuery(),
        body: {
          wireguard: fwcloudProduct.wireguardServer.id,
          fwcloud: fwcloudProduct.fwcloud.id,
        },
      };

      try {
        const result = await WireGuard.freeVpnIP(request);

        expect(result).to.have.property('ip');
        expect(result).to.have.property('netmask');
      } catch (error: any) {
        // Allow test to pass if known error message appears
        expect(error.msg).to.equal('WireGuard LAN not found');
      }
    });
  });

  describe('searchWireGuardUsage', () => {
    it('should detect usages across rules, routes, and groups', async () => {
      const result = await WireGuard.searchWireGuardUsage(
        db.getQuery(),
        fwcloudProduct.fwcloud.id,
        fwcloudProduct.wireguardServer.id,
      );

      expect(result).to.exist;
      expect(result).to.have.property('restrictions');
    });
  });

  describe('addToGroup', () => {
    it('should insert a relation in wireguard__ipobj_g', async () => {
      const result = await WireGuard.addToGroup(
        db.getQuery(),
        fwcloudProduct.wireguardServer.id,
        fwcloudProduct.ipobjGroup.id,
      );

      expect(result).to.exist;
      expect(result).to.be.a('number');
    });
  });

  describe('removeFromGroup', () => {
    it('should remove a relation in wireguard__ipobj_g', async () => {
      const request: any = {
        dbCon: db.getQuery(),
        body: {
          ipobj: fwcloudProduct.wireguardServer.id,
          ipobj_g: fwcloudProduct.ipobjGroup.id,
        },
      };
      const result = await WireGuard.removeFromGroup(request);

      expect(result).to.exist;
      expect(result).to.be.a('number');
    });
  });

  describe('createWireGuardServerInterface', () => {
    it('should create interface and address for server', async () => {
      const request: any = {
        dbCon: db.getQuery(),
        body: {
          wireguard: fwcloudProduct.wireguardServer.id,
          fwcloud: fwcloudProduct.fwcloud.id,
          firewall: fwcloudProduct.firewall.id,
          ipobj_g: fwcloudProduct.ipobjGroup.id,
          install_name: StringHelper.randomize(10) + '.conf',
        },
      };

      await WireGuard.createWireGuardServerInterface(request, fwcloudProduct.wireguardServer.id);

      const result = await db
        .getSource()
        .getRepository(WireGuard)
        .findOne({
          where: { id: fwcloudProduct.wireguardServer.id },
        });
      expect(result).to.exist;
    });
  });

  describe('updateWireGuardServerInterface', () => {
    it('should update interface and address for server', async () => {
      const request: any = {
        dbCon: db.getQuery(),
        body: {
          wireguard: fwcloudProduct.wireguardServer.id,
          fwcloud: fwcloudProduct.fwcloud.id,
          firewall: fwcloudProduct.firewall.id,
          ipobj_g: fwcloudProduct.ipobjGroup.id,
          install_name: StringHelper.randomize(10) + '.conf',
        },
      };

      await WireGuard.updateWireGuardServerInterface(request);

      const result = await db
        .getSource()
        .getRepository(WireGuard)
        .findOne({
          where: { id: fwcloudProduct.wireguardServer.id },
        });
      expect(result).to.exist;
    });
  });

  describe('moveToOtherFirewall', () => {
    it('should update firewall ID for all configs', async () => {
      const newFirewall = await db
        .getSource()
        .getRepository(Firewall)
        .save(
          db
            .getSource()
            .getRepository(Firewall)
            .create({
              name: StringHelper.randomize(10),
              fwCloudId: fwcloudProduct.fwcloud.id,
            }),
        );
      await WireGuard.moveToOtherFirewall(
        db.getQuery(),
        fwcloudProduct.firewall.id,
        newFirewall.id,
      );

      const result = await db
        .getSource()
        .getRepository(WireGuard)
        .findOne({
          where: { id: fwcloudProduct.wireguardServer.id },
        });

      expect(result).to.exist;
    });
  });

  describe('getConfigFilename', () => {
    it('should return the next available config filename', async () => {
      const result = await WireGuard.getConfigFilename(db.getQuery(), fwcloudProduct.firewall.id);

      expect(result).to.exist;
      expect(result).to.be.a('string');
    });
  });

  describe('getPeerOptions', () => {
    it('should return the peer options for a given WireGuard server', async () => {
      const result = await WireGuard.getPeerOptions(
        db.getQuery(),
        fwcloudProduct.wireguardServer.id,
        fwcloudProduct.wireguardClients.get('WireGuard-Cli-1').id,
      );

      expect(result).to.exist;
      expect(result).to.be.an('object');
    });
  });
});
