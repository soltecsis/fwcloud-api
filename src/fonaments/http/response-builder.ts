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

import { Response } from 'express';
import { isResponsable } from '../../fonaments/contracts/responsable';
import { InternalServerException } from '../exceptions/internal-server-exception';
import { HttpException } from '../exceptions/http/http-exception';
import { AbstractApplication, app } from '../abstract-application';
import { isArray } from 'util';
import { HttpCodeResponse } from './http-code-response';
import ObjectHelpers from '../../utils/object-helpers';
import { FwCloudError } from '../exceptions/error';
import { classToPlain } from 'class-transformer';
import * as stream from 'stream';

type Attachment = FileAttached | ContentAttached;

interface ResponseBody {
  status: number;
  response: string;

  data?: object | Array<object>;

  message: string;
  errors?: object;
  stack?: Array<string>;
}

interface FileAttached {
  path: string;
  filename?: string;
}

interface ContentAttached {
  content: string;
  filename?: string;
}

interface DataPayload {
  data: object | Array<object>;
}

function isFileAttached(value: Attachment): value is FileAttached {
  return Object.prototype.hasOwnProperty.call(value, 'path');
}

function isContentAttached(value: Attachment): value is ContentAttached {
  return ObjectHelpers.prototype.hasOwnProperty.call(value, 'content');
}

export interface ErrorPayload {
  message: string;
  errors?: object;
  stack?: Array<string>;
}

export class ResponseBuilder {
  protected _app: AbstractApplication;
  protected _response: Response;

  protected _status: number;
  protected _payload: object;
  protected _error: HttpException;

  protected _attachment: Attachment;

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

  public body(payload: any): ResponseBuilder {
    if (this._payload) {
      throw new Error('Message already defined for the given response');
    }

    this._payload = payload;

    return this;
  }

  public download(
    path: string,
    filename?: string,
    cb?: (err: Error) => void,
  ): ResponseBuilder {
    this._attachment = {
      path: path,
      filename: filename,
    };
    return this;
  }

  public downloadContent(content: string, filename?: string): ResponseBuilder {
    this._attachment = {
      content,
      filename,
    };
    return this;
  }

  public hasFileAttached(): boolean {
    return this._attachment ? true : false;
  }

  public error(error: Error): ResponseBuilder {
    if (!(error instanceof FwCloudError)) {
      error = new FwCloudError(error);
    }

    // In case the exception is not an http exception we generate a 500 exception
    if (!(error instanceof HttpException)) {
      error = new InternalServerException(error.message, error.stack);
    }

    this._status = (<HttpException>error).status;
    this._error = <HttpException>error;

    return this;
  }

  public build(response: Response): ResponseBuilder {
    this._response = response;

    if (!this._status) {
      throw new Error('Status not defined for the given response');
    }

    this._response.status(this._status);

    if (this.hasFileAttached()) {
      return this;
    }

    this._response.json(this.buildMessage());

    return this;
  }

  public send(): Response {
    if (this.hasFileAttached() && isFileAttached(this._attachment)) {
      this._response.download(this._attachment.path, this._attachment.filename);
      return this._response;
    }
    if (this.hasFileAttached() && isContentAttached(this._attachment)) {
      const fileContents = Buffer.from(this._attachment.content);

      const redStream = new stream.PassThrough();
      redStream.end(fileContents);

      this._response.set(
        'Content-disposition',
        'attachment; filename=' + this._attachment.filename ?? 'file.text',
      );
      this._response.set('Content-Type', 'text/plain');

      redStream.pipe(this._response);

      return this._response;
    }

    this._response.send();
  }

  protected buildMessage(): ResponseBody {
    const envelope: Partial<ResponseBody> = {
      status: this._status,
      response: HttpCodeResponse.get(this._status),
    };

    return <ResponseBody>(
      ObjectHelpers.merge(envelope, this.buildPayload(this._payload))
    );
  }

  public toJSON(): ResponseBody {
    return this.buildMessage();
  }

  protected buildPayload(payload: any): ErrorPayload | DataPayload {
    if (this._error) {
      return this.buildErrorPayload(this._error);
    }
    return isArray(payload)
      ? this.buildArrayDataPayload(payload)
      : this.buildDataPayload(payload);
  }

  protected buildDataPayload(payload: Object): DataPayload {
    if (payload === null || payload === undefined) {
      return { data: null };
    }

    const data: object = isResponsable(payload)
      ? payload.toResponse()
      : payload;

    return { data: data };
  }

  protected buildArrayDataPayload(payload: Array<any>): DataPayload {
    const result: Array<Object> = [];

    for (let i = 0; i < payload.length; i++) {
      result.push(
        isResponsable(payload[i])
          ? payload[i].toResponse()
          : classToPlain(payload[i]),
      );
    }

    return { data: result };
  }

  protected buildErrorPayload(error: HttpException): ErrorPayload {
    return error.toResponse();
  }
}
