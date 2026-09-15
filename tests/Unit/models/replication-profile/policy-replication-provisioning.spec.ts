import { describeName, expect, testSuite } from '../../../mocha/global-setup';
import { Application } from '../../../../src/Application';
import db from '../../../../src/database/database-manager';
import { FwCloudFactory, FwCloudProduct } from '../../../utils/fwcloud-factory';
import { Firewall, FireWallOptMask } from '../../../../src/models/firewall/Firewall';
import { Interface } from '../../../../src/models/interface/Interface';
import { PolicyRule } from '../../../../src/models/policy/PolicyRule';
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
});
