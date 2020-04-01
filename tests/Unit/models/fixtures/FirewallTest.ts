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

import { Entity, PrimaryGeneratedColumn, Column, getRepository } from "typeorm";
import Model from "../../../../src/models/Model";
import { app } from "../../../../src/fonaments/abstract-application";
import { RepositoryService } from "../../../../src/database/repository.service";

@Entity('firewall')
export class FirewallTest extends Model {

    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    name: string;

    public getTableName(): string {
        throw new Error("Method not implemented.");
    }

    public async onCreate()  {
        const repository: RepositoryService = await app().getService<RepositoryService>(RepositoryService.name)
        await repository.for(FirewallTest).update(this.id, {name: 'onCreate called'});
    }
}