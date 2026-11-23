import { Request, Response, NextFunction } from 'express';
import { Middleware } from '../fonaments/http/middleware/Middleware';
import { RouterService } from '../fonaments/http/router/router.service';

export class ResolveOperation extends Middleware {
  public async handle(req: Request, _res: Response, next: NextFunction): Promise<void> {
    const router = await this.app.getService<RouterService>(RouterService.name);
    req.operationPolicy = router.resolveOperation(req.method, req.path);
    next();
  }
}
