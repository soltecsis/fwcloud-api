import { describeName, expect, testSuite } from '../../../mocha/global-setup';
import { Application } from '../../../../src/Application';
import db from '../../../../src/database/database-manager';
import { FwCloudFactory, FwCloudProduct } from '../../../utils/fwcloud-factory';
import { Firewall, FireWallOptMask } from '../../../../src/models/firewall/Firewall';
import { Cluster } from '../../../../src/models/firewall/Cluster';
import { Interface } from '../../../../src/models/interface/Interface';
import { PolicyRule } from '../../../../src/models/policy/PolicyRule';
import { Tree, TreeNode } from '../../../../src/models/tree/Tree';
import StringHelper from '../../../../src/utils/string.helper';
import { PolicyReplicationService } from '../../../../src/models/replication-profile/policy-replication.service';
import {
  getProfileProvisioning,
  PolicyReplicationProvision,
} from '../../../../src/models/replication-profile/policy-replication.types';
import { getProfileParameters } from '../../../../src/models/replication-profile/replication-profile-parameters';

/**
 * A two-interface edge profile written entirely in terms of parameters: this is
 * the shape the wizard produces when the operator wants the same policy on a
 * different firewall with different addressing.
 */
const PARAMETERIZED_MODEL = {
  parameters: [
    { name: 'WAN_IP', type: 'address', label: 'WAN address' },
    { name: 'LAN_IP', type: 'address', label: 'LAN address' },
    { name: 'LAN_NET', type: 'network', label: 'LAN network' },
    { name: 'APP_PORT', type: 'port', label: 'Service port', default: 800 },
  ],
  provision: {
    interfaces: [
      { name: 'WAN', role: 'wan', addresses: [{ param: 'WAN_IP' }] },
      { name: 'LAN', role: 'lan', addresses: [{ param: 'LAN_IP' }] },
    ],
    rules: [
      {
        chain: 'forward',
        action: 'accept',
        inRole: 'lan',
        outRole: 'wan',
        source: [{ kind: 'network', value: { param: 'LAN_NET' } }],
        services: [{ protocol: 'tcp', port: { param: 'APP_PORT' } }],
        comment: 'Allow LAN to WAN on the service port',
      },
    ],
  },
};

describe(describeName('PolicyReplicationService provisioning Unit Tests'), () => {
  let app: Application;
  let service: PolicyReplicationService;
  let fwc: FwCloudProduct;
  let targetFirewall: Firewall;
  let provision: PolicyReplicationProvision;

  const parameters = getProfileParameters(PARAMETERIZED_MODEL);

  const applyOptions = (values: Record<string, unknown>) => ({
    parameters,
    parameterValues: values,
    profileCode: 'edge-test',
    profileVersion: 1,
  });

  const values = {
    WAN_IP: '198.51.100.10/24',
    LAN_IP: '192.168.50.1/24',
    LAN_NET: '192.168.50.0/24',
  };

  before(async () => {
    app = testSuite.app;
    await testSuite.resetDatabaseData();
  });

  beforeEach(async () => {
    service = await app.getService<PolicyReplicationService>(PolicyReplicationService.name);
    fwc = await new FwCloudFactory().make();
    provision = getProfileProvisioning(PARAMETERIZED_MODEL);

    targetFirewall = await db
      .getSource()
      .manager.getRepository(Firewall)
      .save({ name: StringHelper.randomize(10), fwCloudId: fwc.fwcloud.id });
  });

  async function countIpObjs(where: string, params: unknown[]): Promise<number> {
    const rows = await db
      .getSource()
      .query(`SELECT COUNT(*) AS total FROM ipobj WHERE fwcloud = ? AND ${where}`, [
        fwc.fwcloud.id,
        ...params,
      ]);

    return Number(rows[0].total);
  }

  it('should read the parameterized model into the provision vocabulary', () => {
    expect(provision.interfaces).to.have.length(2);
    expect(provision.interfaces[0].addresses).to.have.length(1);
    expect(provision.rules[0].source).to.have.length(1);
    expect(provision.rules[0].services).to.have.length(1);
  });

  it('should create interfaces with their addresses and wire the rule objects', async () => {
    const result = await service.provisionPolicyFromProfile(
      { kind: 'firewall', id: targetFirewall.id },
      provision,
      fwc.fwcloud.id,
      'replace_defaults',
      applyOptions(values),
    );

    expect(result.errors).to.be.empty;
    expect(result.applied).to.be.true;
    expect(result.createdRules).to.have.length(1);

    const interfaces = await db
      .getSource()
      .query('SELECT id, name FROM interface WHERE firewall = ? ORDER BY id', [targetFirewall.id]);
    expect(interfaces).to.have.length(2);

    // The WAN address supplied at apply time is bound to the WAN interface.
    const wanAddresses = await db
      .getSource()
      .query('SELECT address, netmask FROM ipobj WHERE interface = ?', [interfaces[0].id]);
    expect(wanAddresses).to.have.length(1);
    expect(wanAddresses[0].address).to.be.eq('198.51.100.10');
    expect(wanAddresses[0].netmask).to.be.eq('/24');

    // The LAN network of the rule became a real network object.
    expect(await countIpObjs('type = 7 AND address = ?', ['192.168.50.0'])).to.be.eq(1);
    // The service port defaulted to 800 and produced a TCP object.
    expect(await countIpObjs('type = 2 AND destination_port_start = ?', [800])).to.be.eq(1);

    const ruleObjects = await db
      .getSource()
      .query('SELECT ipobj, interface, position FROM policy_r__ipobj WHERE rule = ?', [
        result.createdRules[0].targetRuleId,
      ]);
    // One source network plus one service.
    expect(ruleObjects).to.have.length(2);
  });

  it('should bind a role to the target interface assigned to it instead of creating one', async () => {
    const eth1 = await db.getSource().manager.getRepository(Interface).save({
      name: 'eth1',
      type: '10',
      interface_type: '10',
      firewallId: targetFirewall.id,
    });

    const result = await service.provisionPolicyFromProfile(
      { kind: 'firewall', id: targetFirewall.id },
      provision,
      fwc.fwcloud.id,
      'replace_defaults',
      { ...applyOptions(values), interfaceNameMapping: { lan: 'ETH1' } },
    );

    expect(result.errors).to.be.empty;
    expect(result.warnings).to.be.empty;

    // Only WAN is created; LAN is the existing eth1, which receives the LAN address.
    const interfaces = await db
      .getSource()
      .query('SELECT name FROM interface WHERE firewall = ?', [targetFirewall.id]);
    expect(interfaces.map((row: { name: string }) => row.name)).to.have.members(['eth1', 'WAN']);

    const lanAddresses = await db
      .getSource()
      .query('SELECT address FROM ipobj WHERE interface = ?', [eth1.id]);
    expect(lanAddresses.map((row: { address: string }) => row.address)).to.include('192.168.50.1');
  });

  it('should reject an assignment to an interface missing on the target without writing anything', async () => {
    const result = await service.provisionPolicyFromProfile(
      { kind: 'firewall', id: targetFirewall.id },
      provision,
      fwc.fwcloud.id,
      'replace_defaults',
      { ...applyOptions(values), interfaceNameMapping: { lan: 'eth9' } },
    );

    expect(result.errors).to.have.length(1);
    expect(result.applied).to.be.false;

    const interfaces = await db
      .getSource()
      .query('SELECT id FROM interface WHERE firewall = ?', [targetFirewall.id]);
    expect(interfaces).to.be.empty;
  });

  async function policySpecials(type: number): Promise<number[]> {
    const rows = await db
      .getSource()
      .query('SELECT special FROM policy_r WHERE firewall = ? AND type = ? ORDER BY rule_order', [
        targetFirewall.id,
        type,
      ]);

    return rows.map((row: { special: number }) => Number(row.special));
  }

  it('should replace the default rules of the policies the profile fills, keeping the stateful rule', async () => {
    await PolicyRule.insertDefaultPolicy(targetFirewall.id, null, FireWallOptMask.STATEFUL);

    const result = await service.provisionPolicyFromProfile(
      { kind: 'firewall', id: targetFirewall.id },
      provision,
      fwc.fwcloud.id,
      'replace_defaults',
      applyOptions(values),
    );

    expect(result.errors).to.be.empty;
    // The profile rule is IPv4 FORWARD: only that catch-all goes; the stateful rule stays.
    expect(result.removedDefaultRules).to.have.length(1);
    expect(await policySpecials(3)).to.deep.eq([1, 0]);
    // Policies the profile does not touch keep their default rules.
    expect(await policySpecials(1)).to.deep.eq([1, 2]);
    expect(await policySpecials(63)).to.deep.eq([1, 2]);
  });

  it('should keep the default rules in merge mode', async () => {
    await PolicyRule.insertDefaultPolicy(targetFirewall.id, null, FireWallOptMask.STATEFUL);

    const result = await service.provisionPolicyFromProfile(
      { kind: 'firewall', id: targetFirewall.id },
      provision,
      fwc.fwcloud.id,
      'merge',
      applyOptions(values),
    );

    expect(result.errors).to.be.empty;
    expect(result.removedDefaultRules).to.be.empty;
    expect(await policySpecials(3)).to.include(2);
  });

  it('should not add a default policy to a target without one', async () => {
    const result = await service.provisionPolicyFromProfile(
      { kind: 'firewall', id: targetFirewall.id },
      provision,
      fwc.fwcloud.id,
      'replace_defaults',
      applyOptions(values),
    );

    expect(result.errors).to.be.empty;

    const rules = await db
      .getSource()
      .query('SELECT id FROM policy_r WHERE firewall = ?', [targetFirewall.id]);
    expect(rules).to.have.length(result.createdRules.length);
  });

  it('should let a supplied port override the declared default', async () => {
    await service.provisionPolicyFromProfile(
      { kind: 'firewall', id: targetFirewall.id },
      provision,
      fwc.fwcloud.id,
      'replace_defaults',
      applyOptions({ ...values, APP_PORT: 8443 }),
    );

    expect(await countIpObjs('type = 2 AND destination_port_start = ?', [8443])).to.be.eq(1);
    expect(await countIpObjs('type = 2 AND destination_port_start = ?', [800])).to.be.eq(0);
  });

  it('should reuse equivalent objects instead of duplicating them on re-apply', async () => {
    await service.provisionPolicyFromProfile(
      { kind: 'firewall', id: targetFirewall.id },
      provision,
      fwc.fwcloud.id,
      'replace_defaults',
      applyOptions(values),
    );
    await service.provisionPolicyFromProfile(
      { kind: 'firewall', id: targetFirewall.id },
      provision,
      fwc.fwcloud.id,
      'replace_defaults',
      applyOptions(values),
    );

    // Objects are resolved, not blindly created: still exactly one of each.
    expect(await countIpObjs('type = 7 AND address = ?', ['192.168.50.0'])).to.be.eq(1);
    expect(await countIpObjs('type = 2 AND destination_port_start = ?', [800])).to.be.eq(1);

    // And the interfaces are reused rather than duplicated.
    const interfaces = await db
      .getSource()
      .query('SELECT id FROM interface WHERE firewall = ?', [targetFirewall.id]);
    expect(interfaces).to.have.length(2);
  });

  it('should record the object bindings of the applied profile version', async () => {
    await service.provisionPolicyFromProfile(
      { kind: 'firewall', id: targetFirewall.id },
      provision,
      fwc.fwcloud.id,
      'replace_defaults',
      applyOptions(values),
    );

    const bindings = await db
      .getSource()
      .query(
        'SELECT binding_kind, binding_key FROM profile_object_binding WHERE profile_code = ? AND target_firewall = ?',
        ['edge-test', targetFirewall.id],
      );

    const keys = bindings.map((row) => `${row.binding_kind}:${row.binding_key}`);
    expect(keys).to.include('interface:wan');
    expect(keys).to.include('interface:lan');
    expect(keys).to.include('ipobj:wan:address:0');
  });

  it('should skip an equivalent rule in merge mode', async () => {
    await service.provisionPolicyFromProfile(
      { kind: 'firewall', id: targetFirewall.id },
      provision,
      fwc.fwcloud.id,
      'replace_defaults',
      applyOptions(values),
    );

    const merged = await service.provisionPolicyFromProfile(
      { kind: 'firewall', id: targetFirewall.id },
      provision,
      fwc.fwcloud.id,
      'merge',
      applyOptions(values),
    );

    expect(merged.createdRules).to.be.empty;
    expect(merged.conflicts.map((conflict) => conflict.type)).to.include('duplicated_rule');
  });

  describe('native rule options', () => {
    const apply = (mode: 'replace_defaults' | 'merge' | 'dry_run' = 'replace_defaults') =>
      service.provisionPolicyFromProfile(
        { kind: 'firewall', id: targetFirewall.id },
        provision,
        fwc.fwcloud.id,
        mode,
        applyOptions(values),
      );

    it('should distinguish options in merge mode and skip only rules with the same behavior', async () => {
      // The original legacy rule has no options field and behaves exactly like explicit zero.
      const legacy = await apply();
      expect(legacy.errors).to.be.empty;
      const [legacyRow] = await db
        .getSource()
        .query('SELECT options FROM policy_r WHERE id = ?', [legacy.createdRules[0].targetRuleId]);
      expect(legacyRow.options).to.equal(0);
      for (const options of [4, 2, 6, 1, 5]) {
        provision.rules[0].options = options;
        const added = await apply('merge');
        expect(added.errors).to.be.empty;
        expect(added.createdRules).to.have.length(1);
        expect(added.conflicts).to.be.empty;
        const [row] = await db
          .getSource()
          .query('SELECT options FROM policy_r WHERE id = ?', [added.createdRules[0].targetRuleId]);
        expect(row.options).to.equal(options);
        const duplicate = await apply('merge');
        expect(duplicate.createdRules).to.be.empty;
        expect(duplicate.conflicts.map((conflict) => conflict.type)).to.include('duplicated_rule');
      }
      provision.rules[0].options = 0;
      const explicitZero = await apply('merge');
      expect(explicitZero.createdRules).to.be.empty;
      expect(explicitZero.conflicts.map((conflict) => conflict.type)).to.include('duplicated_rule');
    });

    for (const mode of ['replace_defaults', 'merge', 'dry_run'] as const) {
      it(`should reject malformed options before writing any policy data in ${mode}`, async () => {
        const before = await db
          .getSource()
          .query('SELECT * FROM policy_r WHERE firewall = ?', [targetFirewall.id]);
        for (const options of [null, false, true, '6', -1, 1.5, 0x10000, {}, []]) {
          provision.rules = [
            provision.rules[0],
            { ...provision.rules[0], options: options as number },
          ];
          const result = await apply(mode);
          expect(result.applied).to.be.false;
          expect(result.errors.join(' ')).to.include('options must be an integer');
          expect(result.createdRules).to.be.empty;
        }
        expect(
          await db
            .getSource()
            .query('SELECT * FROM policy_r WHERE firewall = ?', [targetFirewall.id]),
        ).to.deep.eq(before);
      });
    }
  });

  describe('position negation', () => {
    const apply = (mode: 'replace_defaults' | 'merge' | 'dry_run' = 'replace_defaults') =>
      service.provisionPolicyFromProfile(
        { kind: 'firewall', id: targetFirewall.id },
        provision,
        fwc.fwcloud.id,
        mode,
        applyOptions(values),
      );

    it('should preserve negated positions independently of the other rule positions', async () => {
      provision.rules[0].negate = '25 9 22 7 7';
      provision.rules[0].destination = [{ kind: 'address', value: '203.0.113.10' }];

      const result = await apply();

      expect(result.errors).to.be.empty;
      expect(result.applied).to.be.true;
      const [rule] = await db
        .getSource()
        .query('SELECT negate FROM policy_r WHERE id = ?', [result.createdRules[0].targetRuleId]);
      expect(rule.negate).to.equal('7 9 22 25');
      const positions = await db
        .getSource()
        .query('SELECT position FROM policy_r__ipobj WHERE rule = ? ORDER BY position', [
          result.createdRules[0].targetRuleId,
        ]);
      // Destination is populated but is deliberately not negated.
      expect(positions.map((row) => row.position)).to.deep.equal([7, 8, 9]);
    });

    it('should leave positions unnegated for legacy templates', async () => {
      const result = await apply();

      expect(result.errors).to.be.empty;
      const [rule] = await db
        .getSource()
        .query('SELECT negate FROM policy_r WHERE id = ?', [result.createdRules[0].targetRuleId]);
      expect(rule.negate).to.be.null;
    });

    it('should apply negated rules to the master policy of a target cluster', async () => {
      const manager = db.getSource().manager;
      const cluster = await manager.getRepository(Cluster).save({
        name: StringHelper.randomize(10),
        fwCloudId: fwc.fwcloud.id,
      });
      targetFirewall.clusterId = cluster.id;
      targetFirewall.fwmaster = 1;
      await manager.getRepository(Firewall).save(targetFirewall);
      const backup = await manager.getRepository(Firewall).save({
        name: StringHelper.randomize(10),
        fwCloudId: fwc.fwcloud.id,
        clusterId: cluster.id,
        fwmaster: 0,
      });
      provision.rules[0].negate = '7 22';

      const result = await service.provisionPolicyFromProfile(
        { kind: 'cluster', id: cluster.id },
        provision,
        fwc.fwcloud.id,
        'replace_defaults',
        applyOptions(values),
      );

      expect(result.errors).to.be.empty;
      expect(result.applied).to.be.true;
      const [rule] = await db
        .getSource()
        .query('SELECT firewall, negate FROM policy_r WHERE id = ?', [
          result.createdRules[0].targetRuleId,
        ]);
      expect(rule.firewall).to.equal(targetFirewall.id);
      expect(rule.negate).to.equal('7 22');
      expect(await db.getSource().query('SELECT id FROM policy_r WHERE firewall = ?', [backup.id]))
        .to.be.empty;
    });

    it('should distinguish negated rules in merge mode and normalize equivalent negation lists', async () => {
      const original = await apply();
      expect(original.errors).to.be.empty;

      provision.rules[0].negate = '9 7';
      const negated = await apply('merge');
      expect(negated.errors).to.be.empty;
      expect(negated.createdRules).to.have.length(1);
      expect(negated.conflicts).to.be.empty;

      // Existing native policies can store the same positions in a different order.
      await db
        .getSource()
        .query('UPDATE policy_r SET negate = ? WHERE id = ?', [
          '9 7',
          negated.createdRules[0].targetRuleId,
        ]);
      provision.rules[0].negate = ' 7  9 7 ';
      const duplicate = await apply('merge');
      expect(duplicate.errors).to.be.empty;
      expect(duplicate.createdRules).to.be.empty;
      expect(duplicate.conflicts.map((conflict) => conflict.type)).to.include('duplicated_rule');
    });

    for (const mode of ['replace_defaults', 'merge', 'dry_run'] as const) {
      it(`should reject invalid negation before writing interfaces, objects or rules in ${mode}`, async () => {
        for (const negate of ['invalid', '7 43', '999', '14', true, 7, ['7']]) {
          // An invalid later rule must also prevent the earlier valid one from being applied.
          const invalid = { ...provision.rules[0], negate: negate as unknown as string };
          provision.rules = [provision.rules[0], invalid];

          const result = await apply(mode);
          expect(result.applied, String(negate)).to.be.false;
          expect(result.errors, String(negate)).not.to.be.empty;
          expect(result.createdRules, String(negate)).to.be.empty;
        }

        expect(
          await db
            .getSource()
            .query('SELECT id FROM interface WHERE firewall = ?', [targetFirewall.id]),
        ).to.be.empty;
        expect(
          await db
            .getSource()
            .query('SELECT id FROM policy_r WHERE firewall = ?', [targetFirewall.id]),
        ).to.be.empty;
        expect(await countIpObjs('type = 7 AND address = ?', ['192.168.50.0'])).to.equal(0);
      });
    }
  });

  it('should validate without writing anything in dry-run mode', async () => {
    const result = await service.provisionPolicyFromProfile(
      { kind: 'firewall', id: targetFirewall.id },
      provision,
      fwc.fwcloud.id,
      'dry_run',
      applyOptions(values),
    );

    expect(result.applied).to.be.false;
    expect(result.errors).to.be.empty;
    expect(result.createdRules).to.have.length(1);
    expect(result.createdRules[0].targetRuleId).to.be.null;

    const interfaces = await db
      .getSource()
      .query('SELECT id FROM interface WHERE firewall = ?', [targetFirewall.id]);
    expect(interfaces).to.be.empty;
    expect(await countIpObjs('type = 7 AND address = ?', ['192.168.50.0'])).to.be.eq(0);
  });

  describe('VPN client references', () => {
    const VPN_MODEL = {
      provision: {
        interfaces: [{ name: 'LAN', role: 'lan' }],
        rules: [
          {
            chain: 'forward',
            action: 'accept',
            inRole: 'lan',
            outRole: 'lan',
            source: [{ type: 'vpnClient', vpnId: 'office', name: 'Office' }],
            comment: 'Office VPN',
          },
        ],
      },
    };

    const provisionVpn = (
      mode: 'dry_run' | 'replace_defaults',
      options: Parameters<typeof service.provisionPolicyFromProfile>[4],
    ) =>
      service.provisionPolicyFromProfile(
        { kind: 'firewall', id: targetFirewall.id },
        getProfileProvisioning(VPN_MODEL),
        fwc.fwcloud.id,
        mode,
        options,
      );

    it('should preview a rule that references a VPN client without writing anything', async () => {
      const result = await provisionVpn('dry_run', {
        vpnConfigIds: new Map([['office', { id: 0, protocol: 'openvpn' }]]),
      });

      expect(result.errors).to.be.empty;
      expect(result.createdRules).to.have.length(1);
      expect(result.createdRules[0].targetRuleId).to.be.null;
      expect(await db.getSource().query('SELECT rule FROM policy_r__openvpn WHERE openvpn = 0')).to
        .be.empty;
    });

    it('should link the rule to the real VPN client through the OpenVPN relation table', async () => {
      const client = fwc.openvpnClients.get('OpenVPN-Cli-1');

      const result = await provisionVpn('replace_defaults', {
        vpnConfigIds: new Map([['office', { id: client.id, protocol: 'openvpn' }]]),
      });

      expect(result.errors).to.be.empty;
      expect(result.applied).to.be.true;

      const links = await db
        .getSource()
        .query('SELECT openvpn, position FROM policy_r__openvpn WHERE rule = ?', [
          result.createdRules[0].targetRuleId,
        ]);
      expect(links).to.have.length(1);
      expect(links[0].openvpn).to.be.eq(client.id);
      // Nothing about it goes through the generic object table.
      expect(
        await db
          .getSource()
          .query('SELECT rule FROM policy_r__ipobj WHERE rule = ?', [
            result.createdRules[0].targetRuleId,
          ]),
      ).to.be.empty;
    });

    it('should link the rule to an IPsec client through the IPsec relation table', async () => {
      const client = fwc.ipsecClients.get('IPSec-Cli-1');

      const result = await provisionVpn('replace_defaults', {
        vpnConfigIds: new Map([['office', { id: client.id, protocol: 'ipsec' }]]),
      });

      expect(result.errors).to.be.empty;
      const links = await db
        .getSource()
        .query('SELECT ipsec FROM policy_r__ipsec WHERE rule = ?', [
          result.createdRules[0].targetRuleId,
        ]);
      expect(links.map((link: { ipsec: number }) => link.ipsec)).to.deep.equal([client.id]);
    });

    it('should refuse a VPN client that has not been created', async () => {
      const result = await provisionVpn('replace_defaults', {});

      expect(result.applied).to.be.false;
      expect(result.errors.join(' ')).to.include('has not been created yet');
    });
  });

  it('should report a missing required parameter instead of writing a partial policy', async () => {
    const result = await service.provisionPolicyFromProfile(
      { kind: 'firewall', id: targetFirewall.id },
      provision,
      fwc.fwcloud.id,
      'replace_defaults',
      applyOptions({ LAN_IP: '192.168.50.1/24', LAN_NET: '192.168.50.0/24' }),
    );

    expect(result.applied).to.be.false;
    expect(result.errors.join(' ')).to.contain('WAN_IP');

    const interfaces = await db
      .getSource()
      .query('SELECT id FROM interface WHERE firewall = ?', [targetFirewall.id]);
    expect(interfaces).to.be.empty;
  });

  it('should reject a value that does not match the parameter type', async () => {
    const result = await service.provisionPolicyFromProfile(
      { kind: 'firewall', id: targetFirewall.id },
      provision,
      fwc.fwcloud.id,
      'dry_run',
      applyOptions({ ...values, LAN_NET: 'not-a-network' }),
    );

    expect(result.errors.join(' ')).to.contain('not-a-network');
  });

  it('should provision an IPv6 INPUT rule', async () => {
    const ipv6Provision = getProfileProvisioning({
      provision: {
        interfaces: [{ name: 'WAN', role: 'wan', addresses: [{ value: 'fd00::1/64' }] }],
        rules: [
          {
            chain: 'input',
            ipVersion: 6,
            action: 'accept',
            inRole: 'wan',
            services: [{ protocol: 'tcp', port: 22 }],
          },
        ],
      },
    });

    const result = await service.provisionPolicyFromProfile(
      { kind: 'firewall', id: targetFirewall.id },
      ipv6Provision,
      fwc.fwcloud.id,
    );

    expect(result.errors).to.be.empty;
    // 61 is IPv6:INPUT in PolicyTypesMap.
    expect(result.createdRules[0].policyTypeId).to.be.eq(61);
  });

  describe('interface addresses in the firewalls tree', () => {
    // The tree the UI loads: without a node of its own an address exists but is not shown.
    async function createFirewallTree(): Promise<void> {
      const rootId = await Tree.newNode(
        db.getQuery(),
        fwc.fwcloud.id,
        'FIREWALLS',
        null,
        'FDF',
        null,
        null,
      );

      await Tree.insertFwc_Tree_New_firewall(fwc.fwcloud.id, rootId, targetFirewall.id);
    }

    /** The address nodes each interface shows, as the tree is dumped for the UI. */
    async function shownAddresses(): Promise<Record<string, string[]>> {
      const find = (node: TreeNode, type: string): TreeNode[] =>
        node.node_type === type ? [node] : node.children.flatMap((child) => find(child, type));
      const tree = await Tree.dumpTree(db.getQuery(), 'FIREWALLS', fwc.fwcloud.id);

      return Object.fromEntries(
        find(tree, 'IFF').map((node) => [
          node.text,
          node.children.filter((child) => child.node_type === 'OIA').map((child) => child.text),
        ]),
      );
    }

    const apply = (
      applied: PolicyReplicationProvision = provision,
      options: Record<string, unknown> = {},
      mode: 'replace_defaults' | 'dry_run' = 'replace_defaults',
    ) =>
      service.provisionPolicyFromProfile(
        { kind: 'firewall', id: targetFirewall.id },
        applied,
        fwc.fwcloud.id,
        mode,
        { ...applyOptions(values), ...options },
      );

    it('should show the address of each created interface without repairing the tree', async () => {
      await createFirewallTree();

      const result = await apply();

      expect(result.applied).to.be.true;
      expect(await shownAddresses()).to.deep.eq({
        WAN: ['WAN-ip (198.51.100.10)'],
        LAN: ['LAN-ip (192.168.50.1)'],
      });

      // Each node points at the address it shows.
      const nodes = await db.getSource().query(
        `SELECT O.address FROM fwc_tree T INNER JOIN ipobj O ON O.id = T.id_obj
          WHERE T.fwcloud = ? AND T.node_type = 'OIA' AND T.obj_type = 5 ORDER BY T.id`,
        [fwc.fwcloud.id],
      );
      expect(nodes.map((row: { address: string }) => row.address)).to.deep.eq([
        '198.51.100.10',
        '192.168.50.1',
      ]);
    });

    it('should show every address of an interface that declares several', async () => {
      await createFirewallTree();

      await apply(
        getProfileProvisioning({
          provision: {
            interfaces: [
              {
                name: 'WAN',
                role: 'wan',
                addresses: [{ value: '198.51.100.10/24' }, { value: '198.51.100.11/24' }],
              },
            ],
            rules: [],
          },
        }),
      );

      expect(await shownAddresses()).to.deep.eq({
        WAN: ['WAN-ip (198.51.100.10)', 'WAN-ip2 (198.51.100.11)'],
      });
    });

    it('should show the address given to an interface that already was on the target', async () => {
      await db.getSource().manager.getRepository(Interface).save({
        name: 'eth1',
        type: '10',
        interface_type: '10',
        firewallId: targetFirewall.id,
      });
      await createFirewallTree();

      await apply(provision, { interfaceNameMapping: { lan: 'eth1' } });

      expect(await shownAddresses()).to.deep.eq({
        WAN: ['WAN-ip (198.51.100.10)'],
        eth1: ['LAN-ip (192.168.50.1)'],
      });
    });

    it('should not show an address twice when the profile is applied again', async () => {
      await createFirewallTree();

      await apply();
      await apply();

      expect(await shownAddresses()).to.deep.eq({
        WAN: ['WAN-ip (198.51.100.10)'],
        LAN: ['LAN-ip (192.168.50.1)'],
      });
    });

    it('should not show addresses that a dry run or a rejected apply did not create', async () => {
      await createFirewallTree();

      await apply(provision, {}, 'dry_run');
      const rejected = await apply(provision, { interfaceNameMapping: { lan: 'eth9' } });

      expect(rejected.applied).to.be.false;
      expect(await shownAddresses()).to.deep.eq({});
    });
  });
});
