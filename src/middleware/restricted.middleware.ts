import { NextFunction, Request, Response } from 'express';
import { Middleware } from '../fonaments/http/middleware/Middleware';
import { WireGuard } from '../models/vpn/wireguard/WireGuard';

export class RestrictedMiddleware extends Middleware {
  public async handle(req: Request, res: Response, next: NextFunction): Promise<void> {
    if (
      req.method === 'PUT' &&
      (req.path.endsWith('wireguard/restricted') || req.path.endsWith('wireguard/del'))
    ) {
      if (req.body.fwcloud && req.body.wireguard) {
        await this.wireguard(req, res, next);
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
      if (data.result) res.status(403).json(data);
      data = await WireGuard.searchWireGuardUsage(req.dbCon, req.body.fwcloud, req.body.wireguard);
      if (data.result) res.status(403).json(data);
      next();
    } catch (error) {
      res.status(400).json(error);
    }
  }
}
