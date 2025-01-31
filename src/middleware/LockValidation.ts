import { Request, Response, NextFunction } from 'express';
import { Middleware } from '../fonaments/http/middleware/Middleware';
import { FwCloud, Lock } from '../models/fwcloud/FwCloud';
import fwcError from '../utils/error_table';
import { logger } from '../fonaments/abstract-application';

export class LockValidation extends Middleware {
  public async handle(req: Request, res: Response, next: NextFunction): Promise<void> {
    if (
      req.method === 'GET' ||
      req.url.startsWith('/backups') ||
      req.url.startsWith('/config') ||
      req.url.startsWith('/openvpnarchives') ||
      req.url.startsWith('/updates') ||
      req.url.startsWith('/systemctl') ||
      req.url.startsWith('/profile') ||
      (req.method === 'PUT' && req.url.endsWith('/get')) ||
      (req.method === 'POST' && req.url === '/user/login') ||
      (req.method === 'POST' && req.url === '/user/logout') ||
      (req.method === 'POST' && req.url === '/fwclouds') ||
      (req.method === 'POST' && req.url === '/fwclouds/import') ||
      (req.method === 'POST' && req.url.startsWith('/fwclouds') && req.url.endsWith('/export')) ||
      (req.method === 'PUT' && req.url === '/updates/updater') ||
      (req.method === 'PUT' && req.url === '/ping') ||
      (req.method === 'PUT' && req.url === '/fwcloud/lock') ||
      (req.method === 'PUT' && req.url === '/fwcloud/unlock')
    ) {
      return next();
    } else {
      try {
        const fwcloudId =
          req.body.fwcloud ||
          (req.url.split('/').length > 2 && !isNaN(Number(req.url.split('/')[2]))
            ? Number(req.url.split('/')[2])
            : undefined);

        if (fwcloudId) {
          const accessResult: Lock = await FwCloud.getFwcloudAccess(
            req.session.user_id,
            fwcloudId,
            req.sessionID,
          );

          if (!accessResult.access) {
            return next();
          }

          if (accessResult.locked) {
            if (accessResult.mylock) {
              return next();
            } else {
              // eslint-disable-next-line @typescript-eslint/only-throw-error
              throw fwcError.ACC_FWCLOUD_LOCK;
            }
          }

          const fwcloudData = {
            fwcloud: fwcloudId,
            iduser: req.session.user_id,
            lock_session_id: req.sessionID,
          };

          const update = await FwCloud.updateFwcloudLock(fwcloudData);
          if (update.result) {
            logger().info(`FWCLOUD: ${fwcloudData.fwcloud} LOCKED BY USER: ${fwcloudData.iduser}`);
            return next();
          } else {
            logger().info(
              `NOT ACCESS FOR LOCKING FWCLOUD: ${fwcloudData.fwcloud} BY USER: ${fwcloudData.iduser}`,
            );
            throw fwcError.other('Error locking FWCloud');
          }
        }
      } catch (error) {
        logger().debug(`Error during lock validation ${JSON.stringify(error)}`);
        res.status(403).json(error);
      }
    }
  }
}
