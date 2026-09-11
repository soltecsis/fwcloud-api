import assert from 'node:assert/strict';
import { DataSource } from 'typeorm';
import {
  exportVPNClients,
  vpnClientsToCSV,
  VPNProtocol,
} from '../../../../src/models/vpn/vpn-clients-export';
import { NotFoundException } from '../../../../src/fonaments/exceptions/not-found-exception';

function database(results: unknown[][]) {
  const calls: { sql: string; parameters: unknown[] }[] = [];
  const source = {
    async query(sql: string, parameters: unknown[]) {
      calls.push({ sql, parameters });
      return results[calls.length - 1];
    },
  } as unknown as DataSource;
  return { source, calls };
}

describe('VPN client JSON export', () => {
  for (const protocol of ['openvpn', 'wireguard', 'ipsec'] as VPNProtocol[]) {
    it(`${protocol}: retains clients without addresses and merges groups without duplicates`, async () => {
      const { source, calls } = database([
        [{ id: 10, name: 'server' }],
        [
          { id: 11, name: 'Staff-A', address: '10.0.0.2', group_id: 3, group_name: 'staff' },
          { id: 11, name: 'Staff-A', address: '10.0.0.2', group_id: 3, group_name: 'staff' },
          { id: 12, name: 'Other', address: null, group_id: null, group_name: null },
        ],
        [
          { prefix: 'staff-', id: 3, name: 'staff' },
          { prefix: 'staff-', id: 4, name: 'prefix group' },
          { prefix: 'unmatched', id: 5, name: 'unrelated' },
        ],
      ]);
      assert.deepEqual(await exportVPNClients(source, protocol, 1, 2, 10), {
        protocol,
        server: { id: 10, name: 'server' },
        clients: [
          {
            id: 11,
            name: 'Staff-A',
            addresses: ['10.0.0.2'],
            ipobjgroups: [
              { id: 3, name: 'staff' },
              { id: 4, name: 'prefix group' },
            ],
          },
          { id: 12, name: 'Other', addresses: [], ipobjgroups: [] },
        ],
      });
      assert.deepEqual(calls[0].parameters, [10, 2, 1]);
      assert.match(calls[0].sql, /CRT.type = 2/);
      assert.match(calls[0].sql, new RegExp(`VPN.${protocol} IS NULL`));
      assert.deepEqual(calls[1].parameters, [
        { openvpn: 'ifconfig-push', wireguard: 'Address', ipsec: 'leftsourceip' }[protocol],
        1,
        1,
        10,
        2,
      ]);
    });

    it(`${protocol}: exports an empty server`, async () => {
      const { source } = database([[{ id: 10, name: 'server' }], [], []]);
      assert.deepEqual((await exportVPNClients(source, protocol, 1, 2, 10)).clients, []);
    });

    it(`${protocol}: rejects a missing server or one outside the requested scope`, async () => {
      const { source, calls } = database([[]]);
      await assert.rejects(exportVPNClients(source, protocol, 1, 2, 10), NotFoundException);
      assert.equal(calls.length, 1);
    });
  }

  it('keeps multiple configured WireGuard addresses', async () => {
    const { source } = database([
      [{ id: 10, name: 'server' }],
      [{ id: 11, name: 'client', address: '10.0.0.2/32, fd00::2/128', group_id: null }],
      [],
    ]);
    assert.deepEqual((await exportVPNClients(source, 'wireguard', 1, 2, 10)).clients[0].addresses, [
      '10.0.0.2/32',
      'fd00::2/128',
    ]);
  });

  it('separates the OpenVPN address from its mask in raw options', async () => {
    const { source } = database([
      [{ id: 10, name: 'server' }],
      [{ id: 11, name: 'client', address: '10.0.0.2 255.255.255.0', group_id: null }],
      [],
    ]);
    assert.deepEqual((await exportVPNClients(source, 'openvpn', 1, 2, 10)).clients[0].addresses, [
      '10.0.0.2',
    ]);
  });

  it('rejects protocols outside the allowlist before querying', async () => {
    const { source, calls } = database([]);
    await assert.rejects(
      exportVPNClients(source, 'invalid' as VPNProtocol, 1, 2, 10),
      NotFoundException,
    );
    assert.equal(calls.length, 0);
  });
});

describe('VPN client CSV formatting', () => {
  it('escapes delimiters, quotes and line breaks and keeps multiple addresses and groups in one row', () => {
    assert.equal(
      vpnClientsToCSV([
        {
          id: 1,
          name: 'José; "Oficina"\nNorte',
          addresses: ['10.0.0.2', 'fd00::2'],
          ipobjgroups: [
            { id: 1, name: 'Personal' },
            { id: 2, name: 'Administración' },
          ],
        },
      ]),
      '\uFEFF"Cliente";"IP asociada";"Grupos"\r\n' +
        '"José; ""Oficina""\nNorte";"10.0.0.2, fd00::2";"Personal, Administración"\r\n',
    );
  });

  it('exports spreadsheet formula-like names as text', () => {
    const csv = vpnClientsToCSV([
      {
        id: 1,
        name: '=1+1',
        addresses: [],
        ipobjgroups: [{ id: 1, name: '@grupo' }],
      },
    ]);
    assert.ok(csv.includes('"\'=1+1";"";"\'@grupo"'));
  });
});
