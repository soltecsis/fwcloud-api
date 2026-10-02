import { describeName, expect, testSuite } from '../../../mocha/global-setup';
import { Application } from '../../../../src/Application';
import db from '../../../../src/database/database-manager';
import { FwCloudFactory, FwCloudProduct } from '../../../utils/fwcloud-factory';
import {
  ReplicationTargetSide,
  makeReplicationTargetFirewall,
} from '../../../utils/replication-profile-fixtures';
import { createUser } from '../../../utils/utils';
import StringHelper from '../../../../src/utils/string.helper';
import { Cluster } from '../../../../src/models/firewall/Cluster';
import { Firewall } from '../../../../src/models/firewall/Firewall';
import { Interface } from '../../../../src/models/interface/Interface';
import { IPObj } from '../../../../src/models/ipobj/IPObj';
import { DefaultPolicyRuleComments, PolicyRule } from '../../../../src/models/policy/PolicyRule';
import { NotFoundException } from '../../../../src/fonaments/exceptions/not-found-exception';
import { ReplicationProfile } from '../../../../src/models/replication-profile/replication-profile.model';
import {
  ipObjCidr,
  ReplicationProfileSnapshotService,
} from '../../../../src/models/replication-profile/replication-profile-snapshot.service';
import {
  getProvisionRulePositions,
  PolicyReplicationService,
} from '../../../../src/models/replication-profile/policy-replication.service';
import { getProfileProvisioning } from '../../../../src/models/replication-profile/policy-replication.types';
import {
  ProfileVpnConnectionTemplate,
  resolveVpnConnectionValues,
} from '../../../../src/models/replication-profile/profile-vpn-config-provisioning.service';
import {
  ProfileVpnCaTemplate,
  ProfileVpnCertificateTemplate,
} from '../../../../src/models/replication-profile/profile-vpn-pki-provisioning.service';
import { validateProfileVpnTemplate } from '../../../../src/models/replication-profile/replication-profile-vpn.validation';
import { normalizeProfileVpnRuleParameters } from '../../../../src/models/replication-profile/replication-profile-vpn-parameters';
import { loadReplicationProfileModel } from '../../../../src/models/replication-profile/replication-profile-template';

interface CapturedObject {
  kind: string;
  value?: unknown;
  role?: string;
  name?: string;
  vpnId?: string;
}

interface CapturedRule {
  chain: string;
  ipVersion: number;
  action: string;
  inRole?: string;
  outRole?: string;
  source?: CapturedObject[];
  destination?: CapturedObject[];
  services?: { protocol: string; port: unknown }[];
  comment?: string;
}

interface CapturedParameter {
  name: string;
  type: string;
  default: unknown;
}

describe(describeName('ReplicationProfileSnapshotService Unit Tests'), () => {
  let app: Application;
  let service: ReplicationProfileSnapshotService;
  let fwc: FwCloudProduct;
  let source: ReplicationTargetSide;
  let ownerId: number;

  before(async () => {
    app = testSuite.app;
    await testSuite.resetDatabaseData();
  });

  beforeEach(async () => {
    service = await app.getService<ReplicationProfileSnapshotService>(
      ReplicationProfileSnapshotService.name,
    );
    fwc = await new FwCloudFactory().make();
    source = await makeReplicationTargetFirewall(fwc);
    // A new owner for every test: the code of a profile is unique for its user.
    ownerId = (await createUser({ role: 0 })).id;
  });

  async function insertForwardRule(
    firewallId: number,
    ruleOrder: number,
    overrides: Partial<{
      action: number;
      active: number;
      special: number;
      comment: string;
    }> = {},
  ): Promise<number> {
    return PolicyRule.insertPolicy_r({
      firewall: firewallId,
      type: 3, // IPv4 FORWARD
      rule_order: ruleOrder,
      action: overrides.action ?? 1,
      active: overrides.active ?? 1,
      options: 0,
      special: overrides.special ?? 0,
      comment: overrides.comment ?? null,
    });
  }

  function attachInterface(ruleId: number, interfaceId: number, position: number): Promise<void> {
    return db
      .getSource()
      .query(
        'INSERT INTO policy_r__interface (rule, interface, position, position_order) VALUES (?, ?, ?, 1)',
        [ruleId, interfaceId, position],
      );
  }

  function attachIpObj(ruleId: number, ipobjId: number, position: number): Promise<void> {
    return db
      .getSource()
      .query(
        'INSERT INTO policy_r__ipobj (rule, ipobj, ipobj_g, interface, position, position_order) VALUES (?, ?, -1, -1, ?, 1)',
        [ruleId, ipobjId, position],
      );
  }

  async function makeTcpService(port: number): Promise<IPObj> {
    return db
      .getSource()
      .manager.getRepository(IPObj)
      .save({
        name: `TCP/${port}`,
        ipObjTypeId: 2,
        protocol: 6,
        source_port_start: 0,
        source_port_end: 0,
        destination_port_start: port,
        destination_port_end: port,
        fwCloudId: fwc.fwcloud.id,
      });
  }

  function getProvision(profile: ReplicationProfile): {
    interfaces: Array<{ name: string; role: string; addresses: Array<{ value: unknown }> }>;
    rules: CapturedRule[];
  } {
    return loadReplicationProfileModel(profile).provision as {
      interfaces: Array<{ name: string; role: string; addresses: Array<{ value: unknown }> }>;
      rules: CapturedRule[];
    };
  }

  function getParameters(profile: ReplicationProfile): CapturedParameter[] {
    return (loadReplicationProfileModel(profile).parameters ?? []) as CapturedParameter[];
  }

  function getVpnTemplate(profile: ReplicationProfile) {
    return loadReplicationProfileModel(profile).vpnTemplate as {
      version: number;
      cas: ProfileVpnCaTemplate[];
      certificates: ProfileVpnCertificateTemplate[];
      connections: ProfileVpnConnectionTemplate[];
    };
  }

  /** Real source configurations, with object-backed options whose literal arguments are empty. */
  async function makeVpnPair(
    kind: ProfileVpnConnectionTemplate['kind'],
    firewallId = source.firewall.id,
  ) {
    const query = (sql: string, params: unknown[] = []) => db.getSource().query(sql, params);
    const certificateNames = {
      openvpn: ['OpenVPN-Server', 'OpenVPN-Cli-1'],
      wireguard: ['Wireguard-Server', 'WireGuard-Cli-1'],
      ipsec: ['IPSec-Server', 'IPSec-Cli-1'],
    }[kind];
    const serverCrt = fwc.crts.get(certificateNames[0]);
    const clientCrt = fwc.crts.get(certificateNames[1]);
    const insertConfig = async (crt: number, parent: number | null, type: number) => {
      const extraColumns =
        kind === 'wireguard' ? ', public_key, private_key' : kind === 'ipsec' ? ', type' : '';
      const extraValues = kind === 'wireguard' ? ", '', ''" : kind === 'ipsec' ? ', ?' : '';
      const result = await query(
        `INSERT INTO ${kind} (firewall, crt, ${kind}${extraColumns}) VALUES (?, ?, ?${extraValues})`,
        [firewallId, crt, parent, ...(kind === 'ipsec' ? [type] : [])],
      );
      return Number(result.insertId);
    };
    const serverId = await insertConfig(serverCrt.id, null, 2);
    const clientId = await insertConfig(clientCrt.id, serverId, 1);
    const addresses = db.getSource().manager.getRepository(IPObj);
    const network = await addresses.save({
      name: `${kind} VPN network`,
      address: '10.88.0.0',
      netmask: '/24',
      ipObjTypeId: 7,
      ip_version: 4,
      fwCloudId: fwc.fwcloud.id,
    });
    const clientAddress = await addresses.save({
      name: `${kind} VPN client`,
      address: '10.88.0.2',
      netmask: '/24',
      ipObjTypeId: 5,
      ip_version: 4,
      fwCloudId: fwc.fwcloud.id,
    });
    let order = 0;
    const addOption = (
      configId: number,
      name: string,
      arg: string,
      scope: number,
      ipobj: number | null = null,
      comment: string | null = null,
    ) =>
      query(
        `INSERT INTO ${kind}_opt (${kind}, name, arg, scope, ipobj, \`order\`, comment) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [configId, name, arg, scope, ipobj, ++order, comment],
      );
    if (kind === 'openvpn') {
      await addOption(serverId, 'server', '', 1, network.id);
      await addOption(serverId, 'port', '4443', 1);
      await addOption(serverId, 'proto', 'tcp-server', 1);
      await addOption(serverId, 'dev', 'tun7', 1);
      await addOption(serverId, 'keepalive', '20 240', 1, null, 'Custom failover');
      await addOption(clientId, 'ifconfig-push', '', 0, clientAddress.id);
      await addOption(clientId, 'remote', 'vpn.example.com 4443', 1);
    } else if (kind === 'wireguard') {
      await addOption(serverId, '<<vpn_network>>', '', 2, network.id);
      await addOption(serverId, 'Address', '10.88.0.1/24', 2);
      await addOption(serverId, 'ListenPort', '51825', 2);
      await addOption(clientId, 'Address', '', 4, clientAddress.id);
      await addOption(clientId, 'Endpoint', 'vpn.example.com:51825', 5);
      await addOption(clientId, 'AllowedIPs', '192.168.60.0/24', 5);
      await addOption(clientId, 'PersistentKeepalive', '25', 5, null, 'Keep NAT alive');
    } else {
      await addOption(serverId, 'leftsubnet', '', 6, network.id);
      await addOption(serverId, 'ike', 'aes256-sha256-modp2048', 6, null, 'Custom proposal');
      await addOption(clientId, 'leftsourceip', '', 7, clientAddress.id);
      await addOption(clientId, 'right', 'vpn.example.com', 7);
      await addOption(clientId, 'rightsubnet', '10.88.0.0/24', 7);
    }
    return { serverId, clientId, serverCrt, clientCrt, addOption };
  }

  it('should be provided as an application service', () => {
    expect(service).to.be.instanceOf(ReplicationProfileSnapshotService);
  });

  describe('firewall snapshots', () => {
    it('should capture interfaces and expressible FORWARD rules into a custom profile', async () => {
      const httpService = await makeTcpService(8080);
      const acceptRuleId = await insertForwardRule(source.firewall.id, 100, {
        comment: 'Allow LAN to WAN web',
      });
      await attachInterface(acceptRuleId, source.lanInterface.id, 22); // In
      await attachInterface(acceptRuleId, source.wanInterface.id, 25); // Out
      await attachIpObj(acceptRuleId, httpService.id, 9); // Service

      const denyRuleId = await insertForwardRule(source.firewall.id, 101, {
        action: 2,
        comment: 'Block WAN to LAN',
      });
      await attachInterface(denyRuleId, source.wanInterface.id, 22);

      const { profile, warnings } = await service.createProfileFromSource(
        {
          source: { kind: 'firewall', id: source.firewall.id },
          name: 'Snapshot of edge firewall',
        },
        { fwCloudId: fwc.fwcloud.id, userId: ownerId },
      );

      expect(warnings).to.be.empty;
      expect(profile.targetKind).to.be.eq('firewall');
      expect(profile.scope).to.be.eq('fwcloud');
      expect(profile.isBuiltin).to.be.false;
      expect(profile.userId).to.be.eq(ownerId);
      expect(profile.fwCloudId).to.be.eq(fwc.fwcloud.id);

      const provision = getProvision(profile);
      const roleByName = new Map(provision.interfaces.map((iface) => [iface.name, iface.role]));
      expect(roleByName.has('ens18')).to.be.true;
      expect(roleByName.has('ens19')).to.be.true;

      expect(provision.rules).to.have.length(2);
      const [acceptRule, denyRule] = provision.rules;
      expect(acceptRule.action).to.be.eq('accept');
      expect(acceptRule.inRole).to.be.eq(roleByName.get('ens19'));
      expect(acceptRule.outRole).to.be.eq(roleByName.get('ens18'));
      expect(acceptRule.services).to.have.length(1);
      expect(acceptRule.services[0].protocol).to.be.eq('tcp');
      // The captured port is exposed as a parameter defaulting to the original.
      const portParamName = (acceptRule.services[0].port as { param: string }).param;
      const portParameter = getParameters(profile).find(
        (parameter) => parameter.name === portParamName,
      );
      expect(portParameter).to.not.be.undefined;
      expect(portParameter.type).to.be.eq('port');
      expect(portParameter.default).to.be.eq(8080);
      expect(acceptRule.comment).to.be.eq('Allow LAN to WAN web');
      expect(denyRule.action).to.be.eq('deny');
      expect(denyRule.inRole).to.be.eq(roleByName.get('ens18'));
      expect(denyRule.services).to.be.undefined;

      const model = loadReplicationProfileModel(profile);
      const sourceRef = model.sourceRef as Record<string, unknown>;
      expect(sourceRef.kind).to.be.eq('firewall');
      expect(sourceRef.id).to.be.eq(source.firewall.id);
      expect(sourceRef.name).to.be.eq(source.firewall.name);

      const compatibility = model.compatibility as Record<string, unknown>;
      expect(compatibility.target_kinds).to.deep.eq(['firewall', 'cluster']);
    });

    it('should skip the default policy rules generated at firewall creation', async () => {
      const { profile, warnings } = await service.createProfileFromSource(
        {
          source: { kind: 'firewall', id: source.firewall.id },
          name: 'Snapshot without custom rules',
        },
        { fwCloudId: fwc.fwcloud.id, userId: ownerId },
      );

      expect(warnings).to.be.empty;
      expect(getProvision(profile).rules).to.be.empty;
    });

    it('should capture an interface address stored with a dotted netmask as CIDR', async () => {
      // The tun interface FWCloud creates for an OpenVPN server stores its mask this way.
      await db.getSource().manager.getRepository(IPObj).save({
        name: 'tun0',
        address: '192.168.1.1',
        netmask: '255.255.255.0',
        ipObjTypeId: 5,
        ip_version: 4,
        interfaceId: source.lanInterface.id,
      });

      const { profile } = await service.createProfileFromSource(
        {
          source: { kind: 'firewall', id: source.firewall.id },
          name: 'Snapshot with a dotted netmask',
        },
        { fwCloudId: fwc.fwcloud.id, userId: ownerId },
      );

      const lan = getProvision(profile).interfaces.find((iface) => iface.name === 'ens19');
      const addresses = lan.addresses as Array<{ value: { param: string } }>;
      const defaults = addresses.map(
        (address) =>
          getParameters(profile).find((parameter) => parameter.name === address.value.param)
            .default,
      );
      expect(defaults).to.include('192.168.1.1/24');
    });

    describe('default INPUT rules', () => {
      const SELF_HOST = DefaultPolicyRuleComments.SELF_HOST_TRAFFIC;
      const USEFUL_ICMP = DefaultPolicyRuleComments.USEFUL_ICMP;
      const inputPositions = getProvisionRulePositions(4, 'input');

      /** The "self host" and "useful ICMP" rules FWCloud creates for a firewall with a loopback. */
      async function addDefaultInputRules(): Promise<void> {
        const lo = await db.getSource().manager.getRepository(Interface).save({
          name: 'lo',
          type: '10',
          interface_type: '10',
          firewallId: source.firewall.id,
        });
        // Without the stateful option: the fixture already created the special rules.
        await PolicyRule.insertDefaultPolicy(source.firewall.id, lo.id, 0);
      }

      function snapshot() {
        return service.createProfileFromSource(
          { source: { kind: 'firewall', id: source.firewall.id }, name: 'Default rules snapshot' },
          { fwCloudId: fwc.fwcloud.id, userId: ownerId },
        );
      }

      it('should skip them while they are untouched, as the target creates its own', async () => {
        await addDefaultInputRules();

        const { profile, warnings } = await snapshot();

        expect(warnings).to.be.empty;
        expect(getProvision(profile).rules).to.be.empty;
      });

      it('should capture the INPUT policy whole once it holds a rule of its own', async () => {
        // Applying a profile with INPUT rules replaces the target's default INPUT rules.
        await addDefaultInputRules();
        const ssh = await makeTcpService(22);
        const sshRuleId = await PolicyRule.insertPolicy_r({
          firewall: source.firewall.id,
          type: 1, // IPv4 INPUT
          rule_order: 10,
          action: 1,
          active: 1,
          options: 0,
          special: 0,
          comment: 'Allow admin SSH',
        });
        await attachIpObj(sshRuleId, ssh.id, inputPositions.service);

        const { profile, warnings } = await snapshot();

        expect(warnings).to.be.empty;
        const rules = getProvision(profile).rules;
        expect(rules.map((rule) => rule.comment)).to.deep.eq([
          SELF_HOST,
          USEFUL_ICMP,
          'Allow admin SSH',
        ]);
        expect(rules.every((rule) => rule.chain === 'input' && rule.ipVersion === 4)).to.be.true;
        expect(rules[0]).to.include({ action: 'accept', inRole: 'lo' });
        expect(rules[1].services[0]).to.include({ kind: 'stdGroup', id: 5 });
      });

      it('should capture a default rule the user gave a VPN client, and the rest of its policy', async () => {
        await addDefaultInputRules();
        const { clientId } = await makeVpnPair('openvpn');
        const [selfHost] = await db
          .getSource()
          .query('SELECT id FROM policy_r WHERE firewall = ? AND type = 1 AND comment = ?', [
            source.firewall.id,
            SELF_HOST,
          ]);
        await db
          .getSource()
          .query(
            'INSERT INTO policy_r__openvpn (rule, openvpn, position, position_order) VALUES (?, ?, ?, 1)',
            [selfHost.id, clientId, inputPositions.source],
          );

        const { profile, warnings } = await snapshot();

        expect(warnings).to.be.empty;
        const rules = getProvision(profile).rules;
        expect(rules.map((rule) => rule.comment)).to.deep.eq([SELF_HOST, USEFUL_ICMP]);
        const client = getVpnTemplate(profile).connections.find(
          (connection) => connection.role === 'client',
        );
        expect(rules[0].inRole).to.eq('lo');
        expect(rules[0].source).to.deep.eq([
          { kind: 'vpnClient', vpnId: client.id, name: client.name },
        ]);
      });
    });

    it('should convert every FWCloud netmask notation to a CIDR suffix', () => {
      expect(ipObjCidr('10.0.0.1', '/24')).to.eq('10.0.0.1/24');
      expect(ipObjCidr('10.0.0.1', '255.255.255.0')).to.eq('10.0.0.1/24');
      expect(ipObjCidr('10.0.0.1', '16')).to.eq('10.0.0.1/16');
      expect(ipObjCidr('10.0.0.1', null)).to.eq('10.0.0.1');
      expect(ipObjCidr('2001:db8::1', 'ffff:ffff:ffff:ffff::')).to.eq('2001:db8::1/64');
      // Not a mask: left for validation to report rather than silently dropped.
      expect(ipObjCidr('10.0.0.1', '255.0.255.0')).to.eq('10.0.0.1255.0.255.0');
    });

    it('should capture a source address as a profile parameter', async () => {
      const addressRuleId = await insertForwardRule(source.firewall.id, 100, {
        comment: 'Address based rule',
      });
      await attachIpObj(addressRuleId, fwc.ipobjs.get('address').id, 7);

      const { profile, warnings } = await service.createProfileFromSource(
        {
          source: { kind: 'firewall', id: source.firewall.id },
          name: 'Snapshot with a source object',
        },
        { fwCloudId: fwc.fwcloud.id, userId: ownerId },
      );

      expect(warnings).to.be.empty;

      const [rule] = getProvision(profile).rules;
      expect(rule.source).to.have.length(1);
      expect(rule.source[0].kind).to.be.oneOf(['address', 'network']);

      // The literal address is not baked into the rule: it is a parameter the
      // caller can re-point when applying the profile elsewhere.
      const paramName = (rule.source[0].value as { param: string }).param;
      expect(getParameters(profile).some((parameter) => parameter.name === paramName)).to.be.true;
    });

    it('should warn about rules that cannot be expressed in the template vocabulary', async () => {
      // Disabled rule.
      await insertForwardRule(source.firewall.id, 101, {
        active: 0,
        comment: 'Disabled rule',
      });

      // Unsupported action (REJECT).
      await insertForwardRule(source.firewall.id, 102, {
        action: 3,
        comment: 'Reject rule',
      });

      const { profile, warnings } = await service.createProfileFromSource(
        {
          source: { kind: 'firewall', id: source.firewall.id },
          name: 'Snapshot with warnings',
        },
        { fwCloudId: fwc.fwcloud.id, userId: ownerId },
      );

      expect(getProvision(profile).rules).to.be.empty;
      expect(warnings).to.have.length(2);
      expect(warnings.join(' ')).to.contain('Disabled rule');
      expect(warnings.join(' ')).to.contain('Reject rule');
    });

    it('should reject a firewall that belongs to another FWCloud', async () => {
      await expect(
        service.createProfileFromSource(
          {
            source: { kind: 'firewall', id: source.firewall.id },
            name: 'Cross-cloud snapshot',
          },
          { fwCloudId: fwc.fwcloud.id + 1, userId: ownerId },
        ),
      ).to.be.rejectedWith(NotFoundException);
    });
  });

  describe('cluster snapshots', () => {
    let cluster: Cluster;

    beforeEach(async () => {
      const manager = db.getSource().manager;

      cluster = await manager.getRepository(Cluster).save(
        manager.getRepository(Cluster).create({
          name: StringHelper.randomize(10),
          fwCloudId: fwc.fwcloud.id,
        }),
      );

      source.firewall.clusterId = cluster.id;
      source.firewall.fwmaster = 1;
      await manager.getRepository(Firewall).save(source.firewall);

      await manager.getRepository(Firewall).save({
        name: `${cluster.name}-backup`,
        fwCloudId: fwc.fwcloud.id,
        clusterId: cluster.id,
        fwmaster: 0,
      });
    });

    it('should capture the master policy and the cluster topology', async () => {
      const ruleId = await insertForwardRule(source.firewall.id, 100, {
        comment: 'Cluster forward rule',
      });
      await attachInterface(ruleId, source.lanInterface.id, 22);

      const { profile, warnings } = await service.createProfileFromSource(
        {
          source: { kind: 'cluster', id: cluster.id },
          name: 'Snapshot of HA cluster',
        },
        { fwCloudId: fwc.fwcloud.id, userId: ownerId },
      );

      expect(warnings).to.be.empty;
      expect(profile.targetKind).to.be.eq('cluster');
      expect(getProvision(profile).rules).to.have.length(1);

      const model = loadReplicationProfileModel(profile);
      const topologyPreset = model.topologyPreset as {
        nodes: Array<{ role: string; name: string; required: boolean }>;
      };
      expect(topologyPreset.nodes).to.have.length(2);
      expect(topologyPreset.nodes[0]).to.deep.eq({
        role: 'master',
        name: source.firewall.name,
        required: true,
        master: true,
      });
      expect(topologyPreset.nodes[1].role).to.be.eq('backup');
      expect(topologyPreset.nodes[1].required).to.be.false;

      const roleAssignments = model.roleAssignments as Record<string, unknown>;
      expect(roleAssignments.nodeRoles).to.deep.eq(['master', 'backup']);

      const sourceRef = model.sourceRef as Record<string, unknown>;
      expect(sourceRef.kind).to.be.eq('cluster');
      expect(sourceRef.name).to.be.eq(cluster.name);
    });

    it('should reject a cluster that belongs to another FWCloud', async () => {
      await expect(
        service.createProfileFromSource(
          {
            source: { kind: 'cluster', id: cluster.id },
            name: 'Cross-cloud cluster snapshot',
          },
          { fwCloudId: fwc.fwcloud.id + 1, userId: ownerId },
        ),
      ).to.be.rejectedWith(NotFoundException);
    });

    it('should capture the master VPN configurations without duplicating the backup VPNs', async () => {
      await makeVpnPair('openvpn');
      const backup = await db
        .getSource()
        .manager.getRepository(Firewall)
        .findOneOrFail({
          where: { clusterId: cluster.id, fwmaster: 0 },
        });
      await makeVpnPair('wireguard', backup.id);

      const { profile, warnings } = await service.createProfileFromSource(
        { source: { kind: 'cluster', id: cluster.id }, name: 'Cluster with VPN' },
        { fwCloudId: fwc.fwcloud.id, userId: ownerId },
      );

      expect(warnings).to.be.empty;
      expect(profile.targetKind).to.equal('cluster');
      const vpn = getVpnTemplate(profile);
      expect(vpn.connections).to.have.length(2);
      expect(vpn.connections.map((connection) => connection.kind)).to.deep.equal([
        'openvpn',
        'openvpn',
      ]);
      expect(vpn.connections.find((connection) => connection.role === 'client').serverId).to.equal(
        vpn.connections.find((connection) => connection.role === 'server').id,
      );
      expect(validateProfileVpnTemplate(vpn)).to.be.empty;
    });
  });

  describe('VPN snapshots', () => {
    for (const kind of ['openvpn', 'wireguard', 'ipsec'] as const) {
      it(`should capture ${kind} configuration, PKI, options and policy references`, async () => {
        const { clientId, serverCrt, clientCrt } = await makeVpnPair(kind);
        const ruleId = await insertForwardRule(source.firewall.id, 100, {
          comment: `Allow ${kind} client`,
        });
        await db
          .getSource()
          .query(
            `INSERT INTO policy_r__${kind} (rule, ${kind}, position, position_order) VALUES (?, ?, 7, 1)`,
            [ruleId, clientId],
          );

        const { profile, warnings } = await service.createProfileFromSource(
          { source: { kind: 'firewall', id: source.firewall.id }, name: `${kind} snapshot` },
          { fwCloudId: fwc.fwcloud.id, userId: ownerId },
        );

        expect(warnings).to.be.empty;
        const vpn = getVpnTemplate(profile);
        expect(vpn.version).to.equal(1);
        expect(vpn.connections).to.have.length(2);
        expect(vpn.cas).to.have.length(1);
        expect(vpn.cas[0]).to.include({ commonName: fwc.ca.cn, validityDays: fwc.ca.days });
        expect(vpn.certificates).to.have.length(2);
        const server = vpn.connections.find((connection) => connection.role === 'server');
        const client = vpn.connections.find((connection) => connection.role === 'client');
        expect(server.kind).to.equal(kind);
        expect(client).to.include({ kind, serverId: server.id, network: '10.88.0.2/24' });
        expect(vpn.certificates.find((cert) => cert.id === server.certificateId)).to.include({
          commonName: serverCrt.cn,
          kind: 'server',
          caId: vpn.cas[0].id,
        });
        expect(vpn.certificates.find((cert) => cert.id === client.certificateId)).to.include({
          commonName: clientCrt.cn,
          kind: 'client',
          caId: vpn.cas[0].id,
        });
        expect(server).to.not.have.any.keys('firewall', 'crt', 'status', 'install_name');
        for (const option of [...server.options, ...client.options]) {
          expect(option).to.not.have.any.keys('id', 'ipobj', 'openvpn', 'wireguard', 'ipsec');
        }

        if (kind === 'openvpn') {
          expect(server).to.include({ network: '10.88.0.0/24', port: 4443, transport: 'tcp' });
          expect(server.options).to.deep.include({
            name: 'keepalive',
            arg: '20 240',
            scope: 1,
            comment: 'Custom failover',
          });
          expect(server.options).to.deep.include({ name: 'dev', arg: 'tun7', scope: 1 });
        } else if (kind === 'wireguard') {
          expect(server.port).to.equal(51825);
          expect(client.remoteNetwork).to.equal('192.168.60.0/24');
          expect(client.options).to.deep.include({
            name: 'PersistentKeepalive',
            arg: '25',
            scope: 5,
            comment: 'Keep NAT alive',
          });
        } else {
          expect(server.localNetwork).to.equal('10.88.0.0/24');
          expect(client.endpoint).to.equal('vpn.example.com');
          expect(server.options).to.deep.include({
            name: 'ike',
            arg: 'aes256-sha256-modp2048',
            scope: 6,
            comment: 'Custom proposal',
          });
        }

        expect(validateProfileVpnTemplate(vpn)).to.be.empty;
        const normalized = normalizeProfileVpnRuleParameters(loadReplicationProfileModel(profile));
        const reparsed = getProfileProvisioning(normalized);
        expect(reparsed.rules).to.have.length(1);
        expect(reparsed.rules[0].source).to.have.length(1);
        expect(reparsed.rules[0].source[0]).to.include({ kind: 'vpnClient', vpnId: client.id });
        const runtime = resolveVpnConnectionValues(
          normalized.vpnRuntime,
          new Map(
            (normalized.parameters as CapturedParameter[]).map((parameter) => [
              parameter.name,
              parameter.default,
            ]),
          ),
        );
        expect(runtime[client.id].network).to.equal('10.88.0.2/24');
        expect(
          kind === 'ipsec' ? runtime[server.id].localNetwork : runtime[server.id].network,
        ).to.be.a('string').and.not.be.empty;
      });
    }

    it('should omit VPN credentials while retaining the reusable connections and safe options', async () => {
      const openvpn = await makeVpnPair('openvpn');
      const wireguard = await makeVpnPair('wireguard');
      const ipsec = await makeVpnPair('ipsec');
      await openvpn.addOption(openvpn.clientId, 'auth-user-pass', 'snapshot-openvpn-password', 1);
      await wireguard.addOption(wireguard.serverId, 'PrivateKey', 'snapshot-wireguard-key', 2);
      await ipsec.addOption(ipsec.serverId, '<<psk>>', 'snapshot-ipsec-key', 6);
      await db
        .getSource()
        .query('UPDATE wireguard SET private_key = ? WHERE id = ?', [
          'snapshot-stored-private-key',
          wireguard.serverId,
        ]);

      const { profile, warnings } = await service.createProfileFromSource(
        { source: { kind: 'firewall', id: source.firewall.id }, name: 'VPN without credentials' },
        { fwCloudId: fwc.fwcloud.id, userId: ownerId },
      );

      const vpn = getVpnTemplate(profile);
      expect(vpn.connections).to.have.length(6);
      expect(vpn.cas).to.have.length(1);
      expect(vpn.certificates).to.have.length(6);
      const serialized = JSON.stringify(loadReplicationProfileModel(profile));
      for (const secret of [
        'snapshot-openvpn-password',
        'snapshot-wireguard-key',
        'snapshot-ipsec-key',
        'snapshot-stored-private-key',
      ]) {
        expect(serialized).to.not.contain(secret);
        expect(warnings.join(' ')).to.not.contain(secret);
      }
      const optionNames = vpn.connections.flatMap((connection) =>
        connection.options.map((option) => option.name),
      );
      expect(optionNames).to.not.include.members(['auth-user-pass', 'PrivateKey', '<<psk>>']);
      expect(optionNames).to.include.members(['keepalive', 'PersistentKeepalive', 'ike']);
      expect(validateProfileVpnTemplate(vpn)).to.be.empty;
    });

    it('should omit a whole rule when its VPN match cannot be represented', async () => {
      const { serverId } = await makeVpnPair('openvpn');
      const prefix = await db
        .getSource()
        .query('INSERT INTO openvpn_prefix (openvpn, name) VALUES (?, ?)', [
          serverId,
          'Department-',
        ]);
      const prefixRule = await insertForwardRule(source.firewall.id, 100, {
        comment: 'Restricted to a dynamic VPN prefix',
      });
      await attachInterface(prefixRule, source.lanInterface.id, 22);
      await db
        .getSource()
        .query(
          'INSERT INTO policy_r__openvpn_prefix (rule, prefix, position, position_order) VALUES (?, ?, 7, 1)',
          [prefixRule, prefix.insertId],
        );
      const foreignRule = await insertForwardRule(source.firewall.id, 101, {
        comment: 'Restricted to a VPN from another firewall',
      });
      await attachInterface(foreignRule, source.lanInterface.id, 22);
      await db
        .getSource()
        .query(
          'INSERT INTO policy_r__wireguard (rule, wireguard, position, position_order) VALUES (?, ?, 8, 1)',
          [foreignRule, fwc.wireguardClients.get('WireGuard-Cli-1').id],
        );

      const { profile, warnings } = await service.createProfileFromSource(
        { source: { kind: 'firewall', id: source.firewall.id }, name: 'Unsupported VPN matches' },
        { fwCloudId: fwc.fwcloud.id, userId: ownerId },
      );

      expect(getProvision(profile).rules).to.be.empty;
      expect(getVpnTemplate(profile).connections).to.have.length(2);
      expect(warnings).to.have.length(2);
      expect(warnings.join(' ')).to.include('Restricted to a dynamic VPN prefix');
      expect(warnings.join(' ')).to.include('Restricted to a VPN from another firewall');
    });
  });

  describe('NAT, predefined objects, routing and system', () => {
    it('should capture what a provisioned firewall holds back into the same vocabulary', async () => {
      const provisioning = await app.getService<PolicyReplicationService>(
        PolicyReplicationService.name,
      );
      const applied = await provisioning.provisionPolicyFromProfile(
        { kind: 'firewall', id: source.firewall.id },
        getProfileProvisioning({
          provision: {
            interfaces: [
              { name: 'ens18', role: 'wan' },
              { name: 'ens19', role: 'lan' },
            ],
            rules: [
              {
                chain: 'forward',
                source: [{ kind: 'stdGroup', id: 1 }],
                services: [{ kind: 'std', id: 20029 }],
              },
              {
                chain: 'dnat',
                inRole: 'wan',
                services: [{ protocol: 'tcp', port: 8443 }],
                translatedDestination: [{ kind: 'address', value: '192.168.70.20' }],
              },
            ],
            routing: {
              tables: [
                {
                  key: 'isp2',
                  number: 12,
                  name: 'ISP2',
                  routes: [
                    {
                      destination: [{ kind: 'std', id: 70003 }],
                      gateway: { kind: 'address', value: '203.0.113.1' },
                    },
                  ],
                },
              ],
              rules: [
                {
                  from: [{ kind: 'range', value: '192.168.70.100-192.168.70.110' }],
                  table: 'isp2',
                },
              ],
            },
            system: {
              dhcp: [
                {
                  network: { kind: 'network', value: '192.168.70.0/24' },
                  range: { kind: 'range', value: '192.168.70.100-192.168.70.200' },
                  router: { kind: 'address', value: '192.168.70.1' },
                  dns: [],
                  maxLease: 7200,
                },
              ],
            },
          },
        }),
        fwc.fwcloud.id,
        'replace_defaults',
        { interfaceNameMapping: { wan: 'ens18', lan: 'ens19' } },
      );
      expect(applied.errors).to.be.empty;

      const { profile, warnings } = await service.createProfileFromSource(
        { source: { kind: 'firewall', id: source.firewall.id }, name: 'Round trip' },
        { fwCloudId: fwc.fwcloud.id, userId: ownerId },
      );

      expect(warnings).to.be.empty;
      const provision = loadReplicationProfileModel(profile).provision as Record<string, any>;
      const forward = provision.rules.find((rule) => rule.chain === 'forward');
      expect(forward.source).to.deep.equal([{ kind: 'stdGroup', id: 1, name: 'rfc1918-nets' }]);
      expect(forward.services).to.deep.equal([{ kind: 'std', id: 20029, name: 'https' }]);
      const dnat = provision.rules.find((rule) => rule.chain === 'dnat');
      expect(dnat.inRole).to.equal('ens18');
      expect(dnat.translatedDestination[0].kind).to.equal('address');

      expect(provision.routing.tables).to.have.length(1);
      expect(provision.routing.tables[0]).to.include({ key: 'table_12', number: 12, name: 'ISP2' });
      expect(provision.routing.tables[0].routes[0].destination).to.deep.equal([
        { kind: 'std', id: 70003, name: 'net-10.0.0.0' },
      ]);
      expect(provision.routing.rules[0].table).to.equal('table_12');
      expect(provision.routing.rules[0].from[0].kind).to.equal('range');
      expect(provision.system.dhcp[0]).to.include({ maxLease: 7200 });
      expect(getParameters(profile).some((parameter) => parameter.type === 'range')).to.be.true;

      // The captured model is a valid provisioning profile again.
      const reparsed = getProfileProvisioning(loadReplicationProfileModel(profile));
      expect(reparsed.rules).to.have.length(2);
      expect(reparsed.routing.tables[0].routes).to.have.length(1);
      expect(reparsed.system.dhcp).to.have.length(1);
    });

    it('should warn about FWCloud groups, which are not predefined and cannot be templated', async () => {
      const [group] = await db
        .getSource()
        .query("INSERT INTO ipobj_g (name, type, fwcloud) VALUES ('Office nets', 20, ?)", [
          fwc.fwcloud.id,
        ])
        .then((result) => [result.insertId]);
      const ruleId = await insertForwardRule(source.firewall.id, 120, { comment: 'Group rule' });
      await db
        .getSource()
        .query(
          'INSERT INTO policy_r__ipobj (rule, ipobj, ipobj_g, interface, position, position_order) VALUES (?, -1, ?, -1, 7, 1)',
          [ruleId, group],
        );

      const { profile, warnings } = await service.createProfileFromSource(
        { source: { kind: 'firewall', id: source.firewall.id }, name: 'Group snapshot' },
        { fwCloudId: fwc.fwcloud.id, userId: ownerId },
      );

      expect(getProvision(profile).rules).to.be.empty;
      expect(warnings).to.have.length(1);
      expect(warnings[0]).to.contain('FORWARD IPv4 rule 120').and.to.contain('groups');
    });
  });

  describe('several interfaces per rule', () => {
    it('should capture every inbound interface of a rule as a list of roles', async () => {
      const ruleId = await insertForwardRule(source.firewall.id, 130, { comment: 'Two inbound' });
      await attachInterface(ruleId, source.lanInterface.id, 22);
      await db
        .getSource()
        .query(
          'INSERT INTO policy_r__interface (rule, interface, position, position_order) VALUES (?, ?, 22, 2)',
          [ruleId, source.wanInterface.id],
        );

      const { profile, warnings } = await service.createProfileFromSource(
        { source: { kind: 'firewall', id: source.firewall.id }, name: 'Two inbound snapshot' },
        { fwCloudId: fwc.fwcloud.id, userId: ownerId },
      );

      expect(warnings).to.be.empty;
      const [rule] = getProvision(profile).rules as unknown as Array<{ inRole: string[] }>;
      expect([...rule.inRole].sort()).to.deep.equal(['ens18', 'ens19']);
    });
  });
});
