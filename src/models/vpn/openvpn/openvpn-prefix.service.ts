import db from '../../../database/database-manager';
import { Service } from '../../../fonaments/services/service';
import { Firewall } from '../../firewall/Firewall';
import { OpenVPNPrefix } from './OpenVPNPrefix';
import { FirewallService } from '../../firewall/firewall.service';
import { FwcTree } from '../../tree/fwc-tree.model';
import fwcError from '../../../utils/error_table';
import RequestData from '../../data/RequestData';

export class OpenVPNPrefixService extends Service {
  protected _firewallService: FirewallService;

  public async build(): Promise<Service> {
    this._firewallService = await this._app.getService(FirewallService.name);
    return this;
  }

  // Activate the compile/install flags of all the firewalls that use this OpenVPN prefix.
  public async update(req: RequestData): Promise<void> {
    // Verify that the new prefix name doesn't already exists.
    req.body.ca = (req as any).prefix.ca;

    if (await OpenVPNPrefix.existsPrefix(req.dbCon, (req as any).prefix.openvpn, req.body.name))
      throw fwcError.ALREADY_EXISTS;

    // If we modify a prefix used in a rule or group, and the new prefix name has no openvpn clients, then don't allow it.
    const search: any = await OpenVPNPrefix.searchPrefixUsage(
      req.dbCon,
      req.body.fwcloud,
      req.body.prefix,
    );
    if (
      search.result &&
      (
        await OpenVPNPrefix.getOpenvpnClientesUnderPrefix(
          req.dbCon,
          (req as any).prefix.openvpn,
          req.body.name,
        )
      ).length < 1
    )
      throw fwcError.IPOBJ_EMPTY_CONTAINER;

    // Modify the prefix name.
    await OpenVPNPrefix.modifyPrefix(req);

    // Apply the new CRT prefix container.
    await OpenVPNPrefix.applyOpenVPNPrefixes(
      req.dbCon,
      req.body.fwcloud,
      (req as any).prefix.openvpn,
    );

    //Update all group nodes which references the prefix to set the new name
    await db
      .getSource()
      .manager.getRepository(FwcTree)
      .createQueryBuilder('node')
      .update(FwcTree)
      .set({
        name: req.body.name,
      })
      .where('node_type = :type', { type: 'PRO' })
      .andWhere('id_obj = :id', { id: req.body.prefix })
      .execute();

    // Update the compilation/installation flags of all firewalls that use this prefix.
    await this.updateAffectedFirewalls(req.body.fwcloud, req.body.prefix);
  }

  protected async updateAffectedFirewalls(fwcloudId: number, prefixId: number): Promise<void> {
    const search = await OpenVPNPrefix.searchPrefixUsage(db.getQuery(), fwcloudId, prefixId, true);
    const PrefixInRule = search.restrictions.PrefixInRule;
    const PrefixInGroupIpRule = search.restrictions.PrefixInGroupInRule;

    for (let j = 0; j < PrefixInRule.length; j++)
      await Firewall.updateFirewallStatus(fwcloudId, PrefixInRule[j].firewall_id, '|3');

    for (let j = 0; j < PrefixInGroupIpRule.length; j++)
      await Firewall.updateFirewallStatus(fwcloudId, PrefixInGroupIpRule[j].firewall_id, '|3');

    const firewall: Firewall[] = await db
      .getSource()
      .manager.getRepository(Firewall)
      .createQueryBuilder('firewall')
      .distinct()
      .innerJoin('firewall.routingTables', 'table')
      .leftJoin('table.routingRules', 'rule')
      .leftJoin('table.routes', 'route')

      .leftJoin('rule.routingRuleToIPObjGroups', 'routingRuleToIPObjGroups')
      .leftJoin('routingRuleToIPObjGroups.ipObjGroup', 'ruleGroup')
      .leftJoin('ruleGroup.openVPNPrefixes', 'ruleGroupOpenVPNPrefix')

      .leftJoin('rule.routingRuleToOpenVPNPrefixes', 'routingRuleToOpenVPNPrefix')

      .leftJoin('route.routeToIPObjGroups', 'routeToIPObjGroups')
      .leftJoin('routeToIPObjGroups.ipObjGroup', 'routeGroup')
      .leftJoin('routeGroup.openVPNPrefixes', 'routeGroupOpenVPNPrefix')

      .leftJoin('route.routeToOpenVPNPrefixes', 'routeToOpenVPNPrefix')

      .where('routingRuleToOpenVPNPrefix.openVPNPrefixId = :idRoutingRule', {
        idRoutingRule: prefixId,
      })
      .orWhere('routeToOpenVPNPrefix.openVPNPrefixId = :idRoute', { idRoute: prefixId })
      .orWhere('ruleGroupOpenVPNPrefix.id = :idRuleGroupPrefix', {
        idRuleGroupPrefix: prefixId,
      })
      .orWhere('routeGroupOpenVPNPrefix.id = :idRouteGroupPrefix', {
        idRouteGroupPrefix: prefixId,
      })

      .getMany();

    await this._firewallService.markAsUncompiled(firewall.map((item) => item.id));
  }
}
