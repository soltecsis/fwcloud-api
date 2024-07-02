import { Service } from '../../fonaments/services/service';
import { DeepPartial } from 'typeorm';
import { FwCloud } from './FwCloud';
import { colorUsage, fwcloudColors } from './FwCloud-colors';
import { User } from '../user/User';
import { Tree } from '../tree/Tree';
import { PolicyRule } from '../policy/PolicyRule';
import { PolicyGroup } from '../policy/PolicyGroup';
import { Route } from '../routing/route/route.model';
import { RoutingRule } from '../routing/routing-rule/routing-rule.model';
import { RouteGroup } from '../routing/route-group/route-group.model';
import { RoutingGroup } from '../routing/routing-group/routing-group.model';
import db from '../../database/database-manager';

export class FwCloudService extends Service {
  /**
   * Creates and store a new FwCloud
   */
  public async store(data: DeepPartial<FwCloud>): Promise<FwCloud> {
    let fwCloud: FwCloud = FwCloud.create(data);
    await fwCloud.save();

    // Data directories are created by typeorm listener
    await this.grantAdminAccess(fwCloud);
    await Tree.createAllTreeCloud(fwCloud);

    return FwCloud.findOne({ where: { id: fwCloud.id } });
  }

  public async update(
    fwCloud: FwCloud,
    data: DeepPartial<FwCloud>,
  ): Promise<FwCloud> {
    fwCloud = Object.assign(fwCloud, data);
    await fwCloud.save();

    return fwCloud;
  }

  public async colors(fwCloud: FwCloud): Promise<colorUsage[]> {
    const policyRulesColors: fwcloudColors = new fwcloudColors(
      await db
        .getSource()
        .manager.getRepository(PolicyRule)
        .createQueryBuilder('policy_r')
        .select('policy_r.style', 'color')
        .addSelect('COUNT(policy_r.style)', 'count')
        .innerJoin('policy_r.firewall', 'firewall')
        .innerJoin('firewall.fwCloud', 'fwcloud')
        .where('policy_r.style is not null')
        .andWhere(`policy_r.style!=121`)
        .andWhere(`fwcloud.id=${fwCloud.id}`)
        .groupBy('policy_r.style')
        .getRawMany(),
    );

    const groupRulesColors: fwcloudColors = new fwcloudColors(
      await db
        .getSource()
        .manager.getRepository(PolicyGroup)
        .createQueryBuilder('policy_g')
        .select('policy_g.groupstyle', 'color')
        .addSelect('COUNT(policy_g.groupstyle)', 'count')
        .innerJoin('policy_g.firewall', 'firewall')
        .innerJoin('firewall.fwCloud', 'fwcloud')
        .where('policy_g.groupstyle is not null')
        .andWhere(`policy_g.groupstyle!=121`)
        .andWhere(`fwcloud.id=${fwCloud.id}`)
        .groupBy('policy_g.groupstyle')
        .getRawMany(),
    );

    const routesColors: fwcloudColors = new fwcloudColors(
      await db
        .getSource()
        .manager.getRepository(Route)
        .createQueryBuilder('route')
        .select('route.style', 'color')
        .addSelect('COUNT(route.style)', 'count')
        .innerJoin('route.routingTable', 'table')
        .innerJoin('table.firewall', 'firewall')
        .innerJoin('firewall.fwCloud', 'fwcloud')
        .where('route.style is not null')
        .andWhere(`route.style!=121`)
        .andWhere(`fwcloud.id=${fwCloud.id}`)
        .groupBy('route.style')
        .getRawMany(),
    );

    const groupRoutesColors: fwcloudColors = new fwcloudColors(
      await db
        .getSource()
        .manager.getRepository(RouteGroup)
        .createQueryBuilder('route_g')
        .select('route_g.style', 'color')
        .addSelect('COUNT(route_g.style)', 'count')
        .innerJoin('route_g.firewall', 'firewall')
        .innerJoin('firewall.fwCloud', 'fwcloud')
        .where('route_g.style is not null')
        .andWhere(`route_g.style!=121`)
        .andWhere(`fwcloud.id=${fwCloud.id}`)
        .groupBy('route_g.style')
        .getRawMany(),
    );

    const routingRulesColors: fwcloudColors = new fwcloudColors(
      await db
        .getSource()
        .manager.getRepository(RoutingRule)
        .createQueryBuilder('routing_r')
        .select('routing_r.style', 'color')
        .addSelect('COUNT(routing_r.style)', 'count')
        .leftJoin('routing_r.routingTable', 'table')
        .innerJoin('table.firewall', 'firewall')
        .innerJoin('firewall.fwCloud', 'fwcloud')
        .where('routing_r.style is not null')
        .andWhere(`routing_r.style!=121`)
        .andWhere(`fwcloud.id=${fwCloud.id}`)
        .groupBy('routing_r.style')
        .getRawMany(),
    );

    const groupRoutingRulesColors: fwcloudColors = new fwcloudColors(
      await db
        .getSource()
        .manager.getRepository(RoutingGroup)
        .createQueryBuilder('routing_g')
        .select('routing_g.style', 'color')
        .addSelect('COUNT(routing_g.style)', 'count')
        .innerJoin('routing_g.firewall', 'firewall')
        .innerJoin('firewall.fwCloud', 'fwcloud')
        .where('routing_g.style is not null')
        .andWhere(`routing_g.style!=121`)
        .andWhere(`fwcloud.id=${fwCloud.id}`)
        .groupBy('routing_g.style')
        .getRawMany(),
    );

    policyRulesColors.combine(groupRulesColors);
    policyRulesColors.combine(routesColors);
    policyRulesColors.combine(groupRoutesColors);
    policyRulesColors.combine(routingRulesColors);
    policyRulesColors.combine(groupRoutingRulesColors);
    policyRulesColors.sort();

    return policyRulesColors.colors;
  }

  /**
   * Grant access to all admin users to the FwCloud
   *
   * @param fwCloud FwCloud resource
   */
  protected async grantAdminAccess(fwCloud: FwCloud): Promise<FwCloud> {
    const users: Array<User> = await User.find({ where: { role: 1 } });

    fwCloud.users = users;
    return await fwCloud.save();
  }
}
