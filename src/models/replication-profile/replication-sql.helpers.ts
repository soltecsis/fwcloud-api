/*
    Copyright 2026 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
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

import db from '../../database/database-manager';

/** Comma-separated `?` placeholders for a SQL `IN (...)` clause. */
export function sqlPlaceholders(count: number): string {
  return new Array(count).fill('?').join(', ');
}

/** Adds a value to the list a map keeps for its key: how rows are grouped by one of their ids. */
export function addToList<K, V>(lists: Map<K, V[]>, key: K, value: V): void {
  const list = lists.get(key);

  if (list) {
    list.push(value);
  } else {
    lists.set(key, [value]);
  }
}

/** Raw parameterized query against the default TypeORM data source. */
export function dbQuery<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  return db.getSource().query(sql, params);
}

/** Promisified `dbCon.query(sql, params, callback)`, for the callback-style connection object the legacy VPN model methods take as `req.dbCon`. */
export function queryRows<T = any>(dbCon: any, sql: string, params: unknown[]): Promise<T[]> {
  return new Promise((resolve, reject) => {
    dbCon.query(sql, params, (error: unknown, rows: T[]) =>
      error ? reject(error) : resolve(rows),
    );
  });
}
