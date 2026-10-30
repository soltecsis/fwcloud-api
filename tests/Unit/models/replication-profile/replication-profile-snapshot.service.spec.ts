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
import { Firewall, FireWallOptMask } from '../../../../src/models/firewall/Firewall';
import { Interface } from '../../../../src/models/interface/Interface';
import { IPObj } from '../../../../src/models/ipobj/IPObj';
import {
  DefaultPolicyRuleComments,
  PolicyRule,
  PolicyRuleOptMask,
} from '../../../../src/models/policy/PolicyRule';
import { PolicyCompiler } from '../../../../src/compiler/policy/PolicyCompiler';
import { PolicyTypesMap } from '../../../../src/models/policy/PolicyType';
import { NotFoundException } from '../../../../src/fonaments/exceptions/not-found-exception';
import { HttpException } from '../../../../src/fonaments/exceptions/http/http-exception';
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
import {
  loadReplicationProfileModel,
  writeReplicationProfileModel,
} from '../../../../src/models/replication-profile/replication-profile-template';
import { getProfileParameters } from '../../../../src/models/replication-profile/replication-profile-parameters';
import { portableProfileModel } from '../../../../src/models/replication-profile/replication-profile-portable';
import { applyInterfaceAddressOverrides } from '../../../../src/models/replication-profile/replication-profile-interface-addresses';
import { policyRuleDateKey } from '../../../../src/models/policy/policy-rule-validity';
import { KeepalivedRuleService } from '../../../../src/models/system/keepalived/keepalived_r/keepalived_r.service';
import { resolveProfileObjectReferences } from '../../../../src/models/replication-profile/replication-profile-object-reference.service';

interface CapturedObject {
  kind: string;
  value?: unknown;
  role?: string;
  interfaceRole?: string;
  interfaceAddressIndex?: number;
  name?: string;
  vpnId?: string;
  referenceId?: string;
}

interface CapturedRule {
  chain: string;
  ipVersion: number;
  action: string;
  options?: number;
  time_start?: string | null;
  time_end?: string | null;
  negate?: string | null;
  inRole?: string;
  outRole?: string;
  source?: CapturedObject[];
  destination?: CapturedObject[];
  services?: { protocol?: string; port?: unknown; kind?: string; referenceId?: string }[];
  comment?: string;
  nodeRole?: string;
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
      negate: string | null;
      options: number;
    }> = {},
  ): Promise<number> {
    return PolicyRule.insertPolicy_r({
      firewall: firewallId,
      type: 3, // IPv4 FORWARD
      rule_order: ruleOrder,
      action: overrides.action ?? 1,
      active: overrides.active ?? 1,
      options: overrides.options ?? 0,
      special: overrides.special ?? 0,
      comment: overrides.comment ?? null,
      negate: overrides.negate ?? null,
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

  async function expectCaptureFailure(
    captureSource: { kind: 'firewall' | 'cluster'; id: number },
    diagnostics: string[],
  ): Promise<HttpException> {
    const error = await service
      .createProfileFromSource(
        { source: captureSource, name: 'Incomplete capture must fail' },
        { fwCloudId: fwc.fwcloud.id, userId: ownerId },
      )
      .then(
        () => null,
        (error) => error,
      );
    expect(error).to.be.instanceOf(HttpException);
    expect(error.status).to.eq(422);
    for (const diagnostic of diagnostics) {
      expect(error.message).to.include(diagnostic);
    }
    expect(
      await db
        .getSource()
        .manager.getRepository(ReplicationProfile)
        .count({ where: { userId: ownerId } }),
    ).to.eq(0);
    return error;
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
    it('preserves disabled manual Keepalived configuration without inventing interface dependencies', async () => {
      const keepalived = await app.getService<KeepalivedRuleService>(KeepalivedRuleService.name);
      const cfg_text = '# Source VRRP\nvrrp_instance VI_1 {\n  virtual_router_id 51\n}\n';
      await keepalived.store({
        firewallId: source.firewall.id,
        rule_type: 2,
        cfg_text,
        active: false,
        style: 'custom',
        comment: 'Preserve native directives',
      });
      const { profile, warnings } = await service.createProfileFromSource(
        {
          source: { kind: 'firewall', id: source.firewall.id },
          name: 'Manual Keepalived snapshot',
        },
        { fwCloudId: fwc.fwcloud.id, userId: ownerId },
      );
      expect(warnings).to.be.empty;
      const [entry] = getProfileProvisioning(loadReplicationProfileModel(profile)).system
        .keepalived;
      expect(entry).to.include({
        rule_type: 2,
        cfg_text,
        active: false,
        style: 'custom',
        comment: 'Preserve native directives',
      });
      expect(entry.interfaceRole).to.eq(undefined);
      expect(entry.virtualIps).to.deep.eq([]);
    });

    it('should not widen a Keepalived rule a former cluster left restricted to the firewall', async () => {
      const keepalived = await app.getService<KeepalivedRuleService>(KeepalivedRuleService.name);
      await keepalived.store({
        firewallId: source.firewall.id,
        rule_type: 2,
        cfg_text: 'global_defs {\n}\n',
        active: true,
        fw_apply_to: source.firewall.id,
      });
      const { profile, warnings } = await service.createProfileFromSource(
        { source: { kind: 'firewall', id: source.firewall.id }, name: 'Former cluster node' },
        { fwCloudId: fwc.fwcloud.id, userId: ownerId },
      );
      expect(warnings).to.have.length(1);
      expect(warnings[0]).to.match(
        /^Keepalived rule .*was not captured: it only applies to this firewall as a node of the cluster it belonged to\.$/,
      );
      expect(
        getProfileProvisioning(loadReplicationProfileModel(profile)).system.keepalived,
      ).to.deep.eq([]);
    });

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
      expect(acceptRule.services[0].kind).to.eq('external');
      const references = loadReplicationProfileModel(profile).objectReferences as any[];
      expect(references[0].referenceId).to.eq(acceptRule.services[0].referenceId);
      expect(references[0].snapshot).to.include({
        name: httpService.name,
        protocol: 6,
        source_port_start: 0,
        source_port_end: 0,
        destination_port_start: 8080,
        destination_port_end: 8080,
      });
      expect(acceptRule.comment).to.be.eq('Allow LAN to WAN web');
      expect(denyRule.action).to.be.eq('deny');
      expect(denyRule.inRole).to.be.eq(roleByName.get('ens18'));
      expect(denyRule.services).to.be.undefined;
      expect(acceptRule).not.to.have.property('negate');
      expect(denyRule).not.to.have.property('negate');

      const model = loadReplicationProfileModel(profile);
      const sourceRef = model.sourceRef as Record<string, unknown>;
      expect(sourceRef.kind).to.be.eq('firewall');
      expect(sourceRef.id).to.be.eq(source.firewall.id);
      expect(sourceRef.name).to.be.eq(source.firewall.name);

      const compatibility = model.compatibility as Record<string, unknown>;
      expect(compatibility.target_kinds).to.deep.eq(['firewall', 'cluster']);
    });

    it('should preserve negation through capture, persisted JSON, application and recapture in every policy', async () => {
      const tcpService = await makeTcpService(8080);
      const sourceObjects = new Map<number, IPObj>();
      const destinationObjects = new Map<number, IPObj>();
      const expected = new Map<string, string | null>();

      for (const ipVersion of [4, 6] as const) {
        sourceObjects.set(
          ipVersion,
          await db
            .getSource()
            .manager.getRepository(IPObj)
            .save({
              name: `Source IPv${ipVersion}`,
              address: ipVersion === 4 ? '192.0.2.10' : '2001:db8:1::10',
              ipObjTypeId: 5,
              ip_version: ipVersion,
              fwCloudId: fwc.fwcloud.id,
            }),
        );
        destinationObjects.set(
          ipVersion,
          await db
            .getSource()
            .manager.getRepository(IPObj)
            .save({
              name: `Destination IPv${ipVersion}`,
              address: ipVersion === 4 ? '198.51.100.0' : '2001:db8:2::',
              netmask: ipVersion === 4 ? '/24' : '/64',
              ipObjTypeId: 7,
              ip_version: ipVersion,
              fwCloudId: fwc.fwcloud.id,
            }),
        );

        for (const chain of ['input', 'output', 'forward', 'snat', 'dnat'] as const) {
          const positions = getProvisionRulePositions(ipVersion, chain);
          const comment = `Negated ${chain} IPv${ipVersion}`;
          // Reverse order deliberately: snapshot JSON retains policy_r's original representation.
          const negate = [
            positions.service,
            positions.destination,
            positions.source,
            positions.out,
            positions.in,
          ]
            .filter((position) => position !== undefined)
            .join(' ');
          const ruleId = await PolicyRule.insertPolicy_r({
            firewall: source.firewall.id,
            type: PolicyTypesMap.get(`IPv${ipVersion}:${chain.toUpperCase()}`),
            rule_order: 100,
            action: 1,
            active: 1,
            options: 0,
            special: 0,
            comment,
            negate,
          });
          expected.set(comment, negate);

          if (positions.in !== undefined) {
            await attachInterface(ruleId, source.lanInterface.id, positions.in);
          }
          if (positions.out !== undefined) {
            await attachInterface(ruleId, source.wanInterface.id, positions.out);
          }
          await attachIpObj(ruleId, sourceObjects.get(ipVersion).id, positions.source);
          await attachIpObj(ruleId, destinationObjects.get(ipVersion).id, positions.destination);
          await attachIpObj(ruleId, tcpService.id, positions.service);

          if (ipVersion === 4 && chain === 'forward') {
            const range = await db.getSource().manager.getRepository(IPObj).save({
              name: 'Extra source range',
              range_start: '192.0.2.20',
              range_end: '192.0.2.30',
              ipObjTypeId: 6,
              ip_version: 4,
              fwCloudId: fwc.fwcloud.id,
            });
            await attachIpObj(ruleId, range.id, positions.source);
            await db
              .getSource()
              .query(
                'INSERT INTO policy_r__ipobj (rule, ipobj, ipobj_g, interface, position, position_order) VALUES (?, -1, 1, -1, ?, 3)',
                [ruleId, positions.source],
              );
          }
        }
      }

      const mixedRule = await insertForwardRule(source.firewall.id, 101, {
        comment: 'Only the source is negated',
        negate: '7',
      });
      await attachIpObj(mixedRule, sourceObjects.get(4).id, 7);
      await attachIpObj(mixedRule, destinationObjects.get(4).id, 8);
      await attachIpObj(mixedRule, tcpService.id, 9);
      expected.set('Only the source is negated', '7');
      await insertForwardRule(source.firewall.id, 102, { comment: 'Legacy rule without negation' });
      expected.set('Legacy rule without negation', null);
      const { profile, warnings } = await service.createProfileFromSource(
        { source: { kind: 'firewall', id: source.firewall.id }, name: 'Negated policies' },
        { fwCloudId: fwc.fwcloud.id, userId: ownerId },
      );
      expect(warnings).to.be.empty;

      const reloaded = await db
        .getSource()
        .manager.getRepository(ReplicationProfile)
        .findOneByOrFail({ id: profile.id });
      const model = loadReplicationProfileModel(reloaded);
      const captured = getProvision(reloaded).rules;
      expect(captured).to.have.length(expected.size);
      for (const rule of captured) {
        if (expected.get(rule.comment) === null) {
          expect(rule).not.to.have.property('negate');
        } else {
          expect(rule.negate).to.eq(expected.get(rule.comment));
        }
      }
      expect(
        captured.find((rule) => rule.comment === 'Negated forward IPv4').source,
      ).to.have.length(3);

      const target = await makeReplicationTargetFirewall(fwc, false);
      const provisioning = await app.getService<PolicyReplicationService>(
        PolicyReplicationService.name,
      );
      const applied = await provisioning.provisionPolicyFromProfile(
        { kind: 'firewall', id: target.firewall.id },
        getProfileProvisioning(model),
        fwc.fwcloud.id,
        'replace_defaults',
        {
          parameters: getProfileParameters(model),
          externalObjects: (await resolveProfileObjectReferences(model, fwc.fwcloud.id)).bindings,
          interfaceNameMapping: { ens18: 'ens18', ens19: 'ens19' },
        },
      );
      expect(applied.errors).to.be.empty;

      const targetRules: Array<{ comment: string; negate: string | null }> = await db
        .getSource()
        .query('SELECT comment, negate FROM policy_r WHERE firewall = ? AND special = 0', [
          target.firewall.id,
        ]);
      expect(targetRules).to.have.length(expected.size);
      const negatedPositions = (negate: string | null | undefined) =>
        negate
          ? negate
              .split(' ')
              .map(Number)
              .sort((a, b) => a - b)
          : [];
      for (const rule of targetRules) {
        expect(negatedPositions(rule.negate)).to.deep.eq(
          negatedPositions(expected.get(rule.comment)),
        );
      }

      const recaptured = await service.createProfileFromSource(
        {
          source: { kind: 'firewall', id: target.firewall.id },
          name: 'Recaptured negated policies',
        },
        { fwCloudId: fwc.fwcloud.id, userId: ownerId },
      );
      expect(recaptured.warnings).to.be.empty;
      for (const rule of getProvision(recaptured.profile).rules) {
        expect(negatedPositions(rule.negate)).to.deep.eq(
          negatedPositions(expected.get(rule.comment)),
        );
      }
    });

    it('should reject incomplete captures and report every rule whose negation cannot be represented', async () => {
      const cases = [
        { negate: '43', comment: 'Wrong IP family' },
        { negate: '14', comment: 'Translation position' },
        { negate: '8', comment: 'Empty destination' },
        { negate: '7 invalid', comment: 'Malformed position list' },
      ];
      for (const [index, overrides] of cases.entries()) {
        const ruleId = await insertForwardRule(source.firewall.id, 120 + index, overrides);
        await attachIpObj(ruleId, source.wanAddress.id, 7);
      }

      await expectCaptureFailure(
        { kind: 'firewall', id: source.firewall.id },
        cases.map((item) => item.comment),
      );
    });

    it('should retain negated interface addresses as source and destination when applying to another firewall', async () => {
      const ruleId = await insertForwardRule(source.firewall.id, 100, {
        comment: 'Negated local interface addresses',
        negate: '7 8',
      });
      await attachIpObj(ruleId, source.wanAddress.id, 7);
      await attachIpObj(ruleId, source.wanAddress.id, 8);

      const { profile, warnings } = await service.createProfileFromSource(
        { source: { kind: 'firewall', id: source.firewall.id }, name: 'Negated own addresses' },
        { fwCloudId: fwc.fwcloud.id, userId: ownerId },
      );
      expect(warnings).to.be.empty;
      const reloaded = await db
        .getSource()
        .manager.getRepository(ReplicationProfile)
        .findOneByOrFail({ id: profile.id });
      const capturedRule = getProvision(reloaded).rules[0];
      const [declared] = getProvision(reloaded).interfaces[0].addresses;
      const expectedAddress = {
        kind: 'address',
        value: declared.value,
        name: source.wanAddress.name,
        interfaceRole: 'ens18',
        interfaceAddressIndex: 0,
      };
      expect(capturedRule.source).to.deep.eq([expectedAddress]);
      expect(capturedRule.destination).to.deep.eq([expectedAddress]);
      expect(capturedRule.negate).to.eq('7 8');
      expect(capturedRule.inRole).to.be.undefined;
      expect(capturedRule.outRole).to.be.undefined;

      const model = loadReplicationProfileModel(reloaded);
      const provision = getProfileProvisioning(model);
      expect(provision.rules[0].source).to.deep.eq(capturedRule.source);
      expect(provision.rules[0].destination).to.deep.eq(capturedRule.destination);
      expect(provision.rules[0].inRoles).to.be.empty;
      expect(provision.rules[0].outRoles).to.be.empty;

      const target = await makeReplicationTargetFirewall(fwc, false);
      const provisioning = await app.getService<PolicyReplicationService>(
        PolicyReplicationService.name,
      );
      const applied = await provisioning.provisionPolicyFromProfile(
        { kind: 'firewall', id: target.firewall.id },
        provision,
        fwc.fwcloud.id,
        'replace_defaults',
        {
          parameters: getProfileParameters(model),
          interfaceNameMapping: { ens18: 'ens18', ens19: 'ens19' },
        },
      );
      expect(applied.errors).to.be.empty;
      const [targetRule] = await db
        .getSource()
        .query('SELECT id, negate FROM policy_r WHERE firewall = ? AND comment = ?', [
          target.firewall.id,
          capturedRule.comment,
        ]);
      expect(targetRule.negate).to.eq('7 8');
      expect(
        await db
          .getSource()
          .query('SELECT interface, position FROM policy_r__interface WHERE rule = ?', [
            targetRule.id,
          ]),
      ).to.be.empty;
      const targetRefs = await db
        .getSource()
        .query(
          'SELECT ipobj, interface, position FROM policy_r__ipobj WHERE rule = ? ORDER BY position',
          [targetRule.id],
        );
      const targetAddress = await db.getSource().manager.getRepository(IPObj).findOneByOrFail({
        interfaceId: target.wanInterface.id,
        address: source.wanAddress.address,
      });
      expect(targetRefs).to.deep.eq([
        { ipobj: targetAddress.id, interface: -1, position: 7 },
        { ipobj: targetAddress.id, interface: -1, position: 8 },
      ]);
    });

    it('should keep a freestanding IP independent from an assigned IP with the same literal when overriding the interface', async () => {
      await db.getSource().manager.getRepository(IPObj).update(source.wanAddress.id, {
        netmask: '/24',
      });
      const freeAddress = await db.getSource().manager.getRepository(IPObj).save({
        name: 'Freestanding address matching the interface IP',
        address: source.wanAddress.address,
        netmask: '/24',
        ipObjTypeId: 5,
        ip_version: 4,
        fwCloudId: fwc.fwcloud.id,
      });
      for (const [index, ownedPosition] of [7, 8].entries()) {
        const ruleId = await insertForwardRule(source.firewall.id, 100 + index, {
          comment: `Owned IP in position ${ownedPosition}`,
        });
        await attachIpObj(ruleId, source.wanAddress.id, ownedPosition);
        await attachIpObj(ruleId, freeAddress.id, ownedPosition === 7 ? 8 : 7);
      }

      const { profile, warnings } = await service.createProfileFromSource(
        {
          source: { kind: 'firewall', id: source.firewall.id },
          name: 'Distinct assigned and freestanding IPs',
        },
        { fwCloudId: fwc.fwcloud.id, userId: ownerId },
      );
      expect(warnings).to.be.empty;
      const model = JSON.parse(JSON.stringify(loadReplicationProfileModel(profile)));
      const provision = getProfileProvisioning(model);
      const parameters = getProfileParameters(model);
      for (const rule of provision.rules) {
        const [owned, free] = rule.comment.endsWith('7')
          ? [rule.source[0], rule.destination[0]]
          : [rule.destination[0], rule.source[0]];
        expect(owned).to.include({ interfaceRole: 'ens18', interfaceAddressIndex: 0 });
        expect(free).not.to.have.property('interfaceRole');
        expect(free).not.to.have.property('interfaceAddressIndex');
        expect(free.value).not.to.deep.eq(owned.value);
      }
      expect(
        await applyInterfaceAddressOverrides(
          provision,
          { ens18: [{ name: 'Selected WAN IP', value: '198.51.100.7/28' }] },
          parameters,
          undefined,
          fwc.fwcloud.id,
        ),
      ).to.be.empty;
      const target = await makeReplicationTargetFirewall(fwc, false);
      const provisioning = await app.getService<PolicyReplicationService>(
        PolicyReplicationService.name,
      );
      const applied = await provisioning.provisionPolicyFromProfile(
        { kind: 'firewall', id: target.firewall.id },
        provision,
        fwc.fwcloud.id,
        'merge',
        { parameters },
      );
      expect(applied.errors).to.be.empty;
      expect(applied.createdRules).to.have.length(2);
      for (const rule of applied.createdRules) {
        const refs = await db.getSource().query(
          `SELECT R.position, R.interface AS interfaceReference, O.address, O.netmask,
                  O.interface AS owner, O.name
           FROM policy_r__ipobj R INNER JOIN ipobj O ON O.id = R.ipobj
           WHERE R.rule = ? ORDER BY R.position`,
          [rule.targetRuleId],
        );
        const ownedPosition = rule.comment.endsWith('7') ? 7 : 8;
        expect(refs).to.have.length(2);
        expect(refs.find((ref) => ref.position === ownedPosition)).to.include({
          interfaceReference: -1,
          address: '198.51.100.7',
          netmask: '/28',
          owner: target.wanInterface.id,
          name: 'Selected WAN IP',
        });
        expect(refs.find((ref) => ref.position !== ownedPosition)).to.include({
          interfaceReference: -1,
          address: source.wanAddress.address,
          netmask: '/24',
          owner: null,
          name: freeAddress.name,
        });
        expect(
          await db
            .getSource()
            .query('SELECT * FROM policy_r__interface WHERE rule = ?', [rule.targetRuleId]),
        ).to.be.empty;
      }
    });

    it('should reject a relation that ambiguously names both an IP and an interface', async () => {
      const ruleId = await insertForwardRule(source.firewall.id, 100);
      await attachIpObj(ruleId, source.wanAddress.id, 7);
      await db
        .getSource()
        .query('UPDATE policy_r__ipobj SET interface = ? WHERE rule = ? AND position = 7', [
          source.wanInterface.id,
          ruleId,
        ]);

      await expect(
        service.buildSourceSnapshot({ kind: 'firewall', id: source.firewall.id }, fwc.fwcloud.id),
      ).to.be.rejectedWith(HttpException, 'ambiguous IP/interface object reference');
    });

    it('should preserve actual source/destination interface objects as interface address sets', async () => {
      const ruleId = await insertForwardRule(source.firewall.id, 100);
      await db
        .getSource()
        .query(
          'INSERT INTO policy_r__ipobj (rule, ipobj, ipobj_g, interface, position, position_order) VALUES (?, -1, -1, ?, 7, 1), (?, -1, -1, ?, 8, 1)',
          [ruleId, source.wanInterface.id, ruleId, source.lanInterface.id],
        );

      const { profile, warnings } = await service.createProfileFromSource(
        { source: { kind: 'firewall', id: source.firewall.id }, name: 'Actual interface objects' },
        { fwCloudId: fwc.fwcloud.id, userId: ownerId },
      );
      expect(warnings).to.be.empty;
      const [captured] = getProvision(profile).rules;
      expect(captured.source).to.deep.eq([{ kind: 'interfaceRole', role: 'ens18' }]);
      expect(captured.destination).to.deep.eq([{ kind: 'interfaceRole', role: 'ens19' }]);
      expect(captured.inRole).to.be.undefined;
      expect(captured.outRole).to.be.undefined;
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

    for (const [description, configured] of [
      ['IPv4 only', [['192.168.1.10', '/24', 4]]],
      ['IPv6 only', [['2001:db8:1::10', '/64', 6]]],
      [
        'dual stack',
        [
          ['192.168.1.10', '/24', 4],
          ['2001:db8:1::10', '/64', 6],
        ],
      ],
      [
        'multiple IPv4',
        [
          ['192.168.1.10', '/24', 4],
          ['192.168.2.10', '/25', 4],
        ],
      ],
      [
        'multiple IPv6',
        [
          ['2001:DB8:0001:0000:0000:0000:0000:0010', '/64', 6],
          ['2001:db8:2::10', '/96', 6],
          ['::1', '/128', 6],
          ['2001:db8:3::10', '/0', 6],
        ],
      ],
      [
        'multiple addresses of both families',
        [
          ['192.168.1.10', '/24', 4],
          ['2001:db8:1::10', '/64', 6],
          ['192.168.2.10', '/25', 4],
          ['2001:db8:2::10', '/127', 6],
        ],
      ],
    ] as [string, [string, string, 4 | 6][]][]) {
      it(`should preserve every interface address and its family through persisted JSON for ${description}`, async () => {
        const repository = db.getSource().manager.getRepository(IPObj);
        for (const [index, [address, netmask, ipVersion]] of configured.entries()) {
          await repository.save({
            name: `Captured address ${index + 1}`,
            address,
            netmask,
            ip_version: ipVersion,
            ipObjTypeId: 5,
            interfaceId: source.lanInterface.id,
            comment: `Address ${index + 1} comment`,
            diff_serv: index,
            options: String(index),
          });
        }

        const { profile, warnings } = await service.createProfileFromSource(
          {
            source: { kind: 'firewall', id: source.firewall.id },
            name: `Capture ${description}`,
          },
          { fwCloudId: fwc.fwcloud.id, userId: ownerId },
        );
        expect(warnings).to.be.empty;
        const saved = await db
          .getSource()
          .manager.getRepository(ReplicationProfile)
          .findOneByOrFail({ id: profile.id });
        const model = JSON.parse(JSON.stringify(loadReplicationProfileModel(saved)));
        const provision = getProfileProvisioning(model);
        const lan = provision.interfaces.find((iface) => iface.name === 'ens19');
        const parameters = getProfileParameters(model);
        expect(lan.role).to.eq('ens19');
        expect(lan.addresses).to.have.length(configured.length);
        for (const [index, [address, netmask, ipVersion]] of configured.entries()) {
          expect(lan.addresses[index]).to.include({
            name: `Captured address ${index + 1}`,
            ipVersion,
            comment: `Address ${index + 1} comment`,
            diff_serv: index,
            options: index,
          });
          const reference = lan.addresses[index].value as { param: string };
          expect(parameters.find((parameter) => parameter.name === reference.param)).to.include({
            default: `${address}${netmask}`,
            ipVersion,
          });
        }
        const wan = provision.interfaces.find((iface) => iface.name === 'ens18');
        expect(wan.addresses).to.have.length(1);
        expect(wan.addresses[0]).to.include({ comment: null, diff_serv: null, options: null });
        const wanReference = wan.addresses[0].value as { param: string };
        expect(parameters.find((parameter) => parameter.name === wanReference.param).default).to.eq(
          source.wanAddress.address,
        );
      });
    }

    for (const [description, configured] of [
      ['invalid IPv6 syntax', { address: '2001:db8::invalid', netmask: '/64', ip_version: 6 }],
      ['invalid IPv6 prefix', { address: '2001:db8::10', netmask: '/129', ip_version: 6 }],
      ['mismatching address family', { address: '2001:db8::10', netmask: '/24', ip_version: 4 }],
      ['unsupported address family', { address: '2001:db8::10', netmask: '/64', ip_version: 5 }],
      [
        'unsupported interface object',
        { address: '2001:db8::', netmask: '/64', ip_version: 6, ipObjTypeId: 7 },
      ],
      [
        'unsupported address property',
        { address: '2001:db8::10', netmask: '/64', ip_version: 6, protocol: 17 },
      ],
      [
        'invalid address options',
        { address: '2001:db8::10', netmask: '/64', ip_version: 6, options: 'invalid' },
      ],
    ] as [string, Partial<IPObj>][]) {
      it(`should reject ${description} with interface and address details before saving a partial template`, async () => {
        await db
          .getSource()
          .manager.getRepository(IPObj)
          .save({
            name: 'Uncapturable address',
            ipObjTypeId: 5,
            interfaceId: source.lanInterface.id,
            ...configured,
          });
        const error = await service
          .createProfileFromSource(
            {
              source: { kind: 'firewall', id: source.firewall.id },
              name: 'Incomplete capture must fail',
            },
            { fwCloudId: fwc.fwcloud.id, userId: ownerId },
          )
          .then(
            () => null,
            (error) => error,
          );
        expect(error).to.be.instanceOf(HttpException);
        expect(error.status).to.eq(422);
        expect(error.message).to.include('Interface "ens19" (role "ens19")');
        expect(error.message).to.include('Uncapturable address');
        expect(error.message).to.include(configured.address);
        expect(error.message).to.include(configured.netmask);
        expect(
          await db
            .getSource()
            .manager.getRepository(ReplicationProfile)
            .count({ where: { userId: ownerId } }),
        ).to.eq(0);
      });
    }

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

      it('should capture the INPUT policy of a cluster whose default rule only applies to one node', async () => {
        await addDefaultInputRules();
        const manager = db.getSource().manager;
        const cluster = await manager
          .getRepository(Cluster)
          .save({ name: StringHelper.randomize(10), fwCloudId: fwc.fwcloud.id });
        await manager
          .getRepository(Firewall)
          .update(source.firewall.id, { clusterId: cluster.id, fwmaster: 1 });
        const backup = await manager.getRepository(Firewall).save({
          name: `${cluster.name}-backup`,
          fwCloudId: fwc.fwcloud.id,
          clusterId: cluster.id,
          fwmaster: 0,
        });
        // Otherwise the target's own default ICMP rule would accept ICMP on every node.
        await db
          .getSource()
          .query(
            'UPDATE policy_r SET fw_apply_to = ? WHERE firewall = ? AND type = 1 AND comment = ?',
            [backup.id, source.firewall.id, USEFUL_ICMP],
          );

        const { profile, warnings } = await service.createProfileFromSource(
          { source: { kind: 'cluster', id: cluster.id }, name: 'Node default rule snapshot' },
          { fwCloudId: fwc.fwcloud.id, userId: ownerId },
        );

        expect(warnings).to.be.empty;
        const rules = getProvision(profile).rules;
        expect(rules.map((rule) => [rule.comment, rule.nodeRole])).to.deep.eq([
          [SELF_HOST, undefined],
          [USEFUL_ICMP, 'backup'],
        ]);
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

      for (const [comment, position] of [
        [SELF_HOST, inputPositions.in],
        [USEFUL_ICMP, inputPositions.service],
      ] as const) {
        it(`should capture the default INPUT policy when ${comment} is negated`, async () => {
          await addDefaultInputRules();
          await db
            .getSource()
            .query(
              'UPDATE policy_r SET negate = ? WHERE firewall = ? AND type = 1 AND comment = ?',
              [String(position), source.firewall.id, comment],
            );

          const { profile, warnings } = await snapshot();

          expect(warnings).to.be.empty;
          const rules = getProvision(profile).rules;
          expect(rules.map((rule) => rule.comment)).to.deep.eq([SELF_HOST, USEFUL_ICMP]);
          expect(rules.find((rule) => rule.comment === comment).negate).to.eq(String(position));
          expect(rules.find((rule) => rule.comment !== comment)).not.to.have.property('negate');
        });
      }

      for (const comment of [SELF_HOST, USEFUL_ICMP]) {
        for (const field of ['time_start', 'time_end'] as const) {
          it(`should capture default INPUT rules when only ${field} is configured: ${comment}`, async () => {
            await addDefaultInputRules();
            const date = new Date('2026-10-01T08:15:30+02:00');
            await db
              .getSource()
              .query(
                `UPDATE policy_r SET ${field} = ? WHERE firewall = ? AND type = 1 AND comment = ?`,
                [date, source.firewall.id, comment],
              );
            const { profile, warnings } = await snapshot();
            expect(warnings).to.be.empty;
            const rules = getProvision(profile).rules;
            expect(rules).to.have.length(2);
            expect(rules.find((rule) => rule.comment === comment)[field]).to.eq(date.toISOString());
            expect(rules.find((rule) => rule.comment !== comment)).not.to.have.property(field);
          });
        }
        for (const options of [1, 2, 4, 6]) {
          it(`should capture default INPUT rules when only options change to ${options}: ${comment}`, async () => {
            await addDefaultInputRules();
            await db
              .getSource()
              .query(
                'UPDATE policy_r SET options = ? WHERE firewall = ? AND type = 1 AND comment = ?',
                [options, source.firewall.id, comment],
              );
            const { profile, warnings } = await snapshot();
            expect(warnings).to.be.empty;
            const rules = getProvision(profile).rules;
            expect(rules).to.have.length(2);
            expect(rules.find((rule) => rule.comment === comment).options).to.eq(options);
            expect(rules.find((rule) => rule.comment !== comment).options).to.eq(0);
          });
        }
      }

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

    for (const grouped of [false, true]) {
      it(`should reject an invalid ${grouped ? 'group member' : 'service'} range with service and rule details before saving`, async () => {
        const invalidService = await db.getSource().manager.getRepository(IPObj).save({
          name: 'Invalid TCP destination range',
          ipObjTypeId: 2,
          protocol: 6,
          source_port_start: 1024,
          source_port_end: 2048,
          destination_port_start: 8011,
          destination_port_end: 8010,
          fwCloudId: fwc.fwcloud.id,
        });
        const ruleId = await insertForwardRule(source.firewall.id, 100, {
          comment: 'Application traffic using invalid range',
        });
        if (grouped) {
          const group = await db
            .getSource()
            .query('INSERT INTO ipobj_g (name, type, fwcloud) VALUES (?, 21, ?)', [
              'Invalid service group',
              fwc.fwcloud.id,
            ]);
          await db
            .getSource()
            .query('INSERT INTO ipobj__ipobjg (ipobj, ipobj_g) VALUES (?, ?)', [
              invalidService.id,
              group.insertId,
            ]);
          await db
            .getSource()
            .query(
              'INSERT INTO policy_r__ipobj (rule, ipobj, ipobj_g, interface, position, position_order) VALUES (?, -1, ?, -1, 9, 1)',
              [ruleId, group.insertId],
            );
        } else {
          await attachIpObj(ruleId, invalidService.id, 9);
        }

        await expectCaptureFailure({ kind: 'firewall', id: source.firewall.id }, [
          'Invalid TCP destination range',
          'Application traffic using invalid range',
          'Destination port end must be greater or equal than destination port start',
        ]);
      });
    }

    it('should report every rule once and in policy order when a service is shared with NAT translation', async () => {
      const invalidService = await makeTcpService(8000);
      await db.getSource().manager.getRepository(IPObj).update(invalidService.id, {
        destination_port_end: 7999,
      });
      const forwardRule = await insertForwardRule(source.firewall.id, 100, {
        comment: 'Shared forward service',
      });
      await attachIpObj(forwardRule, invalidService.id, 9);
      const natRule = await PolicyRule.insertPolicy_r({
        firewall: source.firewall.id,
        type: PolicyTypesMap.get('IPv4:DNAT')!,
        rule_order: 200,
        comment: 'Shared translation service',
        action: 1,
        active: 1,
        options: 0,
        special: 0,
      });
      const positions = getProvisionRulePositions(4, 'dnat');
      await attachIpObj(natRule, invalidService.id, positions.service);
      await attachIpObj(natRule, invalidService.id, positions.translatedService);

      const error = await expectCaptureFailure({ kind: 'firewall', id: source.firewall.id }, [
        invalidService.name,
        'Shared forward service',
        'Shared translation service',
      ]);
      expect(error.message).to.eq(
        'Policy capture failed:\n' +
          `FORWARD IPv4 rule 100 ("Shared forward service") [id ${forwardRule}], ` +
          `DNAT IPv4 rule 200 ("Shared translation service") [id ${natRule}] cannot be captured: ` +
          `service "${invalidService.name}" (service-2-${invalidService.id}): ` +
          `snapshot ("${invalidService.name}"): ` +
          'Destination port end must be greater or equal than destination port start',
      );
    });

    it('should fail without persisting when policy rules cannot be expressed in the template vocabulary', async () => {
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

      await expectCaptureFailure({ kind: 'firewall', id: source.firewall.id }, [
        'Disabled rule',
        'the rule is disabled',
        'Reject rule',
        'only ACCEPT and DENY',
      ]);
    });

    it('should reject capture of a rule restricted to another firewall', async () => {
      const other = await makeReplicationTargetFirewall(fwc);
      const ruleId = await insertForwardRule(source.firewall.id, 100, {
        comment: 'Other firewall only',
      });
      await db
        .getSource()
        .query('UPDATE policy_r SET fw_apply_to = ? WHERE id = ?', [other.firewall.id, ruleId]);

      await expectCaptureFailure({ kind: 'firewall', id: source.firewall.id }, [
        'FORWARD IPv4 rule 100',
        'Other firewall only',
        'not a node of the source',
      ]);
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

  describe('rule options and validity periods', () => {
    const period = (options: number) => ({
      time_start:
        options & PolicyRuleOptMask.STATELESS ? null : new Date('2026-10-01T08:15:30+02:00'),
      time_end: options & PolicyRuleOptMask.LOG ? null : new Date('2026-10-31T19:45:59+01:00'),
    });
    it('should save, reload and apply a legacy template without options using the native zero default', async () => {
      const { profile } = await service.createProfileFromSource(
        { source: { kind: 'firewall', id: source.firewall.id }, name: 'Legacy rule options' },
        { fwCloudId: fwc.fwcloud.id, userId: ownerId },
      );
      writeReplicationProfileModel(profile, {
        provision: {
          interfaces: [],
          rules: [{ chain: 'forward', action: 'accept', comment: 'Legacy rule' }],
        },
      });
      const model = loadReplicationProfileModel(profile);
      const provision = getProfileProvisioning(model);
      expect(provision.rules[0]).not.to.have.property('options');
      const target = await makeReplicationTargetFirewall(fwc, false);
      const provisioning = await app.getService<PolicyReplicationService>(
        PolicyReplicationService.name,
      );
      const result = await provisioning.provisionPolicyFromProfile(
        { kind: 'firewall', id: target.firewall.id },
        provision,
        fwc.fwcloud.id,
      );
      expect(result.errors).to.be.empty;
      expect(result.createdRules).to.have.length(1);
      const [rule] = await db
        .getSource()
        .query('SELECT options, time_start, time_end FROM policy_r WHERE id = ?', [
          result.createdRules[0].targetRuleId,
        ]);
      expect(rule.options).to.eq(0);
      expect(rule.time_start).to.eq(null);
      expect(rule.time_end).to.eq(null);
      expect(loadReplicationProfileModel(profile)).to.deep.eq(model);
    });

    async function asCluster(side: ReplicationTargetSide): Promise<number> {
      const manager = db.getSource().manager;
      const cluster = await manager.getRepository(Cluster).save({
        name: StringHelper.randomize(10),
        fwCloudId: fwc.fwcloud.id,
      });
      await manager
        .getRepository(Firewall)
        .update(side.firewall.id, { clusterId: cluster.id, fwmaster: 1 });
      await manager.getRepository(Firewall).save({
        name: `${cluster.name}-backup`,
        fwCloudId: fwc.fwcloud.id,
        clusterId: cluster.id,
        fwmaster: 0,
      });
      return cluster.id;
    }

    for (const sourceKind of ['firewall', 'cluster'] as const) {
      for (const targetKind of ['firewall', 'cluster'] as const) {
        it(`should preserve rule options from ${sourceKind} through saved JSON to another ${targetKind} and compiled policy`, async () => {
          const sourceId = sourceKind === 'cluster' ? await asCluster(source) : source.firewall.id;
          await db
            .getSource()
            .manager.getRepository(Firewall)
            .update(source.firewall.id, { options: FireWallOptMask.STATEFUL });
          const expected = new Map<string, number>();
          const serviceObject = await makeTcpService(8080);
          for (const ipVersion of [4, 6] as const) {
            for (const chain of ['input', 'output', 'forward', 'snat', 'dnat'] as const) {
              const positions = getProvisionRulePositions(ipVersion, chain);
              for (const options of [
                0,
                PolicyRuleOptMask.LOG,
                PolicyRuleOptMask.STATELESS,
                PolicyRuleOptMask.LOG | PolicyRuleOptMask.STATELESS,
              ]) {
                const comment = `${chain} IPv${ipVersion} options ${options}`;
                expected.set(comment, options);
                const id = await PolicyRule.insertPolicy_r({
                  firewall: source.firewall.id,
                  type: PolicyTypesMap.get(`IPv${ipVersion}:${chain.toUpperCase()}`),
                  rule_order: 100 + options,
                  action: 1,
                  active: 1,
                  special: 0,
                  options,
                  ...period(options),
                  comment,
                  negate: String(positions.service),
                });
                await attachIpObj(id, serviceObject.id, positions.service);
                if (positions.in !== undefined)
                  await attachInterface(id, source.lanInterface.id, positions.in);
                if (positions.out !== undefined)
                  await attachInterface(id, source.wanInterface.id, positions.out);
                if (chain === 'dnat') {
                  const address = await db
                    .getSource()
                    .manager.getRepository(IPObj)
                    .save({
                      name: `DNAT IPv${ipVersion}`,
                      address: ipVersion === 4 ? '192.0.2.10' : '2001:db8::10',
                      ipObjTypeId: 5,
                      ip_version: ipVersion,
                      fwCloudId: fwc.fwcloud.id,
                    });
                  await attachIpObj(id, address.id, positions.translatedDestination);
                }
              }
            }
          }
          const captured = await service.createProfileFromSource(
            {
              source: { kind: sourceKind, id: sourceId },
              name: `Options ${sourceKind} to ${targetKind}`,
            },
            { fwCloudId: fwc.fwcloud.id, userId: ownerId },
          );
          expect(captured.warnings).to.be.empty;
          const profile = await db
            .getSource()
            .manager.getRepository(ReplicationProfile)
            .findOneByOrFail({ id: captured.profile.id });
          const model = JSON.parse(JSON.stringify(loadReplicationProfileModel(profile)));
          expect(model.provision.rules).to.have.length(expected.size);
          for (const rule of model.provision.rules) {
            expect(rule.options, rule.comment).to.eq(expected.get(rule.comment));
            const dates = period(expected.get(rule.comment)!);
            for (const field of ['time_start', 'time_end'] as const) {
              expect(rule[field] ?? '', `${rule.comment} ${field}`).to.eq(
                policyRuleDateKey(dates[field]),
              );
            }
          }
          // Exercise a subsequent save/load as well as the initial capture's persistence.
          writeReplicationProfileModel(profile, model);
          const reloaded = loadReplicationProfileModel(profile);
          expect(reloaded).to.deep.eq(model);
          const target = await makeReplicationTargetFirewall(fwc, false);
          const targetId = targetKind === 'cluster' ? await asCluster(target) : target.firewall.id;
          await db
            .getSource()
            .manager.getRepository(Firewall)
            .update(target.firewall.id, { options: FireWallOptMask.STATEFUL });
          const provisioning = await app.getService<PolicyReplicationService>(
            PolicyReplicationService.name,
          );
          const result = await provisioning.provisionPolicyFromProfile(
            { kind: targetKind, id: targetId },
            getProfileProvisioning(reloaded),
            fwc.fwcloud.id,
            'replace_defaults',
            {
              parameters: getProfileParameters(reloaded),
              externalObjects: (await resolveProfileObjectReferences(reloaded, fwc.fwcloud.id))
                .bindings,
              interfaceNameMapping: { ens18: 'ens18', ens19: 'ens19' },
            },
          );
          expect(result.errors).to.be.empty;
          const rows = await db
            .getSource()
            .query('SELECT * FROM policy_r WHERE firewall = ? AND special = 0', [
              target.firewall.id,
            ]);
          expect(rows).to.have.length(expected.size);
          for (const row of rows) {
            expect(row.options, row.comment).to.eq(expected.get(row.comment));
            const dates = period(expected.get(row.comment)!);
            for (const field of ['time_start', 'time_end'] as const)
              expect(policyRuleDateKey(row[field]), `${row.comment} ${field}`).to.eq(
                policyRuleDateKey(dates[field]),
              );
            expect(row.action).to.eq(1);
            expect(row.negate).to.eq(
              String(
                getProvisionRulePositions(row.type <= 5 ? 4 : 6, row.comment.split(' ')[0]).service,
              ),
            );
          }
          for (const compiler of ['IPTables', 'NFTables'] as const) {
            const compileRules = async (firewall: number) => {
              const policies = await Promise.all(
                [4, 6].flatMap((ipVersion) =>
                  ['INPUT', 'OUTPUT', 'FORWARD'].map((chain) =>
                    PolicyRule.getPolicyData(
                      'compiler',
                      db.getQuery(),
                      fwc.fwcloud.id,
                      firewall,
                      PolicyTypesMap.get(`IPv${ipVersion}:${chain}`),
                      null,
                      null,
                    ),
                  ),
                ),
              );
              const data: any[] = policies.flat();
              // Filter rules are where FWCloud supports logging and connection tracking.
              return PolicyCompiler.compile(
                compiler,
                data.filter(
                  (rule) =>
                    expected.has(rule.comment) &&
                    ['input', 'output', 'forward'].includes(rule.comment.split(' ')[0]),
                ),
              );
            };
            const original = await compileRules(source.firewall.id);
            const applied = await compileRules(target.firewall.id);
            expect(applied).to.have.length(24);
            for (const rule of applied) {
              const options = expected.get(rule.comment)!;
              const sourceRule = original.find((item) => item.comment === rule.comment)!;
              const dates = period(options);
              if (compiler === 'IPTables') {
                expect(rule.cs.includes('--datestart'), rule.comment).to.eq(!!dates.time_start);
                expect(rule.cs.includes('--datestop'), rule.comment).to.eq(!!dates.time_end);
                if (dates.time_start)
                  expect(rule.cs).to.include(
                    `--datestart ${dates.time_start.toISOString().slice(0, 19)}`,
                  );
                if (dates.time_end)
                  expect(rule.cs).to.include(
                    `--datestop ${dates.time_end.toISOString().slice(0, 19)}`,
                  );
              } else {
                expect(rule.cs.includes('meta time'), rule.comment).to.eq(
                  !!(dates.time_start || dates.time_end),
                );
                if (dates.time_start)
                  expect(rule.cs).to.include(`meta time \\>= ${dates.time_start.getTime() / 1000}`);
                if (dates.time_end)
                  expect(rule.cs).to.include(
                    `meta time \\< ${dates.time_end.getTime() / 1000 + 1}`,
                  );
              }
              const hasLog = compiler === 'IPTables' ? /-j LOG/ : /counter log prefix/;
              const hasTracking = compiler === 'IPTables' ? /--ctstate\s+NEW/ : /ct state new/;
              expect(hasLog.test(rule.cs), rule.comment).to.eq(!!(options & PolicyRuleOptMask.LOG));
              expect(hasTracking.test(rule.cs), rule.comment).to.eq(
                !(options & PolicyRuleOptMask.STATELESS),
              );
              expect(hasLog.test(rule.cs)).to.eq(hasLog.test(sourceRule.cs));
              expect(hasTracking.test(rule.cs)).to.eq(hasTracking.test(sourceRule.cs));
              const normalizeIds = (script: string) =>
                script
                  .replace(/FWCRULE\d+/g, 'FWCRULE<ID>')
                  .replace(/RULE ID \d+/g, 'RULE ID <ID>');
              expect(normalizeIds(rule.cs), rule.comment).to.eq(normalizeIds(sourceRule.cs));
            }
          }
          const recaptured = await service.createProfileFromSource(
            {
              source: { kind: targetKind, id: targetId },
              name: `Recaptured ${sourceKind} to ${targetKind}`,
            },
            { fwCloudId: fwc.fwcloud.id, userId: ownerId },
          );
          expect(recaptured.warnings).to.be.empty;
          for (const rule of getProvision(recaptured.profile).rules) {
            expect(rule.options, rule.comment).to.eq(expected.get(rule.comment));
            const dates = period(expected.get(rule.comment)!);
            for (const field of ['time_start', 'time_end'] as const)
              expect(rule[field] ?? '').to.eq(policyRuleDateKey(dates[field]));
          }
        });
      }
    }
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

    it('should capture every IPv6 address of the cluster master alongside IPv4', async () => {
      for (const [index, netmask] of ['/64', '/96'].entries()) {
        await db
          .getSource()
          .manager.getRepository(IPObj)
          .save({
            name: `Cluster IPv6 address ${index + 1}`,
            address: `2001:db8:${index + 1}::10`,
            netmask,
            ip_version: 6,
            ipObjTypeId: 5,
            interfaceId: source.wanInterface.id,
          });
      }
      const { profile, warnings } = await service.createProfileFromSource(
        {
          source: { kind: 'cluster', id: cluster.id },
          name: 'Cluster dual stack snapshot',
        },
        { fwCloudId: fwc.fwcloud.id, userId: ownerId },
      );
      expect(warnings).to.be.empty;
      const model = loadReplicationProfileModel(profile);
      const provision = getProfileProvisioning(model);
      const addresses = provision.interfaces.find((iface) => iface.name === 'ens18').addresses;
      const parameters = getProfileParameters(model);
      expect(addresses).to.have.length(3);
      expect(
        addresses.map(
          (address) =>
            parameters.find(
              (parameter) => parameter.name === (address.value as { param: string }).param,
            ).default,
        ),
      ).to.deep.eq([source.wanAddress.address, '2001:db8:1::10/64', '2001:db8:2::10/96']);
    });

    it('should capture the master policy and the cluster topology', async () => {
      const ruleId = await insertForwardRule(source.firewall.id, 100, {
        comment: 'Cluster forward rule',
        negate: '22',
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
      expect(getProvision(profile).rules[0].negate).to.eq('22');

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

    it('should keep the node each rule is restricted to through the saved and exported JSON', async () => {
      const backup = await db
        .getSource()
        .manager.getRepository(Firewall)
        .findOneByOrFail({ clusterId: cluster.id, fwmaster: 0 });
      const restrictTo = (ruleId: number, nodeId: number) =>
        db.getSource().query('UPDATE policy_r SET fw_apply_to = ? WHERE id = ?', [nodeId, ruleId]);
      await restrictTo(
        await insertForwardRule(source.firewall.id, 100, { comment: 'Master only' }),
        source.firewall.id,
      );
      await restrictTo(
        await insertForwardRule(source.firewall.id, 101, { comment: 'Backup only' }),
        backup.id,
      );
      await insertForwardRule(source.firewall.id, 102, { comment: 'Every node' });

      const { profile, warnings } = await service.createProfileFromSource(
        { source: { kind: 'cluster', id: cluster.id }, name: 'Node restricted rules' },
        { fwCloudId: fwc.fwcloud.id, userId: ownerId },
      );

      expect(warnings).to.be.empty;
      const nodeRoles = (rules: { comment?: string; nodeRole?: string }[]) =>
        rules.map((rule) => [rule.comment, rule.nodeRole]);
      const expected = [
        ['Master only', 'master'],
        ['Backup only', 'backup'],
        ['Every node', undefined],
      ];
      const model = loadReplicationProfileModel(profile);
      const rules = getProvision(profile).rules;
      expect(nodeRoles(rules)).to.deep.eq(expected);
      expect(rules[2]).not.to.have.property('nodeRole');
      expect((model.policyStructure as { rules: CapturedRule[] }).rules).to.deep.eq(rules);
      // Applying a node's rules needs that node, so it is no longer optional.
      const topologyPreset = model.topologyPreset as {
        nodes: Array<{ role: string; required: boolean }>;
      };
      expect(topologyPreset.nodes.map((node) => [node.role, node.required])).to.deep.eq([
        ['master', true],
        ['backup', true],
      ]);
      // A standalone application converts node restrictions without changing the saved template.
      expect((model.compatibility as { target_kinds: string[] }).target_kinds).to.deep.eq([
        'firewall',
        'cluster',
      ]);

      writeReplicationProfileModel(profile, JSON.parse(JSON.stringify(model)));
      const reloaded = loadReplicationProfileModel(profile);
      expect(reloaded).to.deep.eq(model);
      expect(nodeRoles(getProfileProvisioning(portableProfileModel(reloaded)).rules)).to.deep.eq(
        expected,
      );
    });

    it('should reject capture of a rule restricted to a firewall outside the cluster', async () => {
      const outsider = await makeReplicationTargetFirewall(fwc);
      const ruleId = await insertForwardRule(source.firewall.id, 100, { comment: 'Outsider only' });
      await db
        .getSource()
        .query('UPDATE policy_r SET fw_apply_to = ? WHERE id = ?', [outsider.firewall.id, ruleId]);

      await expectCaptureFailure({ kind: 'cluster', id: cluster.id }, [
        'FORWARD IPv4 rule 100',
        'Outsider only',
        'not a node of the source',
      ]);
    });

    it('should leave out routing and system entries restricted to one node, and require Keepalived masters', async () => {
      const backup = await db
        .getSource()
        .manager.getRepository(Firewall)
        .findOneByOrFail({ clusterId: cluster.id, fwmaster: 0 });
      // Keepalived only binds to interfaces with a MAC address.
      await db
        .getSource()
        .query("UPDATE interface SET mac = '00:11:22:33:44:55' WHERE id = ?", [
          source.lanInterface.id,
        ]);
      const provisioning = await app.getService<PolicyReplicationService>(
        PolicyReplicationService.name,
      );
      const applied = await provisioning.provisionPolicyFromProfile(
        { kind: 'cluster', id: cluster.id },
        getProfileProvisioning({
          provision: {
            interfaces: [
              { name: 'ens18', role: 'wan' },
              { name: 'ens19', role: 'lan' },
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
              rules: [{ from: [{ kind: 'address', value: '192.168.70.100' }], table: 'isp2' }],
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
              keepalived: [
                {
                  interfaceRole: 'lan',
                  virtualIps: [{ kind: 'address', value: '192.168.70.254' }],
                  masterNode: 'backup',
                },
              ],
              haproxy: [
                {
                  frontendIp: { kind: 'address', value: '198.51.100.10' },
                  frontendService: { protocol: 'tcp', port: 443 },
                  backendIps: [{ kind: 'address', value: '192.168.70.20' }],
                  backendService: { protocol: 'tcp', port: 8443 },
                },
              ],
            },
          },
        }),
        fwc.fwcloud.id,
        'replace_defaults',
        {
          interfaceNameMapping: { wan: 'ens18', lan: 'ens19' },
          nodeRoleMapping: { master: source.firewall.id, backup: backup.id },
        },
      );
      expect(applied.errors).to.be.empty;
      expect(applied.provisioned).to.include({ routes: 1, routingRules: 1, dhcp: 1, haproxy: 1 });
      expect(applied.provisioned.keepalived).to.eq(1);
      const capture = () =>
        service.createProfileFromSource(
          { source: { kind: 'cluster', id: cluster.id }, name: StringHelper.randomize(10) },
          { fwCloudId: fwc.fwcloud.id, userId: ownerId },
        );

      const unrestricted = await capture();
      expect(unrestricted.warnings).to.be.empty;
      const unrestrictedModel = loadReplicationProfileModel(unrestricted.profile);
      expect(
        (unrestrictedModel.provision as Record<string, any>).system.keepalived[0].masterNode,
      ).to.eq('backup');
      expect(
        (unrestrictedModel.topologyPreset as { nodes: Array<{ required: boolean }> }).nodes.map(
          (node) => node.required,
        ),
      ).to.deep.eq([true, true]);

      for (const table of ['route', 'routing_r', 'dhcp_r', 'keepalived_r', 'haproxy_r']) {
        await db
          .getSource()
          .query(
            `UPDATE ${table} SET fw_apply_to = ? WHERE ${table === 'route' || table === 'routing_r' ? 'routing_table IN (SELECT id FROM routing_table WHERE firewall = ?)' : 'firewall = ?'}`,
            [backup.id, source.firewall.id],
          );
      }
      // With the master as Keepalived master, only "Apply to" makes the backup node required.
      await db
        .getSource()
        .query('UPDATE keepalived_r SET master_node = ? WHERE firewall = ?', [
          source.firewall.id,
          source.firewall.id,
        ]);
      // Manual configurations keep their node too.
      await (
        await app.getService<KeepalivedRuleService>(KeepalivedRuleService.name)
      ).store({
        firewallId: source.firewall.id,
        rule_type: 2,
        cfg_text: 'global_defs {\n}\n',
        active: true,
        fw_apply_to: backup.id,
      });
      const restricted = await capture();

      expect(restricted.warnings).to.have.length(4);
      for (const [index, entry] of [
        'Route',
        'Routing rule',
        'DHCP rule',
        'HAProxy rule',
      ].entries()) {
        expect(restricted.warnings[index]).to.match(
          new RegExp(
            `^${entry} .*was not captured: it only applies to one cluster node, which templates keep for policy and Keepalived rules only\\.$`,
          ),
        );
      }
      const restrictedModel = loadReplicationProfileModel(restricted.profile);
      const provision = restrictedModel.provision as Record<string, any>;
      expect(provision.routing.tables[0].routes).to.deep.eq([]);
      expect(provision.routing.rules).to.deep.eq([]);
      expect(provision.system).to.deep.include({ dhcp: [], haproxy: [] });
      expect(provision.system.keepalived).to.have.length(2);
      expect(provision.system.keepalived[0]).to.include({
        masterNode: 'master',
        nodeRole: 'backup',
      });
      expect(provision.system.keepalived[1]).to.include({
        rule_type: 2,
        cfg_text: 'global_defs {\n}\n',
        nodeRole: 'backup',
      });
      expect(provision.system.keepalived[1]).to.not.have.any.keys('interfaceRole', 'masterNode');
      expect(restrictedModel.compatibility).to.deep.include({
        target_kinds: ['firewall', 'cluster'],
      });
      expect(
        (restrictedModel.topologyPreset as { nodes: Array<{ required: boolean }> }).nodes.map(
          (node) => node.required,
        ),
      ).to.deep.eq([true, true]);

      // A disabled entry is reported as disabled first, whatever node it applies to; Keepalived
      // keeps disabled rules with their node.
      for (const table of ['route', 'routing_r', 'dhcp_r', 'keepalived_r', 'haproxy_r']) {
        await db
          .getSource()
          .query(`UPDATE ${table} SET active = 0 WHERE fw_apply_to = ?`, [backup.id]);
      }
      const disabled = await capture();
      expect(
        disabled.warnings.map((warning) => warning.split(' was not captured: ')[1]),
      ).to.deep.eq([
        'the route is disabled.',
        'the rule is disabled.',
        'the rule is disabled.',
        'the rule is disabled.',
      ]);
      expect(
        (loadReplicationProfileModel(disabled.profile).provision as Record<string, any>).system
          .keepalived[0],
      ).to.include({ active: false, nodeRole: 'backup' });

      // A rule restricted to a firewall outside the cluster is never widened to every node.
      const outsider = await makeReplicationTargetFirewall(fwc);
      await db
        .getSource()
        .query('UPDATE keepalived_r SET fw_apply_to = ? WHERE firewall = ?', [
          outsider.firewall.id,
          source.firewall.id,
        ]);
      const outside = await capture();
      expect(outside.warnings[3]).to.match(
        /^Keepalived rule .*was not captured: it only applies to a firewall that is not a node of the source\.$/,
      );
      expect(
        (loadReplicationProfileModel(outside.profile).provision as Record<string, any>).system
          .keepalived,
      ).to.deep.eq([]);
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

    it('should fail capture and report every rule whose VPN match cannot be represented', async () => {
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

      await expectCaptureFailure({ kind: 'firewall', id: source.firewall.id }, [
        'Restricted to a dynamic VPN prefix',
        'Restricted to a VPN from another firewall',
        'VPN reference',
      ]);
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
  });

  describe('custom object group snapshots', () => {
    async function makeGroup(name: string, type: number, members: number[]): Promise<number> {
      const group = await db
        .getSource()
        .query('INSERT INTO ipobj_g (name, type, comment, fwcloud) VALUES (?, ?, ?, ?)', [
          name,
          type,
          `Configuration of ${name}`,
          fwc.fwcloud.id,
        ]);
      for (const member of members) {
        await db
          .getSource()
          .query('INSERT INTO ipobj__ipobjg (ipobj, ipobj_g) VALUES (?, ?)', [
            member,
            group.insertId,
          ]);
      }
      return Number(group.insertId);
    }

    function attachGroup(ruleId: number, groupId: number, position: number): Promise<void> {
      return db
        .getSource()
        .query(
          'INSERT INTO policy_r__ipobj (rule, ipobj, ipobj_g, interface, position, position_order) VALUES (?, -1, ?, -1, ?, 1)',
          [ruleId, groupId, position],
        );
    }

    for (const kind of ['firewall', 'cluster'] as const) {
      it(`should preserve shared custom address and service groups, complete members and rule semantics in ${kind} JSON`, async () => {
        let sourceId = source.firewall.id;
        let backupId: number | undefined;
        if (kind === 'cluster') {
          const cluster = await db.getSource().manager.getRepository(Cluster).save({
            name: 'Custom group source cluster',
            fwCloudId: fwc.fwcloud.id,
          });
          await db
            .getSource()
            .manager.getRepository(Firewall)
            .update(source.firewall.id, { clusterId: cluster.id, fwmaster: 1 });
          const backup = await db.getSource().manager.getRepository(Firewall).save({
            name: 'Custom group source backup',
            fwCloudId: fwc.fwcloud.id,
            clusterId: cluster.id,
            fwmaster: 0,
          });
          sourceId = cluster.id;
          backupId = backup.id;
        }
        const addressDefinitions = [
          { type: 5, name: 'OFFICE_IP', address: '192.168.1.10', netmask: '/32' },
          { type: 7, name: 'OFFICE_LAN', address: '192.168.2.0', netmask: '/24' },
          {
            type: 6,
            name: 'OFFICE_RANGE',
            range_start: '192.168.3.10',
            range_end: '192.168.3.20',
          },
        ].map((definition) => ({ ...definition, ip_version: 4, options: 0 }));
        const addressMembers: IPObj[] = [];
        for (const { type, ...definition } of addressDefinitions) {
          addressMembers.push(
            await db
              .getSource()
              .manager.getRepository(IPObj)
              .save({
                ...definition,
                ipObjTypeId: type,
                options: '0',
                fwCloudId: fwc.fwcloud.id,
              }),
          );
        }
        const tcp = await makeTcpService(8443);
        const udp = await db.getSource().manager.getRepository(IPObj).save({
          name: 'OFFICE_UDP',
          ipObjTypeId: 4,
          protocol: 17,
          source_port_start: 1024,
          source_port_end: 2048,
          destination_port_start: 9000,
          destination_port_end: 9010,
          fwCloudId: fwc.fwcloud.id,
        });
        const addressGroup = await makeGroup(
          'OFFICE_NETWORKS',
          20,
          addressMembers.map((member) => member.id),
        );
        const serviceGroup = await makeGroup('OFFICE_SERVICES', 21, [tcp.id, udp.id]);
        const options = PolicyRuleOptMask.LOG | PolicyRuleOptMask.STATELESS;
        const firstRule = await insertForwardRule(source.firewall.id, 120, {
          comment: 'Office internet access',
          options,
          negate: '7 8 9',
        });
        const timeStart = new Date('2026-10-01T08:00:00Z');
        const timeEnd = new Date('2026-10-31T20:00:00Z');
        await db
          .getSource()
          .manager.getRepository(PolicyRule)
          .update(firstRule, { time_start: timeStart, time_end: timeEnd });
        if (backupId) {
          await db
            .getSource()
            .query('UPDATE policy_r SET fw_apply_to = ? WHERE id = ?', [backupId, firstRule]);
        }
        await attachGroup(firstRule, addressGroup, 7);
        await attachGroup(firstRule, addressGroup, 8);
        await attachGroup(firstRule, serviceGroup, 9);
        const forwardPositions = getProvisionRulePositions(4, 'forward');
        await attachInterface(firstRule, source.lanInterface.id, forwardPositions.in);
        await attachInterface(firstRule, source.wanInterface.id, forwardPositions.out);
        const secondRule = await insertForwardRule(source.firewall.id, 121, {
          action: 2,
          comment: 'Office deny fallback',
        });
        await attachGroup(secondRule, addressGroup, 7);
        await attachGroup(secondRule, serviceGroup, 9);

        const { profile, warnings } = await service.createProfileFromSource(
          { source: { kind, id: sourceId }, name: 'Complete custom group capture' },
          { fwCloudId: fwc.fwcloud.id, userId: ownerId },
        );

        expect(warnings).to.be.empty;
        const saved = await db
          .getSource()
          .manager.getRepository(ReplicationProfile)
          .findOneByOrFail({ id: profile.id });
        const model: any = JSON.parse(JSON.stringify(loadReplicationProfileModel(saved)));
        const rules = model.provision.rules as CapturedRule[];
        expect(rules.map((rule) => rule.comment)).to.deep.eq([
          'Office internet access',
          'Office deny fallback',
        ]);
        expect(rules[0]).to.include({
          chain: 'forward',
          action: 'accept',
          ipVersion: 4,
          options,
          negate: '7 8 9',
          inRole: 'ens19',
          outRole: 'ens18',
          time_start: timeStart.toISOString(),
          time_end: timeEnd.toISOString(),
        });
        if (kind === 'cluster') expect(rules[0].nodeRole).to.eq('backup');
        expect(rules[1].action).to.eq('deny');
        expect(model.objectReferences).to.have.length(2);
        const addressReference = model.objectReferences.find(
          (reference) => reference.objectType === 'group',
        );
        const serviceReference = model.objectReferences.find(
          (reference) => reference.objectType === 'serviceGroup',
        );
        expect(addressReference.snapshot).to.include({
          type: 20,
          name: 'OFFICE_NETWORKS',
          comment: 'Configuration of OFFICE_NETWORKS',
        });
        expect(addressReference.snapshot.members).to.have.length(3);
        for (const definition of addressDefinitions) {
          expect(
            addressReference.snapshot.members.find((member) => member.name === definition.name),
          ).to.include(definition);
        }
        expect(serviceReference.snapshot).to.include({
          type: 21,
          name: 'OFFICE_SERVICES',
          comment: 'Configuration of OFFICE_SERVICES',
        });
        expect(serviceReference.snapshot.members).to.have.length(2);
        expect(serviceReference.snapshot.members.find((member) => member.type === 4)).to.include({
          name: udp.name,
          protocol: 17,
          source_port_start: 1024,
          source_port_end: 2048,
          destination_port_start: 9000,
          destination_port_end: 9010,
        });
        expect(addressReference.locations).to.have.length(3);
        expect(serviceReference.locations).to.have.length(2);
        expect(rules[0].source).to.deep.eq([
          { kind: 'external', referenceId: addressReference.referenceId },
        ]);
        expect(rules[0].destination).to.deep.eq(rules[0].source);
        expect(rules[1].source).to.deep.eq(rules[0].source);
        expect(rules[0].services).to.deep.eq([
          { kind: 'external', referenceId: serviceReference.referenceId },
        ]);
        expect(rules[1].services).to.deep.eq(rules[0].services);
        expect(model.policyStructure.rules).to.deep.eq(rules);
        writeReplicationProfileModel(saved, model);
        expect(loadReplicationProfileModel(saved)).to.deep.eq(model);
        expect(getProfileProvisioning(loadReplicationProfileModel(saved)).rules).to.have.length(2);
      });
    }

    it('should preserve shared custom groups in compatible SNAT and DNAT positions', async () => {
      const address = await db.getSource().manager.getRepository(IPObj).save({
        name: 'OFFICE_NAT_ADDRESS',
        ipObjTypeId: 5,
        address: '192.168.4.10',
        netmask: '/32',
        ip_version: 4,
        fwCloudId: fwc.fwcloud.id,
      });
      const tcp = await makeTcpService(8443);
      const addressGroup = await makeGroup('OFFICE_NAT_NETWORKS', 20, [address.id]);
      const serviceGroup = await makeGroup('OFFICE_NAT_SERVICES', 21, [tcp.id]);
      for (const [index, chain] of (['snat', 'dnat'] as const).entries()) {
        const rule = await PolicyRule.insertPolicy_r({
          firewall: source.firewall.id,
          type: PolicyTypesMap.get(`IPv4:${chain.toUpperCase()}`)!,
          rule_order: 120 + index,
          comment: `Office ${chain} rule`,
          action: 1,
          active: 1,
          options: 0,
          special: 0,
        });
        const positions = getProvisionRulePositions(4, chain);
        await attachGroup(rule, addressGroup, positions.source);
        await attachGroup(rule, addressGroup, positions.destination);
        await attachGroup(rule, serviceGroup, positions.service);
        // Native translated positions accept individual addresses/ports, rather than groups.
        await attachIpObj(
          rule,
          address.id,
          chain === 'snat' ? positions.translatedSource : positions.translatedDestination,
        );
        await attachIpObj(rule, tcp.id, positions.translatedService);
      }

      const { profile, warnings } = await service.createProfileFromSource(
        { source: { kind: 'firewall', id: source.firewall.id }, name: 'NAT custom groups' },
        { fwCloudId: fwc.fwcloud.id, userId: ownerId },
      );
      expect(warnings).to.be.empty;
      const model: any = JSON.parse(JSON.stringify(loadReplicationProfileModel(profile)));
      expect(model.provision.rules).to.have.length(2);
      expect(model.objectReferences).to.have.length(3);
      const addressReference = model.objectReferences.find(
        (reference) => reference.objectType === 'group',
      );
      const serviceReference = model.objectReferences.find(
        (reference) => reference.objectType === 'serviceGroup',
      );
      const portReference = model.objectReferences.find(
        (reference) => reference.objectType === 'tcp',
      );
      expect(addressReference).to.include({ sourceName: 'OFFICE_NAT_NETWORKS' });
      expect(serviceReference).to.include({ sourceName: 'OFFICE_NAT_SERVICES' });
      expect(addressReference.locations).to.have.length(4);
      expect(serviceReference.locations).to.have.length(2);
      expect(portReference.locations).to.have.length(2);
      for (const rule of model.provision.rules) {
        const groupUsage = [{ kind: 'external', referenceId: addressReference.referenceId }];
        expect(rule.source).to.deep.eq(groupUsage);
        expect(rule.destination).to.deep.eq(groupUsage);
        expect(rule.services).to.deep.eq([
          { kind: 'external', referenceId: serviceReference.referenceId },
        ]);
        expect(rule.translatedService).to.deep.eq([
          { kind: 'external', referenceId: portReference.referenceId },
        ]);
        const translatedField =
          rule.chain === 'snat' ? 'translatedSource' : 'translatedDestination';
        expect(rule[translatedField][0]).to.include({ kind: 'address', name: address.name });
      }
      expect(model.objectReferences.map((reference) => reference.snapshot.name)).to.include.members(
        ['OFFICE_NAT_NETWORKS', 'OFFICE_NAT_SERVICES', tcp.name],
      );
      expect(model.policyStructure.rules).to.deep.eq(model.provision.rules);
      writeReplicationProfileModel(profile, model);
      expect(loadReplicationProfileModel(profile)).to.deep.eq(model);
    });

    it('should fail before persistence and identify all rules, the custom address group and its invalid member', async () => {
      const invalid = await db.getSource().manager.getRepository(IPObj).save({
        name: 'OFFICE_INVALID_RANGE',
        ipObjTypeId: 6,
        ip_version: 4,
        range_start: '192.168.1.20',
        range_end: '192.168.1.10',
        fwCloudId: fwc.fwcloud.id,
      });
      const group = await makeGroup('OFFICE_INVALID_GROUP', 20, [invalid.id]);
      for (const [index, comment] of [
        'Invalid source group rule',
        'Invalid destination group rule',
      ].entries()) {
        const rule = await insertForwardRule(source.firewall.id, 120 + index, { comment });
        await attachGroup(rule, group, index === 0 ? 7 : 8);
      }

      await expectCaptureFailure({ kind: 'firewall', id: source.firewall.id }, [
        'Invalid source group rule',
        'Invalid destination group rule',
        'OFFICE_INVALID_GROUP',
        'OFFICE_INVALID_RANGE',
        'range',
      ]);
    });

    it('should fail before persistence when a service is stored in a custom address group', async () => {
      const tcp = await makeTcpService(8443);
      const group = await makeGroup('OFFICE_BAD_MEMBER_TYPE', 20, [tcp.id]);
      const rule = await insertForwardRule(source.firewall.id, 120, {
        comment: 'Invalid custom group dependency',
      });
      await attachGroup(rule, group, 7);

      await expectCaptureFailure({ kind: 'firewall', id: source.firewall.id }, [
        'Invalid custom group dependency',
        'OFFICE_BAD_MEMBER_TYPE',
        tcp.name,
        'unsupported dependency type 2',
      ]);
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
