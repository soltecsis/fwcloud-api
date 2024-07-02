/*!
    Copyright 2024 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
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
import { ServiceProvider } from '../../../../fonaments/services/service-provider';
import {
  ServiceBound,
  ServiceContainer,
} from '../../../../fonaments/services/service-container';
import { AbstractApplication } from '../../../../fonaments/abstract-application';
import { HAProxyRuleService } from './haproxy_r.service';

export class HAProxyRuleServiceProvider extends ServiceProvider {
  public register(serviceContainer: ServiceContainer): ServiceBound {
    return serviceContainer.singleton(
      HAProxyRuleService.name,
      async (app: AbstractApplication): Promise<HAProxyRuleService> => {
        return HAProxyRuleService.make(app);
      },
    );
  }

  public async bootstrap(app: AbstractApplication): Promise<void> {
    await app.getService<HAProxyRuleService>(HAProxyRuleService.name);
  }
}
