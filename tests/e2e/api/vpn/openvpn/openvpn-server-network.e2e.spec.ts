import sinon from 'sinon';
import request = require('supertest');
import { EntityManager } from 'typeorm';
import db from '../../../../../src/database/database-manager';
import {
  Firewall,
  FirewallInstallCommunication,
} from '../../../../../src/models/firewall/Firewall';
import { FwCloud } from '../../../../../src/models/fwcloud/FwCloud';
import { IPObj } from '../../../../../src/models/ipobj/IPObj';
import { Tree } from '../../../../../src/models/tree/Tree';
import { Crt } from '../../../../../src/models/vpn/pki/Crt';
import { OpenVPN } from '../../../../../src/models/vpn/openvpn/OpenVPN';
import { WireGuardOption } from '../../../../../src/models/vpn/wireguard/wireguard-option.model';
import { describeName, expect, testSuite } from '../../../../mocha/global-setup';
import { FwCloudFactory, FwCloudProduct } from '../../../../utils/fwcloud-factory';
import { attachSession, createUser, generateSession } from '../../../../utils/utils';

const BASE_ROUTE = '/vpn/openvpn';

describe(describeName('OpenVPN server network validation E2E tests'), () => {
  let manager: EntityManager;
  let fixture: FwCloudProduct;
  let cookie: string;
  let serverNode: number;
  let crt: Crt;

  const treeNodeId = async (name: string, type: string) => {
    const node = (await Tree.getNodeByNameAndType(fixture.fwcloud.id, name, type)) as {
      id: number;
    };
    return node.id;
  };

  const createNetwork = async (address: string, netmask: string) => {
    const { body } = await request(testSuite.app.express)
      .post('/ipobj')
      .set('Cookie', cookie)
      .send({
        fwcloud: fixture.fwcloud.id,
        name: `OpenVPN ${address}${netmask}`,
        type: 7,
        address,
        netmask,
        ip_version: 4,
        node_parent: await treeNodeId('Networks', 'OIN'),
        node_type: 'OIN',
        node_order: 1,
      })
      .expect(200);
    return body.insertId as number;
  };

  const options = (ipobj: number) => [
    { name: 'dev', arg: 'tun99', ipobj: null, scope: 1 },
    { name: 'server', arg: '', ipobj, scope: 1 },
  ];

  const createServer = (ipobj: number) =>
    request(testSuite.app.express)
      .post(BASE_ROUTE)
      .set('Cookie', cookie)
      .send({
        fwcloud: fixture.fwcloud.id,
        firewall: fixture.firewall.id,
        crt: crt.id,
        node_id: serverNode,
        install_dir: '/etc/openvpn',
        install_name: 'server.conf',
        comment: 'Saved server',
        options: options(ipobj),
      });

  const updateServer = (openvpn: number, ipobj: number) =>
    request(testSuite.app.express)
      .put(BASE_ROUTE)
      .set('Cookie', cookie)
      .send({
        fwcloud: fixture.fwcloud.id,
        openvpn,
        install_dir: '/etc/openvpn',
        install_name: 'updated.conf',
        comment: 'Updated server',
        options: options(ipobj),
      });

  const updateNetwork = (id: number, address: string, netmask: string) =>
    request(testSuite.app.express).put('/ipobj').set('Cookie', cookie).send({
      fwcloud: fixture.fwcloud.id,
      id,
      name: 'Updated network',
      type: 7,
      address,
      netmask,
      ip_version: 4,
    });

  const getServerData = (openvpn: number) =>
    request(testSuite.app.express)
      .put(`${BASE_ROUTE}/get`)
      .set('Cookie', cookie)
      .send({ fwcloud: fixture.fwcloud.id, openvpn });

  const getConfigFile = (openvpn: number) =>
    request(testSuite.app.express)
      .put(`${BASE_ROUTE}/file/get`)
      .set('Cookie', cookie)
      .send({ fwcloud: fixture.fwcloud.id, openvpn });

  beforeEach(async () => {
    await testSuite.resetDatabaseData();
    manager = db.getSource().manager;
    fixture = await new FwCloudFactory().make();
    const admin = await createUser({ role: 1 });
    admin.fwClouds = [fixture.fwcloud];
    await manager.save(admin);
    cookie = attachSession(generateSession(admin));

    // Synthetic test cookies authenticate as the admin but receive a new Express session ID
    // for each request. Keep the cloud lock assigned to the test user across those requests.
    sinon.stub(FwCloud, 'getFwcloudAccess').resolves({
      access: true,
      locked: true,
      mylock: true,
      locked_at: null,
      locked_by: null,
    });

    await Tree.createAllTreeCloud(fixture.fwcloud);
    await Tree.insertFwc_Tree_New_firewall(
      fixture.fwcloud.id,
      await treeNodeId('FIREWALLS', 'FDF'),
      fixture.firewall.id,
    );
    serverNode = await treeNodeId('OpenVPN', 'OPN');
    crt = await manager.getRepository(Crt).save({
      caId: fixture.ca.id,
      cn: 'OpenVPN-Network-Test',
      days: 1000,
      type: 2,
    });

    sinon.stub(OpenVPN, 'getCRTData').resolves('certificate data\n');
  });

  afterEach(() => {
    sinon.restore();
  });

  it('creates and updates a server with an aligned subnet and emits a dotted mask', async () => {
    const cidrNetwork = await createNetwork('10.99.219.0', '/24');
    const created = await createServer(cidrNetwork).expect(200);
    const openvpn = created.body.insertId;
    const config = await getConfigFile(openvpn).expect(200);
    expect(config.body.cfg).to.include('\nserver 10.99.219.0 255.255.255.0\n');

    const interfaceAddress = await manager.getRepository(IPObj).findOneByOrFail({
      name: 'tun99',
      fwCloudId: fixture.fwcloud.id,
    });
    expect(interfaceAddress.address).to.equal('10.99.219.1');

    const dottedNetwork = await createNetwork('10.99.219.128', '255.255.255.128');
    await updateServer(openvpn, dottedNetwork).expect(204);
    const updated = await getConfigFile(openvpn).expect(200);
    expect(updated.body.cfg).to.include('\nserver 10.99.219.128 255.255.255.128\n');

    await updateNetwork(dottedNetwork, '10.99.219.0', '/25').expect(200);
    const updatedNetwork = await getConfigFile(openvpn).expect(200);
    expect(updatedNetwork.body.cfg).to.include('\nserver 10.99.219.0 255.255.255.128\n');
  });

  it('rejects an invalid server network before saving the server', async () => {
    const ipobj = await createNetwork('10.99.219.1', '/24');
    const { body } = await createServer(ipobj).expect(400);
    expect(body.msg).to.include('10.99.219.1').and.include('/24').and.include('10.99.219.0');
    expect(await manager.getRepository(OpenVPN).countBy({ crtId: crt.id })).to.equal(0);
  });

  it('rejects a non-network object as the server network', async () => {
    const { body } = await createServer(fixture.ipobjs.get('address').id).expect(400);
    expect(body.msg).to.match(/network object/i);
    expect(await manager.getRepository(OpenVPN).countBy({ crtId: crt.id })).to.equal(0);
  });

  it('preserves the previously saved configuration after an invalid replacement', async () => {
    const validNetwork = await createNetwork('10.99.219.0', '/24');
    const created = await createServer(validNetwork).expect(200);
    const openvpn = created.body.insertId;
    const before = await getServerData(openvpn).expect(200);

    const invalidNetwork = await createNetwork('10.99.219.64', '255.255.255.128');
    const { body } = await updateServer(openvpn, invalidNetwork).expect(400);
    expect(body.msg)
      .to.include('10.99.219.64')
      .and.include('255.255.255.128')
      .and.include('10.99.219.0');
    const after = await getServerData(openvpn).expect(200);
    expect(after.body).to.deep.equal(before.body);
  });

  it('rejects invalid changes to a referenced network before changing the object', async () => {
    const ipobj = await createNetwork('10.99.219.0', '/24');
    const created = await createServer(ipobj).expect(200);
    const repository = manager.getRepository(IPObj);
    const before = await repository.findOneByOrFail({ id: ipobj });

    const { body } = await updateNetwork(ipobj, '10.99.219.1', '/25').expect(400);
    expect(body.msg).to.include('10.99.219.1').and.include('/25').and.include('10.99.219.0');
    expect(await repository.findOneByOrFail({ id: ipobj })).to.deep.equal(before);
    const config = await getConfigFile(created.body.insertId).expect(200);
    expect(config.body.cfg).to.include('\nserver 10.99.219.0 255.255.255.0\n');
  });

  it('rolls back the source address and option when a derived network would be invalid', async () => {
    const shared = await createNetwork('10.99.219.0', '/24');
    const created = await createServer(shared).expect(200);

    const ipobjs = manager.getRepository(IPObj);
    const wireGuardAddress = await ipobjs.save({
      fwCloudId: fixture.fwcloud.id,
      name: 'WireGuard address',
      ipObjTypeId: 5,
      ip_version: 4,
      address: '10.99.219.1',
      netmask: '/24',
    });
    const wgOptions = manager.getRepository(WireGuardOption);
    const wgOptionKey = { wireGuardId: fixture.wireguardServer.id, name: 'Address' };
    await wgOptions.update(wgOptionKey, { ipObjId: wireGuardAddress.id, arg: '10.99.219.1/24' });
    await wgOptions.save({
      wireGuardId: fixture.wireguardServer.id,
      ipObjId: shared,
      name: '<<vpn_network>>',
      arg: '10.99.219.0/24',
      order: 2,
      scope: 2,
    });

    const { body } = await request(testSuite.app.express)
      .put('/ipobj')
      .set('Cookie', cookie)
      .send({
        fwcloud: fixture.fwcloud.id,
        id: wireGuardAddress.id,
        name: wireGuardAddress.name,
        type: 5,
        ip_version: 4,
        address: '10.99.219.5',
        netmask: '/30',
      })
      .expect(400);
    expect(body.msg).to.include('10.99.219.4').and.include('/30');
    expect(await ipobjs.findOneByOrFail({ id: wireGuardAddress.id })).to.include({
      address: '10.99.219.1',
      netmask: '/24',
    });
    expect(await wgOptions.findOneByOrFail(wgOptionKey)).to.have.property('arg', '10.99.219.1/24');
    const config = await getConfigFile(created.body.insertId).expect(200);
    expect(config.body.cfg).to.include('\nserver 10.99.219.0 255.255.255.0\n');
  });

  it('serializes a server assignment with concurrent changes to its network', async () => {
    const ipobj = await createNetwork('10.99.219.0', '/24');
    const [create, update] = await Promise.all([
      createServer(ipobj),
      updateNetwork(ipobj, '10.99.219.1', '/24'),
    ]);
    expect([create.status, update.status].sort()).to.deep.equal([200, 400]);

    const saved = await manager.getRepository(IPObj).findOneByOrFail({ id: ipobj });
    if (create.status === 200) {
      expect(saved.address).to.equal('10.99.219.0');
      await getConfigFile(create.body.insertId).expect(200);
    } else {
      expect(saved.address).to.equal('10.99.219.1');
      expect(await manager.getRepository(OpenVPN).countBy({ crtId: crt.id })).to.equal(0);
    }
  });

  it('blocks generation, installation, and activation for a historical malformed subnet', async () => {
    const ipobj = await createNetwork('10.99.219.0', '/24');
    const created = await createServer(ipobj).expect(200);
    const openvpn = created.body.insertId;
    await manager.getRepository(IPObj).update(ipobj, { netmask: '255.0.255.0' });
    await manager.getRepository(Firewall).update(fixture.firewall.id, {
      install_communication: FirewallInstallCommunication.Agent,
    });
    const getCommunication = sinon.stub(Firewall.prototype, 'getCommunication').rejects();

    const config = await getConfigFile(openvpn).expect(400);
    expect(config.body.msg).to.include('10.99.219.0').and.include('255.0.255.0');

    const install = await request(testSuite.app.express)
      .put(`${BASE_ROUTE}/install`)
      .set('Cookie', cookie)
      .send({ fwcloud: fixture.fwcloud.id, firewall: fixture.firewall.id, openvpn })
      .expect(400);
    expect(install.body.msg).to.equal(config.body.msg);

    const activation = await request(testSuite.app.express)
      .post('/systemctl')
      .set('Cookie', cookie)
      .send({
        fwcloud: fixture.fwcloud.id,
        firewall: fixture.firewall.id,
        command: 'start',
        service: 'openvpn-server@server',
      })
      .expect(400);
    expect(activation.body.message).to.equal(config.body.msg);

    sinon.assert.notCalled(getCommunication);
    expect(await manager.getRepository(IPObj).findOneByOrFail({ id: ipobj })).to.have.property(
      'netmask',
      '255.0.255.0',
    );
  });

  it('continues to save and generate an OpenVPN client using an address object with host bits', async () => {
    const client = fixture.openvpnClients.get('OpenVPN-Cli-1');
    const ipobj = fixture.ipobjs.get('openvpn-cli1-addr');
    await manager.getRepository(IPObj).update(ipobj.id, { netmask: '255.255.255.0' });

    await request(testSuite.app.express)
      .put(BASE_ROUTE)
      .set('Cookie', cookie)
      .send({
        fwcloud: fixture.fwcloud.id,
        openvpn: client.id,
        options: [{ name: 'ifconfig-push', arg: '', ipobj: ipobj.id, scope: 0 }],
      })
      .expect(204);

    const config = await getConfigFile(client.id).expect(200);
    expect(config.body.ccd).to.equal(`ifconfig-push ${ipobj.address} 255.255.255.0\n`);
  });
});
