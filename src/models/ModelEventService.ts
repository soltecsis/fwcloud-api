/*
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

import Model from './Model';
import { getRepository } from 'typeorm';
import StringHelper from '../utils/StringHelper';

export class ModelEventService {
    constructor() {}

    public async emit(event: "create" | "update" | "delete" | "all", model: typeof Model, criteria: any, 
    callback?: (event: "create" | "update" | "delete" | "all", model: typeof Model, criteria: any) => void) {
        if (callback) {
            return callback(event, model, criteria);
        }

        const method = StringHelper.toCamelCase('on', event);

        if(model.methodExists(method)) {
            const modelInstances: Model[] = await this.getEntities(model, criteria);
            
            for(let i = 0; i < modelInstances.length; i++) {
                await modelInstances[i][method]();
            }
        }

        return null;
    }

    private async getEntities(model: typeof Model, criteria: number | Object): Promise<Model[]> {
        if (criteria instanceof model) {
            return [criteria];
        }
        
        if (typeof criteria === 'number') {
            return [await this.getEntityById(model, criteria)];
        }
        
        return await this.getEntitiesByCriteria(model, criteria);
    }

    private async getEntityById(model: typeof Model, id: number): Promise<Model> {
        return await getRepository(model).findOne(id)
    }

    private async getEntitiesByCriteria(model: typeof Model, criteria: Object): Promise<Model[]> {
        return await getRepository(model).find(criteria);
    }
}

const modelEventService: ModelEventService = new ModelEventService();

export default modelEventService;