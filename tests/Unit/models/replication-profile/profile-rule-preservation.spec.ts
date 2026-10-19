import 'reflect-metadata';
import { strict as assert } from 'node:assert';
import sinon from 'sinon';
import db from '../../../../src/database/database-manager';
import {
  DefaultPolicyRuleComments,
  PolicyRule,
  SpecialPolicyRules,
} from '../../../../src/models/policy/PolicyRule';
import { PolicyTypesMap } from '../../../../src/models/policy/PolicyType';
import {
  PolicyReplicationService,
  getProvisionRulePositions,
} from '../../../../src/models/replication-profile/policy-replication.service';
import {
  createPolicyReplicationResult,
  getProfileProvisioning,
} from '../../../../src/models/replication-profile/policy-replication.types';
import { convertProfileVpnReferencesToIp } from '../../../../src/models/replication-profile/profile-vpn-ip-conversion';
import { normalizeProfileVpnRuleParameters } from '../../../../src/models/replication-profile/replication-profile-vpn-parameters';

/**
 * Stateful SQL test double: exercises the real rule insertion, relation writes and cleanup.
 * No test database is connected, initialized or cleared.
 */
describe('Template rules sharing default-rule comments survive application', () => {
  let sandbox: sinon.SinonSandbox;
  let service: any;
  let rows: Map<number, any>;
  let interfaces: any[][];
  let objects: any[][];
  let events: string[];
  let resolvedObjects: any[];
  let nextId: number;
  let family: 4 | 6;
  let inputType: number;

  const template = (withVpn = true, protocol = 'openvpn'): any =>
    normalizeProfileVpnRuleParameters({
      vpnTemplate: {
        connections: [
          {
            id: 'office',
            name: 'Office VPN',
            role: 'client',
            kind: protocol,
            network: family === 4 ? '192.0.2.25/32' : '2001:db8::25/128',
            remoteNetwork: '10.0.0.0/24',
          },
        ],
      },
      provision: {
        interfaces: [],
        rules: [
          {
            chain: 'input',
            ipVersion: family,
            action: 'accept',
            inRole: 'lo',
            source: withVpn
              ? [{ kind: 'vpnClient', vpnId: 'office' }]
              : [{ kind: 'address', value: family === 4 ? '192.0.2.25/32' : '2001:db8::25/128' }],
            comment: DefaultPolicyRuleComments.SELF_HOST_TRAFFIC,
          },
          {
            chain: 'input',
            ipVersion: family,
            action: 'accept',
            services: [{ kind: 'stdGroup', id: 5, name: 'Useful ICMP' }],
            comment: DefaultPolicyRuleComments.USEFUL_ICMP,
          },
        ],
      },
    });

  function initialize(ipVersion: 4 | 6 = 4): void {
    family = ipVersion;
    inputType = PolicyTypesMap.get(`IPv${family}:INPUT`)!;
    rows = new Map([
      [
        1,
        {
          id: 1,
          firewall: 12,
          type: inputType,
          rule_order: 1,
          special: SpecialPolicyRules.STATEFUL,
          comment: 'Stateful firewall rule.',
        },
      ],
      [
        2,
        {
          id: 2,
          firewall: 12,
          type: inputType,
          rule_order: 2,
          special: 0,
          comment: DefaultPolicyRuleComments.SELF_HOST_TRAFFIC,
        },
      ],
      [
        3,
        {
          id: 3,
          firewall: 12,
          type: inputType,
          rule_order: 3,
          special: 0,
          comment: DefaultPolicyRuleComments.USEFUL_ICMP,
        },
      ],
      [
        4,
        {
          id: 4,
          firewall: 12,
          type: inputType,
          rule_order: 4,
          special: SpecialPolicyRules.CATCHALL,
          comment: 'Catch-all rule.',
        },
      ],
      [
        5,
        {
          id: 5,
          firewall: 12,
          type: PolicyTypesMap.get(`IPv${family}:OUTPUT`),
          rule_order: 2,
          special: 0,
          comment: 'Keep another policy',
        },
      ],
    ]);
    interfaces = [];
    objects = [];
    events = [];
    resolvedObjects = [];
    nextId = 100;
  }

  async function query(sql: string, params: any[] = []): Promise<any[]> {
    if (sql.startsWith('SELECT id, special, comment FROM policy_r')) {
      events.push('read-defaults');
      return [...rows.values()]
        .filter((row) => row.firewall === params[0] && params.slice(1).includes(row.type))
        .map((row) => ({ id: row.id, special: row.special, comment: row.comment }));
    }
    if (sql.startsWith('SELECT R.id')) return [];
    if (sql.startsWith('SELECT id, name, type, NULL AS ip_version FROM ipobj_g')) {
      return [{ id: 5, name: 'Useful ICMP', type: 21, ip_version: null }];
    }
    if (sql.startsWith('INSERT INTO policy_r__interface')) {
      interfaces.push([...params]);
      return [];
    }
    if (sql.startsWith('INSERT INTO policy_r__ipobj')) {
      objects.push([...params]);
      return [];
    }
    if (sql.startsWith('DELETE FROM policy_r WHERE id IN')) {
      for (const id of params) rows.delete(id);
      events.push('delete-defaults');
      return [];
    }
    if (sql.startsWith('DELETE FROM ')) {
      if (sql.startsWith('DELETE FROM policy_r__interface '))
        interfaces = interfaces.filter((ref) => !params.includes(ref[0]));
      if (sql.startsWith('DELETE FROM policy_r__ipobj '))
        objects = objects.filter((ref) => !params.includes(ref[0]));
      return [];
    }
    if (sql.startsWith('UPDATE policy_r SET rule_order')) {
      for (const row of rows.values()) {
        if (row.firewall === params[1] && row.type === params[2] && row.special === params[3])
          row.rule_order += params[0];
      }
      return [];
    }
    throw new Error('Unexpected SQL in isolated test: ' + sql);
  }

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    initialize();
    const runner = {
      query,
      connect: async () => {},
      startTransaction: async () => {},
      commitTransaction: async () => {},
      rollbackTransaction: async () => {},
      release: async () => {},
    };
    sandbox.stub(db, 'getSource').returns({ query, createQueryRunner: () => runner } as any);
    sandbox.stub(PolicyRule, 'insertPolicy_r').callsFake(async (data: any) => {
      const id = nextId++;
      rows.set(id, { ...data, id });
      events.push('insert-template');
      return id;
    });
    service = Object.create(PolicyReplicationService.prototype);
    service.standardRowsCache = new Map();
    service.positionTypesCache = new Map();
  });
  afterEach(() => sandbox.restore());

  async function apply(withVpn = true, mode = 'replace_defaults', protocol = 'openvpn') {
    const model = template(withVpn, protocol);
    const converted = convertProfileVpnReferencesToIp(
      model,
      getProfileProvisioning(model),
      undefined,
    );
    assert.deepEqual(converted.errors, []);
    const result = createPolicyReplicationResult(mode as any);
    const resolver = {
      resolveParameterAddress: () => undefined,
      resolve: async (data: any) => {
        resolvedObjects.push(data);
        return { id: mode === 'dry_run' ? 0 : 901 };
      },
    };
    await service.provisionRules(
      converted.provision,
      12,
      new Map([['lo', 201]]),
      new Map(),
      resolver,
      result,
      mode,
      mode === 'dry_run',
      undefined,
    );
    return result;
  }

  for (const ipVersion of [4, 6] as const) {
    for (const protocol of ['openvpn', 'wireguard', 'ipsec']) {
      it(`IPv${ipVersion} ${protocol}: retains both template rules, comments, order, interface and object references`, async () => {
        initialize(ipVersion);
        const result = await apply(true, 'replace_defaults', protocol);
        assert.deepEqual(result.errors, []);
        assert.equal(result.createdRules.length, 2);
        const createdIds = result.createdRules.map((rule) => rule.targetRuleId!);
        assert.ok(
          createdIds.every((id) => rows.has(id)),
          'reported template rules must still exist after cleanup',
        );
        assert.deepEqual(result.removedDefaultRules, [2, 3, 4]);
        assert.deepEqual([...rows.keys()], [1, 5, 100, 101]);
        assert.deepEqual(
          createdIds.map((id) => [
            rows.get(id).type,
            rows.get(id).action,
            rows.get(id).rule_order,
            rows.get(id).comment,
          ]),
          [
            [inputType, 1, 2, DefaultPolicyRuleComments.SELF_HOST_TRAFFIC],
            [inputType, 1, 3, DefaultPolicyRuleComments.USEFUL_ICMP],
          ],
        );
        const positions = getProvisionRulePositions(family, 'input');
        assert.deepEqual(interfaces, [[100, 201, positions.in, 1]]);
        assert.deepEqual(objects, [
          [100, 901, -1, -1, positions.source, 1],
          [101, -1, 5, -1, positions.service, 1],
        ]);
        assert.equal(resolvedObjects[0].kind, 'address');
        assert.equal(resolvedObjects[0].name, 'Office VPN');
        assert.equal(resolvedObjects[0].address, family === 4 ? '192.0.2.25' : '2001:db8::25');
        assert.ok(events.indexOf('read-defaults') < events.indexOf('insert-template'));
      });
    }
  }

  it('preserves matching comments and restrictions in templates without VPN references too', async () => {
    const result = await apply(false);
    assert.ok(result.createdRules.every((rule) => rows.has(rule.targetRuleId!)));
    assert.equal(objects.length, 2);
    assert.equal(interfaces.length, 1);
  });

  it('previews exactly the original default ids and never changes the target', async () => {
    const before = JSON.stringify([...rows.values()]);
    const result = await apply(true, 'dry_run');
    assert.deepEqual(result.removedDefaultRules, [2, 3, 4]);
    assert.equal(result.createdRules.length, 2);
    assert.ok(result.createdRules.every((rule) => rule.targetRuleId === null));
    assert.equal(JSON.stringify([...rows.values()]), before);
    assert.deepEqual(interfaces, []);
    assert.deepEqual(objects, []);
  });

  it('merge mode keeps the existing target rules and never runs default cleanup', async () => {
    const result = await apply(true, 'merge');
    assert.deepEqual(result.removedDefaultRules, []);
    assert.equal(rows.size, 7);
    assert.ok(!events.includes('delete-defaults'));
  });
});
