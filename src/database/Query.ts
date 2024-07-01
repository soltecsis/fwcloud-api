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

import db from './database-manager';
import { QueryRunner, Connection } from 'typeorm';
import * as sqlstring from 'sqlstring';

export default class Query {
  public query(
    query: string,
    params: Array<any>,
    callback: (err: any, result: any) => void,
  ): void;
  public query(
    query: string,
    params: Record<string, never>,
    callback: (err: any, result: any) => void,
  ): void;
  public query(query: string, callback: (err: any, result: any) => void): void;
  public query(
    query: string,
    params: any = [],
    callback?: (err: any, result: any) => void,
  ): void {
    const queryRunner: QueryRunner = db.getQueryRunner();

    if (typeof params === 'function') {
      callback = params;
      params = [];
    }

    queryRunner
      .query(query, params)
      .then(async (result) => {
        await queryRunner.release();
        if (callback) {
          callback(null, result);
        }
      })
      .catch(async (err) => {
        await queryRunner.release();
        if (callback) {
          callback(err, null);
        }
      });
  }

  public escape(value: any): string {
    return sqlstring.escape(value);
  }

  public escapeId(value: any): string {
    return sqlstring.escapeId(value);
  }
}
