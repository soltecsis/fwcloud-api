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

import { Response } from "express";
import { isResponsable } from "../../fonaments/contracts/responsable"
import { InternalServerException } from "../exceptions/internal-server-exception";
import { HttpException } from "../exceptions/http/http-exception";
import { AbstractApplication, app } from "../abstract-application";
import { isArray } from "util";
import { HttpCodeResponse } from "./http-code-response";
import ObjectHelpers from "../../utils/object-helpers";
import { FwCloudError } from "../exceptions/error";
import { SocketManager } from "../../sockets/socket-manager";
import { Progress } from "./progress/progress";

interface ResponseBody {
    status: number,
    response: string,
    data?: object,
    error?: ErrorBody
}

export interface ErrorBody {
    [k: string]: any,
    exception?: ExceptionBody,
}

export interface ExceptionBody {
    name: string,
    stack: Array<string>,
    caused_by?: ExceptionBody
}

export class ResponseBuilder {
    protected _status: number;
    protected _payload: object;
    protected _app: AbstractApplication;
    protected _response: Response;
    protected _socket_id: string;

    // Only used in handled request which uses a sockets
    protected _event_id: string;

    private constructor() {
        this._app = app();
    }

    public static buildResponse(): ResponseBuilder {
        return new ResponseBuilder();
    }

    public status(status: number): ResponseBuilder {
        if (this._status) {
            throw new Error('Status already defined for the given response');
        }
        
        this._status = status;
        return this;
    }

    public socket(socket: SocketManager): ResponseBuilder {
        this._event_id = socket.event_id;
        return this;
    }

    public body(payload: any): ResponseBuilder {
        if (this._payload) {
            throw new Error('Message already defined for the given response');
        }

        this._payload = this.buildPayload(payload);

        return this;
    }

    public progress(progress: Progress<any>, socket_id: string, customEventHandler?: (p: Progress<any>) => void): ResponseBuilder {
        const socket: SocketManager = SocketManager.init(this._socket_id);
        this._event_id =socket.event_id;
        this._socket_id = socket_id;
        
        if (!customEventHandler) {
            progress.on('start', (payload) => {
                socket.event(payload);
            })
            .on('step', (payload) => {
                socket.event(payload);
            })
            .on('end', async (payload) => {
                socket.end(payload);
            });
        } else {
            customEventHandler(progress);
        }

        this.body(progress.response);

        return this;
    }

    public send(response: Response): ResponseBuilder {
        this._response = response;

        if (!this._status) {
            throw new Error('Status not defined for the given response');
        }

        this._response.status(this._status);

        this._response.send(this.buildMessage());

        return this;
    }

    protected buildMessage(): ResponseBody {
        let envelope: Partial<ResponseBody> = {
            status: this._status,
            response: HttpCodeResponse.get(this._status),
        }

        return <ResponseBody>ObjectHelpers.merge(envelope, this._payload, this.attachEvent());
    }

    protected attachEvent(): { event_id: string } {
        if (this._event_id) {
            return { event_id: this._event_id }
        }

        return null;
    }

    public toJSON(): ResponseBody {
        return this.buildMessage();
    }

    protected buildPayload(payload: any): Object {
        if (payload.constructor === Error) {
            payload = new FwCloudError().fromError(payload);
        }

        if (payload instanceof FwCloudError) {
            return { error: this.buildErrorPayload(payload) };
        }

        return { data: this.buildDataPayload(payload) };
    }

    protected buildDataPayload(payload: Object): Object {
        if (payload === null || payload === undefined) {
            return {};
        }

        if (isArray(payload)) {
            return this.buildArrayDataResponse(payload);
        }

        if (isResponsable(payload)) {
            return payload.toResponse();
        }

        return payload;
    }

    protected buildArrayDataResponse(payload: Array<any>): Array<Object> {
        const result: Array<Object> = [];

        for (let i = 0; i < payload.length; i++) {
            result.push(isResponsable(payload[i]) ? payload[i].toResponse() : payload[i]);
        }

        return result;
    }

    protected buildErrorPayload(payload: FwCloudError): ErrorBody {
        if (payload instanceof HttpException) {
            this._status = payload.status;
            return payload.toResponse();
        }

        // In case the exception is not an http exception we generate a 500 exception
        return this.buildErrorPayload(new InternalServerException(payload.message, payload));
    }
}