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

import { Service } from './service';
import { AbstractApplication } from '../abstract-application';

export interface ServiceBound {
  singleton: boolean;
  name: string;
  target: (app: AbstractApplication) => Promise<Service>;
  instance: Service;
}

export class ServiceContainer {
  protected app: AbstractApplication;

  protected _services: Array<ServiceBound>;

  constructor(app: AbstractApplication) {
    this.app = app;
    this._services = [];
  }

  public async close(): Promise<void> {
    for (let i = 0; i < this._services.length; i++) {
      if (this._services[i].singleton && this._services[i].instance !== null) {
        await this._services[i].instance.close();
      }
    }
  }

  get services(): Array<ServiceBound> {
    return this._services;
  }

  public bind<T extends Service>(
    name: string,
    target: (app: AbstractApplication) => Promise<T>,
  ): ServiceBound {
    if (this.isBound(name)) {
      throw new Error('Service ' + name + 'has been already bound');
    }

    const bound: ServiceBound = {
      singleton: false,
      name: name,
      target: target,
      instance: null,
    };

    this._services.push(bound);

    return bound;
  }

  public singleton<T extends Service>(
    name: string,
    target: (app: AbstractApplication) => Promise<T>,
  ): ServiceBound {
    if (this.isBound(name)) {
      throw new Error('Service ' + name + 'has been already bound');
    }

    const bound: ServiceBound = {
      singleton: true,
      name: name,
      target: target,
      instance: null,
    };

    this._services.push(bound);

    return bound;
  }

  public isBound(name: string): boolean {
    return this.find(name) !== null;
  }

  public async get<T extends Service>(name: string): Promise<T> {
    if (this.isBound(name)) {
      const service = this.find(name);

      if (service.singleton && service.instance === null) {
        service.instance = await service.target(this.app);
      }

      if (service.singleton && service.instance !== null) {
        return <T>service.instance;
      }

      return <Promise<T>>service.target(this.app);
    }

    return null;
  }

  private find(name: string): ServiceBound {
    const results: Array<ServiceBound> = this._services.filter(
      (service: ServiceBound) => {
        return service.name === name;
      },
    );

    return results.length > 0 ? results[0] : null;
  }
}
