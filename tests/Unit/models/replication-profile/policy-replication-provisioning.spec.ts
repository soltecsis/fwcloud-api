import { describeName, expect, testSuite } from '../../../mocha/global-setup';
import { Application } from '../../../../src/Application';
import db from '../../../../src/database/database-manager';
import { FwCloudFactory, FwCloudProduct } from '../../../utils/fwcloud-factory';
import { Firewall, FireWallOptMask } from '../../../../src/models/firewall/Firewall';
import { Cluster } from '../../../../src/models/firewall/Cluster';
import { Interface } from '../../../../src/models/interface/Interface';
import { IPObj } from '../../../../src/models/ipobj/IPObj';
import { PolicyRule } from '../../../../src/models/policy/PolicyRule';
import { Tree, TreeNode } from '../../../../src/models/tree/Tree';
import StringHelper from '../../../../src/utils/string.helper';
import { PolicyReplicationService } from '../../../../src/models/replication-profile/policy-replication.service';
import {
  getProfileProvisioning,
  PolicyReplicationProvision,
} from '../../../../src/models/replication-profile/policy-replication.types';
import { getProfileParameters } from '../../../../src/models/replication-profile/replication-profile-parameters';
import { applyInterfaceAddressOverrides } from '../../../../src/models/replication-profile/replication-profile-interface-addresses';

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

  /** The profile applied to the target firewall, as the rule settings tests apply it. */
  const apply = (mode: 'replace_defaults' | 'merge' | 'dry_run' = 'replace_defaults') =>
    service.provisionPolicyFromProfile(
      { kind: 'firewall', id: targetFirewall.id },
      provision,
      fwc.fwcloud.id,
      mode,
      applyOptions(values),
    );

  it('should read the parameterized model into the provision vocabulary', () => {
    expect(provision.interfaces).to.have.length(2);
    expect(provision.interfaces[0].addresses).to.have.length(1);
    expect(provision.rules[0].source).to.have.length(1);
    expect(provision.rules[0].services).to.have.length(1);
  });

  for (const protocol of ['tcp', 'udp'] as const) {
    it(`should keep a legacy ${protocol} port-only template unrestricted instead of reusing a source-restricted service`, async () => {
      const restricted = await db
        .getSource()
        .manager.getRepository(IPObj)
        .save({
          name: `Restricted ${protocol}`,
          fwCloudId: fwc.fwcloud.id,
          ipObjTypeId: protocol === 'tcp' ? 2 : 4,
          protocol: protocol === 'tcp' ? 6 : 17,
          source_port_start: 1024,
          source_port_end: 65535,
          destination_port_start: 443,
          destination_port_end: 443,
        });
      const result = await service.provisionPolicyFromProfile(
        { kind: 'firewall', id: targetFirewall.id },
        getProfileProvisioning({
          provision: {
            rules: [{ chain: 'forward', action: 'accept', services: [{ protocol, port: 443 }] }],
          },
        }),
        fwc.fwcloud.id,
        'merge',
      );
      expect(result.errors).to.be.empty;
      const [row] = await db
        .getSource()
        .query(
          'SELECT O.* FROM policy_r__ipobj R INNER JOIN ipobj O ON O.id = R.ipobj WHERE R.rule = ? AND R.position = 9',
          [result.createdRules[0].targetRuleId],
        );
      expect(Number(row.id)).not.to.eq(restricted.id);
      expect(row).to.include({
        source_port_start: 0,
        source_port_end: 0,
        destination_port_start: 443,
        destination_port_end: 443,
      });
      expect(
        await db.getSource().manager.getRepository(IPObj).findOneByOrFail({ id: restricted.id }),
      ).to.include({ source_port_start: 1024, source_port_end: 65535 });
    });
  }

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

  it('should preserve native IPv6 address settings when deployment overrides select an address', async () => {
    const model = {
      parameters: [{ name: 'V6', type: 'address', ipVersion: 6, default: '2001:db8::10/127' }],
      provision: {
        interfaces: [
          {
            name: 'eth0',
            role: 'lan',
            addresses: [
              {
                name: 'Original IPv6',
                value: { param: 'V6' },
                ipVersion: 6,
                comment: 'Original comment',
                diff_serv: 12,
                options: '0',
              },
            ],
          },
        ],
      },
    };
    const captured = getProfileProvisioning(model);
    expect(
      await applyInterfaceAddressOverrides(
        captured,
        { lan: [{ name: 'Selected IPv6', value: '2001:0DB8::20/127' }] },
        getProfileParameters(model),
        undefined,
        fwc.fwcloud.id,
      ),
    ).to.be.empty;
    const result = await service.provisionPolicyFromProfile(
      { kind: 'firewall', id: targetFirewall.id },
      captured,
      fwc.fwcloud.id,
      'merge',
      { parameters: getProfileParameters(model) },
    );
    expect(result.errors).to.be.empty;
    expect(result.applied).to.equal(true);
    const [row] = await db
      .getSource()
      .query(
        'SELECT O.* FROM ipobj O JOIN interface I ON I.id = O.interface WHERE I.firewall = ?',
        [targetFirewall.id],
      );
    expect(row).to.include({
      name: 'Selected IPv6',
      address: '2001:0DB8::20',
      netmask: '/127',
      ip_version: 6,
      comment: 'Original comment',
      diff_serv: 12,
      options: '0',
    });
  });

  it('should preserve unset captured IPv6 settings instead of reusing different destination settings', async () => {
    const iface = await db.getSource().manager.getRepository(Interface).save({
      name: 'eth0',
      type: '10',
      interface_type: '10',
      firewallId: targetFirewall.id,
    });
    const existing = await db.getSource().manager.getRepository(IPObj).save({
      name: 'IPv6',
      address: '2001:db8::1',
      netmask: '/64',
      ip_version: 6,
      ipObjTypeId: 5,
      fwCloudId: fwc.fwcloud.id,
      interfaceId: iface.id,
      comment: 'Destination comment',
      diff_serv: 12,
      options: '1',
    });
    const result = await service.provisionPolicyFromProfile(
      { kind: 'firewall', id: targetFirewall.id },
      getProfileProvisioning({
        provision: {
          interfaces: [
            {
              name: 'eth0',
              role: 'lan',
              addresses: [
                {
                  name: 'IPv6',
                  value: '2001:db8::1/64',
                  ipVersion: 6,
                  comment: null,
                  diff_serv: null,
                  options: null,
                },
              ],
            },
          ],
        },
      }),
      fwc.fwcloud.id,
      'merge',
    );
    expect(result.errors).to.be.empty;
    expect(result.applied).to.equal(true);
    const rows = await db
      .getSource()
      .manager.getRepository(IPObj)
      .findBy({ interfaceId: iface.id });
    expect(rows).to.have.length(2);
    expect(rows.find((row) => row.id !== existing.id)).to.include({
      ip_version: 6,
      address: '2001:db8::1',
      netmask: '/64',
      comment: null,
      diff_serv: null,
      options: null,
    });
    expect(rows.find((row) => row.id === existing.id)).to.include({
      comment: 'Destination comment',
      diff_serv: 12,
      options: '1',
    });
  });

  for (const address of [
    { value: '2001:db8:::1/64' },
    { value: '2001:db8::1/129' },
    { value: '2001:db8::1/64/128' },
    { value: '2001:db8::1/64', ipVersion: 4 },
    { value: '2001:db8::1/64', options: 'invalid' },
  ]) {
    it(`should reject invalid IPv6 configuration before writing any interfaces: ${JSON.stringify(address)}`, async () => {
      const result = await service.provisionPolicyFromProfile(
        { kind: 'firewall', id: targetFirewall.id },
        getProfileProvisioning({
          provision: {
            interfaces: [
              { name: 'valid-first', role: 'first', addresses: ['192.0.2.1/24'] },
              { name: 'invalid-second', role: 'second', addresses: [address] },
            ],
          },
        }),
        fwc.fwcloud.id,
        'merge',
      );
      expect(result.applied).to.equal(false);
      expect(result.errors).to.have.length(1);
      expect(result.errors[0]).to.include('invalid-second').and.to.include(address.value);
      expect(
        await db
          .getSource()
          .manager.getRepository(Interface)
          .countBy({ firewallId: targetFirewall.id }),
      ).to.equal(0);
    });
  }

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

  describe('rule validity periods', () => {
    it('should merge rules with different dates and recognize equivalent instants', async () => {
      expect((await apply()).createdRules).to.have.length(1);
      for (const period of [
        { time_start: '2026-10-01T08:15:30+02:00', time_end: '2026-10-31T19:45:59+01:00' },
        { time_start: '2026-10-01T08:15:30+02:00', time_end: null },
        { time_start: null, time_end: '2026-10-31T19:45:59+01:00' },
        { time_start: '2026-10-02T08:15:30+02:00', time_end: '2026-10-31T19:45:59+01:00' },
      ]) {
        Object.assign(provision.rules[0], period);
        const added = await apply('merge');
        expect(added.errors).to.be.empty;
        expect(added.createdRules).to.have.length(1);
        const [row] = await db
          .getSource()
          .query('SELECT time_start, time_end FROM policy_r WHERE id = ?', [
            added.createdRules[0].targetRuleId,
          ]);
        for (const field of ['time_start', 'time_end'] as const) {
          expect(row[field]?.getTime() ?? null).to.eq(
            period[field] ? Date.parse(period[field]) : null,
          );
          provision.rules[0][field] = period[field] ? new Date(period[field]).toISOString() : null;
        }
        const duplicate = await apply('merge');
        expect(duplicate.errors).to.be.empty;
        expect(duplicate.createdRules).to.be.empty;
        expect(duplicate.conflicts.map((conflict) => conflict.type)).to.include('duplicated_rule');
      }
      provision.rules[0].time_start = null;
      provision.rules[0].time_end = '';
      expect((await apply('merge')).createdRules).to.be.empty;
    });
  });

  describe('native rule options', () => {
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

  describe('rule states', () => {
    const COMMENTS = ['Allow HTTP', 'Allow SSH', 'Allow HTTPS'];
    const STATES = [true, false, true];

    beforeEach(() => {
      provision.rules = COMMENTS.map((comment, index) => ({
        ...provision.rules[0],
        active: STATES[index],
        comment,
      }));
    });

    const appliedRules = () =>
      db
        .getSource()
        .query(
          'SELECT comment, active, rule_order FROM policy_r WHERE firewall = ? AND special = 0 ORDER BY rule_order, id',
          [targetFirewall.id],
        );

    it('should preview disabled rules in their place and state without writing anything', async () => {
      const preview = await apply('dry_run');

      expect(preview.errors).to.be.empty;
      expect(
        preview.createdRules.map((rule) => [rule.comment, rule.active, rule.ruleOrder]),
      ).to.deep.eq([
        [COMMENTS[0], true, 2],
        [COMMENTS[1], false, 3],
        [COMMENTS[2], true, 4],
      ]);
      expect(await appliedRules()).to.be.empty;
    });

    it('should create disabled rules disabled and enabled rules enabled, in their order', async () => {
      const result = await apply();

      expect(result.errors).to.be.empty;
      expect(result.applied).to.be.true;
      expect(result.createdRules.map((rule) => rule.active)).to.deep.eq(STATES);
      const rows = await appliedRules();
      expect(rows.map((row) => [row.comment, row.active])).to.deep.eq([
        [COMMENTS[0], 1],
        [COMMENTS[1], 0],
        [COMMENTS[2], 1],
      ]);
      expect(rows.map((row) => row.rule_order)).to.deep.eq(
        result.createdRules.map((rule) => rule.ruleOrder),
      );
    });

    it('should create the objects a disabled rule uses without enabling it', async () => {
      provision.rules = [{ ...provision.rules[0], active: false, comment: COMMENTS[1] }];

      const result = await apply();

      expect(result.errors).to.be.empty;
      expect(await countIpObjs('type = 7 AND address = ?', ['192.168.50.0'])).to.be.eq(1);
      const [rule] = await appliedRules();
      expect(rule.active).to.eq(0);
      // One source network plus one service, as for an enabled rule.
      const ruleObjects = await db
        .getSource()
        .query('SELECT ipobj FROM policy_r__ipobj WHERE rule = ?', [
          result.createdRules[0].targetRuleId,
        ]);
      expect(ruleObjects).to.have.length(2);
    });

    it('should keep legacy rules without a state enabled, as FWCloud creates them', async () => {
      provision = getProfileProvisioning(PARAMETERIZED_MODEL);
      expect(provision.rules[0]).not.to.have.property('active');

      const result = await apply();

      expect(result.errors).to.be.empty;
      expect(result.createdRules.map((rule) => rule.active)).to.deep.eq([true]);
      expect((await appliedRules()).map((row) => row.active)).to.deep.eq([1]);
    });

    it('should tell enabled and disabled rules apart in merge mode, warning about each copy', async () => {
      provision.rules = [{ ...provision.rules[1] }];
      expect((await apply()).errors).to.be.empty;

      // An enabled copy next to the disabled rule is announced by the preview and the application.
      provision.rules[0].active = true;
      const warning =
        'Rule 1: an equivalent rule already exists on the target, but disabled; this rule is added enabled.';
      const preview = await apply('dry_run');
      expect(preview.warnings).to.include(warning);
      expect(preview.createdRules.map((rule) => rule.active)).to.deep.eq([true]);
      const enabled = await apply('merge');
      expect(enabled.conflicts).to.be.empty;
      expect(enabled.warnings).to.include(warning);
      expect(enabled.createdRules.map((rule) => rule.active)).to.deep.eq([true]);

      for (const active of [true, false]) {
        provision.rules[0].active = active;
        const duplicate = await apply('merge');
        expect(duplicate.createdRules).to.be.empty;
        expect(duplicate.conflicts.map((conflict) => conflict.type)).to.include('duplicated_rule');
        expect(duplicate.warnings.join(' ')).not.to.include('this rule is added');
      }
      delete provision.rules[0].active;
      const legacy = await apply('merge');
      expect(legacy.createdRules, 'a legacy rule matches the enabled copy').to.be.empty;
      expect((await appliedRules()).map((row) => row.active)).to.deep.eq([0, 1]);
    });

    it('should warn when a disabled rule is added next to its enabled equivalent', async () => {
      provision.rules = [{ ...provision.rules[0] }];
      expect((await apply()).errors).to.be.empty;

      provision.rules[0].active = false;
      const disabled = await apply('merge');

      expect(disabled.conflicts).to.be.empty;
      expect(disabled.warnings).to.include(
        'Rule 1: an equivalent rule already exists on the target, but enabled; this rule is added disabled.',
      );
      expect((await appliedRules()).map((row) => row.active)).to.deep.eq([1, 0]);
    });

    for (const mode of ['replace_defaults', 'merge', 'dry_run'] as const) {
      it(`should reject a state that is not a boolean before writing any policy data in ${mode}`, async () => {
        const before = await db
          .getSource()
          .query('SELECT * FROM policy_r WHERE firewall = ?', [targetFirewall.id]);
        for (const active of [null, 0, 1, 'false', 'true', {}, []]) {
          provision.rules[1] = { ...provision.rules[1], active: active as boolean };
          const result = await apply(mode);
          expect(result.applied).to.be.false;
          expect(result.errors).to.deep.eq(['Rule 2: active must be a boolean.']);
          expect(result.createdRules).to.be.empty;
        }
        expect(
          await db
            .getSource()
            .query('SELECT * FROM policy_r WHERE firewall = ?', [targetFirewall.id]),
        ).to.deep.eq(before);
        expect(
          await db
            .getSource()
            .query('SELECT id FROM interface WHERE firewall = ?', [targetFirewall.id]),
        ).to.be.empty;
      });
    }
  });

  describe('position negation', () => {
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

  describe('cluster node restrictions', () => {
    const COMMENTS = ['Master only', 'Backup only', 'Every node'];
    let cluster: Cluster;
    let backup: Firewall;

    beforeEach(async () => {
      const manager = db.getSource().manager;
      cluster = await manager.getRepository(Cluster).save({
        name: StringHelper.randomize(10),
        fwCloudId: fwc.fwcloud.id,
      });
      targetFirewall.clusterId = cluster.id;
      targetFirewall.fwmaster = 1;
      await manager.getRepository(Firewall).save(targetFirewall);
      backup = await manager.getRepository(Firewall).save({
        name: StringHelper.randomize(10),
        fwCloudId: fwc.fwcloud.id,
        clusterId: cluster.id,
        fwmaster: 0,
      });
      provision.rules = [
        { ...provision.rules[0], nodeRole: 'master', comment: COMMENTS[0] },
        { ...provision.rules[0], nodeRole: 'backup', comment: COMMENTS[1] },
        { ...provision.rules[0], comment: COMMENTS[2] },
      ];
    });

    const applyToCluster = (
      nodeRoleMapping: Record<string, number> | undefined,
      mode: 'replace_defaults' | 'merge' | 'dry_run' = 'replace_defaults',
    ) =>
      service.provisionPolicyFromProfile(
        { kind: 'cluster', id: cluster.id },
        provision,
        fwc.fwcloud.id,
        mode,
        { ...applyOptions(values), nodeRoleMapping },
      );

    const appliedNodes = () =>
      db
        .getSource()
        .query(
          'SELECT comment, fw_apply_to FROM policy_r WHERE firewall = ? AND comment IN (?) ORDER BY rule_order',
          [targetFirewall.id, COMMENTS],
        );

    async function expectNothingWritten(): Promise<void> {
      expect(await appliedNodes()).to.be.empty;
      expect(
        await db
          .getSource()
          .query('SELECT id FROM interface WHERE firewall = ?', [targetFirewall.id]),
      ).to.be.empty;
    }

    it('should restrict each rule to the destination node mapped to its role', async () => {
      const result = await applyToCluster({ master: targetFirewall.id, backup: backup.id });

      expect(result.errors).to.be.empty;
      expect(result.applied).to.be.true;
      expect(await appliedNodes()).to.deep.equal([
        { comment: COMMENTS[0], fw_apply_to: targetFirewall.id },
        { comment: COMMENTS[1], fw_apply_to: backup.id },
        { comment: COMMENTS[2], fw_apply_to: null },
      ]);
    });

    it('should keep disabled rules disabled on the node mapped to their role', async () => {
      provision.rules[1].active = false;
      provision.rules[2].active = false;

      const preview = await applyToCluster(
        { master: targetFirewall.id, backup: backup.id },
        'dry_run',
      );
      expect(preview.createdRules.map((rule) => rule.active)).to.deep.eq([true, false, false]);
      const result = await applyToCluster({ master: targetFirewall.id, backup: backup.id });

      expect(result.errors).to.be.empty;
      expect(
        await db
          .getSource()
          .query(
            'SELECT comment, fw_apply_to, active FROM policy_r WHERE firewall = ? AND comment IN (?) ORDER BY rule_order',
            [targetFirewall.id, COMMENTS],
          ),
      ).to.deep.equal([
        { comment: COMMENTS[0], fw_apply_to: targetFirewall.id, active: 1 },
        { comment: COMMENTS[1], fw_apply_to: backup.id, active: 0 },
        { comment: COMMENTS[2], fw_apply_to: null, active: 0 },
      ]);
    });

    it('should follow the node role mapping instead of node positions', async () => {
      const result = await applyToCluster({ master: backup.id, backup: targetFirewall.id });

      expect(result.errors).to.be.empty;
      expect(await appliedNodes()).to.deep.equal([
        { comment: COMMENTS[0], fw_apply_to: backup.id },
        { comment: COMMENTS[1], fw_apply_to: targetFirewall.id },
        { comment: COMMENTS[2], fw_apply_to: null },
      ]);
    });

    for (const mode of ['replace_defaults', 'merge', 'dry_run'] as const) {
      it(`should reject a node role without a destination node before writing anything in ${mode}`, async () => {
        for (const mapping of [undefined, {}, { master: targetFirewall.id }]) {
          const result = await applyToCluster(mapping, mode);

          expect(result.applied, JSON.stringify(mapping)).to.be.false;
          expect(result.createdRules, JSON.stringify(mapping)).to.be.empty;
          expect(result.errors, JSON.stringify(mapping)).to.include(
            'Rule 2 node: cluster node role "backup" is not assigned to a node of the target cluster.',
          );
        }
        await expectNothingWritten();
      });
    }

    it('should reject a destination node that belongs to another cluster', async () => {
      const otherCluster = await db
        .getSource()
        .manager.getRepository(Cluster)
        .save({ name: StringHelper.randomize(10), fwCloudId: fwc.fwcloud.id });
      const outsider = await db
        .getSource()
        .manager.getRepository(Firewall)
        .save({
          name: StringHelper.randomize(10),
          fwCloudId: fwc.fwcloud.id,
          clusterId: otherCluster.id,
          fwmaster: 1,
        });

      const result = await applyToCluster({ master: targetFirewall.id, backup: outsider.id });

      expect(result.applied).to.be.false;
      expect(result.errors).to.deep.equal([
        'Rule 2 node: cluster node role "backup" is not assigned to a node of the target cluster.',
      ]);
      await expectNothingWritten();
    });

    it('should reject two node roles assigned to the same destination node', async () => {
      const result = await applyToCluster({ master: backup.id, backup: backup.id });

      expect(result.applied).to.be.false;
      expect(result.errors).to.deep.equal([
        'Rule 1 node: cluster node roles "master" and "backup" are assigned to the same node; each role needs a node of its own.',
        'Rule 2 node: cluster node roles "backup" and "master" are assigned to the same node; each role needs a node of its own.',
      ]);
      await expectNothingWritten();
    });

    it('should reject a node restriction on a firewall target', async () => {
      const firewall = await db
        .getSource()
        .manager.getRepository(Firewall)
        .save({ name: StringHelper.randomize(10), fwCloudId: fwc.fwcloud.id });

      const result = await service.provisionPolicyFromProfile(
        { kind: 'firewall', id: firewall.id },
        provision,
        fwc.fwcloud.id,
        'replace_defaults',
        { ...applyOptions(values), nodeRoleMapping: { master: firewall.id } },
      );

      expect(result.applied).to.be.false;
      expect(result.errors).to.deep.equal([
        'Rule 1: it only applies to cluster node "master", but the target is not a cluster.',
        'Rule 2: it only applies to cluster node "backup", but the target is not a cluster.',
      ]);
      expect(
        await db.getSource().query('SELECT id FROM policy_r WHERE firewall = ?', [firewall.id]),
      ).to.be.empty;
    });

    for (const mode of ['replace_defaults', 'merge', 'dry_run'] as const) {
      it(`should reject malformed node roles instead of applying the rule to every node in ${mode}`, async () => {
        for (const nodeRole of [null, '', ' ', 2, ['backup'], { role: 'backup' }]) {
          provision.rules[1].nodeRole = nodeRole as unknown as string;

          const result = await applyToCluster(
            { master: targetFirewall.id, backup: backup.id },
            mode,
          );

          expect(result.applied, JSON.stringify(nodeRole)).to.be.false;
          expect(result.createdRules, JSON.stringify(nodeRole)).to.be.empty;
          expect(result.errors, JSON.stringify(nodeRole)).to.deep.equal([
            'Rule 2: nodeRole must name a cluster node; leave it out to apply the rule to every node.',
          ]);
        }
        await expectNothingWritten();
      });
    }

    it('should tell rules on different nodes apart in merge mode', async () => {
      const mapping = { master: targetFirewall.id, backup: backup.id };
      const everyNode = provision.rules[2];
      provision.rules = [everyNode];
      expect((await applyToCluster(mapping)).errors).to.be.empty;

      // The same rule restricted to one node is a different rule...
      provision.rules = [{ ...everyNode, nodeRole: 'backup' }];
      const restricted = await applyToCluster(mapping, 'merge');
      expect(restricted.errors).to.be.empty;
      expect(restricted.conflicts).to.be.empty;
      expect(restricted.createdRules).to.have.length(1);

      // ...which is recognized once it exists.
      const again = await applyToCluster(mapping, 'merge');
      expect(again.errors).to.be.empty;
      expect(again.createdRules).to.be.empty;
      expect(again.conflicts.map((conflict) => conflict.type)).to.deep.equal(['duplicated_rule']);
    });
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

    const applyProvision = (
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

      const result = await applyProvision();

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

      await applyProvision(
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

      await applyProvision(provision, { interfaceNameMapping: { lan: 'eth1' } });

      expect(await shownAddresses()).to.deep.eq({
        WAN: ['WAN-ip (198.51.100.10)'],
        eth1: ['LAN-ip (192.168.50.1)'],
      });
    });

    it('should not show an address twice when the profile is applied again', async () => {
      await createFirewallTree();

      await applyProvision();
      await applyProvision();

      expect(await shownAddresses()).to.deep.eq({
        WAN: ['WAN-ip (198.51.100.10)'],
        LAN: ['LAN-ip (192.168.50.1)'],
      });
    });

    it('should not show addresses that a dry run or a rejected apply did not create', async () => {
      await createFirewallTree();

      await applyProvision(provision, {}, 'dry_run');
      const rejected = await applyProvision(provision, { interfaceNameMapping: { lan: 'eth9' } });

      expect(rejected.applied).to.be.false;
      expect(await shownAddresses()).to.deep.eq({});
    });
  });
});
