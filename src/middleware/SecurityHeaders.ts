import { Request, Response, NextFunction } from 'express';
import { Middleware } from '../fonaments/http/middleware/Middleware';

export class SecurityHeaders extends Middleware {
  public async handle(_req: Request, res: Response, next: NextFunction): Promise<void> {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    next();
  }
}
