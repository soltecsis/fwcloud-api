import { NextFunction, Request, Response } from 'express';
import { Middleware } from '../fonaments/http/middleware/Middleware';
import { WireGuard } from '../models/vpn/wireguard/WireGuard';
import { WireGuardPrefix } from '../models/vpn/wireguard/WireGuardPrefix';
import { IPSec } from '../models/vpn/ipsec/IPSec';
import { IPSecPrefix } from '../models/vpn/ipsec/IPSecPrefix';

export class RestrictedMiddleware extends Middleware {
  public async handle(req: Request, res: Response, next: NextFunction): Promise<void> {
    if (req.method === 'PUT' && req.path.endsWith('policy/wireguard/del')) return next();
    if (req.method === 'PUT' && req.path.endsWith('policy/ipsec/del')) return next();

    if (
      req.method === 'PUT' &&
      (req.path.endsWith('wireguard/restricted') ||
        req.path.endsWith('wireguard/del') ||
        req.path.endsWith('ipsec/restricted') ||
        req.path.endsWith('ipsec/del'))
    ) {
      if (req.body.fwcloud && req.body.wireguard) {
        await this.wireguard(req, res, next);
      } else if (req.body.fwcloud && req.body.ipsec) {
        await this.ipsec(req, res, next);
      } else if (req.body.fwcloud && req.body.prefix) {
        next();
      }
    } else if (
      req.method === 'PUT' &&
      (req.path.endsWith('wireguard/prefix/restricted') ||
        req.path.endsWith('wireguard/prefix/del') ||
        req.path.endsWith('ipsec/prefix/restricted') ||
        req.path.endsWith('ipsec/prefix/del'))
    ) {
      if (req.body.fwcloud && req.body.prefix) {
        if (req.path.includes('wireguard')) {
          await this.wireguard_prefix(req, res, next);
        } else if (req.path.includes('ipsec')) {
          await this.ipsec_prefix(req, res, next);
        }
      }
    } else {
      next();
    }
  }

  public async wireguard(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void | Response> {
    try {
      let data = await WireGuard.searchWireGuardChild(
        req.dbCon,
        req.body.fwcloud,
        req.body.wireguard,
      );
      if (data.result) return res.status(403).json(data);
      data = await WireGuard.searchWireGuardUsage(req.dbCon, req.body.fwcloud, req.body.wireguard);
      if (data.result) return res.status(403).json(data);
      next();
    } catch (error) {
      res.status(400).json(error);
    }
  }

  public async wireguard_prefix(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void | Response> {
    try {
      const data = await WireGuardPrefix.searchPrefixUsage(
        req.dbCon,
        req.body.fwcloud,
        req.body.prefix,
      );
      if ((data as any).result) return res.status(403).json(data);
      next();
    } catch (error) {
      res.status(400).json(error);
    }
  }
  public async ipsec(req: Request, res: Response, next: NextFunction): Promise<void | Response> {
    try {
      const ipsecData = (req as any).ipsec;
      const hasParentIPSec = ipsecData?.ipsec !== null && ipsecData?.ipsec !== undefined;
      const hasCertificate = ipsecData?.crt !== null && ipsecData?.crt !== undefined;
      const isClientWithoutServer = ipsecData?.type === 333 || (!hasParentIPSec && !hasCertificate);

      // IPSec-only clients cannot have child configurations.
      if (!isClientWithoutServer) {
        const childData = await IPSec.searchIPSecChild(req.dbCon, req.body.fwcloud, req.body.ipsec);
        if (childData.result) return res.status(403).json(childData);
      }

      const usageData = await IPSec.searchIPSecUsage(req.dbCon, req.body.fwcloud, req.body.ipsec);
      if (usageData.result) return res.status(403).json(usageData);
      next();
    } catch (error) {
      res.status(400).json(error);
    }
  }

  public async ipsec_prefix(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void | Response> {
    try {
      const data = await IPSecPrefix.searchPrefixUsage(
        req.dbCon,
        req.body.fwcloud,
        req.body.prefix,
      );
      if ((data as any).result) return res.status(403).json(data);
      next();
    } catch (error) {
      res.status(400).json(error);
    }
  }
}
