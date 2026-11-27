import { Request, Response, NextFunction } from 'express';
import { Middleware } from '../fonaments/http/middleware/Middleware';
import { UserRole } from '../models/user/user-role';
import fwcError from '../utils/error_table';

/** Role authorization only; cloud membership and locks remain independent. */
export class ReadOnlyValidation extends Middleware {
  public async handle(req: Request, res: Response, next: NextFunction): Promise<void> {
    if (
      req.session?.user?.role === Number(UserRole.Viewer) &&
      req.operationPolicy?.viewerAllowed !== true
    ) {
      res.status(403).json(fwcError.READ_ONLY_USER);
      return;
    }
    next();
  }
}
