import { describeName, expect, testSuite } from '../../../mocha/global-setup';
import db from '../../../../src/database/database-manager';
import { FwCloudFactory, FwCloudProduct } from '../../../utils/fwcloud-factory';
import { Firewall } from '../../../../src/models/firewall/Firewall';
import { Crt } from '../../../../src/models/vpn/pki/Crt';
import { IPSec } from '../../../../src/models/vpn/ipsec/IPSec';
import { createVpnProvisioningTarget, vpnConnection } from '../../../utils/vpn-template-fixtures';
import { ProfileVpnRollback } from '../../../../src/models/replication-profile/profile-vpn-rollback';
import {
  ProfileVpnConnectionTemplate,
  bindVpnOptionParameters,
  provisionVpnTemplateConfigs,
} from '../../../../src/models/replication-profile/profile-vpn-config-provisioning.service';

const connection = (overrides: Partial<ProfileVpnConnectionTemplate>) =>
  vpnConnection({ kind: 'ipsec', port: 500, ...overrides });

describe(describeName('IPsec VPN template provisioning'), () => {
  let fwc: FwCloudProduct;
  let firewall: Firewall;
  let serverCrt: Crt;
  let clientCrt: Crt;
  let errors: string[];
  let rollback: ProfileVpnRollback;

  const server = connection({ id: 'srv', name: 'Office', certificateId: 'srvcert' });
  const client = connection({
    id: 'cli',
    name: 'Laptop',
    role: 'client',
    serverId: 'srv',
    certificateId: 'clicert',
  });
  const values: Record<string, Record<string, string>> = {
    srv: { localNetwork: '10.20.0.0/24', endpoint: 'vpn.example.com' },
    cli: { network: '10.20.0.5/24' },
  };

  const provision = (connections: ProfileVpnConnectionTemplate[], resolved = values) =>
    provisionVpnTemplateConfigs(
      db.getQuery(),
      fwc.fwcloud.id,
      firewall.id,
      connections,
      {
        caIds: new Map(),
        certificateIds: new Map([
          ['srvcert', serverCrt.id],
          ['clicert', clientCrt.id],
        ]),
        rollback,
      },
      resolved,
      errors,
    );

  const rows = (sql: string, params: unknown[] = []): Promise<any[]> =>
    db.getSource().query(sql, params);

  before(async () => {
    await testSuite.resetDatabaseData();
  });

  beforeEach(async () => {
    errors = [];
    rollback = new ProfileVpnRollback();
    fwc = await new FwCloudFactory().make();
    ({ firewall, serverCrt, clientCrt } = await createVpnProvisioningTarget(fwc, 'Prof'));
  });

  it('creates a server and its client the way the interactive panel does', async () => {
    const configs = await provision([server, client]);

    expect(errors).to.be.empty;
    expect(configs.get('srv')).to.deep.include({ protocol: 'ipsec' });
    expect(configs.get('cli')).to.deep.include({ protocol: 'ipsec' });
    const serverId = configs.get('srv').id;
    const clientId = configs.get('cli').id;

    const [serverRow] = await rows('SELECT * FROM ipsec WHERE id = ?', [serverId]);
    expect(serverRow).to.deep.include({
      firewall: firewall.id,
      crt: serverCrt.id,
      ipsec: null,
      type: 2,
      install_dir: '/etc',
      install_name: 'ips0.conf',
    });
    const [clientRow] = await rows('SELECT * FROM ipsec WHERE id = ?', [clientId]);
    expect(clientRow).to.deep.include({
      firewall: firewall.id,
      crt: clientCrt.id,
      ipsec: serverId,
      type: 1,
    });

    const option = async (ipsec: number, name: string, cli: number | null = null) =>
      (
        await rows('SELECT * FROM ipsec_opt WHERE ipsec = ? AND name = ? AND ipsec_cli <=> ?', [
          ipsec,
          name,
          cli,
        ])
      )[0];

    // The server's VPN network is a real network object bound to leftsubnet, and the tunnel
    // interface takes its first address.
    const subnet = await option(serverId, 'leftsubnet');
    expect(subnet.arg).to.equal('10.20.0.0/24');
    expect(subnet.scope).to.equal(6);
    const [network] = await rows('SELECT type, address, netmask FROM ipobj WHERE id = ?', [
      subnet.ipobj,
    ]);
    expect(network).to.deep.equal({ type: 7, address: '10.20.0.0', netmask: '/24' });
    expect((await option(serverId, 'left')).arg).to.equal('10.20.0.1');
    expect((await option(serverId, 'leftid')).arg).to.equal('"CN=Prof-Server"');
    expect((await option(serverId, 'leftcert')).arg).to.equal('Prof-Server.crt');
    const interfaces = await rows('SELECT name FROM interface WHERE firewall = ?', [firewall.id]);
    expect(interfaces.map((row) => row.name)).to.include('ips0');

    // The client owns its address as a real object and points at the server.
    const source = await option(clientId, 'leftsourceip');
    expect(source.arg).to.equal('10.20.0.5');
    expect(source.scope).to.equal(7);
    const [address] = await rows('SELECT type, address, netmask FROM ipobj WHERE id = ?', [
      source.ipobj,
    ]);
    expect(address).to.deep.equal({ type: 5, address: '10.20.0.5', netmask: '/24' });
    expect((await option(clientId, 'right')).arg).to.equal('vpn.example.com');
    expect((await option(clientId, 'rightid')).arg).to.equal('"CN=Prof-Server"');
    expect((await option(clientId, 'leftcert')).arg).to.equal('Prof-Client.crt');
    expect((await option(clientId, 'rightsubnet')).arg).to.equal('10.20.0.0/24');

    // The server-side peer entries the interactive controller adds for every client.
    expect((await option(serverId, 'auto', clientId)).arg).to.equal('add');
    expect((await option(serverId, 'auto', clientId)).scope).to.equal(8);
    expect(await option(serverId, 'rightsubnet', clientId)).to.exist;

    const nodes = await rows(
      'SELECT node_type, id_obj, obj_type FROM fwc_tree WHERE fwcloud = ? AND node_type IN (?, ?)',
      [fwc.fwcloud.id, 'ISS', 'ISC'],
    );
    expect(nodes.filter((node) => node.node_type === 'ISS')).to.deep.include({
      node_type: 'ISS',
      id_obj: serverId,
      obj_type: 332,
    });
    expect(nodes.filter((node) => node.node_type === 'ISC')).to.deep.include({
      node_type: 'ISC',
      id_obj: clientId,
      obj_type: 331,
    });
  });

  it('produces configuration files the installer can use', async () => {
    const configs = await provision([server, client]);
    expect(errors).to.be.empty;

    const serverDump = (await IPSec.dumpCfg(db.getQuery(), configs.get('srv').id)) as {
      cfg: string;
    };
    expect(serverDump.cfg).to.include('leftsubnet = 10.20.0.0/24');
    expect(serverDump.cfg).to.include('leftcert = Prof-Server.crt');
    expect(serverDump.cfg).to.include('conn Prof-Client');
    expect(serverDump.cfg).to.include('rightsourceip = 10.20.0.5');
    expect(serverDump.cfg).to.include('rightcert = Prof-Client.crt');

    const clientDump = (await IPSec.dumpCfg(db.getQuery(), configs.get('cli').id)) as {
      cfg: string;
    };
    expect(clientDump.cfg).to.include('right = vpn.example.com');
    expect(clientDump.cfg).to.include('leftsourceip = 10.20.0.5');
    expect(clientDump.cfg).to.include('leftcert = Prof-Client.crt');
  });

  describe('client right', () => {
    const pickedEndpoints: Array<{
      label: string;
      option: NonNullable<ProfileVpnConnectionTemplate['options']>[number];
    }> = [
      {
        label: 'a cloud object address',
        option: { name: 'right', arg: '203.0.113.7', scope: 7 },
      },
      {
        label: 'a template object parameter',
        option: { name: 'right', arg: 'Edge', scope: 7, param: 'edge_ip' },
      },
      {
        label: 'a template interface role',
        option: { name: 'right', arg: 'eth0', scope: 7, interfaceRole: 'wan' },
      },
    ];

    for (const { label, option } of pickedEndpoints) {
      it(`stores ${label} without a port even without the server's endpoint`, async () => {
        const connections = bindVpnOptionParameters(
          [server, { ...client, options: [option] }],
          new Map([['edge_ip', '203.0.113.7']]),
          errors,
          new Map([['wan', '203.0.113.7']]),
        );
        const configs = await provision(connections, {
          srv: { localNetwork: values.srv.localNetwork },
          cli: values.cli,
        });

        expect(errors).to.be.empty;
        expect(
          await rows('SELECT arg, scope FROM ipsec_opt WHERE ipsec = ? AND name = ?', [
            configs.get('cli').id,
            'right',
          ]),
        ).to.deep.equal([{ arg: '203.0.113.7', scope: 7 }]);
        const dumped = (await IPSec.dumpCfg(db.getQuery(), configs.get('cli').id)) as {
          cfg: string;
        };
        expect(dumped.cfg).to.match(/right = 203\.0\.113\.7\r?\n/);
      });
    }

    it("uses the server's endpoint when the picker was left empty", async () => {
      const configs = await provision([
        server,
        { ...client, options: [{ name: 'right', arg: '', scope: 7 }] },
      ]);

      expect(errors).to.be.empty;
      expect(
        await rows('SELECT arg FROM ipsec_opt WHERE ipsec = ? AND name = ?', [
          configs.get('cli').id,
          'right',
        ]),
      ).to.deep.equal([{ arg: 'vpn.example.com' }]);
    });

    it("prefers the selected endpoint over the server's deployment value", async () => {
      const configs = await provision([
        server,
        { ...client, options: [{ name: 'right', arg: '203.0.113.7', scope: 7 }] },
      ]);

      expect(errors).to.be.empty;
      expect(
        await rows('SELECT arg FROM ipsec_opt WHERE ipsec = ? AND name = ?', [
          configs.get('cli').id,
          'right',
        ]),
      ).to.deep.equal([{ arg: '203.0.113.7' }]);
    });
  });

  it("puts the routes added in the template after the server's network in the client's rightsubnet", async () => {
    const configs = await provision([
      { ...server, localNetwork: '192.168.1.0/24' },
      {
        ...client,
        options: [
          { name: 'rightsubnet', arg: '192.168.1.0/24, 10.30.0.0/24, 10.20.0.0/24', scope: 7 },
        ],
      },
    ]);

    expect(errors).to.be.empty;
    expect(
      await rows('SELECT arg FROM ipsec_opt WHERE ipsec = ? AND name = ?', [
        configs.get('cli').id,
        'rightsubnet',
      ]),
    ).to.deep.equal([{ arg: '10.20.0.0/24, 10.30.0.0/24' }]);
  });

  it('removes everything it created when it is rolled back', async () => {
    const before = {
      ipsec: await rows('SELECT id FROM ipsec WHERE firewall = ?', [firewall.id]),
      objects: await rows('SELECT id FROM ipobj WHERE fwcloud = ? ', [fwc.fwcloud.id]),
    };
    await provision([server, client]);
    expect(errors).to.be.empty;

    await rollback.rollback(errors);

    expect(errors).to.be.empty;
    expect(await rows('SELECT id FROM ipsec WHERE firewall = ?', [firewall.id])).to.deep.equal(
      before.ipsec,
    );
    expect(
      await rows(
        'SELECT O.name FROM ipsec_opt O INNER JOIN ipsec I ON I.id = O.ipsec WHERE I.firewall = ?',
        [firewall.id],
      ),
    ).to.be.empty;
    // Every network and address object it made is gone (the tunnel interface itself stays, exactly
    // as when a server is deleted interactively).
    expect(await rows('SELECT id FROM ipobj WHERE fwcloud = ?', [fwc.fwcloud.id])).to.deep.equal(
      before.objects,
    );
    expect(
      await rows("SELECT id FROM fwc_tree WHERE fwcloud = ? AND node_type IN ('ISS', 'ISC')", [
        fwc.fwcloud.id,
      ]),
    ).to.be.empty;
  });

  it('refuses a second IPsec server on the same firewall like the interactive one does', async () => {
    const other = connection({ id: 'srv2', name: 'Second', certificateId: 'srvcert' });
    await provision([server, other], {
      ...values,
      srv2: { localNetwork: '10.30.0.0/24', endpoint: 'other.example.com' },
    });

    expect(errors.join(' ')).to.include('already has an IPsec server');
    expect(
      await rows('SELECT id FROM ipsec WHERE firewall = ? AND ipsec IS NULL', [firewall.id]),
    ).to.have.length(1);
  });

  it('reports a client of an external server instead of silently skipping it', async () => {
    const external = connection({
      id: 'ext',
      name: 'Branch',
      role: 'client',
      certificateId: 'clicert',
    });
    const configs = await provision([external]);

    expect(configs.has('ext')).to.be.false;
    expect(errors.join(' ')).to.include('IPsec connection "Branch"');
    expect(errors.join(' ')).to.include('pre-shared key');
  });

  it('needs the values a server and its clients cannot work without', async () => {
    await provision([server, client], { srv: { localNetwork: '10.20.0.0/24' }, cli: values.cli });

    expect(errors.join(' ')).to.include('endpoint');
    expect(
      await rows('SELECT id FROM ipsec WHERE ipsec IS NOT NULL AND firewall = ?', [firewall.id]),
    ).to.be.empty;
  });
});
