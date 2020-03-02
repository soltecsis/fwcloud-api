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

import { Middleware } from "../fonaments/http/middleware/Middleware";
import { Request, Response, NextFunction } from "express";
import ejs from 'ejs';
import * as path from 'path';

export class EJS extends Middleware {
    public handle(req: Request, res: Response, next: NextFunction) {
        this.app.express.set('views', path.join(this.app.path, 'dist', 'src', 'views'));
        this.app.express.engine('html', ejs.renderFile);
        this.app.express.set('view engine', 'html');
        next();
    }

}