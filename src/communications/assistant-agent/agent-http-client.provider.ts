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

import { AbstractApplication } from '../../fonaments/abstract-application';
import { ServiceBound, ServiceContainer } from '../../fonaments/services/service-container';
import { ServiceProvider } from '../../fonaments/services/service-provider';
import { AgentHttpClient } from './agent-http-client';

/** Registers the single production transport for fwcloud-ai-agent. */
export class AgentHttpClientProvider extends ServiceProvider {
  public register(serviceContainer: ServiceContainer): ServiceBound {
    // ServiceContainer caches only after construction resolves. Keeping the
    // in-flight promise here prevents two concurrent first callers from
    // creating separate transports outside the container lifecycle.
    let client: Promise<AgentHttpClient> | null = null;

    return serviceContainer.singleton(AgentHttpClient.name, (app: AbstractApplication) => {
      client ??= AgentHttpClient.make(app);
      return client;
    });
  }
}
