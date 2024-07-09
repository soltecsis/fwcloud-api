/*!
    Copyright 2021 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
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

import { Repository } from '../../database/repository';
import { Firewall } from './Firewall';
import { EntityManager } from 'typeorm';

export class FirewallRepository extends Repository<Firewall> {
  constructor(manager?: EntityManager) {
    super(Firewall, manager);
  }
  public async markAsUncompiled(Firewall: Firewall): Promise<Firewall>;
  public async markAsUncompiled(Firewalls: Array<Firewall>): Promise<Firewall>;
  public async markAsUncompiled(
    oneOrMany: Firewall | Array<Firewall>,
  ): Promise<Firewall | Array<Firewall>> {
    const entities: Array<Firewall> = Array.isArray(oneOrMany) ? oneOrMany : [oneOrMany];

    await this.createQueryBuilder()
      .update(Firewall)
      .where('id IN (:...ids)', {
        ids: this.getIdsFromEntityCollection(entities),
      })
      .set({
        status: 3,
        installed_at: null,
        compiled_at: null,
      })
      .execute();

    return await this.reloadEntities(oneOrMany);
  }

  public async markAllAsUncompiled(): Promise<void> {
    await this.createQueryBuilder()
      .update(Firewall)
      .set({
        status: 3,
        installed_at: null,
        compiled_at: null,
      })
      .execute();
  }
}
