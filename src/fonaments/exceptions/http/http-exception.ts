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

export class HttpException extends Error implements Responsable {
    
    protected _app: AbstractApplication;

    public info: string;
    public status: number;
    public message: string;
    private _exception: string;

    constructor() {
        super();
        this._app = app();
        this._exception = this.constructor.name;
        this.message = this._exception;
        this.info = this.message;
    }
    
    toResponse(): Object {
        return this.generateResponse();
    }

    protected response(): Object {
        return {}
    }

    private generateResponse(): Object {
        return {
            error: ObjectHelpers.merge({
                status: this.status,
                information: this.info,
                message: this.message,
                exception: this._exception,
            }, this.printStack(), this.response())
        }
    }

    private printStack(): Object {
        const obj: any = {};

        if (this.shouldPrintStack()) {
            obj.stack = this.stack;
        }

        return obj;
    }

    private shouldPrintStack(): boolean {
        return this._app.config.get('env') !== 'prod';
    }
}