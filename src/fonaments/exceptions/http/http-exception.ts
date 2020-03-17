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

import { Responsable } from "../../contracts/responsable";
import ObjectHelpers from "../../../utils/object-helpers";
import { app, AbstractApplication } from "../../abstract-application";
import { ExceptionBody, ErrorBody } from "../../http/response-builder";
import { FwCloudError } from "../error";

export class HttpException extends FwCloudError implements Responsable {
    
    public status: number;
    
    constructor(message: string = null, caused_by: FwCloudError = null) {
        super(message, caused_by);
        this._app = app();
    }

    toResponse(): ErrorBody {
        return this.generateResponse();
    }

    protected response(): Object {
        return {}
    }

    private generateResponse(): ErrorBody {
        return <ErrorBody>ObjectHelpers.merge(
            this.response(),
            this.shouldAttachExceptionDetails() ? { exception: this.getExceptionDetails() } : null
        );
    }

    private shouldAttachExceptionDetails(): boolean {
        return this._app.config.get('env') !== 'prod';
    }
}