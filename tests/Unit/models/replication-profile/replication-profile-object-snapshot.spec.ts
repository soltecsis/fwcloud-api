import { expect } from 'chai';
import sinon from 'sinon';
import db from '../../../../src/database/database-manager';
import {
  findExistingProfileSnapshot,
  loadProfileObjects,
  ProfileSnapshotSelectionPlan,
  validateProfileObjectSnapshot,
} from '../../../../src/models/replication-profile/replication-profile-object-snapshot';
import { resolveProfileObjectReferences } from '../../../../src/models/replication-profile/replication-profile-object-reference.service';

/** These tests use the real API validators, with no application or database bootstrap. */
describe('Replication profile saved object snapshots', () => {
  const destinationCloud = 73;
  const address = {
    type: 5,
    name: 'External IP',
    ip_version: 4,
    address: '198.51.100.10',
    netmask: '/32',
  };
  const range = {
    type: 6,
    name: 'External range',
    ip_version: 4,
    range_start: '198.51.100.10',
    range_end: '198.51.100.20',
  };
  const tcp = {
    type: 2,
    name: 'External TCP',
    protocol: 6,
    source_port_start: 1024,
    source_port_end: 65535,
    destination_port_start: 8000,
    destination_port_end: 8010,
    tcp_flags_mask: 2,
    tcp_flags_settings: 2,
  };
  const hostInterface = {
    name: 'eth0',
    type: 11,
    interface_type: 11,
    comment: 'Original host interface',
    addresses: [address],
  };
  let queries: sinon.SinonStub;
  let legacyQueries: sinon.SinonStub;

  beforeEach(() => {
    queries = sinon.stub().resolves([]);
    legacyQueries = sinon
      .stub()
      .callsFake((_sql, parameters, callback) => (callback ?? parameters)(null, []));
    sinon.stub(db, 'getSource').returns({ query: queries } as any);
    sinon.stub(db, 'getQuery').returns({ query: legacyQueries, escape: JSON.stringify } as any);
  });

  afterEach(() => sinon.restore());

  function expectReadOnlyQueries(): void {
    for (const call of [...queries.getCalls(), ...legacyQueries.getCalls()]) {
      expect(call.args[0]).to.match(/^\s*SELECT\b/i);
    }
  }

  for (const snapshot of [
    address,
    { ...address, name: 'IPv6 IP', ip_version: 6, address: '2001:db8::10', netmask: '/128' },
    { ...address, type: 7, name: 'External network', address: '198.51.100.0', netmask: '/24' },
    range,
    tcp,
    {
      type: 4,
      name: 'External UDP',
      protocol: 17,
      source_port_start: 0,
      source_port_end: 65535,
      destination_port_start: 53,
      destination_port_end: 53,
    },
    { type: 3, name: 'External ICMP', protocol: 1, icmp_type: 8, icmp_code: -1 },
    { type: 1, name: 'External GRE', protocol: 47 },
    { type: 9, name: 'external.example.test' },
    { type: 20, name: 'Address group', members: [address, range] },
    { type: 21, name: 'Service group', members: [tcp] },
    { type: 8, name: 'External host', interfaces: [hostInterface] },
    {
      type: 20,
      name: 'Host group',
      members: [{ type: 8, name: 'External host', interfaces: [hostInterface] }],
    },
  ]) {
    it(`validates the complete configuration of ${snapshot.name} without changing it`, async () => {
      const original = JSON.stringify(snapshot);

      expect(await validateProfileObjectSnapshot(snapshot, snapshot.type, destinationCloud)).to.eq(
        null,
      );
      expect(JSON.stringify(snapshot)).to.eq(original);
      expectReadOnlyQueries();
    });
  }

  for (const [description, snapshot, type, expected] of [
    ['missing snapshot', undefined, 5, 'type and name'],
    ['wrong object type', { ...address, type: 7 }, 5, 'type and name'],
    ['unsupported object type', { type: 999, name: 'Unsupported' }, 999, 'unsupported object type'],
    ['missing address', { type: 5, name: address.name, ip_version: 4 }, 5, 'address'],
    [
      'missing network address',
      { type: 7, name: 'Network', ip_version: 4, netmask: '/24' },
      7,
      'network address',
    ],
    ['missing range endpoint', { ...range, range_end: undefined }, 6, 'range_end'],
    [
      'reversed range',
      { ...range, range_start: range.range_end, range_end: range.range_start },
      6,
      'range_start',
    ],
    ['mixed range address families', { ...range, range_end: '2001:db8::20' }, 6, 'range_end'],
    ['invalid service protocol', { ...tcp, protocol: 17 }, 2, 'protocol'],
    [
      'missing restricted source start',
      { ...tcp, source_port_start: undefined },
      2,
      'source_port_start',
    ],
    ['missing restricted source end', { ...tcp, source_port_end: undefined }, 2, 'source_port_end'],
    [
      'missing service port',
      { ...tcp, destination_port_end: undefined },
      2,
      'destination_port_end',
    ],
    [
      'out of range service port',
      { ...tcp, destination_port_end: 70000 },
      2,
      'destination_port_end',
    ],
    ['reversed service ports', { ...tcp, destination_port_start: 8011 }, 2, 'port'],
    ['unknown snapshot field', { ...address, force: 1 }, 5, 'force'],
    ['missing group dependencies', { type: 20, name: 'Group' }, 20, 'members'],
    [
      'unsupported VPN dependency',
      { type: 20, name: 'VPN group', members: [{ type: 401, name: 'Prefix', id: 12 }] },
      20,
      'members[0]',
    ],
    [
      'address in a service group',
      { type: 21, name: 'Service group', members: [address] },
      21,
      'members[0]',
    ],
    [
      'service in an address group',
      { type: 20, name: 'Address group', members: [tcp] },
      20,
      'members[0]',
    ],
    ['missing host interfaces', { type: 8, name: 'Host' }, 8, 'interfaces'],
    [
      'incomplete host interface',
      { type: 8, name: 'Host', interfaces: [{ name: 'eth0', addresses: [] }] },
      8,
      'type',
    ],
    [
      'incomplete host member',
      { type: 20, name: 'Host group', members: [{ type: 8, name: 'Host', id: 18 }] },
      20,
      'members[0].interfaces',
    ],
    [
      'corrupt host address',
      {
        type: 8,
        name: 'Host',
        interfaces: [{ ...hostInterface, addresses: [{ ...address, address: 'invalid' }] }],
      },
      8,
      'address',
    ],
  ] as [string, unknown, number, string][]) {
    it(`returns a controlled error for a ${description} and performs no writes`, async () => {
      const error = await validateProfileObjectSnapshot(snapshot, type, destinationCloud);

      expect(error).to.be.a('string').and.include(expected);
      expectReadOnlyQueries();
    });
  }

  it('looks up snapshots inside the destination FWCloud and allows shared default objects', async () => {
    expect(await findExistingProfileSnapshot(address, 5, destinationCloud)).to.eq(null);

    expect(queries.firstCall.args[0]).to.include('(fwcloud = ? OR fwcloud IS NULL)');
    expect(queries.firstCall.args[1]).to.deep.eq([destinationCloud, 5, address.name]);
    expectReadOnlyQueries();
  });

  it('reuses a compatible object without relying on its original database ID', async () => {
    queries.onFirstCall().resolves([{ id: 100234 }]);
    queries.onSecondCall().resolves([{ ...address, id: 100234 }]);

    expect(
      await findExistingProfileSnapshot({ ...address, id: 42 }, 5, destinationCloud),
    ).to.deep.eq({
      id: 100234,
      data: address,
    });
    expect(queries.secondCall.args[1]).to.deep.eq([100234, destinationCloud]);
    expectReadOnlyQueries();
  });

  for (const [description, snapshot, existing] of [
    [
      'different range comments',
      { ...range, comment: 'Saved comment' },
      { ...range, comment: 'Updated comment' },
    ],
    ['an empty range comment', { ...range, comment: '' }, range],
    ['an omitted range comment', range, { ...range, comment: '' }],
    [
      'equivalent IPv6 notation',
      {
        ...address,
        ip_version: 6,
        address: '2001:0db8:0000:0000:0000:0000:0000:0010',
        netmask: '/128',
      },
      { ...address, ip_version: 6, address: '2001:db8::10', netmask: '/128' },
    ],
    [
      'equivalent IPv6 range notation',
      {
        ...range,
        ip_version: 6,
        range_start: '2001:0db8:0000:0000:0000:0000:0000:0010',
        range_end: '2001:0db8:0000:0000:0000:0000:0000:0020',
      },
      { ...range, ip_version: 6, range_start: '2001:db8::10', range_end: '2001:db8::20' },
    ],
    [
      'equivalent network masks',
      { ...address, type: 7, address: '198.51.100.0', netmask: '255.255.255.0' },
      { ...address, type: 7, address: '198.51.100.0', netmask: '/24' },
    ],
    ['numeric service options', { ...tcp, options: '0' }, { ...tcp, options: 0 }],
  ] as [string, Record<string, unknown>, Record<string, unknown>][]) {
    it(`reuses an object with ${description} without changing the saved snapshot`, async () => {
      queries.onFirstCall().resolves([{ id: 100234 }]);
      queries.onSecondCall().resolves([{ ...existing, id: 100234 }]);
      const original = JSON.stringify(snapshot);

      expect(
        await findExistingProfileSnapshot(snapshot, snapshot.type as number, destinationCloud),
      ).to.deep.eq({ id: 100234, data: existing });
      expect(JSON.stringify(snapshot)).to.eq(original);
      expectReadOnlyQueries();
    });
  }

  it('reuses a group with the same members in another order and different IDs and comments', async () => {
    const snapshot = {
      type: 20,
      name: 'Address group',
      comment: 'Saved group comment',
      members: [
        { ...address, id: 42, comment: 'Saved address comment' },
        { ...range, id: 43, comment: 'Saved range comment' },
      ],
    };
    const existingMembers = [
      { ...range, id: 100236, comment: 'Updated range comment' },
      { ...address, id: 100235, comment: 'Updated address comment' },
    ];
    queries.onFirstCall().resolves([{ id: 100234 }]);
    queries
      .onSecondCall()
      .resolves([{ id: 100234, type: 20, name: snapshot.name, comment: 'Updated group comment' }]);
    queries
      .onThirdCall()
      .resolves(existingMembers.map((member) => ({ group_id: 100234, ...member })));
    const original = JSON.stringify(snapshot);

    expect(await findExistingProfileSnapshot(snapshot, 20, destinationCloud)).to.deep.eq({
      id: 100234,
      data: {
        type: 20,
        name: snapshot.name,
        comment: 'Updated group comment',
        members: existingMembers,
      },
    });
    expect(JSON.stringify(snapshot)).to.eq(original);
    expectReadOnlyQueries();
  });

  it('returns a controlled conflict for an incompatible object with the same name', async () => {
    queries.onFirstCall().resolves([{ id: 100234 }]);
    queries.onSecondCall().resolves([{ ...address, id: 100234, address: '203.0.113.99' }]);
    let error: unknown;

    try {
      await findExistingProfileSnapshot(address, 5, destinationCloud);
    } catch (caught) {
      error = caught;
    }

    expect(error).to.be.instanceOf(Error);
    expect((error as Error).message)
      .to.include(address.name)
      .and.include('incompatible');
    expectReadOnlyQueries();
  });

  for (const type of [2, 4]) {
    for (const sourcePorts of [
      [0, 0],
      [1024, 1024],
      [2048, 65535],
    ]) {
      it(`rejects reuse of type ${type} when only source ports differ: ${sourcePorts.join('-')}`, async () => {
        const snapshot = { ...tcp, type, protocol: type === 2 ? 6 : 17 };
        queries.onFirstCall().resolves([{ id: 100234 }]);
        queries.onSecondCall().resolves([
          {
            ...snapshot,
            id: 100234,
            source_port_start: sourcePorts[0],
            source_port_end: sourcePorts[1],
          },
        ]);
        let error: unknown;
        try {
          await findExistingProfileSnapshot(snapshot, type, destinationCloud);
        } catch (caught) {
          error = caught;
        }
        expect(error).to.be.instanceOf(Error);
        expect((error as Error).message).to.include('incompatible');
        expectReadOnlyQueries();
      });
    }

    it(`treats omitted source ports in a legacy type ${type} snapshot as unrestricted`, async () => {
      const {
        source_port_start,
        source_port_end,
        tcp_flags_mask,
        tcp_flags_settings,
        ...snapshot
      } = {
        ...tcp,
        type,
        protocol: type === 2 ? 6 : 17,
      };
      expect(await validateProfileObjectSnapshot(snapshot, type, destinationCloud)).to.eq(null);
      queries.resetHistory();
      queries.onFirstCall().resolves([{ id: 100234 }]);
      queries.onSecondCall().resolves([
        {
          ...snapshot,
          id: 100234,
          source_port_start: 0,
          source_port_end: 0,
        },
      ]);
      expect((await findExistingProfileSnapshot(snapshot, type, destinationCloud))?.id).to.eq(
        100234,
      );
      expect(snapshot).not.to.have.property('source_port_start');
      expectReadOnlyQueries();
    });
  }

  for (const [description, snapshot, existing] of [
    ['range start', range, { ...range, range_start: '198.51.100.11' }],
    ['range end', range, { ...range, range_end: '198.51.100.21' }],
    ['source port start', tcp, { ...tcp, source_port_start: 1025 }],
    ['source port end', tcp, { ...tcp, source_port_end: 65534 }],
    ['destination port start', tcp, { ...tcp, destination_port_start: 8001 }],
    ['destination port end', tcp, { ...tcp, destination_port_end: 8011 }],
    ['TCP flags mask', tcp, { ...tcp, tcp_flags_mask: 16 }],
    ['TCP flags settings', tcp, { ...tcp, tcp_flags_settings: 0 }],
    ['service options', { ...tcp, options: 0 }, { ...tcp, options: 1 }],
  ] as [string, Record<string, unknown>, Record<string, unknown>][]) {
    it(`rejects an object with the same name and a different ${description}`, async () => {
      queries.onFirstCall().resolves([{ id: 100234 }]);
      queries.onSecondCall().resolves([{ ...existing, id: 100234 }]);
      let error: unknown;

      try {
        await findExistingProfileSnapshot(snapshot, snapshot.type as number, destinationCloud);
      } catch (caught) {
        error = caught;
      }

      expect(error).to.be.instanceOf(Error);
      expect((error as Error).message)
        .to.include(snapshot.name as string)
        .and.include('incompatible');
      expectReadOnlyQueries();
    });
  }

  it('reuses the oldest equivalent destination objects across choices with different names', async () => {
    const objects = [
      { ...address, id: 100234, name: 'Existing second IP', address: '198.51.100.11' },
      { ...address, id: 100235, name: 'Existing first IP', comment: 'Destination comment' },
      { ...address, id: 100236, name: 'Newer equivalent IP' },
    ];
    queries.callsFake(async (sql: string, parameters: unknown[]) => {
      if (sql.startsWith('SELECT id FROM ipobj WHERE')) {
        return objects
          .filter((object) => parameters.length === 2 || object.name === parameters[2])
          .map(({ id }) => ({ id }));
      }
      return objects.filter((object) => parameters.slice(0, -1).includes(object.id));
    });
    const plan = new ProfileSnapshotSelectionPlan(destinationCloud);
    const first = { ...address, name: 'Saved first IP' };
    const second = { ...address, name: 'Saved second IP', address: '198.51.100.11' };
    const saved = JSON.stringify([first, second]);
    const expected = objects.map(({ id, ...data }) => ({ type: 5, id, data }));

    expect(await plan.select(first, 5)).to.deep.equal(expected[1]);
    expect(await plan.select(second, 5)).to.deep.equal(expected[0]);
    expect(JSON.stringify([first, second])).to.equal(saved);
    const catalogs = queries
      .getCalls()
      .filter(
        (call) =>
          call.args[0].startsWith('SELECT id FROM ipobj WHERE') && call.args[1].length === 2,
      );
    expect(catalogs).to.have.length(1);
    expectReadOnlyQueries();
  });

  it('preserves host interface order, empty interfaces and separate address lists in a batch', async () => {
    queries.onFirstCall().resolves([
      { id: 100234, type: 8, name: 'First host' },
      { id: 100235, type: 8, name: 'Second host' },
    ]);
    const hostInterfaceRow = (hostId: number, interfaceId: number, order: number) => ({
      host_id: hostId,
      interface_id: interfaceId,
      interface_name: `eth${order}`,
      interface_kind: 11,
      interface_type: 11,
      interface_order: order,
    });
    queries.onSecondCall().resolves([
      { ...hostInterfaceRow(100234, 12, 1), ...address, id: 100301 },
      { ...hostInterfaceRow(100234, 12, 1), ...address, id: 100302 },
      { ...hostInterfaceRow(100234, 11, 2), id: null },
      { ...hostInterfaceRow(100235, 12, 1), ...address, id: 100303 },
    ]);

    const lookup = await loadProfileObjects(
      [
        { type: 8, id: 100234 },
        { type: 8, id: 100235 },
      ],
      destinationCloud,
    );
    const interfacesOf = (id: number) =>
      (lookup(8, id).interfaces as Record<string, any>[]).map((iface) => ({
        id: iface.id,
        name: iface.name,
        addresses: iface.addresses.map((ip) => ip.id),
      }));

    expect(interfacesOf(100234)).to.deep.equal([
      { id: 12, name: 'eth1', addresses: [100301, 100302] },
      { id: 11, name: 'eth2', addresses: [] },
    ]);
    expect(interfacesOf(100235)).to.deep.equal([{ id: 12, name: 'eth1', addresses: [100303] }]);
    expectReadOnlyQueries();
  });

  it('resolves a deleted object for preview while leaving the saved template and database untouched', async () => {
    const model = {
      objectReferences: [
        {
          referenceId: 'external-ip',
          objectType: 'address',
          sourceObjectId: 42,
          sourceName: address.name,
          snapshot: { ...address },
          locations: ['model.provision.rules[0].source[0]'],
        },
      ],
      provision: {
        rules: [{ chain: 'forward', source: [{ kind: 'external', referenceId: 'external-ip' }] }],
      },
    };
    const original = JSON.stringify(model);

    const result = await resolveProfileObjectReferences(model, destinationCloud);

    expect(result.errors).to.deep.eq([]);
    expect(result.objectReferences[0].snapshot).to.deep.eq(address);
    expect(JSON.stringify(model)).to.eq(original);
    expectReadOnlyQueries();
  });
});
