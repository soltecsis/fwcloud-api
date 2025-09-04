import db from '../../../database/database-manager';
import { Service } from '../../../fonaments/services/service';
import { Firewall } from '../../firewall/Firewall';
import { Request } from 'express';
import { FirewallService } from '../../firewall/firewall.service';
import { FwcTree } from '../../tree/fwc-tree.model';
import { IPSecPrefix } from './IPSecPrefix';
const fwcError = require('../../../utils/error_table');

export class IPSecPrefixService extends Service {
  protected _firewallService: FirewallService;

  public async build(): Promise<Service> {
    this._firewallService = await this._app.getService(FirewallService.name);
    return this;
  }

  // Activate the compile/install flags of all the firewalls that use this IPSec prefix.
  public async update(req: Request): Promise<void> {
    // Verify that the new prefix name doesn't already exists.
    req.body.ca = (req as any).prefix.ca;

    if (await IPSecPrefix.existsPrefix(req.dbCon, (req as any).prefix.ipsec, req.body.name))
      throw fwcError.ALREADY_EXISTS;

    // If we modify a prefix used in a rule or group, and the new prefix name has no IPSec clients, then don't allow it.
    const search: any = await IPSecPrefix.searchPrefixUsage(
      req.dbCon,
      req.body.fwcloud,
      req.body.prefix,
    );
    if (
      search.result &&
      (
        await IPSecPrefix.getIPSecClientsUnderPrefix(
          req.dbCon,
          (req as any).prefix.ipsec,
          req.body.name,
        )
      ).length < 1
    )
      throw fwcError.IPOBJ_EMPTY_CONTAINER;

    // Modify the prefix name.
    await IPSecPrefix.modifyPrefix(req);

    // Apply the new CRT prefix container.
    await IPSecPrefix.applyIPSecPrefixes(req.dbCon, req.body.fwcloud, (req as any).prefix.ipsec);

    //Update all group nodes which references the prefix to set the new name
    await db
      .getSource()
      .manager.getRepository(FwcTree)
      .createQueryBuilder('node')
      .update(FwcTree)
      .set({
        name: req.body.name,
      })
      .where('node_type = :type', { type: 'PRI' })
      .andWhere('id_obj = :id', { id: req.body.prefix })
      .execute();

    // Update the compilation/installation flags of all firewalls that use this prefix.
    await this.updateAffectedFirewalls(req.body.fwcloud, req.body.prefix);
  }

  public updateAffectedFirewalls(fwcloudId: number, prefixId: number): Promise<void> {
    return new Promise(async (resolve, reject) => {
      try {
        const search: any = await IPSecPrefix.searchPrefixUsage(
          db.getQuery(),
          fwcloudId,
          prefixId,
          true,
        );
        const PrefixInRule: any = search.restrictions.PrefixInRule;
        const PrefixInGroupIpRule: any = search.restrictions.PrefixInGroupInRule;

        const firewallIds: Set<number> = new Set();
        const clusterIds: Set<number> = new Set();

        PrefixInRule.forEach((item) => {
          firewallIds.add(item.firewall_id);
          if (item.cluster_id) clusterIds.add(item.cluster_id);
        });

        PrefixInGroupIpRule.forEach((item) => {
          firewallIds.add(item.firewall_id);
          if (item.cluster_id) clusterIds.add(item.cluster_id);
        });

        const firewalls: Firewall[] = await db
          .getSource()
          .manager.getRepository(Firewall)
          .createQueryBuilder('firewall')
          .distinct()
          .innerJoin('firewall.routingTables', 'table')
          .leftJoin('table.routingRules', 'rule')
          .leftJoin('table.routes', 'route')

          .leftJoin('rule.routingRuleToIPObjGroups', 'routingRuleToIPObjGroups')
          .leftJoin('routingRuleToIPObjGroups.ipObjGroup', 'ruleGroup')
          .leftJoin('ruleGroup.ipSecPrefixes', 'ruleGroupIPSecPrefix')

          .leftJoin('rule.routingRuleToIPSecPrefixes', 'routingRuleToIPSecPrefix')

          .leftJoin('route.routeToIPObjGroups', 'routeToIPObjGroups')
          .leftJoin('routeToIPObjGroups.ipObjGroup', 'routeGroup')
          .leftJoin('routeGroup.ipSecPrefixes', 'routeGroupIPSecPrefix')

          .leftJoin('route.routeToIPSecPrefixes', 'routeToIPSecPrefix')

          .where('routingRuleToIPSecPrefix.ipsecPrefixId = :idRoutingRule', {
            idRoutingRule: prefixId,
          })
          .orWhere('routeToIPSecPrefix.ipsecPrefixId = :idRoute', { idRoute: prefixId })
          .orWhere('ruleGroupIPSecPrefix.id = :idRuleGroupPrefix', {
            idRuleGroupPrefix: prefixId,
          })
          .orWhere('routeGroupIPSecPrefix.id = :idRouteGroupPrefix', {
            idRouteGroupPrefix: prefixId,
          })
          .getMany();

        firewalls.forEach((fw) => {
          firewallIds.add(fw.id);
          if (fw.clusterId) clusterIds.add(fw.clusterId);
        });

        if (clusterIds.size > 0) {
          const clusterFirewalls = await db
            .getSource()
            .manager.getRepository(Firewall)
            .createQueryBuilder('firewall')
            .where('firewall.clusterId IN (:...clusterIds)', {
              clusterIds: Array.from(clusterIds),
            })
            .getMany();
          clusterFirewalls.forEach((fw) => firewallIds.add(fw.id));
        }

        if (firewallIds.size > 0) {
          await this._firewallService.markAsUncompiled(Array.from(firewallIds));
        }
      } catch (error) {
        return reject(error);
      }

      resolve();
    });
  }
}
