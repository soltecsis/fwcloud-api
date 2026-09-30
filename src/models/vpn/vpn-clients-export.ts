import { DataSource } from 'typeorm';
import { NotFoundException } from '../../fonaments/exceptions/not-found-exception';

export type VPNProtocol = 'openvpn' | 'wireguard' | 'ipsec';

export function vpnClientsToCSV(
  clients: Awaited<ReturnType<typeof exportVPNClients>>['clients'],
): string {
  const escapeCell = (value: string): string => {
    // Keep user-defined names from being interpreted as spreadsheet formulas.
    const text = /^[\s]*[=+@-]/.test(value) ? `'${value}` : value;
    return `"${text.replace(/"/g, '""')}"`;
  };
  const rows = [
    ['Cliente', 'IP asociada', 'Grupos'],
    ...clients.map((client) => [
      client.name,
      client.addresses.join(', '),
      client.ipobjgroups.map((group) => group.name).join(', '),
    ]),
  ];
  // UTF-8 BOM preserves accented names when opening the file in Excel.
  return '\uFEFF' + rows.map((row) => row.map(escapeCell).join(';')).join('\r\n') + '\r\n';
}

const addressOptions: Record<VPNProtocol, string> = {
  openvpn: 'ifconfig-push',
  wireguard: 'Address',
  ipsec: 'leftsourceip',
};

/** Export configured addresses, never runtime leases or VPN credentials. */
export async function exportVPNClients(
  source: DataSource,
  protocol: VPNProtocol,
  fwcloud: number,
  firewall: number,
  serverId: number,
) {
  // Table identifiers only come from this allowlist; values are bound parameters.
  if (!Object.prototype.hasOwnProperty.call(addressOptions, protocol)) {
    throw new NotFoundException();
  }
  const servers = await source.query(
    `SELECT VPN.id, COALESCE(CRT.cn, VPN.install_name) AS name
     FROM ${protocol} VPN
     INNER JOIN firewall FW ON FW.id = VPN.firewall
     INNER JOIN crt CRT ON CRT.id = VPN.crt AND CRT.type = 2
     WHERE VPN.id = ? AND VPN.${protocol} IS NULL AND FW.id = ? AND FW.fwcloud = ?`,
    [serverId, firewall, fwcloud],
  );
  if (!servers.length) throw new NotFoundException();

  const rows: {
    id: number;
    name: string;
    address: string | null;
    group_id: number | null;
    group_name: string | null;
  }[] = await source.query(
    `SELECT VPN.id, COALESCE(CRT.cn, VPN.install_name) AS name,
            COALESCE(IP.address, NULLIF(OPT.arg, '')) AS address,
            G.id AS group_id, G.name AS group_name
     FROM ${protocol} VPN
     LEFT JOIN crt CRT ON CRT.id = VPN.crt
     LEFT JOIN ${protocol}_opt OPT ON OPT.${protocol} = VPN.id AND OPT.name = ?
     LEFT JOIN ipobj IP ON IP.id = OPT.ipobj AND IP.fwcloud = ?
     LEFT JOIN ${protocol}__ipobj_g VG ON VG.${protocol} = VPN.id
     LEFT JOIN ipobj__ipobjg IG ON IG.ipobj = IP.id
     LEFT JOIN ipobj_g G ON (G.id = VG.ipobj_g OR G.id = IG.ipobj_g) AND G.fwcloud = ?
     WHERE VPN.${protocol} = ? AND VPN.firewall = ?
     ORDER BY VPN.id, OPT.id, G.id`,
    [addressOptions[protocol], fwcloud, fwcloud, serverId, firewall],
  );
  const prefixes: { prefix: string; id: number; name: string }[] = await source.query(
    `SELECT P.name AS prefix, G.id, G.name
     FROM ${protocol}_prefix P
     INNER JOIN ${protocol}_prefix__ipobj_g PG ON PG.prefix = P.id
     INNER JOIN ipobj_g G ON G.id = PG.ipobj_g AND G.fwcloud = ?
     WHERE P.${protocol} = ? ORDER BY P.id, G.id`,
    [fwcloud, serverId],
  );

  const clients = new Map<
    number,
    { id: number; name: string; addresses: string[]; ipobjgroups: { id: number; name: string }[] }
  >();
  for (const row of rows) {
    if (!clients.has(row.id)) {
      clients.set(row.id, { id: row.id, name: row.name, addresses: [], ipobjgroups: [] });
    }
    const client = clients.get(row.id);
    // Raw options can contain several addresses (WireGuard) or an address and mask (OpenVPN).
    const addresses = row.address
      ? protocol === 'openvpn'
        ? [row.address.trim().split(/\s+/)[0]]
        : row.address
            .split(',')
            .map((address) => address.trim())
            .filter(Boolean)
      : [];
    for (const address of addresses) {
      if (!client.addresses.includes(address)) client.addresses.push(address);
    }
    if (row.group_id && !client.ipobjgroups.some((group) => group.id === row.group_id)) {
      client.ipobjgroups.push({ id: row.group_id, name: row.group_name });
    }
  }
  for (const client of clients.values()) {
    for (const prefix of prefixes) {
      // Match the same case-insensitive expressions used by the VPN prefix models.
      if (
        new RegExp('^' + prefix.prefix, 'i').test(client.name) &&
        !client.ipobjgroups.some((group) => group.id === prefix.id)
      ) {
        client.ipobjgroups.push({ id: prefix.id, name: prefix.name });
      }
    }
    client.ipobjgroups.sort((a, b) => a.id - b.id);
  }
  return { protocol, server: servers[0], clients: [...clients.values()] };
}
