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

import { ExceptionBody } from "../http/response-builder";
import { AbstractApplication, app } from "../abstract-application";

export class FwCloudError extends Error {
    protected _caused_by: FwCloudError;
    protected _app: AbstractApplication;

    constructor(message: string = null, caused_by: FwCloudError = null) {
        super(message ? message : "");
        this.name = this.constructor.name;
        this._app = app();
        this._caused_by = caused_by;
    }

    public fromError(error: Error): FwCloudError {
        this.stack = error.stack;
        this.message = error.message;
        this.name = error.name;

        return this;
    }
    
    public getExceptionDetails(): ExceptionBody {
        const result: Partial<ExceptionBody> = {
            name: this.constructor.name,
            stack: this.stackToArray()
        }

        if (this._caused_by) {
            result.caused_by = this._caused_by.getExceptionDetails();
        }

        return <ExceptionBody>result;
    }

    protected stackToArray(): Array<string> {
        const stack: string = this.stack;
        const results: Array<string> = [];
        const stackLines: Array<string> = stack.split("\n");

        for(let i = 0; i < stackLines.length; i++ ) {
            const line: string = stackLines[i].trim();
            results.push(line);
        }

        return results;
    }
}