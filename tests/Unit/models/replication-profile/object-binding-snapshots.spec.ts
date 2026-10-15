import { expect } from 'chai';
import * as sinon from 'sinon';
import db from '../../../../src/database/database-manager';
import { IPObj } from '../../../../src/models/ipobj/IPObj';
import { IPObjGroup } from '../../../../src/models/ipobj/IPObjGroup';
import { IPObjToIPObjGroup } from '../../../../src/models/ipobj/IPObjToIPObjGroup';
import { Interface } from '../../../../src/models/interface/Interface';
import { InterfaceIPObj } from '../../../../src/models/interface/InterfaceIPObj';
import { Tree } from '../../../../src/models/tree/Tree';
import { ObjectBindingResolver } from '../../../../src/models/replication-profile/object-binding.resolver';
import * as snapshots from '../../../../src/models/replication-profile/replication-profile-object-snapshot';
import type { ProfileExternalObjectBinding } from '../../../../src/models/replication-profile/replication-profile-object-reference';

describe('ObjectBindingResolver saved external object recreation', () => {
  let sandbox: sinon.SinonSandbox;
  let insertObject: sinon.SinonStub;
  let insertGroup: sinon.SinonStub;
  let insertMember: sinon.SinonStub;
  let insertInterface: sinon.SinonStub;
  let insertHostInterface: sinon.SinonStub;
  let findExisting: sinon.SinonStub;
  let validate: sinon.SinonStub;

  const address = {
    type: 5,
    name: 'Saved address',
    address: '192.0.2.25',
    netmask: '/32',
    ip_version: 4,
    comment: 'Keep this configuration',
  };

  const binding = (data: Record<string, unknown>): ProfileExternalObjectBinding => ({
    type: Number(data.type),
    data,
  });

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    sandbox.stub(db, 'getSource').returns({ query: async () => [] } as any);
    sandbox.stub(db, 'getQuery').returns({} as any);
    findExisting = sandbox.stub(snapshots, 'findExistingProfileSnapshot').resolves(null);
    validate = sandbox.stub(snapshots, 'validateProfileObjectSnapshot').resolves(null);
    insertObject = sandbox.stub(IPObj, 'insertIpobj');
    insertObject.onCall(0).resolves(100101);
    insertObject.onCall(1).resolves(100102);
    insertObject.onCall(2).resolves(100103);
    insertGroup = sandbox.stub(IPObjGroup, 'insertIpobj_g').callsFake((_data, callback) => {
      callback(null, { insertId: 100201 });
    });
    insertMember = sandbox.stub(IPObjToIPObjGroup, 'insertIpobj__ipobjg').resolves(1);
    insertInterface = sandbox.stub(Interface, 'insertInterface').resolves(100301);
    insertHostInterface = sandbox.stub(InterfaceIPObj, 'insertInterface__ipobj').resolves(1);
  });

  afterEach(() => sandbox.restore());

  for (const data of [
    address,
    {
      type: 6,
      name: 'Saved range',
      ip_version: 6,
      range_start: '2001:db8::10',
      range_end: '2001:db8::20',
    },
    {
      type: 7,
      name: 'Saved network',
      ip_version: 4,
      address: '198.51.100.0',
      netmask: '/24',
    },
    {
      type: 2,
      name: 'Saved TCP service',
      protocol: 6,
      source_port_start: 1000,
      source_port_end: 2000,
      destination_port_start: 443,
      destination_port_end: 444,
      tcp_flags_mask: 2,
      tcp_flags_settings: 2,
      diff_serv: 32,
    },
    {
      type: 4,
      name: 'Saved UDP service',
      protocol: 17,
      source_port_start: 0,
      source_port_end: 0,
      destination_port_start: 53,
      destination_port_end: 53,
    },
    { type: 9, name: 'saved.example.test' },
  ]) {
    it(`recreates ${data.name} with its complete saved configuration in the destination`, async () => {
      const saved = JSON.stringify(data);
      const objects = new Map([['external', binding(data)]]);
      const resolver = new ObjectBindingResolver(72, true, objects);

      expect(await resolver.prepareExternalObjects()).to.deep.equal([]);
      const resolved = await resolver.resolveExternal('external');

      expect(resolved).to.deep.equal({ id: 100101, type: data.type });
      expect(insertObject.calledOnce).to.equal(true);
      expect(insertObject.firstCall.args[1]).to.deep.equal({ ...data, fwcloud: 72 });
      expect(objects.get('external').id).to.equal(100101);
      expect(JSON.stringify(data)).to.equal(saved);
    });
  }

  it('recreates one missing object for concurrent usages and separate references to the same object', async () => {
    const objects = new Map([
      ['first', binding(address)],
      ['second', binding({ id: 123, ...address })],
    ]);
    const resolver = new ObjectBindingResolver(72, true, objects);

    const resolved = await Promise.all([
      resolver.resolveExternal('first'),
      resolver.resolveExternal('second'),
      resolver.resolveExternal('first'),
    ]);

    expect(resolved.map(({ id }) => id)).to.deep.equal([100101, 100101, 100101]);
    expect(insertObject.calledOnce).to.equal(true);
    expect(objects.get('first').id).to.equal(objects.get('second').id);
  });

  it('reuses an identical destination object on a repeated operation', async () => {
    const first = new ObjectBindingResolver(72, true, new Map([['external', binding(address)]]));
    await first.resolveExternal('external');
    findExisting.resolves({ id: 100101, data: address });
    const second = new ObjectBindingResolver(72, true, new Map([['external', binding(address)]]));

    expect(await second.resolveExternal('external')).to.deep.equal({ id: 100101, type: 5 });
    expect(insertObject.calledOnce).to.equal(true);
    expect(findExisting.lastCall.args[2]).to.equal(72);
  });

  it('creates missing group members first and binds repeated dependencies once', async () => {
    const group = { type: 20, name: 'Saved address group', members: [{ id: 44, ...address }] };
    const objects = new Map([
      ['group', binding(group)],
      ['address', binding(address)],
    ]);
    const resolver = new ObjectBindingResolver(72, true, objects);

    expect(await resolver.resolveExternal('group')).to.deep.equal({ id: 100201, type: 20 });
    expect(await resolver.resolveExternal('address')).to.deep.equal({ id: 100101, type: 5 });
    expect(insertObject.calledOnce).to.equal(true);
    expect(insertObject.calledBefore(insertGroup)).to.equal(true);
    expect(insertMember.calledOnce).to.equal(true);
    expect(insertMember.firstCall.args[0].body).to.deep.equal({ ipobj_g: 100201, ipobj: 100101 });
  });

  it('recreates service groups preserving their port service dependencies', async () => {
    const service = {
      type: 2,
      name: 'Saved HTTPS',
      protocol: 6,
      source_port_start: 0,
      source_port_end: 0,
      destination_port_start: 443,
      destination_port_end: 443,
    };
    const group = { type: 21, name: 'Saved services', comment: 'Ports', members: [service] };
    const resolver = new ObjectBindingResolver(72, true, new Map([['group', binding(group)]]));

    expect(await resolver.resolveExternal('group')).to.deep.equal({ id: 100201, type: 21 });
    expect(insertObject.firstCall.args[1]).to.deep.equal({ ...service, fwcloud: 72 });
    expect(insertGroup.firstCall.args[0]).to.deep.equal({
      type: 21,
      name: 'Saved services',
      comment: 'Ports',
      fwcloud: 72,
    });
  });

  it('recreates host interfaces and owned addresses using their new destination IDs', async () => {
    const host = {
      type: 8,
      name: 'Saved host',
      interfaces: [
        {
          id: 13,
          name: 'lan',
          type: 10,
          interface_type: 10,
          labelName: 'Original LAN',
          mac: '00:11:22:33:44:55',
          comment: 'Interface metadata',
          interface_order: 2,
          addresses: [{ id: 14, ...address }],
        },
      ],
    };
    const resolver = new ObjectBindingResolver(72, true, new Map([['host', binding(host)]]));

    expect(await resolver.resolveExternal('host')).to.deep.equal({ id: 100101, type: 8 });
    expect(insertInterface.firstCall.args[1]).to.deep.equal({
      name: 'lan',
      type: 10,
      interface_type: 10,
      labelName: 'Original LAN',
      mac: '00:11:22:33:44:55',
      comment: 'Interface metadata',
    });
    expect(insertHostInterface.firstCall.args[1]).to.deep.equal({
      interface: 100301,
      ipobj: 100101,
      interface_order: 2,
    });
    expect(insertObject.secondCall.args[1]).to.deep.equal({
      ...address,
      fwcloud: 72,
      interface: 100301,
    });
  });

  for (const interfaceNodeId of [100401, null]) {
    it(`looks up a host interface tree node once for multiple addresses (${interfaceNodeId ?? 'missing node'})`, async () => {
      const query = sandbox.stub(db.getSource(), 'query').resolves([]);
      query.callsFake(async (_sql, parameters) =>
        parameters[1] === 'IFH' && interfaceNodeId !== null ? [{ id: interfaceNodeId }] : [],
      );
      const newNode = sandbox.stub(Tree, 'newNode').resolves(1);
      const addresses = [address, { ...address, name: 'Second IP', address: '192.0.2.26' }];
      const host = {
        type: 8,
        name: 'Saved host',
        interfaces: [{ name: 'lan', type: 10, interface_type: 10, addresses }],
      };
      const resolver = new ObjectBindingResolver(72, true, new Map([['host', binding(host)]]));

      await resolver.resolveExternal('host');

      const lookups = query.getCalls().filter((call) => call.args[1][1] === 'IFH');
      expect(lookups).to.have.length(1);
      expect(insertObject.callCount).to.equal(3);
      expect(newNode.callCount).to.equal(interfaceNodeId === null ? 0 : 2);
      if (interfaceNodeId !== null) {
        expect(newNode.getCalls().map((call) => call.args.slice(2))).to.deep.equal([
          [address.name, interfaceNodeId, 'OIA', 100102, 5],
          ['Second IP', interfaceNodeId, 'OIA', 100103, 5],
        ]);
      }
    });
  }

  it('does not create objects or modify bindings in a preview', async () => {
    const objects = new Map([['external', binding(address)]]);
    const resolver = new ObjectBindingResolver(72, false, objects);

    expect(await resolver.prepareExternalObjects()).to.deep.equal([]);
    expect(await resolver.resolveExternal('external')).to.deep.equal({ id: 0, type: 5 });
    expect(objects.get('external').id).to.equal(undefined);
    expect(insertObject.called).to.equal(false);
    expect(insertGroup.called).to.equal(false);
    expect(insertInterface.called).to.equal(false);
  });

  it('reports invalid snapshots before any object or dependency creation', async () => {
    validate.onCall(1).resolves('snapshot.range_end is missing');
    const resolver = new ObjectBindingResolver(
      72,
      true,
      new Map([
        ['valid', binding(address)],
        ['invalid', binding({ type: 6, name: 'Broken range' })],
      ]),
    );

    const errors = await resolver.prepareExternalObjects();

    expect(errors).to.have.length(1);
    expect(errors[0]).to.contain('invalid').and.contain('range_end');
    expect(insertObject.called).to.equal(false);
    expect(insertGroup.called).to.equal(false);
    expect(insertInterface.called).to.equal(false);
  });

  it('rejects conflicting pending objects before creation even when neither exists yet', async () => {
    const resolver = new ObjectBindingResolver(
      72,
      true,
      new Map([
        ['first', binding(address)],
        ['second', binding({ ...address, address: '192.0.2.26' })],
      ]),
    );

    const errors = await resolver.prepareExternalObjects();

    expect(errors).to.have.length(1);
    expect(errors[0]).to.contain('conflict').and.contain('first').and.contain('second');
    expect(insertObject.called).to.equal(false);
  });
});
