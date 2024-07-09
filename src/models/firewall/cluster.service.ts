import db from '../../database/database-manager';
import { app } from '../../fonaments/abstract-application';
import { Service } from '../../fonaments/services/service';
import { Tree } from '../tree/Tree';
import { Cluster } from './Cluster';
import { FirewallService } from './firewall.service';

export class ClusterService extends Service {
  public async remove(clusterId: number, fwcloudId: number, userId: number): Promise<void> {
    return new Promise((resolve, reject) => {
      //BUCLE de FIREWALL en CLUSTER
      let sql = `SELECT ${userId} as iduser, F.* FROM firewall F
                WHERE F.cluster=${clusterId} AND F.fwcloud=${fwcloudId} ORDER BY fwmaster desc`;
      db.getQuery().query(sql, async (error, fws) => {
        if (error) return reject(error);

        try {
          const firewallService: FirewallService = await app().getService(FirewallService.name);

          for (const fw of fws) {
            await firewallService.remove(fw.id, fwcloudId, userId);
          }
        } catch (error) {
          return reject(error);
        }

        sql = `SELECT T.* , A.id as idnode FROM ${Cluster._getTableName()} T
                    INNER JOIN fwc_tree A ON A.id_obj=T.id AND A.obj_type=100
                    WHERE T.id=${clusterId}`;
        db.getQuery().query(sql, async (error, cluster) => {
          if (error) return reject(error);

          try {
            //If exists Id from cluster to remove
            if (cluster.length > 0)
              await Tree.deleteFwc_TreeFullNode({
                id: cluster[0].idnode,
                fwcloud: fwcloudId,
                iduser: userId,
              });
          } catch (error) {
            return reject(error);
          }

          db.getQuery().query(
            `DELETE FROM ${Cluster._getTableName()} WHERE id=${cluster[0].id}`,
            (error, result) => {
              if (error) return reject(error);
              resolve();
            },
          );
        });
      });
    });
  }
}
