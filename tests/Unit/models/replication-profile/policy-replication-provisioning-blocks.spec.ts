import { describeName, expect, testSuite } from '../../../mocha/global-setup';
import { Application } from '../../../../src/Application';
import db from '../../../../src/database/database-manager';
import { FwCloudFactory, FwCloudProduct } from '../../../utils/fwcloud-factory';
import { Firewall } from '../../../../src/models/firewall/Firewall';
import StringHelper from '../../../../src/utils/string.helper';
import { PolicyReplicationService } from '../../../../src/models/replication-profile/policy-replication.service';
import { getProfileProvisioning } from '../../../../src/models/replication-profile/policy-replication.types';
import { getProfileParameters } from '../../../../src/models/replication-profile/replication-profile-parameters';
import { validateReplicationProfilePayload } from '../../../../src/models/replication-profile/replication-profile-validation.service';
import { loadReplicationProfileStandardCatalog } from '../../../../src/models/replication-profile/replication-profile-standard-objects';
import { RulePositionsMap } from '../../../../src/models/policy/PolicyPosition';

/** Fixed ids of FWCloud predefined objects (config/seeds/ipobj_std.sql). */
const STD_NET_10 = 70003;
const STD_LINK_LOCAL_V6 = 70011;
const STD_HTTPS = 20029;
const STD_GROUP_RFC1918 = 1;

const INTERFACES = [
  { name: 'WAN', role: 'wan', addresses: ['198.51.100.10/24'] },
  { name: 'LAN', role: 'lan', addresses: ['192.168.60.1/24'] },
];

describe(describeName('PolicyReplicationService provisioning blocks Unit Tests'), () => {
  let app: Application;
  let service: PolicyReplicationService;
  let fwc: FwCloudProduct;
  let firewall: Firewall;

  const apply = (
    model: Record<string, unknown>,
    mode: 'replace_defaults' | 'dry_run' = 'replace_defaults',
  ) =>
    service.provisionPolicyFromProfile(
      { kind: 'firewall', id: firewall.id },
      getProfileProvisioning(model),
      fwc.fwcloud.id,
      mode,
      { parameters: getProfileParameters(model), parameterValues: {} },
    );

  const query = (sql: string, params: unknown[] = []) => db.getSource().query(sql, params);

  before(async () => {
    app = testSuite.app;
    await testSuite.resetDatabaseData();
  });

  beforeEach(async () => {
    service = await app.getService<PolicyReplicationService>(PolicyReplicationService.name);
    fwc = await new FwCloudFactory().make();
    firewall = await db
      .getSource()
      .manager.getRepository(Firewall)
      .save({ name: StringHelper.randomize(10), fwCloudId: fwc.fwcloud.id });
  });

  it('should list the predefined objects, services and groups with their fixed ids', async () => {
    const catalog = await loadReplicationProfileStandardCatalog();

    expect(catalog.objects.find((object) => object.id === STD_HTTPS)).to.include({
      name: 'https',
      type: 2,
    });
    expect(catalog.objects.find((object) => object.id === STD_NET_10)).to.include({
      type: 7,
      ip_version: 4,
    });
    expect(catalog.groups.find((group) => group.id === STD_GROUP_RFC1918).members).to.include(
      STD_NET_10,
    );
  });

  it('should reference predefined objects, groups and services instead of creating copies', async () => {
    const result = await apply({
      provision: {
        interfaces: INTERFACES,
        rules: [
          {
            chain: 'forward',
            source: [{ kind: 'stdGroup', id: STD_GROUP_RFC1918 }],
            destination: [{ kind: 'std', id: STD_NET_10 }],
            services: [{ kind: 'std', id: STD_HTTPS }],
          },
        ],
      },
    });

    expect(result.errors).to.be.empty;
    const rows = await query(
      'SELECT ipobj, ipobj_g, position FROM policy_r__ipobj WHERE rule = ? ORDER BY position',
      [result.createdRules[0].targetRuleId],
    );
    expect(rows).to.deep.equal([
      {
        ipobj: -1,
        ipobj_g: STD_GROUP_RFC1918,
        position: RulePositionsMap.get('IPv4:FORWARD:Source'),
      },
      {
        ipobj: STD_NET_10,
        ipobj_g: -1,
        position: RulePositionsMap.get('IPv4:FORWARD:Destination'),
      },
      { ipobj: STD_HTTPS, ipobj_g: -1, position: RulePositionsMap.get('IPv4:FORWARD:Service') },
    ]);
    const copies = await query(
      'SELECT COUNT(*) AS total FROM ipobj WHERE fwcloud = ? AND name = ?',
      [fwc.fwcloud.id, 'https'],
    );
    expect(Number(copies[0].total)).to.equal(0);
  });

  it('should refuse predefined objects of another IP family or that do not exist', async () => {
    const result = await apply({
      provision: {
        interfaces: INTERFACES,
        rules: [
          { chain: 'forward', source: [{ kind: 'std', id: STD_LINK_LOCAL_V6 }] },
          { chain: 'forward', source: [{ kind: 'std', id: 999999 }] },
        ],
      },
    });

    expect(result.errors).to.have.length(2);
    expect(result.errors[0]).to.contain('IPv6');
    expect(result.errors[1]).to.contain('does not exist');
    expect(result.createdRules).to.be.empty;
  });

  it('should provision SNAT masquerade and DNAT port forwarding with their translated positions', async () => {
    const result = await apply({
      provision: {
        interfaces: INTERFACES,
        rules: [
          {
            chain: 'snat',
            outRole: 'wan',
            source: [{ kind: 'network', value: '192.168.60.0/24' }],
          },
          {
            chain: 'dnat',
            inRole: 'wan',
            services: [{ protocol: 'tcp', port: 8443 }],
            translatedDestination: [{ kind: 'address', value: '192.168.60.20' }],
            translatedServices: [{ protocol: 'tcp', port: 443 }],
          },
        ],
      },
    });

    expect(result.errors).to.be.empty;
    const [snat, dnat] = result.createdRules;
    expect(snat.policyTypeId).to.equal(4);
    expect(dnat.policyTypeId).to.equal(5);

    const snatInterfaces = await query('SELECT position FROM policy_r__interface WHERE rule = ?', [
      snat.targetRuleId,
    ]);
    expect(snatInterfaces.map((row) => row.position)).to.deep.equal([
      RulePositionsMap.get('IPv4:SNAT:Out'),
    ]);

    const dnatPositions = (
      await query('SELECT position FROM policy_r__ipobj WHERE rule = ? ORDER BY position', [
        dnat.targetRuleId,
      ])
    ).map((row) => row.position);
    expect(dnatPositions).to.deep.equal(
      ['Service', 'Translated Destination', 'Translated Service'].map((name) =>
        RulePositionsMap.get(`IPv4:DNAT:${name}`),
      ),
    );
  });

  it('should reject objects a NAT translated position does not accept', async () => {
    const result = await apply({
      provision: {
        interfaces: INTERFACES,
        rules: [
          {
            chain: 'snat',
            outRole: 'wan',
            translatedSource: [{ kind: 'network', value: '203.0.113.0/24' }],
          },
        ],
      },
    });

    expect(result.errors).to.have.length(1);
    expect(result.errors[0]).to.contain('translated source');
  });

  it('should create routing tables, routes and policy routing rules', async () => {
    const result = await apply({
      provision: {
        interfaces: INTERFACES,
        routing: {
          tables: [
            {
              key: 'isp2',
              number: 10,
              name: 'ISP2',
              routes: [
                {
                  destination: [{ kind: 'std', id: STD_NET_10 }],
                  gateway: { kind: 'address', value: '198.51.100.1' },
                  interfaceRole: 'wan',
                },
              ],
            },
          ],
          rules: [
            {
              from: [{ kind: 'network', value: '192.168.60.0/24' }],
              table: 'isp2',
              comment: 'LAN via ISP2',
            },
          ],
        },
      },
    });

    expect(result.errors).to.be.empty;
    expect(result.provisioned).to.include({ routingTables: 1, routes: 1, routingRules: 1 });

    const [table] = await query('SELECT id, number, name FROM routing_table WHERE firewall = ?', [
      firewall.id,
    ]);
    expect(table).to.include({ number: 10, name: 'ISP2' });
    const [route] = await query(
      'SELECT id, gateway, interface FROM route WHERE routing_table = ?',
      [table.id],
    );
    expect(route.interface).to.be.a('number');
    expect(
      (await query('SELECT ipobj FROM route__ipobj WHERE route = ?', [route.id]))[0].ipobj,
    ).to.equal(STD_NET_10);
    const [rule] = await query('SELECT id, comment FROM routing_r WHERE routing_table = ?', [
      table.id,
    ]);
    expect(rule.comment).to.equal('LAN via ISP2');
  });

  it('should create DHCP and HAProxy entries and skip Keepalived on interfaces without a MAC', async () => {
    const result = await apply({
      provision: {
        interfaces: INTERFACES,
        system: {
          dhcp: [
            {
              network: { kind: 'network', value: '192.168.60.0/24' },
              range: { kind: 'range', value: '192.168.60.100-192.168.60.200' },
              router: { kind: 'address', value: '192.168.60.1' },
              dns: [{ kind: 'address', value: '192.168.60.2' }],
              maxLease: 3600,
            },
          ],
          keepalived: [
            { interfaceRole: 'lan', virtualIps: [{ kind: 'address', value: '192.168.60.254' }] },
          ],
          haproxy: [
            {
              frontendIp: { kind: 'address', value: '198.51.100.10' },
              frontendService: { protocol: 'tcp', port: 443 },
              backendIps: [{ kind: 'address', value: '192.168.60.20' }],
              backendService: { protocol: 'tcp', port: 8443 },
            },
          ],
        },
      },
    });

    expect(result.errors).to.be.empty;
    expect(result.provisioned).to.include({ dhcp: 1, keepalived: 0, haproxy: 1 });
    expect(result.warnings.some((warning) => warning.includes('MAC'))).to.be.true;

    const [dhcp] = await query('SELECT id, max_lease, active FROM dhcp_r WHERE firewall = ?', [
      firewall.id,
    ]);
    expect(dhcp).to.include({ max_lease: 3600 });
    expect(await query('SELECT ipobj FROM dhcp_r__ipobj WHERE rule = ?', [dhcp.id])).to.have.length(
      1,
    );
    const range = await query(
      'SELECT range_end FROM ipobj WHERE fwcloud = ? AND type = 6 AND range_start = ?',
      [fwc.fwcloud.id, '192.168.60.100'],
    );
    expect(range).to.deep.equal([{ range_end: '192.168.60.200' }]);
    expect(
      await query('SELECT id FROM haproxy_r WHERE firewall = ?', [firewall.id]),
    ).to.have.length(1);
  });

  it('should only count routing and system entries in dry-run mode', async () => {
    const result = await apply(
      {
        provision: {
          interfaces: INTERFACES,
          routing: { tables: [{ key: 't', number: 20, name: 'T', routes: [] }], rules: [] },
          system: { dhcp: [], keepalived: [], haproxy: [] },
        },
      },
      'dry_run',
    );

    expect(result.errors).to.be.empty;
    expect(result.provisioned.routingTables).to.equal(1);
    expect(await query('SELECT id FROM routing_table WHERE firewall = ?', [firewall.id])).to.be
      .empty;
  });

  it('should validate routing tables, NAT translations and predefined references when saving', () => {
    const errors = validateReplicationProfilePayload({
      targetKind: 'firewall',
      model: {
        provision: {
          interfaces: [{ name: 'WAN', role: 'wan' }],
          rules: [
            { chain: 'forward', translatedSource: [{ kind: 'address', value: '192.0.2.1' }] },
            { chain: 'forward', source: [{ kind: 'std', id: 'https' }] },
          ],
          routing: {
            tables: [{ key: 'a', number: 251, name: 'A' }],
            rules: [{ from: [], table: 'missing' }],
          },
          system: { keepalived: [{ interfaceRole: 'lan', virtualIps: [] }] },
        },
      },
    });

    expect(errors.map((error) => error.code)).to.include.members([
      'invalid_rule_translation',
      'invalid_standard_reference',
      'invalid_routing_table_number',
      'invalid_routing_rule_table',
      'invalid_rule_role',
    ]);
  });

  it('should put several interfaces in the In and Out positions of one rule', async () => {
    const result = await apply({
      provision: {
        interfaces: [...INTERFACES, { name: 'DMZ', role: 'dmz' }],
        rules: [{ chain: 'forward', inRole: ['lan', 'dmz'], outRole: 'wan' }],
      },
    });

    expect(result.errors).to.be.empty;
    const rows = await query(
      'SELECT position, position_order FROM policy_r__interface WHERE rule = ? ORDER BY position, position_order',
      [result.createdRules[0].targetRuleId],
    );
    expect(rows).to.deep.equal([
      { position: RulePositionsMap.get('IPv4:FORWARD:In'), position_order: 1 },
      { position: RulePositionsMap.get('IPv4:FORWARD:In'), position_order: 2 },
      { position: RulePositionsMap.get('IPv4:FORWARD:Out'), position_order: 1 },
    ]);
  });

  it('should resolve the Keepalived master node through the cluster node role mapping', async () => {
    const [cluster] = await query("INSERT INTO cluster (fwcloud, name) VALUES (?, 'CL-profile')", [
      fwc.fwcloud.id,
    ]).then((inserted) => [inserted.insertId]);
    const master = await db
      .getSource()
      .manager.getRepository(Firewall)
      .save({
        name: StringHelper.randomize(10),
        fwCloudId: fwc.fwcloud.id,
        clusterId: cluster,
        fwmaster: 1,
      });
    const backup = await db
      .getSource()
      .manager.getRepository(Firewall)
      .save({
        name: StringHelper.randomize(10),
        fwCloudId: fwc.fwcloud.id,
        clusterId: cluster,
        fwmaster: 0,
      });
    const model = {
      topologyPreset: {
        kind: 'cluster',
        nodes: [
          { role: 'madrid', name: 'FW-1', required: true, master: true },
          { role: 'valencia', name: 'FW-2', required: true },
        ],
      },
      provision: {
        interfaces: [{ name: 'LAN', role: 'lan' }],
        system: {
          keepalived: [
            {
              interfaceRole: 'lan',
              virtualIps: [{ kind: 'address', value: '192.168.80.254' }],
              masterNode: 'valencia',
            },
          ],
        },
      },
    };
    const run = (mapping: Record<string, number>) =>
      service.provisionPolicyFromProfile(
        { kind: 'cluster', id: cluster },
        getProfileProvisioning(model),
        fwc.fwcloud.id,
        'replace_defaults',
        { nodeRoleMapping: mapping },
      );

    const unmapped = await run({ madrid: master.id });
    expect(unmapped.errors.join(' ')).to.contain('"valencia"');

    await query("UPDATE interface SET mac = '00:11:22:33:44:55' WHERE firewall = ?", [master.id]);
    const mapped = await run({ madrid: master.id, valencia: backup.id });
    expect(mapped.errors).to.be.empty;
    const [rule] = await query('SELECT master_node FROM keepalived_r WHERE firewall = ?', [
      master.id,
    ]);
    expect(rule.master_node).to.equal(backup.id);

    expect(
      validateReplicationProfilePayload({
        targetKind: 'cluster',
        model: {
          ...model,
          provision: {
            ...model.provision,
            system: {
              keepalived: [{ interfaceRole: 'lan', virtualIps: [], masterNode: 'sevilla' }],
            },
          },
        },
      }).some((error) => error.path.endsWith('masterNode')),
    ).to.be.true;
  });
});
