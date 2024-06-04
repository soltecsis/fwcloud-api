import { Service } from "../../fonaments/services/service";
import { Firewall } from "./Firewall";
import { FSHelper } from "../../utils/fs-helper";
import * as path from "path";
import * as fs from "fs";
import { Compiler } from "./compiler";
import { Installer } from "./installer";
import ObjectHelpers from "../../utils/object-helpers";
import { EventEmitter } from "typeorm/platform/PlatformTools";
import db from "../../database/database-manager";
import { IPObj } from "../ipobj/IPObj";
import { getCustomRepository, getRepository, In } from "typeorm";
import { FirewallRepository } from "./firewall.repository";
import { AbstractApplication, app } from "../../fonaments/abstract-application";
import { PolicyRule } from "../policy/PolicyRule";
import { PolicyGroup } from "../policy/PolicyGroup";
import { Interface } from "../interface/Interface";
import { OpenVPN } from "../vpn/openvpn/OpenVPN";
import { Tree } from "../tree/Tree";
import { RoutingTable } from "../routing/routing-table/routing-table.model";
import { RoutingTableService } from "../routing/routing-table/routing-table.service";
import { Route } from "../routing/route/route.model";
import { RoutingRule } from "../routing/routing-rule/routing-rule.model";
import { RoutingRuleToIPObj } from "../routing/routing-rule/routing-rule-to-ipobj.model";
import { RouteToIPObj } from "../routing/route/route-to-ipobj.model";
import { RouteToIPObjGroup } from "../routing/route/route-to-ipobj-group.model";
import { RouteToOpenVPN } from "../routing/route/route-to-openvpn.model";
import { RoutingRuleToIPObjGroup } from "../routing/routing-rule/routing-rule-to-ipobj-group.model";
import { RoutingRuleToOpenVPN } from "../routing/routing-rule/routing-rule-to-openvpn.model";
import { RoutingRuleToOpenVPNPrefix } from "../routing/routing-rule/routing-rule-to-openvpn-prefix.model";
import { RoutingRuleToMark } from "../routing/routing-rule/routing-rule-to-mark.model";
import { RoutingRuleService } from "../routing/routing-rule/routing-rule.service";
import { HAProxyRule } from "../system/haproxy/haproxy_r/haproxy_r.model";
import { HAProxyRuleService } from "../system/haproxy/haproxy_r/haproxy_r.service";
import { DHCPRuleService } from "../system/dhcp/dhcp_r/dhcp_r.service";
import { DHCPRule } from "../system/dhcp/dhcp_r/dhcp_r.model";
import { DHCPGroup } from "../system/dhcp/dhcp_g/dhcp_g.model";
import { KeepalivedRuleService } from "../system/keepalived/keepalived_r/keepalived_r.service";
import { KeepalivedGroup } from "../system/keepalived/keepalived_g/keepalived_g.model";
import { KeepalivedRule } from "../system/keepalived/keepalived_r/keepalived_r.model";
const fwcError = require("../../utils/error_table");
const utilsModel = require("../../utils/utils.js");

export type SSHConfig = {
  host: string;
  port: number;
  username: string;
  password: string;
};

export class FirewallService extends Service {
  protected _dataDir: string;
  protected _scriptFilename: string;
  protected _headerPath: string;
  protected _footerPath: string;

  protected _repository: FirewallRepository;

  constructor(app: AbstractApplication) {
    super(app);
    this._repository = getCustomRepository(FirewallRepository);
  }

  public async build(): Promise<FirewallService> {
    this._dataDir = this._app.config.get("policy").data_dir;
    this._scriptFilename = this._app.config.get("policy").script_name;
    this._headerPath = this._app.config.get("policy").header_file;
    this._footerPath = this._app.config.get("policy").footer_file;

    return this;
  }

  /**
   * Compile a firewall
   *
   * @param firewall
   */
  public async compile(
    firewall: Firewall,
    eventEmitter: EventEmitter = new EventEmitter(),
  ): Promise<Firewall> {
    if (firewall.fwCloudId === undefined || firewall.fwCloudId === null) {
      throw new Error("Firewall does not belong to a fwcloud");
    }

    await this.createFirewallPolicyDirectory(firewall);
    await new Compiler(firewall).compile(
      this._headerPath,
      this._footerPath,
      eventEmitter,
    );

    return firewall;
  }

  public async install(
    firewall: Firewall,
    customSSHConfig: Partial<SSHConfig>,
    eventEmitter: EventEmitter = new EventEmitter(),
  ): Promise<Firewall> {
    const ipObj: IPObj = await getRepository(IPObj).findOne({
      id: firewall.install_ipobj,
      interfaceId: firewall.install_interface,
    });
    const sshConfig: SSHConfig = <SSHConfig>ObjectHelpers.merge(
      {
        host: ipObj.address,
        port: firewall.install_port,
        username: firewall.install_user,
        password: firewall.install_pass,
      },
      customSSHConfig,
    );

    await new Installer(firewall).install(sshConfig, eventEmitter);
    await Firewall.updateFirewallStatus(firewall.fwCloudId, firewall.id, "&~2");
    await Firewall.updateFirewallInstallDate(firewall.fwCloudId, firewall.id);

    return firewall;
  }

  public async markAsUncompiled(ids: number[]): Promise<Firewall[]>;
  public async markAsUncompiled(id: number): Promise<Firewall>;
  public async markAsUncompiled(
    idOrIds: number | number[],
  ): Promise<Firewall | Firewall[]> {
    if (Array.isArray(idOrIds)) {
      const firewalls: Firewall[] = await this._repository.find({
        where: {
          id: In(idOrIds),
        },
      });
      return await this._repository.markAsUncompiled(firewalls);
    }

    const firewall: Firewall = await this._repository.findOneOrFail(idOrIds);
    await getCustomRepository(FirewallRepository).markAsUncompiled(firewall);
    return this._repository.findOneOrFail(idOrIds);
  }

  public async clone(
    originalId: number,
    clonedId: number,
    dataI: { id_org: number; id_clon: number }[],
  ): Promise<void> {
    const routingTables: RoutingTable[] = await getRepository(RoutingTable)
      .createQueryBuilder("table")
      .where("table.firewallId = :originalId", { originalId })
      .leftJoinAndSelect("table.routes", "route")
      .leftJoinAndSelect("table.routingRules", "rule")

      .leftJoinAndSelect("route.routeToIPObjs", "routeToIPObjs")
      .leftJoinAndSelect("route.routeToIPObjGroups", "routeToIPObjGroups")
      .leftJoinAndSelect("route.routeToOpenVPNs", "routeToOpenVPNs")
      .leftJoinAndSelect(
        "route.routeToOpenVPNPrefixes",
        "routeToOpenVPNPrefixes",
      )

      .leftJoinAndSelect("rule.routingRuleToOpenVPNs", "routingRuleToOpenVPNs")
      .leftJoinAndSelect(
        "rule.routingRuleToOpenVPNPrefixes",
        "routingRuleToOpenVPNPrefixes",
      )
      .leftJoinAndSelect(
        "rule.routingRuleToIPObjGroups",
        "routingRuleToIPObjGroups",
      )
      .leftJoinAndSelect("rule.routingRuleToIPObjs", "routingRuleToIPObjs")
      .leftJoinAndSelect("rule.routingRuleToMarks", "routingRuleToMarks")
      .getMany();

    for (const table of routingTables) {
      const persistedTable: RoutingTable = await (
        await app().getService<RoutingTableService>(RoutingTableService.name)
      ).create({
        firewallId: clonedId,
        name: table.name,
        comment: table.comment,
        number: table.number,
      });

      await getRepository(Route).save(
        table.routes.map((route) => {
          route.id = undefined;
          route.routingTableId = persistedTable.id;
          const mapIndex: number = dataI
            .map((item) => item.id_org)
            .indexOf(route.interfaceId);

          if (mapIndex >= 0) {
            route.interfaceId = dataI[mapIndex].id_clon;
          }
          return route;
        }),
      );

      await getRepository(RoutingRule).save(
        table.routingRules.map((rule) => {
          rule.id = undefined;
          rule.routingTableId = persistedTable.id;
          return rule;
        }),
      );
    }
  }

  public async remove(
    firewallId: number,
    fwcloudId: number,
    userId: number,
  ): Promise<void> {
    const routingTableService: RoutingTableService = await app().getService(
      RoutingTableService.name,
    );
    const routingRuleService: RoutingRuleService = await app().getService(
      RoutingRuleService.name,
    );
    const dhcpRuleService: DHCPRuleService = await app().getService(
      DHCPRuleService.name,
    );
    const keepalivedRuleService: KeepalivedRuleService = await app().getService(
      KeepalivedRuleService.name,
    );
    const haproxyRuleService: HAProxyRuleService = await app().getService(
      HAProxyRuleService.name,
    );

    const firewallEntity: Firewall = await getRepository(
      Firewall,
    ).findOneOrFail(firewallId, {
      relations: [
        "routingTables",
        "routingTables.routingRules",
        "dhcpRules",
        "keepalivedRules",
        "haproxyRules",
      ],
    });
    for (const table of firewallEntity.routingTables) {
      await routingRuleService.bulkRemove(
        table.routingRules.map((item) => item.id),
      );
      await routingTableService.remove({
        fwCloudId: firewallEntity.fwCloudId,
        firewallId: firewallEntity.id,
        id: table.id,
      });
    }

    await dhcpRuleService.bulkRemove(
      firewallEntity.dhcpRules.map((item) => item.id),
    );
    await keepalivedRuleService.bulkRemove(
      firewallEntity.keepalivedRules.map((item) => item.id),
    );
    await haproxyRuleService.bulkRemove(
      firewallEntity.haproxyRules.map((item) => item.id),
    );

    await Firewall.deleteFirewall(userId, fwcloudId, firewallId);
  }

  /**
   * Create compilation output directories
   *
   * @param firewall
   */
  protected async createFirewallPolicyDirectory(
    firewall: Firewall,
  ): Promise<void> {
    const directoryPath: string = path.join(
      this._dataDir,
      firewall.fwCloudId.toString(),
      firewall.id.toString(),
    );

    if (FSHelper.directoryExists(directoryPath)) {
      FSHelper.rmDirectorySync(directoryPath);
    }

    FSHelper.mkdirSync(directoryPath);
    fs.writeFileSync(path.join(directoryPath, this._scriptFilename), "");
  }

  public deleteFirewallFromCluster(
    clusterId: number,
    firewallId: number,
    fwcloudId: number,
    userId: number,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const sqlExists = `SELECT T.*, A.id as idnode FROM ${Firewall._getTableName()} T 
				INNER JOIN user__fwcloud U ON T.fwcloud=U.fwcloud AND U.user=${userId}
				INNER JOIN fwc_tree A ON A.id_obj=T.id AND A.node_type="FW"
				WHERE T.id=${firewallId} AND T.cluster=${clusterId}`;

      db.getQuery().query(sqlExists, async (error, row) => {
        if (error) return reject(error);
        if (row.length === 0) return reject(fwcError.NOT_FOUND);

        const rowF = row[0];
        const idNodeFirewall = rowF.idnode;

        // Deleting FIREWAL MASTER
        if (rowF.fwmaster === 1) {
          // Transfer data to the new slave firewall.
          let sql = `SELECT T.id FROM ${Firewall._getTableName()} T
						WHERE fwmaster=0 AND  T.cluster=${clusterId}	ORDER by T.id limit 1`;
          db.getQuery().query(sql, async (error, rowS) => {
            if (error) return reject(error);
            if (rowS.length === 0) return reject(fwcError.NOT_FOUND);

            const idNewFM = rowS[0].id;
            try {
              // Rename data directory with the new firewall master id.
              await utilsModel.renameFirewallDataDir(
                fwcloudId,
                firewallId,
                idNewFM,
              );

              // Move all related objects to the new firewall.
              await PolicyRule.moveToOtherFirewall(
                db.getQuery(),
                firewallId,
                idNewFM,
              );
              await PolicyGroup.moveToOtherFirewall(
                db.getQuery(),
                firewallId,
                idNewFM,
              );
              await Interface.moveToOtherFirewall(
                db.getQuery(),
                firewallId,
                idNewFM,
              );
              await OpenVPN.moveToOtherFirewall(
                db.getQuery(),
                firewallId,
                idNewFM,
              );
              await DHCPGroup.moveToOtherFirewall(firewallId, idNewFM);
              await DHCPRule.moveToOtherFirewall(firewallId, idNewFM);
              await KeepalivedGroup.moveToOtherFirewall(firewallId, idNewFM);
              await KeepalivedRule.moveToOtherFirewall(firewallId, idNewFM);

              // Move routing tables.
              const routingTableService =
                await app().getService<RoutingTableService>(
                  RoutingTableService.name,
                );
              await routingTableService.moveToOtherFirewall(
                firewallId,
                idNewFM,
              );

              // Promote the new master.
              await Firewall.promoteToMaster(db.getQuery(), idNewFM);

              // Delete the old firewall node.
              await Firewall.deleteFirewallRow(
                db.getQuery(),
                fwcloudId,
                firewallId,
              );
            } catch (error) {
              return reject(error);
            }

            //UPDATE TREE RECURSIVE FROM IDNODE CLUSTER
            //GET NODE FROM CLUSTER
            sql = `SELECT ${firewallId} as OLDFW, ${idNewFM} as NEWFW, T.* FROM fwc_tree T 
							WHERE node_type='CL' AND id_obj=${clusterId} AND fwcloud=${fwcloudId}`;
            db.getQuery().query(sql, async (error, rowT) => {
              if (error) return reject(error);

              if (rowT && rowT.length > 0) {
                try {
                  await Tree.updateIDOBJFwc_TreeFullNode(rowT[0]);

                  //DELETE TREE NODES From firewall
                  const dataNode = {
                    id: idNodeFirewall,
                    fwcloud: fwcloudId,
                    iduser: userId,
                  };
                  await Tree.deleteFwc_TreeFullNode(dataNode);
                } catch (error) {
                  return reject(error);
                }
              }

              resolve();
            });
          });
        } else {
          // Deleting FIREWALL SLAVE
          try {
            //DELETE TREE NODES From firewall
            await Tree.deleteFwc_TreeFullNode({
              id: idNodeFirewall,
              fwcloud: fwcloudId,
              iduser: userId,
            });
            await Firewall.deleteFirewallRow(
              db.getQuery(),
              fwcloudId,
              firewallId,
            );
            resolve();
          } catch (error) {
            reject(error);
          }
        }
      });
    });
  }
}
