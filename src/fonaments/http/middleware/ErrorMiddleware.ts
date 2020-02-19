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

import { Application } from "../../../Application";
import { Request, Response, NextFunction } from "express";

export abstract class ErrorMiddleware {
    protected app: Application;

    public abstract handle(error: any, req: Request, res: Response, next: NextFunction): void;

    private safeHandler(error: any, req: Request, res: Response, next: NextFunction) {
        try {
            const result = this.handle(error, req, res, next);
        } catch (e) {
            console.error(e);
            throw e;
        }
    }

    public register(app: Application) {
        this.app = app;
        app.express.use((error: any, req: Request, res: Response, next: NextFunction) => {
            this.safeHandler(error, req, res, next);
        });
    }
}