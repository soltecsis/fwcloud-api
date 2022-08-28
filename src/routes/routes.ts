import { OpenVPNArchiveConfigController } from './../controllers/firewalls/openvpn/archive/config/openvpn-archive-config.controller';
import { OpenVPNArchiveController } from './../controllers/firewalls/openvpn/archive/openvpn-archive.controller';
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

import { RouteCollection } from "../fonaments/http/router/route-collection";
import { BackupController } from "../controllers/backups/backup.controller";
import { BackupConfigController } from "../controllers/backups/backup-config/backup-config.controller";
import { RouterParser } from "../fonaments/http/router/router-parser";
import { isAdmin } from "../gates/isAdmin";
import { VersionController } from "../controllers/version.controller";
import { SnapshotController } from "../controllers/snapshots/snapshot.controller";
import { isLoggedIn } from "../gates/isLoggedIn";
import { FwCloudExportController } from "../controllers/fwclouds/fwcloud-export/fwcloud-export.controller";
import { OpenVPNController } from "../controllers/firewalls/openvpn/openvpn.controller";
import { FwCloudController } from "../controllers/fwclouds/fwcloud.controller";
import { UpdateController } from "../controllers/updates/update.controller";
import { IptablesSaveController } from "../controllers/iptables-save/iptables-save.controller";
import { PingController } from "../controllers/ping/ping.controller";
import { RoutingTableController } from "../controllers/routing/routing-tables/routing-tables.controller";
import { RouteController } from "../controllers/routing/route/route.controller";
import { RoutingRuleController } from "../controllers/routing/routing-rule/routing-rule.controller";
import { RoutingGroupController } from "../controllers/routing/routing-group/routing-group.controller";
import { RouteGroupController } from "../controllers/routing/route-group/route-group.controller";
import { FirewallController } from "../controllers/firewalls/firewall.controller";
import { PolicyRuleController } from "../controllers/policy-rule/policy-rule.controller";
import { TfaController } from "../controllers/auth/tfa.controller";
import { CaController } from "../controllers/ca/ca.controller";
import { CrtController } from "../controllers/crt/crt.controller";

export class Routes extends RouteCollection {

    public routes(router: RouterParser): void {
    
        router.gates([isLoggedIn], (router) => {

            //Admin routes
            router.gates([isAdmin], (router) => {

                router.prefix('/backups', (router: RouterParser) => {
                    //Backups
                    router.get('/', BackupController, 'index').name('backups.index');
                    router.post('/', BackupController, 'store').name('backups.store');
                    router.post('/import', BackupController, 'import').name('backups.import');
                    router.get('/:backup(\\d+)', BackupController, 'show').name('backups.show');
                    router.post('/:backup(\\d+)/restore', BackupController, 'restore').name('backups.restore');
                    router.delete('/:backup(\\d+)', BackupController, 'destroy').name('backups.destroy');
                    router.get('/:backup(\\d+)/export', BackupController, 'export').name('backups.export');

                    // Backups Config
                    router.prefix('/config', (router: RouterParser) => {
                        router.get('/', BackupConfigController, 'show').name('backups.config.show');
                        router.put('/', BackupConfigController, 'update').name('backups.config.update');
                    });
                });

                router.prefix('/openvpnarchives', (router: RouterParser) => {
                    router.post('/', OpenVPNArchiveController, 'store').name('openvpnarchives.store')
                    router.prefix('/config', (router: RouterParser) => {
                        router.get('/', OpenVPNArchiveConfigController, 'show').name('openvpnarchives.config.show')
                        router.put('/', OpenVPNArchiveConfigController, 'update').name('openvpnarchives.config.update')
                    })
                })

                //Version
                router.get('/version', VersionController, 'show').name('versions.show');

                //Update requests
                router.prefix('/updates', (router: RouterParser) => {
                    router.get('/', UpdateController, 'proxy').name('updates.show');
                    router.put('/websrv', UpdateController, 'proxy').name('updates.fwcloud-websrv');
                    router.put('/ui', UpdateController, 'proxy').name('updates.fwcloud-updater');
                    router.put('/api', UpdateController, 'proxy').name('updates.fwcloud-api');
                    router.put('/updater', UpdateController, 'update').name('updates.fwcloud-updater');
                });
            });

            router.prefix('/fwclouds', (router: RouterParser) => {
                router.post('/', FwCloudController, 'store').name('fwclouds.store');
                router.post('/import', FwCloudExportController, 'import').name('fwclouds.exports.import');

                router.prefix('/:fwcloud(\\d+)', (router: RouterParser) => {
                    router.put('/', FwCloudController, 'update').name('fwclouds.update');
                    router.prefix('/cas', (router: RouterParser) => {
                        router.prefix('/:ca(\\d+)', (router: RouterParser) => {
                            router.put('/', CaController, 'update').name('fwclouds.cas.update');
                            router.prefix('/crts', (router: RouterParser) => {
                                router.prefix('/:crt(\\d+)', (router: RouterParser) => {
                                    router.put('/', CrtController, 'update').name('fwclouds.cas.crts.update');
                                })
                            })
                        })  
                    });
                    router.prefix('/firewalls', (router: RouterParser) => {
                        router.post('/communication/ping', FirewallController, 'pingCommunication').name('fwclouds.firewalls.communication.ping');
                        router.post('/communication/info', FirewallController, 'infoCommunication').name('fwclouds.firewalls.communication.info');
                        router.post('/plugin',FirewallController,'installPlugin').name('fwcloud.firewalls.communication.installPlugin')
                        router.prefix('/:firewall(\\d+)', (router:RouterParser) => {

                            router.prefix('/policyRules', (router: RouterParser) => {
                                router.get('/read', PolicyRuleController, 'read').name('fwclouds.firewalls.policyRules.read');
                                router.post('/download', PolicyRuleController, 'download').name('fwclouds.firewalls.policyRules.download');
                            })

                            router.prefix('/openvpns', (router: RouterParser) => {
                                router.prefix('/:openvpn(\\d+)', (router: RouterParser) => {
                                    router.post('/installer', OpenVPNController, 'installer').name('fwclouds.firewalls.openvpns.installer');
                                    router.get('/history', OpenVPNController, 'history').name('fwclouds.firewalls.openvpns.history');
                                    router.get('/graph', OpenVPNController, 'graph').name('fwclouds.firewalls.openvpns.graph');
                                })
                            });

                            router.prefix('/routingTables', (router: RouterParser) => {
                                router.post('/', RoutingTableController, 'create').name('fwclouds.firewalls.routing.tables.store');
                                router.get('/', RoutingTableController, 'index').name('fwclouds.firewalls.routing.tables.index');
                                router.prefix('/:routingTable(\\d+)', (router:RouterParser) => {
                                    router.get('/', RoutingTableController, 'show').name('fwclouds.firewalls.routing.tables.show');
                                    router.get('/grid', RoutingTableController, 'grid').name('fwclouds.firewalls.routing.tables.grid');
                                    router.put('/', RoutingTableController, 'update').name('fwclouds.firewalls.routing.tables.update');
                                    router.get('/restricted', RoutingTableController, 'restrictions').name('fwclouds.firewalls.routing.tables.restrictions');
                                    router.delete('/', RoutingTableController, 'remove').name('fwclouds.firewalls.routing.tables.delete');
                                    
                                    router.prefix('/routes', (router: RouterParser) => {
                                        router.get('/compile', RoutingTableController, 'compileRoutes').name('fwclouds.firewalls.routing.tables.compile');
                                        router.get('/', RouteController, 'index').name('fwclouds.firewalls.routing.tables.routes.index');
                                        router.post('/', RouteController, 'store').name('fwclouds.firewalls.routing.tables.routes.store');
                                        router.post('/copy', RouteController, 'copy').name('fwclouds.firewalls.routing.tables.routes.copy');
                                        router.put('/bulkUpdate', RouteController, 'bulkUpdate').name('fwclouds.firewalls.routing.tables.routes.bulkUpdate');
                                        router.put('/move', RouteController, 'move').name('fwclouds.firewalls.routing.tables.routes.move');
                                        router.put('/moveTo', RouteController, 'moveTo').name('fwclouds.firewalls.routing.tables.routes.moveTo');
                                        router.put('/moveInterface', RouteController, 'moveInterface').name('fwclouds.firewalls.routing.tables.routes.moveInterface');
                                        router.put('/moveToGateway', RouteController, 'moveToGateway').name('fwclouds.firewalls.routing.tables.routes.moveToGateway');
                                        router.delete('/bulkRemove', RouteController, 'bulkRemove').name('fwclouds.firewalls.routing.tables.routes.bulkRemove');
                                        router.prefix('/:route(\\d+)', (router:RouterParser) => {
                                            router.get('/', RouteController, 'show').name('fwclouds.firewalls.routing.tables.routes.show');
                                            router.get('/compile', RouteController, 'compile').name('fwclouds.firewalls.routing.tables.routes.compile')
                                            router.put('/', RouteController, 'update').name('fwclouds.firewalls.routing.tables.routes.update');
                                            router.delete('/', RouteController, 'remove').name('fwclouds.firewalls.routing.tables.routes.delete');
                                        });
                                    });
                                });
                            });

                            router.prefix('/routeGroups', (router: RouterParser) => {
                                router.get('/', RouteGroupController, 'index').name('fwclouds.firewalls.routing.routeGroups.index');
                                router.post('/', RouteGroupController, 'create').name('fwclouds.firewalls.routing.routeGroups.create');
                                router.prefix('/:routeGroup(\\d+)', (router: RouterParser) => {
                                    router.get('/', RouteGroupController, 'show').name('fwclouds.firewalls.routing.routeGroups.show');
                                    router.put('/', RouteGroupController, 'update').name('fwclouds.firewalls.routing.routeGroups.update');
                                    router.delete('/', RouteGroupController, 'remove').name('fwclouds.firewalls.routing.routeGroups.delete');
                                })
                            });

                            router.prefix('/routingGroups', (router: RouterParser) => {
                                router.get('/', RoutingGroupController, 'index').name('fwclouds.firewalls.routing.routingGroups.index');
                                router.post('/', RoutingGroupController, 'create').name('fwclouds.firewalls.routing.routingGroups.create');
                                router.prefix('/:routingGroup(\\d+)', (router: RouterParser) => {
                                    router.get('/', RoutingGroupController, 'show').name('fwclouds.firewalls.routing.routingGroups.show');
                                    router.put('/', RoutingGroupController, 'update').name('fwclouds.firewalls.routing.routingGroups.update');
                                    router.delete('/', RoutingGroupController, 'remove').name('fwclouds.firewalls.routing.routingGroups.delete');
                                })
                            });

                            router.prefix('/routingRules', (router: RouterParser) => {
                                router.post('/', RoutingRuleController, 'create').name('fwclouds.firewalls.routing.rules.store');
                                router.get('/', RoutingRuleController, 'index').name('fwclouds.firewalls.routing.rules.index');
                                router.get('/grid', RoutingRuleController, 'grid').name('fwclouds.firewalls.routing.rules.grid');
                                router.post('/copy', RoutingRuleController, 'copy').name('fwclouds.firewalls.routing.rules.copy');
                                router.put('/move', RoutingRuleController, 'move').name('fwclouds.firewalls.routing.rules.move');
                                router.put('/moveFrom', RoutingRuleController, 'moveFrom').name('fwclouds.firewalls.routing.rules.moveFrom');
                                router.get('/compile', FirewallController, 'compileRoutingRules').name('fwclouds.firewalls.routing.compile');
                                router.put('/bulkUpdate', RoutingRuleController, 'bulkUpdate').name('fwclouds.firewalls.routing.rules.bulkUpdate');
                                router.delete('/bulkRemove', RoutingRuleController, 'bulkRemove').name('fwclouds.firewalls.routing.rules.bulkRemove');
                                router.prefix('/:routingRule(\\d+)', (router:RouterParser) => {
                                    router.get('/', RoutingRuleController, 'show').name('fwclouds.firewalls.routing.rules.show');
                                    router.get('/compile', RoutingRuleController, 'compile').name('fwclouds.firewalls.routing.rules.compile')
                                    router.put('/', RoutingRuleController, 'update').name('fwclouds.firewalls.routing.rules.update');
                                    router.delete('/', RoutingRuleController, 'remove').name('fwclouds.firewalls.routing.rules.delete');
                                });
                            });
                        })
                    })

                    //Firewalls
                    // Old way restored. These routes has been disabled temporarily
                    /*router.prefix('/firewalls/:firewall(\\d+)', (router: RouterParser) => {
                        router.post('/compile', FirewallController, 'compile').name('firewalls.compile');
                        router.post('/install', FirewallController, 'install').name('firewalls.install');
                    });*/

                    //Colors usage.
                    router.get('/colors', FwCloudController, 'colors').name('fwclouds.colors');

                    //Snapshots
                    router.prefix('/snapshots', (router: RouterParser) => {
                        router.get('/', SnapshotController, 'index').name('snapshots.index');
                        router.get('/:snapshot(\\d+)', SnapshotController, 'show').name('snapshots.show');
                        router.post('/', SnapshotController, 'store').name('snapshots.store');
                        router.put('/:snapshot(\\d+)', SnapshotController, 'update').name('snapshots.update');
                        router.post('/:snapshot(\\d+)/restore', SnapshotController, 'restore').name('snapshots.restore');
                        router.delete('/:snapshot(\\d+)', SnapshotController, 'destroy').name('snapshots.destroy');
                    });

                    router.post('/export', FwCloudExportController, 'store').name('fwclouds.exports.store');
                });
            });

            // iptables-save import/export
            router.prefix('/iptables-save', (router: RouterParser) => {
                router.put('/import', IptablesSaveController , 'import').name('iptables-save.import');
                router.put('/export', IptablesSaveController, 'export').name('iptables-save.export');
            });

            // ping for keep session alive
            router.prefix('/ping', (router: RouterParser) => {
                router.put('/', PingController, 'ping').name('ping.pong');
            });
        });
        router.prefix('/profile/tfa',(router: RouterParser) => {
            router.post('/verify',TfaController,'verify').name('profile.tfa.verify');
            router.prefix('/setup',(router:RouterParser) => {
                router.get('/',TfaController,'getSetup').name('profile.tfa.setup.get');
                router.post('/',TfaController,'setup').name('profile.tfa.setup');
                router.delete('/',TfaController,'deleteSetup').name('profile.tfa.setup.delete')
            })
        });
    }
}