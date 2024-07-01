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

import { Repository as TypeORMRepository, In } from 'typeorm';
import { isArray } from 'util';

export class Repository<T> extends TypeORMRepository<T> {
  /**
   * Reloads an entitiy or an array of them
   *
   * @param oneOrMany One Entity or Array of them
   */
  protected async reloadEntities(
    oneOrMany: T | Array<T>,
  ): Promise<T | Array<T>> {
    if (isArray(oneOrMany)) {
      return await this.find({
        where: {
          id: In(this.getIdsFromEntityCollection(oneOrMany)),
        },
      });
    }

    return this.findOne((<any>oneOrMany).id);
  }

  /**
   * Extract ids from an array of policyRules
   *
   * @param items
   */
  protected getIdsFromEntityCollection(
    items: Array<T>,
    fn: (item: T) => any = null,
  ): Array<T> {
    if (fn === null) {
      fn = (item: any) => {
        return item.id;
      };
    }
    if (items.length <= 0) {
      return [null];
    }
    return items.map(fn);
  }
}
