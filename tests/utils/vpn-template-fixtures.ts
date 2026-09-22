import db from '../../src/database/database-manager';
import { Firewall } from '../../src/models/firewall/Firewall';
import { Tree } from '../../src/models/tree/Tree';
import { Crt } from '../../src/models/vpn/pki/Crt';
import StringHelper from '../../src/utils/string.helper';
import { ProfileVpnConnectionTemplate } from '../../src/models/replication-profile/profile-vpn-config-provisioning.service';
import { FwCloudProduct } from './fwcloud-factory';

/** A template VPN connection with every field set; each spec overrides what it is about. */
export const vpnConnection = (
  overrides: Partial<ProfileVpnConnectionTemplate> = {},
): ProfileVpnConnectionTemplate => ({
  id: 'srv',
  name: 'Office',
  kind: 'openvpn',
  role: 'server',
  endpoint: '',
  port: 1194,
  network: '',
  localNetwork: '',
  remoteNetwork: '',
  transport: 'udp',
  device: 'tun',
  ...overrides,
});

/**
 * What VPN provisioning needs on a FWCloud: its trees, a server and a client certificate of its
 * CA (their CNs are `<cnPrefix>-Server` and `<cnPrefix>-Client`), and a firewall with its own tree.
 */
export async function createVpnProvisioningTarget(
  fwc: FwCloudProduct,
  cnPrefix: string,
): Promise<{ firewall: Firewall; serverCrt: Crt; clientCrt: Crt }> {
  await Tree.createAllTreeCloud(fwc.fwcloud);

  const crts = db.getSource().manager.getRepository(Crt);
  const serverCrt = await crts.save(
    crts.create({ caId: fwc.ca.id, cn: `${cnPrefix}-Server`, days: 365, type: 2 }),
  );
  const clientCrt = await crts.save(
    crts.create({ caId: fwc.ca.id, cn: `${cnPrefix}-Client`, days: 365, type: 1 }),
  );

  const firewall = await db
    .getSource()
    .manager.getRepository(Firewall)
    .save({ name: StringHelper.randomize(10), fwCloudId: fwc.fwcloud.id });
  const folder = (await Tree.getNodeByNameAndType(fwc.fwcloud.id, 'FIREWALLS', 'FDF')) as {
    id: number;
  };
  await Tree.insertFwc_Tree_New_firewall(fwc.fwcloud.id, folder.id, firewall.id);

  return { firewall, serverCrt, clientCrt };
}
