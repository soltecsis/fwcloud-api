import { describeName, expect, testSuite } from '../../../mocha/global-setup';
import db from '../../../../src/database/database-manager';
import { FwCloudFactory, FwCloudProduct } from '../../../utils/fwcloud-factory';
import { Firewall } from '../../../../src/models/firewall/Firewall';
import { Crt } from '../../../../src/models/vpn/pki/Crt';
import { Interface } from '../../../../src/models/interface/Interface';
import { IPObj } from '../../../../src/models/ipobj/IPObj';
import { createVpnProvisioningTarget, vpnConnection } from '../../../utils/vpn-template-fixtures';
import { ProfileVpnRollback } from '../../../../src/models/replication-profile/profile-vpn-rollback';
import {
  ProfileVpnConnectionTemplate,
  bindVpnOptionParameters,
  loadInterfaceRoleAddresses,
  provisionVpnTemplateConfigs,
} from '../../../../src/models/replication-profile/profile-vpn-config-provisioning.service';

const connection = (overrides: Partial<ProfileVpnConnectionTemplate>) =>
  vpnConnection({ certificateId: 'srvcert', ...overrides });

const OVP = 1;
const WG_SERVER_INTERFACE = 2;
const WG_CLIENT_PEER = 5;
const IPSEC_SERVER = 6;

describe(describeName('VPN template options provisioning'), () => {
  let fwc: FwCloudProduct;
  let firewall: Firewall;
  let serverCrt: Crt;
  let clientCrt: Crt;
  let errors: string[];
  let rollback: ProfileVpnRollback;

  const provision = (
    connections: ProfileVpnConnectionTemplate[],
    resolved: Record<string, Record<string, string>>,
  ) =>
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

  const optionsOf = async (table: string, column: string, id: number, scope?: number) =>
    Object.fromEntries(
      (
        await rows(
          `SELECT name, arg FROM ${table} WHERE ${column} = ? ${scope === undefined ? '' : 'AND scope = ?'} ${
            table === 'ipsec_opt' ? 'AND ipsec_cli IS NULL' : ''
          }`,
          scope === undefined ? [id] : [id, scope],
        )
      ).map((row) => [row.name, row.arg]),
    );

  before(async () => {
    await testSuite.resetDatabaseData();
  });

  beforeEach(async () => {
    errors = [];
    rollback = new ProfileVpnRollback();
    fwc = await new FwCloudFactory().make();
    ({ firewall, serverCrt, clientCrt } = await createVpnProvisioningTarget(fwc, 'Opt'));
  });

  describe('OpenVPN', () => {
    const values = {
      srv: { network: '10.8.0.0/24', endpoint: 'vpn.example.com' },
      cli: { network: '10.8.0.2/24' },
    };
    const client = connection({
      id: 'cli',
      name: 'Laptop',
      role: 'client',
      serverId: 'srv',
      certificateId: 'clicert',
    });

    it('keeps exactly what the apply builds for a connection saved without options', async () => {
      const configs = await provision([connection({}), client], values);

      expect(errors).to.be.empty;
      const options = await optionsOf('openvpn_opt', 'openvpn', configs.get('srv').id, OVP);
      expect(options).to.include({
        port: '1194',
        proto: 'udp',
        topology: 'subnet',
        keepalive: '10 120',
      });
      expect(options.server).to.equal('10.8.0.0 255.255.255.0');
    });

    it('applies the options the template editor stored, and never lets them change what is derived', async () => {
      const server = connection({
        options: [
          { name: 'server', arg: '1.1.1.0 255.255.255.0', scope: OVP },
          { name: 'port', arg: '4443', scope: OVP },
          { name: 'proto', arg: 'tcp', scope: OVP },
          { name: 'dev', arg: 'tun0', scope: OVP },
          { name: 'keepalive', arg: '20 240', scope: OVP, comment: 'faster failover' },
          { name: 'push', arg: 'route 10.9.0.0 255.255.255.0', scope: OVP },
        ],
      });
      const configs = await provision([server, client], values);

      expect(errors).to.be.empty;
      const id = configs.get('srv').id;
      const options = await optionsOf('openvpn_opt', 'openvpn', id, OVP);
      expect(options).to.include({ port: '4443', proto: 'tcp', keepalive: '20 240' });
      expect(options.push).to.equal('route 10.9.0.0 255.255.255.0');
      // The network comes from what the apply was given, and a generic tun0 still means a free tun.
      expect(options.server).to.equal('10.8.0.0 255.255.255.0');
      expect(options.dev).to.equal('tun0');
      // Options the operator removed from the grid are not created.
      expect(options).to.not.have.any.keys('topology', 'cipher', 'multihome');
      const [{ comment }] = await rows(
        "SELECT comment FROM openvpn_opt WHERE openvpn = ? AND name = 'keepalive'",
        [id],
      );
      expect(comment).to.equal('faster failover');
    });

    it("creates a connection no rule references with the template's own values", async () => {
      // No rule points at it, so it got no apply-time parameters: nothing in `resolved`.
      const configs = await provision(
        [connection({ network: '10.8.0.0/24', endpoint: 'vpn.example.com' })],
        {},
      );

      expect(errors).to.be.empty;
      expect(
        (await optionsOf('openvpn_opt', 'openvpn', configs.get('srv').id, OVP)).server,
      ).to.equal('10.8.0.0 255.255.255.0');
    });

    it('keeps a tunnel interface name the operator typed', async () => {
      const server = connection({ options: [{ name: 'dev', arg: 'tun7', scope: OVP }] });
      const configs = await provision([server], { srv: values.srv });

      expect(errors).to.be.empty;
      expect((await optionsOf('openvpn_opt', 'openvpn', configs.get('srv').id, OVP)).dev).to.equal(
        'tun7',
      );
    });

    it('applies a stored client option list too', async () => {
      const configs = await provision(
        [
          connection({}),
          {
            ...client,
            options: [
              { name: 'remote', arg: '', scope: OVP },
              { name: 'verb', arg: '5', scope: OVP },
              { name: 'client', arg: '', scope: OVP },
            ],
          },
        ],
        values,
      );

      expect(errors).to.be.empty;
      const options = await optionsOf('openvpn_opt', 'openvpn', configs.get('cli').id, OVP);
      expect(options).to.include({ verb: '5', remote: 'vpn.example.com 1194' });
      expect(options).to.not.have.any.keys('cipher', 'tls-client');
    });

    it('keeps every remote picked in the template editor instead of the server endpoint', async () => {
      const configs = await provision(
        [
          connection({}),
          {
            ...client,
            options: [
              { name: 'remote', arg: '203.0.113.7 1194', scope: OVP },
              { name: 'remote', arg: '198.51.100.9 1195', scope: OVP },
            ],
          },
        ],
        { ...values, srv: { network: values.srv.network } },
      );

      expect(errors).to.be.empty;
      const remotes = await rows(
        "SELECT arg FROM openvpn_opt WHERE openvpn = ? AND name = 'remote' ORDER BY arg",
        [configs.get('cli').id],
      );
      expect(remotes.map((row) => row.arg)).to.deep.equal([
        '198.51.100.9 1195',
        '203.0.113.7 1194',
      ]);
    });
  });

  describe('WireGuard', () => {
    const wgServer = connection({ id: 'wgs', name: 'WG Office', kind: 'wireguard', port: 51820 });
    const values = { wgs: { network: '10.50.0.1/24', endpoint: 'wg.example.com' } };

    it('binds the config to the certificate the template declares', async () => {
      const configs = await provision([wgServer], values);

      expect(errors).to.be.empty;
      const [row] = await rows('SELECT crt FROM wireguard WHERE id = ?', [configs.get('wgs').id]);
      expect(row.crt).to.equal(serverCrt.id);
    });

    it('applies the options the template editor stored, leaving the keys and the address to the apply', async () => {
      const configs = await provision(
        [
          {
            ...wgServer,
            options: [
              { name: 'PrivateKey', arg: 'must-not-be-used', scope: WG_SERVER_INTERFACE },
              { name: 'Address', arg: '9.9.9.9/24', scope: WG_SERVER_INTERFACE },
              { name: 'ListenPort', arg: '51999', scope: WG_SERVER_INTERFACE },
              { name: 'DNS', arg: '1.1.1.1', scope: WG_SERVER_INTERFACE },
            ],
          },
        ],
        values,
      );

      expect(errors).to.be.empty;
      const options = await optionsOf(
        'wireguard_opt',
        'wireguard',
        configs.get('wgs').id,
        WG_SERVER_INTERFACE,
      );
      expect(options).to.include({ ListenPort: '51999', DNS: '1.1.1.1', Address: '10.50.0.1/24' });
      expect(options).to.not.have.property('PrivateKey');
    });

    it('links the server and client addresses to IP objects, like the interactive panel', async () => {
      const client = connection({
        id: 'wgc',
        name: 'WG Laptop',
        kind: 'wireguard',
        role: 'client',
        serverId: 'wgs',
        certificateId: 'clicert',
      });
      const configs = await provision([wgServer, client], {
        ...values,
        wgc: { network: '10.50.0.2/24', remoteNetwork: '192.168.1.0/24' },
      });

      expect(errors).to.be.empty;
      const linked = async (id: number) =>
        Object.fromEntries(
          (
            await rows(
              `SELECT W.name, W.arg, O.type, O.address FROM wireguard_opt W
               LEFT JOIN ipobj O ON O.id = W.ipobj WHERE W.wireguard = ? AND W.ipobj IS NOT NULL`,
              [id],
            )
          ).map((row) => [row.name, [row.arg, row.type, row.address]]),
        );

      // The network object behind '<<vpn_network>>', and the tunnel interface's first host.
      expect(await linked(configs.get('wgs').id)).to.deep.equal({
        '<<vpn_network>>': ['10.50.0.0/24', 7, '10.50.0.0'],
        Address: ['10.50.0.1/24', 5, '10.50.0.1'],
      });
      expect(await linked(configs.get('wgc').id)).to.deep.equal({
        Address: ['10.50.0.2/24', 5, '10.50.0.2'],
      });
    });

    describe('client Endpoint', () => {
      const wgClient = connection({
        id: 'wgc',
        name: 'WG Laptop',
        kind: 'wireguard',
        role: 'client',
        serverId: 'wgs',
        certificateId: 'clicert',
      });
      const clientValues = {
        ...values,
        wgc: { network: '10.50.0.2/24', remoteNetwork: '192.168.1.0/24' },
      };
      const endpointOf = async (configs: Map<string, { id: number }>) =>
        (await optionsOf('wireguard_opt', 'wireguard', configs.get('wgc').id, WG_CLIENT_PEER))
          .Endpoint;

      it("is worked out from the server's endpoint and port when the template left it empty", async () => {
        const configs = await provision(
          [
            wgServer,
            { ...wgClient, options: [{ name: 'Endpoint', arg: '', scope: WG_CLIENT_PEER }] },
          ],
          clientValues,
        );

        expect(errors).to.be.empty;
        expect(await endpointOf(configs)).to.equal('wg.example.com:51820');
      });

      it('keeps the one picked in the template editor', async () => {
        const configs = await provision(
          [
            wgServer,
            {
              ...wgClient,
              options: [{ name: 'Endpoint', arg: '203.0.113.7:51999', scope: WG_CLIENT_PEER }],
            },
          ],
          clientValues,
        );

        expect(errors).to.be.empty;
        expect(await endpointOf(configs)).to.equal('203.0.113.7:51999');
      });

      it("doesn't need the server's endpoint once one was picked", async () => {
        const configs = await provision(
          [
            wgServer,
            {
              ...wgClient,
              options: [{ name: 'Endpoint', arg: '203.0.113.7:51820', scope: WG_CLIENT_PEER }],
            },
          ],
          { ...clientValues, wgs: { network: '10.50.0.1/24' } },
        );

        expect(errors).to.be.empty;
        expect(await endpointOf(configs)).to.equal('203.0.113.7:51820');
      });
    });
  });

  describe('options bound to a profile object', () => {
    const bind = (
      options: ProfileVpnConnectionTemplate['options'],
      kind: 'openvpn' | 'wireguard',
    ) =>
      bindVpnOptionParameters(
        [connection({ id: 'cli', name: 'Laptop', kind, role: 'client', options })],
        new Map<string, unknown>([
          ['edge_ip', '203.0.113.7'],
          ['edge_v6', '2001:db8::7'],
          ['empty', ''],
        ]),
        errors,
        new Map(),
      )[0].options;

    it("take the object's address as applied and keep the port they were picked with", () => {
      expect(
        bind([{ name: 'Endpoint', arg: 'Edge:51999', scope: 5, param: 'edge_ip' }], 'wireguard'),
      ).to.deep.equal([{ name: 'Endpoint', arg: '203.0.113.7:51999', scope: 5 }]);
      expect(
        bind([{ name: 'Endpoint', arg: 'Edge:51820', scope: 5, param: 'edge_v6' }], 'wireguard')[0]
          .arg,
      ).to.equal('[2001:db8::7]:51820');
      expect(
        bind([{ name: 'remote', arg: 'Edge 1195', scope: OVP, param: 'edge_ip' }], 'openvpn')[0]
          .arg,
      ).to.equal('203.0.113.7 1195');
      expect(errors).to.be.empty;
    });

    it('take the address of the interface playing their role on the target', () => {
      const options = bindVpnOptionParameters(
        [
          connection({
            id: 'cli',
            name: 'Laptop',
            kind: 'wireguard',
            role: 'client',
            options: [{ name: 'Endpoint', arg: 'eth0:51820', scope: 5, interfaceRole: 'wan' }],
          }),
        ],
        new Map(),
        errors,
        new Map([['wan', '198.51.100.4']]),
      )[0].options;

      expect(options).to.deep.equal([{ name: 'Endpoint', arg: '198.51.100.4:51820', scope: 5 }]);
      expect(errors).to.be.empty;
    });

    it('find the interface assigned to each role, else the one of the same name', async () => {
      const iface = async (name: string, addresses: Array<[string, number]>) => {
        const saved = await db
          .getSource()
          .manager.getRepository(Interface)
          .save(
            db.getSource().manager.getRepository(Interface).create({
              name,
              type: '10',
              interface_type: '10',
              firewallId: firewall.id,
            }),
          );
        for (const [address, ipVersion] of addresses) {
          await db
            .getSource()
            .manager.getRepository(IPObj)
            .save(
              db
                .getSource()
                .manager.getRepository(IPObj)
                .create({
                  name: `${name} ${address}`,
                  address,
                  ipObjTypeId: 5,
                  ip_version: ipVersion,
                  interfaceId: saved.id,
                }),
            );
        }
      };
      await iface('ens18', [
        ['2001:db8::4', 6],
        ['198.51.100.4', 4],
      ]);
      await iface('eth1', [['192.0.2.1', 4]]);
      await iface('eth9', []);

      const addresses = await loadInterfaceRoleAddresses(
        db.getQuery(),
        firewall.id,
        [
          { role: 'wan', name: 'eth0' },
          { role: 'lan', name: 'eth1' },
          { role: 'dmz', name: 'eth9' },
        ],
        { wan: 'ens18' },
      );

      expect(Object.fromEntries(addresses)).to.deep.equal({
        wan: '198.51.100.4',
        lan: '192.0.2.1',
      });
    });

    it('report an object applied without an address', () => {
      expect(
        bind([{ name: 'Endpoint', arg: 'Edge:51820', scope: 5, param: 'empty' }], 'wireguard')[0]
          .arg,
      ).to.equal('');
      expect(errors).to.have.length(1);
    });
  });

  describe('IPsec', () => {
    const server = connection({ id: 'ips', name: 'IPsec Office', kind: 'ipsec', port: 500 });
    const values = { ips: { localNetwork: '10.20.0.0/24', endpoint: 'ips.example.com' } };

    it('applies the options the template editor stored, leaving what depends on the certificate and network', async () => {
      const configs = await provision(
        [
          {
            ...server,
            options: [
              { name: 'keyexchange', arg: 'ikev1', scope: IPSEC_SERVER },
              { name: 'dpddelay', arg: '600s', scope: IPSEC_SERVER },
              { name: 'leftid', arg: '"CN=someone-else"', scope: IPSEC_SERVER },
              { name: 'leftsubnet', arg: '1.2.3.0/24', scope: IPSEC_SERVER },
              { name: 'charondebug', arg: 'ike 2', scope: IPSEC_SERVER },
              { name: 'uniqueids', arg: 'no', scope: IPSEC_SERVER },
            ],
          },
        ],
        values,
      );

      expect(errors).to.be.empty;
      const options = await optionsOf('ipsec_opt', 'ipsec', configs.get('ips').id, IPSEC_SERVER);
      expect(options).to.include({
        keyexchange: 'ikev1',
        dpddelay: '600s',
        uniqueids: 'no',
        charondebug: 'ike 2',
        leftid: '"CN=Opt-Server"',
        leftsubnet: '10.20.0.0/24',
      });
      expect(options).to.not.have.any.keys('esp', 'rekey', 'leftfirewall');
    });
  });
});
