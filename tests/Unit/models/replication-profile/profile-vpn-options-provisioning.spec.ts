import { describeName, expect, testSuite } from '../../../mocha/global-setup';
import db from '../../../../src/database/database-manager';
import { FwCloudFactory, FwCloudProduct } from '../../../utils/fwcloud-factory';
import { Firewall } from '../../../../src/models/firewall/Firewall';
import { Crt } from '../../../../src/models/vpn/pki/Crt';
import { createVpnProvisioningTarget, vpnConnection } from '../../../utils/vpn-template-fixtures';
import { ProfileVpnRollback } from '../../../../src/models/replication-profile/profile-vpn-rollback';
import {
  ProfileVpnConnectionTemplate,
  provisionVpnTemplateConfigs,
} from '../../../../src/models/replication-profile/profile-vpn-config-provisioning.service';

const connection = (overrides: Partial<ProfileVpnConnectionTemplate>) =>
  vpnConnection({ certificateId: 'srvcert', ...overrides });

const OVP = 1;
const WG_SERVER_INTERFACE = 2;
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
              { name: 'remote', arg: 'ignored 1', scope: OVP },
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
