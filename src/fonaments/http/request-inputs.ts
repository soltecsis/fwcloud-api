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

import { Request } from 'express';
import ObjectHelpers from '../../utils/object-helpers';

export class RequestInputs {
  private _req: Request;

  constructor(req: Request) {
    this._req = req;
  }

  /**
   * Returns all inputs
   */
  public all<T extends object>(): T {
    return this._req.body;
  }

  /**
   * Returns the input value or default value if it does not exist
   *
   * @param name Input name
   * @param defaultValue Default value
   */
  public get<T extends string | string[] | unknown = unknown>(
    name: string,
    defaultValue: T = undefined,
  ): T {
    if (Object.prototype.hasOwnProperty.call(this._req.body, name)) {
      return this._req.body[name];
    }

    if (Object.prototype.hasOwnProperty.call(this._req.query, name)) {
      return this._req.query[name] as T;
    }

    return defaultValue;
  }

  /**
   * Returns whether an input exists
   *
   * @param name Input name
   */
  public has(name: string): boolean {
    return (
      Object.prototype.hasOwnProperty.call(this._req.body, name) ||
      Object.prototype.hasOwnProperty.call(this._req.query, name)
    );
  }
}
