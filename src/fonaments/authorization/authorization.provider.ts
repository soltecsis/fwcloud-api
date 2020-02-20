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

import { ServiceProvider } from "../services/service-provider";
import { ServiceContainer } from "../services/service-container";
import { AuthorizationService } from "./authorization.service";
import { AbstractApplication } from "../abstract-application";
import { Service } from "../services/service";

export class AuthorizationServiceProvider extends ServiceProvider {
    public async register(serviceContainer: ServiceContainer): Promise<void> {
        serviceContainer.singleton(AuthorizationService.name, async (app: AbstractApplication): Promise<Service> => {
            return new AuthorizationService(app);
        });
    }
}