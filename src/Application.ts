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

import db from './database/database-manager';
import { BodyParser } from './middleware/BodyParser';
import { Compression } from './middleware/Compression';
import { MethodOverride } from './middleware/MethodOverride';
import { SessionMiddleware } from './middleware/Session';
import { CORS } from './middleware/cors.middleware';
import { Authorization } from './middleware/Authorization';
import { ConfirmationToken } from './middleware/confirmation-token.middleware';
import { InputValidation } from './middleware/InputValidation';
import { AccessControl } from './middleware/AccessControl';
import { AttachDatabaseConnection } from './middleware/AttachDatabaseConnection';
import { Throws404 } from './middleware/Throws404';
import { ErrorResponse } from './middleware/ErrorResponse';
import { RequestBuilder } from './middleware/RequestBuilder';
import { ServiceProvider } from './fonaments/services/service-provider';
import { BackupServiceProvider } from './backups/backup.provider';
import { CronServiceProvider } from './backups/cron/cron.provider';
import { Middlewareable } from './fonaments/http/middleware/Middleware';
import { AuthorizationTest } from './middleware/AuthorizationTest';
import { SnapshotServiceProvider } from './snapshots/snapshot.provider';
import { MaintenanceMiddleware } from './middleware/maintenance.middleware';
import { DatabaseServiceProvider } from './database/database.provider';
import { RepositoryServiceProvider } from './database/repository.provider';
import { RouterServiceProvider } from './fonaments/http/router/router.provider';
import { AuthorizationServiceProvider } from './fonaments/authorization/authorization.provider';
import { AuthorizationMiddleware } from './fonaments/authorization/authorization.middleware';
import { WebSocketServiceProvider } from './sockets/web-socket.provider';
import { FirewallServiceProvider } from './models/firewall/firewall.provider';
import { FwCloudExportServiceProvider } from './fwcloud-exporter/fwcloud-export.provider';
import { LogRequestMiddleware } from './middleware/log-request.middleware';
import { OpenVPNServiceProvider } from './models/vpn/openvpn/openvpn.provider';
import { FwCloudServiceProvider } from './models/fwcloud/fwcloud.provider';
import { HTTPApplication } from './fonaments/http-application';
import { UpdateServiceProvider } from './updates/updates.provider';
import { IptablesSaveServiceProvider } from './iptables-save/iptables-save.provider';
import { logger } from './fonaments/abstract-application';
import * as fs from 'fs';
import { RoutingTableServiceProvider } from './models/routing/routing-table/routing-table.provider';
import { RouteServiceProvider } from './models/routing/route/route.provider';
import { RoutingRuleServiceProvider } from './models/routing/routing-rule/routing-rule.provider';
import { RoutingGroupServiceProvider } from './models/routing/routing-group/routing-group.provider';
import { RouteGroupServiceProvider } from './models/routing/route-group/route-group.provider';
import { ClusterServiceProvider } from './models/firewall/cluster.provider';
import { OpenVPNPrefixServiceProvider } from './models/vpn/openvpn/openvpn-prefix.provider';
import { OpenVPNStatusHistoryServiceProvider } from './models/vpn/openvpn/status/openvpn-status-history.provider';
import { isMainThread } from 'worker_threads';
import { BackupService } from './backups/backup.service';
import { PolicyRuleServiceProvider } from './policy-rule/policy-rule.provider';
import { AuthServiceProvider } from './models/user/auth.provider';
import { CaServiceProvider } from './ca/ca.provider';
import { CrtServiceProvider } from './crt/crt.provider';
import { OpenVPNService } from './models/vpn/openvpn/openvpn.service';
import { HAProxyRuleServiceProvider } from './models/system/haproxy/haproxy_r/haproxy_r.provider';
import { HAProxyGroupServiceProvider } from './models/system/haproxy/haproxy_g/haproxy_g.provider';
import { DHCPRuleServiceProvider } from './models/system/dhcp/dhcp_r/dhcp_r.provider';
import { DHCPGroupServiceProvider } from './models/system/dhcp/dhcp_g/dhcp_g.provider';
import { KeepalivedGroupServiceProvider } from './models/system/keepalived/keepalived_g/keepalived_g.provider';
import { KeepalivedRuleServiceProvider } from './models/system/keepalived/keepalived_r/keepalived_r.provider';

export class Application extends HTTPApplication {
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

  private signalHandler = (signal: 'SIGINT' | 'SIGTERM') => {
    logger().info(`Received signal: ${signal}`);
    fs.unlink('.pid', (err) => {
      logger().info(`------- Application stopped --------`);
      setTimeout(() => process.exit(0), 100);
    });
  };

  public async bootstrap(): Promise<Application> {
    await super.bootstrap();
    await this.startDatabaseService();

    if (isMainThread) {
      this.logger().info(`------- Starting application -------`);
      this.logger().info(
        `FWCloud API v${this.version.tag} (PID=${process.pid}) (${this.config.get('env')}) | schema: v${this.version.schema}`,
      );

      // If stdout log mode is not enabled, log messages are not shown in terminal.
      // As a result, user doesn't know when application has started.
      // So, we print out the message directly
      if (
        this._config.get('env') !== 'test' &&
        this._config.get('log.stdout') === false
      ) {
        console.log(`------- Starting application -------`);
        console.log(
          `FWCloud API v${this.version.tag} (PID=${process.pid}) (${this.config.get('env')}) | schema: v${this.version.schema}`,
        );
      }

      process.on('SIGINT', this.signalHandler);
      process.on('SIGTERM', this.signalHandler);

      //Starting scheduled tasks from the backup service
      (
        await this.getService<BackupService>(BackupService.name)
      ).startScheduledTasks();

      //Starting scheduled task from the openvpn service
      (
        await this.getService<OpenVPNService>(OpenVPNService.name)
      ).startScheduledTasks();
    }

    return this;
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
      ClusterServiceProvider,
      FwCloudExportServiceProvider,
      OpenVPNServiceProvider,
      FwCloudServiceProvider,
      UpdateServiceProvider,
      IptablesSaveServiceProvider,
      RoutingTableServiceProvider,
      RouteServiceProvider,
      RoutingRuleServiceProvider,
      RoutingGroupServiceProvider,
      RouteGroupServiceProvider,
      DHCPRuleServiceProvider,
      DHCPGroupServiceProvider,
      KeepalivedRuleServiceProvider,
      KeepalivedGroupServiceProvider,
      OpenVPNPrefixServiceProvider,
      OpenVPNStatusHistoryServiceProvider,
      HAProxyRuleServiceProvider,
      HAProxyGroupServiceProvider,
      PolicyRuleServiceProvider,
      AuthServiceProvider,
      CaServiceProvider,
      CrtServiceProvider,
    ];
  }

  protected beforeMiddlewares(): Array<Middlewareable> {
    return [
      LogRequestMiddleware,
      BodyParser,
      RequestBuilder,
      Compression,
      MethodOverride,
      MaintenanceMiddleware,
      AuthorizationMiddleware,
      AttachDatabaseConnection,
      SessionMiddleware,
      CORS,
      this.config.get('env') !== 'test' ? Authorization : AuthorizationTest,
      ConfirmationToken,
      InputValidation,
      AccessControl,
    ];
  }

  protected afterMiddlewares(): Array<Middlewareable> {
    return [Throws404, ErrorResponse];
  }

  private async startDatabaseService() {
    await db.connect(this);
  }
}
