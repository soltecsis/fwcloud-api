import { Middleware } from '../fonaments/http/middleware/Middleware';
import { Request, Response, NextFunction } from 'express';
import { logger } from '../fonaments/abstract-application';

export class LogRequestMiddleware extends Middleware {
  public handle(req: Request, res: Response, next: NextFunction): Promise<void> {
    return new Promise(() => {
      logger('http').log(
        'entry',
        `${req.ip}|HTTP/${req.httpVersion}|${req.method.toUpperCase()}|${req.url}`,
      );
      next();
    });
  }
}
