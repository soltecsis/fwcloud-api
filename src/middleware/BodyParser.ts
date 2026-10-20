/*!
    Copyright 2019 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
    https://soltecsis.com
    info@soltecsis.com


    This file is part of FWCloud (https://fwcloud.net).

    FWCloud is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    FWCloud is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with FWCloud.  If not, see <https://www.gnu.org/licenses/>.
*/

import { Middleware } from '../fonaments/http/middleware/Middleware';
import { json, Request, Response, NextFunction } from 'express';
import { HttpException } from '../fonaments/exceptions/http/http-exception';

export class BodyParser extends Middleware {
  private readonly parser = json({ limit: '2mb' });

  public async handle(req: Request, res: Response, next: NextFunction): Promise<void> {
    const profileImport =
      req.method === 'POST' &&
      /^\/(?:api\/)?fwclouds\/[^/]+\/(?:assistant\/)?profiles\/import\/?$/.test(req.path);
    if (!profileImport) {
      this.parser(req, res, next);
      return;
    }
    const parser = json({ limit: this.app.config.get('replication_profiles').import_max_size });
    parser(req, res, (error) => {
      if (error?.type === 'entity.too.large')
        return next(
          new HttpException('Replication profile import exceeds the configured size limit.', 413),
        );
      if (error?.type === 'entity.parse.failed')
        return next(new HttpException('Replication profile import must contain valid JSON.', 400));
      next(error);
    });
  }
}
