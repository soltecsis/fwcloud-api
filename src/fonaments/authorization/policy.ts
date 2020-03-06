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
import { app } from "../abstract-application";

export abstract class Authorization {
    protected _authorizationService: AuthorizationService;
    
    public async authorize(): Promise<void> {
        this._authorizationService = await app().getService<AuthorizationService>(AuthorizationService.name);
    }

    public can(): boolean {
        return false;
    }
    
    static revoke() {
        return new Unauthorized();
    }

    static grant() {
        return new Authorized();
    }
}

export class Authorized extends Authorization {
    public async authorize() {
        await super.authorize();
    }

    public can(): boolean {
        return true;
    }
}

export class Unauthorized extends Authorization {
    public async authorize() {
        await super.authorize();
        this._authorizationService.revokeAuthorization();
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