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

import { ServiceProvider } from '../fonaments/services/service-provider';
import { BackupServiceProvider } from '../backups/backup.provider';
import { CronServiceProvider } from '../backups/cron/cron.provider';
import { SnapshotServiceProvider } from '../snapshots/snapshot.provider';
import { DatabaseServiceProvider } from '../database/database.provider';
import { RepositoryServiceProvider } from '../database/repository.provider';
import { RouterServiceProvider } from '../fonaments/http/router/router.provider';
import { AuthorizationServiceProvider } from '../fonaments/authorization/authorization.provider';
import { WebSocketServiceProvider } from '../sockets/web-socket.provider';
import { FirewallServiceProvider } from '../models/firewall/firewall.provider';
import { FwCloudExportServiceProvider } from '../fwcloud-exporter/fwcloud-export.provider';
import { OpenVPNServiceProvider } from '../models/vpn/openvpn/openvpn.provider';
import { FwCloudServiceProvider } from '../models/fwcloud/fwcloud.provider';
import { CLIApplication } from '../fonaments/cli-application';
import { RouterService } from '../fonaments/http/router/router.service';
import { Routes } from '../routes/routes';

export class Application extends CLIApplication {
  public static async run(path?: string): Promise<Application> {
    try {
      const app: Application = new Application(path);
      await app.bootstrap();
      return app;
    } catch (e) {
      console.error('Application can not start: ' + e.message);
      console.error(e.stack);
      process.exit(1);
    }
  }

  protected providers(): Array<typeof ServiceProvider> {
    return [
      DatabaseServiceProvider,
      RepositoryServiceProvider,
      RouterServiceProvider,
      AuthorizationServiceProvider,
      CronServiceProvider,
      BackupServiceProvider,
      SnapshotServiceProvider,
      WebSocketServiceProvider,
      FirewallServiceProvider,
      FwCloudExportServiceProvider,
      OpenVPNServiceProvider,
      FwCloudServiceProvider,
    ];
  }

  public async bootstrap(): Promise<CLIApplication> {
    this.setCLIConfiguration();
    await super.bootstrap();

    const routerService: RouterService = await this.getService<RouterService>(
      RouterService.name,
    );

    routerService.registerRoutes();

    return this;
  }

  protected setCLIConfiguration() {
    this.config.set('log.stdout', this._config.get('env') !== 'test');
  }
}
