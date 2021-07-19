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

import { getRepository, Repository } from "typeorm";
import { Firewall } from "../../src/models/firewall/Firewall";
import { FwCloud } from "../../src/models/fwcloud/FwCloud";
import { InterfaceIPObj } from "../../src/models/interface/InterfaceIPObj";
import { IPObj } from "../../src/models/ipobj/IPObj";
import { IPObjGroup } from "../../src/models/ipobj/IPObjGroup";
import { IPObjToIPObjGroup } from "../../src/models/ipobj/IPObjToIPObjGroup";
import { Interface } from "../../src/models/interface/Interface";
import { OpenVPN } from "../../src/models/vpn/openvpn/OpenVPN";
import { OpenVPNOption } from "../../src/models/vpn/openvpn/openvpn-option.model";
import { Ca } from "../../src/models/vpn/pki/Ca";
import { Crt } from "../../src/models/vpn/pki/Crt";
import StringHelper from "../../src/utils/string.helper";
import { OpenVPNPrefix } from "../../src/models/vpn/openvpn/OpenVPNPrefix";
import { RoutingTable } from "../../src/models/routing/routing-table/routing-table.model";
import { Route } from "../../src/models/routing/route/route.model";
import { RouteService } from "../../src/models/routing/route/route.service";
import { testSuite } from "../mocha/global-setup";
import { RoutingRule } from "../../src/models/routing/routing-rule/routing-rule.model";
import { RoutingRuleService } from "../../src/models/routing/routing-rule/routing-rule.service";
import { Mark } from "../../src/models/ipobj/Mark";

export type FwCloudProduct = {
    fwcloud: FwCloud;
    firewall: Firewall;
    ipobjGroup: IPObjGroup;
    ipobjs: Map<string, IPObj>;
    interfaces: Map<string, Interface>;
    ca: Ca;
    crts: Map<string, Crt>;
    openvpnServer: OpenVPN;
    openvpnClients: Map<string, OpenVPN>;
    openvpnPrefix: OpenVPNPrefix;
    routingTable: RoutingTable;
    routes: Map<string, Route>;
    routingRules: Map<string, RoutingRule>;
    mark: Mark;
}

export class FwCloudFactory {
    private _fwcloudRepository: Repository<FwCloud>;
    private _firewallRepository: Repository<Firewall>;
    private _ipobjRepository: Repository<IPObj>;
    private _ipobjGroupRepository: Repository<IPObjGroup>;
    private _interfaceRepository: Repository<Interface>;
    private _interfaceIPObjRepository: Repository<InterfaceIPObj>;
    private _ipobjToGroupRepository: Repository<IPObjToIPObjGroup>;
    private _caRepository: Repository<Ca>;
    private _crtRepository: Repository<Crt>;
    private _openvpnRepository: Repository<OpenVPN>;
    private _openvpnOptRepository: Repository<OpenVPNOption>;
    private _openvpnPrefixRepository: Repository<OpenVPNPrefix>;
    private _routingTableRepository: Repository<RoutingTable>;
    private _markRepository: Repository<Mark>;

    public fwc: FwCloudProduct;

    private _ipobjNextId: number;

    constructor() {
        this._fwcloudRepository = getRepository(FwCloud);
        this._firewallRepository = getRepository(Firewall);
        this._ipobjRepository = getRepository(IPObj);
        this._ipobjGroupRepository = getRepository(IPObjGroup);
        this._interfaceRepository = getRepository(Interface);
        this._interfaceIPObjRepository = getRepository(InterfaceIPObj);
        this._ipobjToGroupRepository = getRepository(IPObjToIPObjGroup);
        this._caRepository= getRepository(Ca);
        this._crtRepository = getRepository(Crt);
        this._openvpnRepository = getRepository(OpenVPN);
        this._openvpnOptRepository = getRepository(OpenVPNOption);
        this._openvpnPrefixRepository = getRepository(OpenVPNPrefix);
        this._routingTableRepository = getRepository(RoutingTable);
        this._markRepository = getRepository(Mark);

        this.fwc = {} as FwCloudProduct;
        this.fwc.ipobjs = new Map<string, IPObj>();
        this.fwc.interfaces = new Map<string, Interface>();
        this.fwc.crts = new Map<string, Crt>();
        this.fwc.openvpnClients = new Map<string, OpenVPN>();
        this.fwc.routes = new Map<string, Route>();
        this.fwc.routingRules = new Map<string, RoutingRule>();

        this._ipobjNextId = this.randomId(10,100000);
    }

    async make(): Promise<FwCloudProduct> {
        await this.makeFwcAndFw();
        await this.makeIpobjGroup();
        await this.makeIPOBjs();
        await this.makeHost();
        await this.makeMark();
        await this.makePKI();
        await this.makeVPNs();
        await this.addToGroup();
        await this.makeRouting();

        return this.fwc;
    }

    private randomId(min: number, max: number): number {
        return Math.floor(Math.random() * (max - min)) + min;
    }

    private async makeFwcAndFw(): Promise<void> {
        let FWInterface: Interface;

        this.fwc.fwcloud = await this._fwcloudRepository.save(this._fwcloudRepository.create({
            id: this.randomId(10,100000),
            name: StringHelper.randomize(10)
        }));

        this.fwc.firewall = await this._firewallRepository.save(this._firewallRepository.create({
            id: this.randomId(10,100000),
            name: StringHelper.randomize(10),
            fwCloudId: this.fwc.fwcloud.id
        }));

        this.fwc.interfaces.set('firewall-interface1', await this._interfaceRepository.save(this._interfaceRepository.create({
            name: `eth${this.randomId(0,100)}`,
            type: '10',
            interface_type: '10',
            firewallId: this.fwc.firewall.id
        })));
    }

    private async makeIpobjGroup(): Promise<void> {
        this.fwc.ipobjGroup = await this._ipobjGroupRepository.save(this._ipobjGroupRepository.create({
            id: this.randomId(10,100000),
            name: 'ipobjs group',
            type: 20,
            fwCloudId: this.fwc.fwcloud.id
        }));
    }

    private async makeIPOBjs(): Promise<void> {
        this.fwc.ipobjs.set('gateway', await this._ipobjRepository.save(this._ipobjRepository.create({
            id: this._ipobjNextId++,
            name: 'gateway',
            address: '1.2.3.4',
            ipObjTypeId: 5,
            interfaceId: null,
            fwCloudId: this.fwc.fwcloud.id
        })));

        this.fwc.ipobjs.set('address', await this._ipobjRepository.save(this._ipobjRepository.create({
            id: this._ipobjNextId++,
            name: 'address',
            address: '10.20.30.40',
            ipObjTypeId: 5,
            interfaceId: null,
            fwCloudId: this.fwc.fwcloud.id
        })));

        this.fwc.ipobjs.set('addressRange', await this._ipobjRepository.save(this._ipobjRepository.create({
            id: this._ipobjNextId++,
            name: 'addressRange',
            range_start: '10.10.10.50',
            range_end: '10.10.10.80',
            ipObjTypeId: 6,
            interfaceId: null,
            fwCloudId: this.fwc.fwcloud.id
        })));

        this.fwc.ipobjs.set('network', await this._ipobjRepository.save(this._ipobjRepository.create({
            id: this._ipobjNextId++,
            name: 'network',
            address: '10.20.30.0',
            netmask: '/24',
            ipObjTypeId: 7,
            interfaceId: null,
            fwCloudId: this.fwc.fwcloud.id
        })));

        this.fwc.ipobjs.set('networkNoCIDR', await this._ipobjRepository.save(this._ipobjRepository.create({
            id: this._ipobjNextId++,
            name: 'network',
            address: '192.168.0.0',
            netmask: '255.255.0.0',
            ipObjTypeId: 7,
            interfaceId: null,
            fwCloudId: this.fwc.fwcloud.id
        })));
    }

    private async makeHost(): Promise<void> {
        let interface1: Interface;
        let interface2: Interface;
        let interface3: Interface;

        this.fwc.ipobjs.set('host', await this._ipobjRepository.save(this._ipobjRepository.create({
            id: this._ipobjNextId++,
            name: 'host',
            ipObjTypeId: 8,
            interfaceId: null,
            fwCloudId: this.fwc.fwcloud.id
        })));

        interface1 = await this._interfaceRepository.save(this._interfaceRepository.create({
            name: 'eth1',
            type: '11',
            interface_type: '11'
        }));

        interface2 = await this._interfaceRepository.save(this._interfaceRepository.create({
            name: 'eth2',
            type: '11',
            interface_type: '11'
        }));

        interface3 = await this._interfaceRepository.save(this._interfaceRepository.create({
            name: 'eth3',
            type: '11',
            interface_type: '11'
        }));

        await this._interfaceIPObjRepository.save(this._interfaceIPObjRepository.create({
            interfaceId: interface1.id,
            ipObjId: this.fwc.ipobjs.get('host').id,
            interface_order: '1'
        }));

        await this._interfaceIPObjRepository.save(this._interfaceIPObjRepository.create({
            interfaceId: interface2.id,
            ipObjId: this.fwc.ipobjs.get('host').id,
            interface_order: '2'
        }));

        await this._interfaceIPObjRepository.save(this._interfaceIPObjRepository.create({
            interfaceId: interface3.id,
            ipObjId: this.fwc.ipobjs.get('host').id,
            interface_order: '3'
        }));

        this.fwc.ipobjs.set('host-eth2-addr1', await this._ipobjRepository.save(this._ipobjRepository.create({
            id: this._ipobjNextId++,
            name: 'host-eth2-addr1',
            address: '192.168.10.1',
            ipObjTypeId: 5,
            interfaceId: interface2.id,
            fwCloudId: this.fwc.fwcloud.id
        })));

        this.fwc.ipobjs.set('host-eth3-addr1', await this._ipobjRepository.save(this._ipobjRepository.create({
            id: this._ipobjNextId++,
            name: 'host-eth3-addr1',
            address: '172.26.20.5',
            ipObjTypeId: 5,
            interfaceId: interface3.id,
            fwCloudId: this.fwc.fwcloud.id
        })));

        this.fwc.ipobjs.set('host-eth3-addr2', await this._ipobjRepository.save(this._ipobjRepository.create({
            id: this._ipobjNextId++,
            name: 'host-eth3-addr2',
            address: '172.26.20.6',
            ipObjTypeId: 5,
            interfaceId: interface3.id,
            fwCloudId: this.fwc.fwcloud.id
        })));
    }

    private async makePKI(): Promise<void> {
        let crtNextId = this.randomId(10,100000);

        this.fwc.ca = await this._caRepository.save(this._caRepository.create({
            id: this.randomId(10,100000),
            fwCloudId: this.fwc.fwcloud.id,
            cn: 'CA',
            days: 1000
        }));

        this.fwc.crts.set('OpenVPN-Server', await this._crtRepository.save(this._crtRepository.create({
            id: crtNextId++,
            caId: this.fwc.ca.id,
            cn: 'OpenVPN-Server',
            days: 1000,
            type: 2
        })));

        this.fwc.crts.set('OpenVPN-Cli-1', await this._crtRepository.save(this._crtRepository.create({
            id: crtNextId++,
            caId: this.fwc.ca.id,
            cn: 'OpenVPN-Cli-1',
            days: 1000,
            type: 1
        })));

        this.fwc.crts.set('OpenVPN-Cli-2', await this._crtRepository.save(this._crtRepository.create({
            id: crtNextId++,
            caId: this.fwc.ca.id,
            cn: 'OpenVPN-Cli-2',
            days: 1000,
            type: 1
        })));

        this.fwc.crts.set('OpenVPN-Cli-3', await this._crtRepository.save(this._crtRepository.create({
            id: crtNextId++,
            caId: this.fwc.ca.id,
            cn: 'Other-OpenVPN-Client',
            days: 1000,
            type: 1
        })));
    }

    private async makeVPNs(): Promise<void> {
        let vpnNextId = this.randomId(10,100000);

        this.fwc.openvpnServer = await this._openvpnRepository.save(this._openvpnRepository.create({
            id: vpnNextId++,
            parentId: null,
            firewallId: this.fwc.firewall.id,
            crtId: this.fwc.crts.get('OpenVPN-Server').id
        }));

        this.fwc.openvpnClients.set('OpenVPN-Cli-1', await this._openvpnRepository.save(this._openvpnRepository.create({
            id: vpnNextId++,
            parentId: this.fwc.openvpnServer.id,
            firewallId: this.fwc.firewall.id,
            crtId: this.fwc.crts.get('OpenVPN-Cli-1').id
        })));

        this.fwc.openvpnClients.set('OpenVPN-Cli-2', await this._openvpnRepository.save(this._openvpnRepository.create({
            id: vpnNextId++,
            parentId: this.fwc.openvpnServer.id,
            firewallId: this.fwc.firewall.id,
            crtId: this.fwc.crts.get('OpenVPN-Cli-2').id
        })));

        this.fwc.openvpnClients.set('OpenVPN-Cli-3', await this._openvpnRepository.save(this._openvpnRepository.create({
            id: vpnNextId++,
            parentId: this.fwc.openvpnServer.id,
            firewallId: this.fwc.firewall.id,
            crtId: this.fwc.crts.get('OpenVPN-Cli-3').id,
            ipObjGroups: [this.fwc.ipobjGroup]
        })));

        this.fwc.ipobjs.set('openvpn-cli1-addr', await this._ipobjRepository.save(this._ipobjRepository.create({
            id: this._ipobjNextId++,
            name: 'OpenVPN Cli1 address',
            address: '10.200.47.5',
            ipObjTypeId: 5,
            interfaceId: null,
            fwCloudId: this.fwc.fwcloud.id
        })));

        this.fwc.ipobjs.set('openvpn-cli2-addr', await this._ipobjRepository.save(this._ipobjRepository.create({
            id: this._ipobjNextId++,
            name: 'OpenVPN Cli2 address',
            address: '10.200.47.62',
            ipObjTypeId: 5,
            interfaceId: null,
            fwCloudId: this.fwc.fwcloud.id
        })));

        this.fwc.ipobjs.set('openvpn-cli3-addr', await this._ipobjRepository.save(this._ipobjRepository.create({
            id: this._ipobjNextId++,
            name: 'OpenVPN Cli3 address',
            address: '10.200.201.78',
            ipObjTypeId: 5,
            interfaceId: null,
            fwCloudId: this.fwc.fwcloud.id
        })));

        await this._openvpnOptRepository.save(this._openvpnOptRepository.create({
            openVPNId: this.fwc.openvpnClients.get('OpenVPN-Cli-1').id,
            ipObjId: this.fwc.ipobjs.get('openvpn-cli1-addr').id,
            name: 'ifconfig-push',
            order: 1,
            scope: 0
        }));

        await this._openvpnOptRepository.save(this._openvpnOptRepository.create({
            openVPNId: this.fwc.openvpnClients.get('OpenVPN-Cli-2').id,
            ipObjId: this.fwc.ipobjs.get('openvpn-cli2-addr').id,
            name: 'ifconfig-push',
            order: 1,
            scope: 0
        }));

        await this._openvpnOptRepository.save(this._openvpnOptRepository.create({
            openVPNId: this.fwc.openvpnClients.get('OpenVPN-Cli-3').id,
            ipObjId: this.fwc.ipobjs.get('openvpn-cli3-addr').id,
            name: 'ifconfig-push',
            order: 1,
            scope: 0
        }));

        this.fwc.openvpnPrefix = await this._openvpnPrefixRepository.save(this._openvpnPrefixRepository.create({
            id: this.randomId(10,100000),
            openVPNId: this.fwc.openvpnServer.id,
            name: 'OpenVPN-Cli-',
            ipObjGroups: [this.fwc.ipobjGroup]
        }));
    }

    private async addToGroup(): Promise<void> {
        await this._ipobjToGroupRepository.save(this._ipobjToGroupRepository.create({
            ipObjGroupId: this.fwc.ipobjGroup.id,
            ipObjId: this.fwc.ipobjs.get('address').id
        }));

        await this._ipobjToGroupRepository.save(this._ipobjToGroupRepository.create({
            ipObjGroupId: this.fwc.ipobjGroup.id,
            ipObjId: this.fwc.ipobjs.get('addressRange').id
        }));

        await this._ipobjToGroupRepository.save(this._ipobjToGroupRepository.create({
            ipObjGroupId: this.fwc.ipobjGroup.id,
            ipObjId: this.fwc.ipobjs.get('network').id
        }));

        await this._ipobjToGroupRepository.save(this._ipobjToGroupRepository.create({
            ipObjGroupId: this.fwc.ipobjGroup.id,
            ipObjId: this.fwc.ipobjs.get('host').id
        }));
    }

    private async makeRouting(): Promise<void> {
        const routeService = await testSuite.app.getService<RouteService>(RouteService.name);
        const routingRuleService = await testSuite.app.getService<RoutingRuleService>(RoutingRuleService.name);

        this.fwc.routingTable = await this._routingTableRepository.save({
            id: this.randomId(10,100000),
            firewallId: this.fwc.firewall.id,
            number: this.randomId(0,256),
            name: 'Routing table',
        });

        this.fwc.routes.set('route1', await routeService.create({
            routingTableId: this.fwc.routingTable.id,
            gatewayId: this.fwc.ipobjs.get('gateway').id,
            interfaceId: this.fwc.interfaces.get('firewall-interface1').id
        }));

        this.fwc.routes.set('route2', await routeService.create({
            routingTableId: this.fwc.routingTable.id,
            gatewayId: this.fwc.ipobjs.get('gateway').id
        }));

        this.fwc.routes.set('route3', await routeService.create({
            routingTableId: this.fwc.routingTable.id,
            gatewayId: this.fwc.ipobjs.get('gateway').id
        }));

        this.fwc.routes.set('route4', await routeService.create({
            routingTableId: this.fwc.routingTable.id,
            gatewayId: this.fwc.ipobjs.get('gateway').id,
            interfaceId: this.fwc.interfaces.get('firewall-interface1').id
        }));

        this.fwc.routingRules.set('routing-rule-1', await routingRuleService.create({
            routingTableId: this.fwc.routingTable.id
        }));

        this.fwc.routingRules.set('routing-rule-2', await routingRuleService.create({
            routingTableId: this.fwc.routingTable.id
        }));

        this.fwc.routingRules.set('routing-rule-3', await routingRuleService.create({
            routingTableId: this.fwc.routingTable.id
        }));

        await routeService.update(this.fwc.routes.get('route1').id, {
            ipObjIds: [this.fwc.ipobjs.get('address').id, 
                       this.fwc.ipobjs.get('addressRange').id, 
                       this.fwc.ipobjs.get('network').id, 
                       this.fwc.ipobjs.get('networkNoCIDR').id, 
                       this.fwc.ipobjs.get('host').id],
            openVPNIds: [this.fwc.openvpnClients.get('OpenVPN-Cli-3').id],
            openVPNPrefixIds: [this.fwc.openvpnPrefix.id]
        });
  
        await routeService.update(this.fwc.routes.get('route2').id, {
            ipObjGroupIds: [this.fwc.ipobjGroup.id]
        });
        
        await routingRuleService.update(this.fwc.routingRules.get('routing-rule-1').id, {
            ipObjIds: [this.fwc.ipobjs.get('address').id, 
                       this.fwc.ipobjs.get('addressRange').id, 
                       this.fwc.ipobjs.get('network').id, 
                       this.fwc.ipobjs.get('networkNoCIDR').id, 
                       this.fwc.ipobjs.get('host').id],
            openVPNIds: [this.fwc.openvpnClients.get('OpenVPN-Cli-3').id],
            openVPNPrefixIds: [this.fwc.openvpnPrefix.id],
            markIds: [this.fwc.mark.id]
          });
        
          await routingRuleService.update(this.fwc.routingRules.get('routing-rule-2').id, {
            ipObjGroupIds: [this.fwc.ipobjGroup.id]
          });              
    }

    private async makeMark(): Promise<void> {
        this.fwc.mark = await this._markRepository.save(this._markRepository.create({
            id: this.randomId(10,100000),
            code: this.randomId(10,3000),
            name: 'mark',
            fwCloudId: this.fwc.fwcloud.id
        }));
    }
} 