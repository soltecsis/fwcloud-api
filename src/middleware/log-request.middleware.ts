import { Middleware } from '../fonaments/http/middleware/Middleware';
import { Request, Response, NextFunction } from 'express';
import { logger } from '../fonaments/abstract-application';
import moment from 'moment';

export class LogRequestMiddleware extends Middleware {
  public async handle(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    logger('http').log(
      'entry',
      `${req.ip}|HTTP/${req.httpVersion}|${req.method.toUpperCase()}|${req.url}`,
    );
    next();
  }
}
