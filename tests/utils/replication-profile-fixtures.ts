import db from '../../src/database/database-manager';
import { Firewall, FireWallOptMask } from '../../src/models/firewall/Firewall';
import { Interface } from '../../src/models/interface/Interface';
import { IPObj } from '../../src/models/ipobj/IPObj';
import { PolicyRule } from '../../src/models/policy/PolicyRule';
import StringHelper from '../../src/utils/string.helper';
import { FwCloudProduct } from './fwcloud-factory';

export interface ReplicationTargetSide {
  firewall: Firewall;
  wanInterface: Interface;
  lanInterface: Interface;
  wanAddress: IPObj;
}

/**
 * Creates a standalone firewall inside the product FWCloud with wan/lan
 * interfaces, an optional wan interface address and the generated default
 * policy, ready to act as a policy replication target.
 */
export async function makeReplicationTargetFirewall(
  fwc: FwCloudProduct,
  withWanAddress: boolean = true,
): Promise<ReplicationTargetSide> {
  const manager = db.getSource().manager;

  const firewall = await manager.getRepository(Firewall).save({
    name: StringHelper.randomize(10),
    fwCloudId: fwc.fwcloud.id,
  });

  const wanInterface = await manager.getRepository(Interface).save({
    name: 'ens18',
    type: '10',
    interface_type: '10',
    firewallId: firewall.id,
  });

  const lanInterface = await manager.getRepository(Interface).save({
    name: 'ens19',
    type: '10',
    interface_type: '10',
    firewallId: firewall.id,
  });

  let wanAddress: IPObj = null;
  if (withWanAddress) {
    wanAddress = await manager.getRepository(IPObj).save({
      name: 'tgt-wan-addr',
      address: '203.0.113.10',
      ipObjTypeId: 5,
      ip_version: 4,
      interfaceId: wanInterface.id,
      fwCloudId: fwc.fwcloud.id,
    });
  }

  await PolicyRule.insertDefaultPolicy(firewall.id, null, FireWallOptMask.STATEFUL);

  return { firewall, wanInterface, lanInterface, wanAddress };
}
