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

import { Controller } from "../../fonaments/http/controller";
import { IptablesSaveService } from "../../iptables-save/iptables-save.service";
import { IptablesSaveStats } from '../../iptables-save/iptables-save.data';
import { Request } from "express";
import { ResponseBuilder } from "../../fonaments/http/response-builder";
import { app } from "../../fonaments/abstract-application";

export class IptablesSaveController extends Controller {
    protected _iptablesSaveService: IptablesSaveService;

    async make() {
        this._iptablesSaveService = await app().getService<IptablesSaveService>(IptablesSaveService.name);
    }

    // WARNING: We are validating input wit Joi middleware, ignore this validation.
    //@Validate({})
    public async import(request: Request): Promise<ResponseBuilder> {
        // If request.body.fwcloud and request.body.firewall exists, we have already checked in the access control middleware 
        // that the user has access to the indicated fwcloud and firewall.

        let result: IptablesSaveStats;

        if (request.body.type === 'data')
            result = await this._iptablesSaveService.import(request);
        else // ssh
            result = await this._iptablesSaveService.importSSH(request);

        return ResponseBuilder.buildResponse().status(200).body(result);
    }

    // WARNING: We are validating input wit Joi middleware, ignore this validation.
    //@Validate({})
    public async export(request: Request): Promise<ResponseBuilder> {
        const result = await this._iptablesSaveService.export(request);

        return ResponseBuilder.buildResponse().status(200).body(result);
    }
}