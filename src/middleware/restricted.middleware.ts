import { NextFunction, Request, Response } from 'express';
import { Middleware } from '../fonaments/http/middleware/Middleware';
import { WireGuard } from '../models/vpn/wireguard/WireGuard';
import { WireGuardPrefix } from '../models/vpn/wireguard/WireGuardPrefix';

export class RestrictedMiddleware extends Middleware {
  public async handle(req: Request, res: Response, next: NextFunction): Promise<void> {
    if (
      req.method === 'PUT' &&
      (req.path.endsWith('wireguard/restricted') || req.path.endsWith('wireguard/del'))
    ) {
      if (req.body.fwcloud && req.body.wireguard) {
        await this.wireguard(req, res, next);
      }
    } else if (
      req.method === 'PUT' &&
      (req.path.endsWith('wireguard/prefix/restricted') ||
        req.path.endsWith('wireguard/prefix/del'))
    ) {
      if (req.body.fwcloud && req.body.prefix) {
        await this.wireguard_prefix(req, res, next);
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
}
