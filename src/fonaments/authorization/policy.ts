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

import { AuthorizationService } from "./authorization.service";
import { AuthorizationException } from "../exceptions/authorization-exception";

export abstract class Authorization {
    public can(): boolean {
        return false;
    }

    public authorize(): void {
        return;
    }
    
    static revoke(): Unauthorized {
        return new Unauthorized;
    }

    static grant(): Authorized {
        return new Authorized;
    }
}

export class Authorized extends Authorization {

    public authorize(): void {
        return;
    }

    public can(): boolean {
        return true;
    }
}

export class Unauthorized extends Authorization {
    public authorize(): void {
        const exception = new AuthorizationException();
        throw exception;
    }

    public can(): boolean {
        return false;
    }
}

export class Policy {
    protected _authorizationService: AuthorizationService;
    protected authorized: boolean;

    constructor() {
        this.authorized = false;
    }
}