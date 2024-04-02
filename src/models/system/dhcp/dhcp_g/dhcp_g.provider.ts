/*!
    Copyright 2023 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
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
import { AbstractApplication } from "../../../../fonaments/abstract-application";
import {ServiceBound, ServiceContainer} from "../../../../fonaments/services/service-container";
import { ServiceProvider } from "../../../../fonaments/services/service-provider";
import { DHCPGroupService } from "./dhcp_g.service";

export class DHCPGroupServiceProvider extends ServiceProvider {

    public register(serviceContainer: ServiceContainer): ServiceBound {
        return serviceContainer.singleton(DHCPGroupService.name, async(app: AbstractApplication): Promise<DHCPGroupService> => {
            return DHCPGroupService.make(app);
        });
    }

    public async bootstrap(app: AbstractApplication): Promise<void> {
        await app.getService<DHCPGroupService>(DHCPGroupService.name);
    }

}
