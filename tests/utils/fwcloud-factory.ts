/*!
    Copyright 2022 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
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

import { EntityManager, Repository } from 'typeorm';
import { Firewall } from '../../src/models/firewall/Firewall';
import { FwCloud } from '../../src/models/fwcloud/FwCloud';
import { InterfaceIPObj } from '../../src/models/interface/InterfaceIPObj';
import { IPObj } from '../../src/models/ipobj/IPObj';
import { IPObjGroup } from '../../src/models/ipobj/IPObjGroup';
import { IPObjToIPObjGroup } from '../../src/models/ipobj/IPObjToIPObjGroup';
import { Interface } from '../../src/models/interface/Interface';
import { OpenVPN } from '../../src/models/vpn/openvpn/OpenVPN';
import { OpenVPNOption } from '../../src/models/vpn/openvpn/openvpn-option.model';
import { Ca } from '../../src/models/vpn/pki/Ca';
import { Crt } from '../../src/models/vpn/pki/Crt';
import StringHelper from '../../src/utils/string.helper';
import { OpenVPNPrefix } from '../../src/models/vpn/openvpn/OpenVPNPrefix';
import { RoutingTable } from '../../src/models/routing/routing-table/routing-table.model';
import { Route } from '../../src/models/routing/route/route.model';
import { RouteService } from '../../src/models/routing/route/route.service';
import { testSuite } from '../mocha/global-setup';
import { RoutingRule } from '../../src/models/routing/routing-rule/routing-rule.model';
import { RoutingRuleService } from '../../src/models/routing/routing-rule/routing-rule.service';
import { Mark } from '../../src/models/ipobj/Mark';
import db from '../../src/database/database-manager';
import { WireGuard } from '../../src/models/vpn/wireguard/WireGuard';
import { WireGuardPrefix } from '../../src/models/vpn/wireguard/WireGuardPrefix';
import { WireGuardOption } from '../../src/models/vpn/wireguard/wireguard-option.model';
import { IPSec } from '../../src/models/vpn/ipsec/IPSec';
import { IPSecPrefix } from '../../src/models/vpn/ipsec/IPSecPrefix';
import { IPSecOption } from '../../src/models/vpn/ipsec/ipsec-option.model';

const utilsModel = require('../../src/utils/utils.js');

export type FwCloudProduct = {
  dhcpGroup: any;
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
  wireguardServer: WireGuard;
  wireguardClients: Map<string, WireGuard>;
  wireguardPrefix: WireGuardPrefix;
  routingTable: RoutingTable;
  routes: Map<string, Route>;
  routingRules: Map<string, RoutingRule>;
  mark: Mark;
  ipsecServer: IPSec;
  ipsecClients: Map<string, IPSec>;
  ipsecPrefix: IPSecPrefix;
};

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
  private _wireguardRepository: Repository<WireGuard>;
  private _wireguardOptRepository: Repository<WireGuardOption>;
  private _wireguardPrefixRepository: Repository<WireGuardPrefix>;
  private _routingTableRepository: Repository<RoutingTable>;
  private _routeRepository: Repository<Route>;
  private _routingRuleRepository: Repository<RoutingRule>;
  private _markRepository: Repository<Mark>;
  private _manager: EntityManager;
  private _ipsecRepository: Repository<IPSec>;
  private _ipsecOptRepository: Repository<IPSecOption>;
  private _ipsecPrefixRepository: Repository<IPSecPrefix>;

  public fwc: FwCloudProduct;

  private _ipobjNextId: number;

  constructor() {
    this._manager = db.getSource().manager;
    this._fwcloudRepository = this._manager.getRepository(FwCloud);
    this._firewallRepository = this._manager.getRepository(Firewall);
    this._ipobjRepository = this._manager.getRepository(IPObj);
    this._ipobjGroupRepository = this._manager.getRepository(IPObjGroup);
    this._interfaceRepository = this._manager.getRepository(Interface);
    this._interfaceIPObjRepository = this._manager.getRepository(InterfaceIPObj);
    this._ipobjToGroupRepository = this._manager.getRepository(IPObjToIPObjGroup);
    this._caRepository = this._manager.getRepository(Ca);
    this._crtRepository = this._manager.getRepository(Crt);
    this._openvpnRepository = this._manager.getRepository(OpenVPN);
    this._openvpnOptRepository = this._manager.getRepository(OpenVPNOption);
    this._openvpnPrefixRepository = this._manager.getRepository(OpenVPNPrefix);
    this._wireguardRepository = this._manager.getRepository(WireGuard);
    this._wireguardOptRepository = this._manager.getRepository(WireGuardOption);
    this._wireguardPrefixRepository = this._manager.getRepository(WireGuardPrefix);
    this._routingTableRepository = this._manager.getRepository(RoutingTable);
    this._routeRepository = this._manager.getRepository(Route);
    this._routingRuleRepository = this._manager.getRepository(RoutingRule);
    this._markRepository = this._manager.getRepository(Mark);
    this._ipsecRepository = this._manager.getRepository(IPSec);
    this._ipsecOptRepository = this._manager.getRepository(IPSecOption);
    this._ipsecPrefixRepository = this._manager.getRepository(IPSecPrefix);

    this.fwc = {} as FwCloudProduct;
    this.fwc.ipobjs = new Map<string, IPObj>();
    this.fwc.interfaces = new Map<string, Interface>();
    this.fwc.crts = new Map<string, Crt>();
    this.fwc.openvpnClients = new Map<string, OpenVPN>();
    this.fwc.wireguardClients = new Map<string, WireGuard>();
    this.fwc.routes = new Map<string, Route>();
    this.fwc.routingRules = new Map<string, RoutingRule>();
    this.fwc.ipsecClients = new Map<string, IPSec>();

    this._ipobjNextId = this.randomId(10, 100000);
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
    this.fwc.fwcloud = await this._fwcloudRepository.save(
      this._fwcloudRepository.create({
        id: this.randomId(10, 100000),
        name: StringHelper.randomize(10),
        locked: false,
        locked_by: null,
      }),
    );

    this.fwc.firewall = await this._firewallRepository.save(
      this._firewallRepository.create({
        id: this.randomId(10, 100000),
        name: StringHelper.randomize(10),
        fwCloudId: this.fwc.fwcloud.id,
      }),
    );

    this.fwc.interfaces.set(
      'firewall-interface1',
      await this._interfaceRepository.save(
        this._interfaceRepository.create({
          name: `eth${this.randomId(0, 100)}`,
          type: '10',
          interface_type: '10',
          firewallId: this.fwc.firewall.id,
        }),
      ),
    );
  }

  private async makeIpobjGroup(): Promise<void> {
    this.fwc.ipobjGroup = await this._ipobjGroupRepository.save(
      this._ipobjGroupRepository.create({
        id: this.randomId(10, 100000),
        name: 'ipobjs group',
        type: 20,
        fwCloudId: this.fwc.fwcloud.id,
      }),
    );
  }

  private async makeIPOBjs(): Promise<void> {
    this.fwc.ipobjs.set(
      'gateway',
      await this._ipobjRepository.save(
        this._ipobjRepository.create({
          id: this._ipobjNextId++,
          name: 'gateway',
          address: '1.2.3.4',
          ipObjTypeId: 5,
          interfaceId: null,
          fwCloudId: this.fwc.fwcloud.id,
        }),
      ),
    );

    this.fwc.ipobjs.set(
      'address',
      await this._ipobjRepository.save(
        this._ipobjRepository.create({
          id: this._ipobjNextId++,
          name: 'address',
          address: '10.20.30.40',
          ipObjTypeId: 5,
          interfaceId: null,
          fwCloudId: this.fwc.fwcloud.id,
        }),
      ),
    );

    this.fwc.ipobjs.set(
      'addressRange',
      await this._ipobjRepository.save(
        this._ipobjRepository.create({
          id: this._ipobjNextId++,
          name: 'addressRange',
          range_start: '10.10.10.50',
          range_end: '10.10.10.80',
          ipObjTypeId: 6,
          interfaceId: null,
          fwCloudId: this.fwc.fwcloud.id,
        }),
      ),
    );

    this.fwc.ipobjs.set(
      'network',
      await this._ipobjRepository.save(
        this._ipobjRepository.create({
          id: this._ipobjNextId++,
          name: 'network',
          address: '10.20.30.0',
          netmask: '/24',
          ipObjTypeId: 7,
          interfaceId: null,
          fwCloudId: this.fwc.fwcloud.id,
        }),
      ),
    );

    this.fwc.ipobjs.set(
      'networkNoCIDR',
      await this._ipobjRepository.save(
        this._ipobjRepository.create({
          id: this._ipobjNextId++,
          name: 'network',
          address: '192.168.0.0',
          netmask: '255.255.0.0',
          ipObjTypeId: 7,
          interfaceId: null,
          fwCloudId: this.fwc.fwcloud.id,
        }),
      ),
    );
  }

  private async makeHost(): Promise<void> {
    this.fwc.ipobjs.set(
      'host',
      await this._ipobjRepository.save(
        this._ipobjRepository.create({
          id: this._ipobjNextId++,
          name: 'host',
          ipObjTypeId: 8,
          interfaceId: null,
          fwCloudId: this.fwc.fwcloud.id,
        }),
      ),
    );

    const interface1: Interface = await this._interfaceRepository.save(
      this._interfaceRepository.create({
        name: 'eth1',
        type: '11',
        interface_type: '11',
      }),
    );

    const interface2: Interface = await this._interfaceRepository.save(
      this._interfaceRepository.create({
        name: 'eth2',
        type: '11',
        interface_type: '11',
      }),
    );

    const interface3: Interface = await this._interfaceRepository.save(
      this._interfaceRepository.create({
        name: 'eth3',
        type: '11',
        interface_type: '11',
      }),
    );

    await this._interfaceIPObjRepository.save(
      this._interfaceIPObjRepository.create({
        interfaceId: interface1.id,
        ipObjId: this.fwc.ipobjs.get('host').id,
        interface_order: '1',
      }),
    );

    await this._interfaceIPObjRepository.save(
      this._interfaceIPObjRepository.create({
        interfaceId: interface2.id,
        ipObjId: this.fwc.ipobjs.get('host').id,
        interface_order: '2',
      }),
    );

    await this._interfaceIPObjRepository.save(
      this._interfaceIPObjRepository.create({
        interfaceId: interface3.id,
        ipObjId: this.fwc.ipobjs.get('host').id,
        interface_order: '3',
      }),
    );

    this.fwc.ipobjs.set(
      'host-eth2-addr1',
      await this._ipobjRepository.save(
        this._ipobjRepository.create({
          id: this._ipobjNextId++,
          name: 'host-eth2-addr1',
          address: '192.168.10.1',
          ipObjTypeId: 5,
          interfaceId: interface2.id,
          fwCloudId: this.fwc.fwcloud.id,
        }),
      ),
    );

    this.fwc.ipobjs.set(
      'host-eth3-addr1',
      await this._ipobjRepository.save(
        this._ipobjRepository.create({
          id: this._ipobjNextId++,
          name: 'host-eth3-addr1',
          address: '172.26.20.5',
          ipObjTypeId: 5,
          interfaceId: interface3.id,
          fwCloudId: this.fwc.fwcloud.id,
        }),
      ),
    );

    this.fwc.ipobjs.set(
      'host-eth3-addr2',
      await this._ipobjRepository.save(
        this._ipobjRepository.create({
          id: this._ipobjNextId++,
          name: 'host-eth3-addr2',
          address: '172.26.20.6',
          ipObjTypeId: 5,
          interfaceId: interface3.id,
          fwCloudId: this.fwc.fwcloud.id,
        }),
      ),
    );
  }

  private async makePKI(): Promise<void> {
    let crtNextId = this.randomId(10, 100000);

    this.fwc.ca = await this._caRepository.save(
      this._caRepository.create({
        id: this.randomId(10, 100000),
        fwCloudId: this.fwc.fwcloud.id,
        cn: 'CA',
        days: 1000,
      }),
    );

    this.fwc.crts.set(
      'OpenVPN-Server',
      await this._crtRepository.save(
        this._crtRepository.create({
          id: crtNextId++,
          caId: this.fwc.ca.id,
          cn: 'OpenVPN-Server',
          days: 1000,
          type: 2,
        }),
      ),
    );

    this.fwc.crts.set(
      'OpenVPN-Cli-1',
      await this._crtRepository.save(
        this._crtRepository.create({
          id: crtNextId++,
          caId: this.fwc.ca.id,
          cn: 'OpenVPN-Cli-1',
          days: 1000,
          type: 1,
        }),
      ),
    );

    this.fwc.crts.set(
      'OpenVPN-Cli-2',
      await this._crtRepository.save(
        this._crtRepository.create({
          id: crtNextId++,
          caId: this.fwc.ca.id,
          cn: 'OpenVPN-Cli-2',
          days: 1000,
          type: 1,
        }),
      ),
    );

    this.fwc.crts.set(
      'OpenVPN-Cli-3',
      await this._crtRepository.save(
        this._crtRepository.create({
          id: crtNextId++,
          caId: this.fwc.ca.id,
          cn: 'Other-OpenVPN-Client',
          days: 1000,
          type: 1,
        }),
      ),
    );

    this.fwc.crts.set(
      'Wireguard-Server',
      await this._crtRepository.save(
        this._crtRepository.create({
          id: crtNextId++,
          caId: this.fwc.ca.id,
          cn: 'Wireguard-Server',
          days: 1000,
          type: 2,
        }),
      ),
    );

    this.fwc.crts.set(
      'WireGuard-Cli-1',
      await this._crtRepository.save(
        this._crtRepository.create({
          id: crtNextId++,
          caId: this.fwc.ca.id,
          cn: 'WireGuard-Cli-1',
          days: 1000,
          type: 1,
        }),
      ),
    );

    this.fwc.crts.set(
      'WireGuard-Cli-2',
      await this._crtRepository.save(
        this._crtRepository.create({
          id: crtNextId++,
          caId: this.fwc.ca.id,
          cn: 'WireGuard-Cli-2',
          days: 1000,
          type: 1,
        }),
      ),
    );

    this.fwc.crts.set(
      'WireGuard-Cli-3',
      await this._crtRepository.save(
        this._crtRepository.create({
          id: crtNextId++,
          caId: this.fwc.ca.id,
          cn: 'Other-WireGuard-Client',
          days: 1000,
          type: 1,
        }),
      ),
    );

    this.fwc.crts.set(
      'IPSec-Server',
      await this._crtRepository.save(
        this._crtRepository.create({
          id: crtNextId++,
          caId: this.fwc.ca.id,
          cn: 'IPSec-Server',
          days: 1000,
          type: 2,
        }),
      ),
    );

    this.fwc.crts.set(
      'IPSec-Cli-1',
      await this._crtRepository.save(
        this._crtRepository.create({
          id: crtNextId++,
          caId: this.fwc.ca.id,
          cn: 'IPSec-Cli-1',
          days: 1000,
          type: 1,
        }),
      ),
    );

    this.fwc.crts.set(
      'IPSec-Cli-2',
      await this._crtRepository.save(
        this._crtRepository.create({
          id: crtNextId++,
          caId: this.fwc.ca.id,
          cn: 'IPSec-Cli-2',
          days: 1000,
          type: 1,
        }),
      ),
    );

    this.fwc.crts.set(
      'IPSec-Cli-3',
      await this._crtRepository.save(
        this._crtRepository.create({
          id: crtNextId++,
          caId: this.fwc.ca.id,
          cn: 'Other-IPSec-Client',
          days: 1000,
          type: 1,
        }),
      ),
    );
  }

  private async makeVPNs(): Promise<void> {
    let vpnNextId = this.randomId(10, 100000);

    this.fwc.openvpnServer = await this._openvpnRepository.save(
      this._openvpnRepository.create({
        id: vpnNextId++,
        parentId: null,
        firewallId: this.fwc.firewall.id,
        crtId: this.fwc.crts.get('OpenVPN-Server').id,
      }),
    );

    this.fwc.openvpnClients.set(
      'OpenVPN-Cli-1',
      await this._openvpnRepository.save(
        this._openvpnRepository.create({
          id: vpnNextId++,
          parentId: this.fwc.openvpnServer.id,
          firewallId: this.fwc.firewall.id,
          crtId: this.fwc.crts.get('OpenVPN-Cli-1').id,
        }),
      ),
    );

    this.fwc.openvpnClients.set(
      'OpenVPN-Cli-2',
      await this._openvpnRepository.save(
        this._openvpnRepository.create({
          id: vpnNextId++,
          parentId: this.fwc.openvpnServer.id,
          firewallId: this.fwc.firewall.id,
          crtId: this.fwc.crts.get('OpenVPN-Cli-2').id,
        }),
      ),
    );

    this.fwc.openvpnClients.set(
      'OpenVPN-Cli-3',
      await this._openvpnRepository.save(
        this._openvpnRepository.create({
          id: vpnNextId++,
          parentId: this.fwc.openvpnServer.id,
          firewallId: this.fwc.firewall.id,
          crtId: this.fwc.crts.get('OpenVPN-Cli-3').id,
          ipObjGroups: [this.fwc.ipobjGroup],
        }),
      ),
    );

    this.fwc.ipobjs.set(
      'openvpn-cli1-addr',
      await this._ipobjRepository.save(
        this._ipobjRepository.create({
          id: this._ipobjNextId++,
          name: 'OpenVPN Cli1 address',
          address: '10.200.47.5',
          ipObjTypeId: 5,
          interfaceId: null,
          fwCloudId: this.fwc.fwcloud.id,
        }),
      ),
    );

    this.fwc.ipobjs.set(
      'openvpn-cli2-addr',
      await this._ipobjRepository.save(
        this._ipobjRepository.create({
          id: this._ipobjNextId++,
          name: 'OpenVPN Cli2 address',
          address: '10.200.47.62',
          ipObjTypeId: 5,
          interfaceId: null,
          fwCloudId: this.fwc.fwcloud.id,
        }),
      ),
    );

    this.fwc.ipobjs.set(
      'openvpn-cli3-addr',
      await this._ipobjRepository.save(
        this._ipobjRepository.create({
          id: this._ipobjNextId++,
          name: 'OpenVPN Cli3 address',
          address: '10.200.201.78',
          ipObjTypeId: 5,
          interfaceId: null,
          fwCloudId: this.fwc.fwcloud.id,
        }),
      ),
    );

    await this._openvpnOptRepository.save(
      this._openvpnOptRepository.create({
        openVPNId: this.fwc.openvpnClients.get('OpenVPN-Cli-1').id,
        ipObjId: this.fwc.ipobjs.get('openvpn-cli1-addr').id,
        name: 'ifconfig-push',
        order: 1,
        scope: 0,
      }),
    );

    await this._openvpnOptRepository.save(
      this._openvpnOptRepository.create({
        openVPNId: this.fwc.openvpnClients.get('OpenVPN-Cli-2').id,
        ipObjId: this.fwc.ipobjs.get('openvpn-cli2-addr').id,
        name: 'ifconfig-push',
        order: 1,
        scope: 0,
      }),
    );

    await this._openvpnOptRepository.save(
      this._openvpnOptRepository.create({
        openVPNId: this.fwc.openvpnClients.get('OpenVPN-Cli-3').id,
        ipObjId: this.fwc.ipobjs.get('openvpn-cli3-addr').id,
        name: 'ifconfig-push',
        order: 1,
        scope: 0,
      }),
    );

    this.fwc.openvpnPrefix = await this._openvpnPrefixRepository.save(
      this._openvpnPrefixRepository.create({
        id: this.randomId(10, 100000),
        openVPNId: this.fwc.openvpnServer.id,
        name: 'OpenVPN-Cli-',
        ipObjGroups: [this.fwc.ipobjGroup],
      }),
    );

    this.fwc.wireguardServer = await this._wireguardRepository.save(
      this._wireguardRepository.create({
        id: vpnNextId++,
        parentId: null,
        firewallId: this.fwc.firewall.id,
        crtId: this.fwc.crts.get('Wireguard-Server').id,
        public_key: '',
        private_key: '',
      }),
    );

    await this._wireguardOptRepository.save(
      this._wireguardOptRepository.create({
        wireGuardId: this.fwc.wireguardServer.id,
        ipObjId: this.fwc.ipobjs.get('network').id,
        name: 'Address',
        arg: this.fwc.ipobjs.get('network').address,
        order: 1,
        scope: 0,
      }),
    );

    this.fwc.wireguardClients.set(
      'WireGuard-Cli-1',
      await this._wireguardRepository.save(
        this._wireguardRepository.create({
          id: vpnNextId++,
          parentId: this.fwc.wireguardServer.id,
          firewallId: this.fwc.firewall.id,
          crtId: this.fwc.crts.get('WireGuard-Cli-1').id,
          public_key: '',
          private_key: '',
        }),
      ),
    );

    this.fwc.wireguardClients.set(
      'WireGuard-Cli-2',
      await this._wireguardRepository.save(
        this._wireguardRepository.create({
          id: vpnNextId++,
          parentId: this.fwc.wireguardServer.id,
          firewallId: this.fwc.firewall.id,
          crtId: this.fwc.crts.get('WireGuard-Cli-2').id,
          public_key: '',
          private_key: '',
        }),
      ),
    );

    this.fwc.wireguardClients.set(
      'WireGuard-Cli-3',
      await this._wireguardRepository.save(
        this._wireguardRepository.create({
          id: vpnNextId++,
          parentId: this.fwc.wireguardServer.id,
          firewallId: this.fwc.firewall.id,
          crtId: this.fwc.crts.get('WireGuard-Cli-3').id,
          public_key: '',
          private_key: '',
        }),
      ),
    );

    this.fwc.wireguardPrefix = await this._wireguardPrefixRepository.save(
      this._wireguardPrefixRepository.create({
        id: this.randomId(10, 100000),
        wireGuardId: this.fwc.wireguardServer.id,
        name: 'WireGuard-Cli-',
      }),
    );

    this.fwc.ipsecServer = await this._ipsecRepository.save(
      this._ipsecRepository.create({
        id: vpnNextId++,
        parentId: null,
        firewallId: this.fwc.firewall.id,
        crtId: this.fwc.crts.get('IPSec-Server').id,
      }),
    );

    await this._ipsecOptRepository.save(
      this._ipsecOptRepository.create({
        ipSecId: this.fwc.ipsecServer.id,
        ipObjId: this.fwc.ipobjs.get('network').id,
        name: 'left',
        arg: this.fwc.ipobjs.get('network').address,
        order: 1,
        scope: 0,
      }),
    );

    this.fwc.ipsecClients.set(
      'IPSec-Cli-1',
      await this._ipsecRepository.save(
        this._ipsecRepository.create({
          id: vpnNextId++,
          parentId: this.fwc.ipsecServer.id,
          firewallId: this.fwc.firewall.id,
          crtId: this.fwc.crts.get('IPSec-Cli-1').id,
        }),
      ),
    );

    this.fwc.ipsecClients.set(
      'IPSec-Cli-2',
      await this._ipsecRepository.save(
        this._ipsecRepository.create({
          id: vpnNextId++,
          parentId: this.fwc.ipsecServer.id,
          firewallId: this.fwc.firewall.id,
          crtId: this.fwc.crts.get('IPSec-Cli-2').id,
        }),
      ),
    );

    this.fwc.ipsecClients.set(
      'IPSec-Cli-3',
      await this._ipsecRepository.save(
        this._ipsecRepository.create({
          id: vpnNextId++,
          parentId: this.fwc.ipsecServer.id,
          firewallId: this.fwc.firewall.id,
          crtId: this.fwc.crts.get('IPSec-Cli-3').id,
          ipObjGroups: [this.fwc.ipobjGroup],
        }),
      ),
    );

    this.fwc.ipobjs.set(
      'ipsec-cli1-addr',
      await this._ipobjRepository.save(
        this._ipobjRepository.create({
          id: this._ipobjNextId++,
          name: 'IPSec Cli1 address',
          address: '10.200.47.6',
          ipObjTypeId: 5,
          interfaceId: null,
          fwCloudId: this.fwc.fwcloud.id,
        }),
      ),
    );

    this.fwc.ipobjs.set(
      'ipsec-cli2-addr',
      await this._ipobjRepository.save(
        this._ipobjRepository.create({
          id: this._ipobjNextId++,
          name: 'IPSec Cli2 address',
          address: '10.200.47.63',
          ipObjTypeId: 5,
          interfaceId: null,
          fwCloudId: this.fwc.fwcloud.id,
        }),
      ),
    );

    this.fwc.ipobjs.set(
      'ipsec-cli3-addr',
      await this._ipobjRepository.save(
        this._ipobjRepository.create({
          id: this._ipobjNextId++,
          name: 'IPSec Cli3 address',
          address: '10.200.201.79',
          ipObjTypeId: 5,
          interfaceId: null,
          fwCloudId: this.fwc.fwcloud.id,
        }),
      ),
    );

    this.fwc.ipsecPrefix = await this._ipsecPrefixRepository.save(
      this._ipsecPrefixRepository.create({
        id: this.randomId(10, 100000),
        ipsecId: this.fwc.ipsecServer.id,
        name: 'IPSec-Cli-',
        ipObjGroups: [this.fwc.ipobjGroup],
      }),
    );

    await this._ipsecOptRepository.save(
      this._ipsecOptRepository.create({
        ipSecId: this.fwc.ipsecClients.get('IPSec-Cli-1').id,
        ipObjId: this.fwc.ipobjs.get('ipsec-cli1-addr').id,
        name: 'leftsourceip',
        order: 1,
        scope: 0,
      }),
    );

    await this._ipsecOptRepository.save(
      this._ipsecOptRepository.create({
        ipSecId: this.fwc.ipsecClients.get('IPSec-Cli-2').id,
        ipObjId: this.fwc.ipobjs.get('ipsec-cli2-addr').id,
        name: 'leftsourceip',
        order: 1,
        scope: 0,
      }),
    );

    await this._ipsecOptRepository.save(
      this._ipsecOptRepository.create({
        ipSecId: this.fwc.ipsecClients.get('IPSec-Cli-3').id,
        ipObjId: this.fwc.ipobjs.get('ipsec-cli3-addr').id,
        name: 'leftsourceip',
        order: 1,
        scope: 0,
      }),
    );
  }

  private async addToGroup(): Promise<void> {
    await this._ipobjToGroupRepository.save(
      this._ipobjToGroupRepository.create({
        ipObjGroupId: this.fwc.ipobjGroup.id,
        ipObjId: this.fwc.ipobjs.get('address').id,
      }),
    );

    await this._ipobjToGroupRepository.save(
      this._ipobjToGroupRepository.create({
        ipObjGroupId: this.fwc.ipobjGroup.id,
        ipObjId: this.fwc.ipobjs.get('addressRange').id,
      }),
    );

    await this._ipobjToGroupRepository.save(
      this._ipobjToGroupRepository.create({
        ipObjGroupId: this.fwc.ipobjGroup.id,
        ipObjId: this.fwc.ipobjs.get('network').id,
      }),
    );

    await this._ipobjToGroupRepository.save(
      this._ipobjToGroupRepository.create({
        ipObjGroupId: this.fwc.ipobjGroup.id,
        ipObjId: this.fwc.ipobjs.get('host').id,
      }),
    );
  }

  private async makeRouting(): Promise<void> {
    const routeService = await testSuite.app.getService<RouteService>(RouteService.name);
    const routingRuleService = await testSuite.app.getService<RoutingRuleService>(
      RoutingRuleService.name,
    );
    let lastRouteId = this.randomId(10, 100000);
    let lastRoutingRuleId = this.randomId(10, 100000);

    this.fwc.routingTable = await this._routingTableRepository.save({
      id: this.randomId(10, 100000),
      firewallId: this.fwc.firewall.id,
      number: this.randomId(10, 256),
      name: 'Routing table',
    });

    this.fwc.routes.set(
      'route1',
      await this._routeRepository.save({
        id: lastRouteId++,
        routingTableId: this.fwc.routingTable.id,
        gatewayId: this.fwc.ipobjs.get('gateway').id,
        interfaceId: this.fwc.interfaces.get('firewall-interface1').id,
        route_order: 1,
      }),
    );

    this.fwc.routes.set(
      'route2',
      await this._routeRepository.save({
        id: lastRouteId++,
        routingTableId: this.fwc.routingTable.id,
        gatewayId: this.fwc.ipobjs.get('gateway').id,
        route_order: 2,
      }),
    );

    this.fwc.routes.set(
      'route3',
      await this._routeRepository.save({
        id: lastRouteId++,
        routingTableId: this.fwc.routingTable.id,
        gatewayId: this.fwc.ipobjs.get('gateway').id,
        route_order: 3,
      }),
    );

    this.fwc.routes.set(
      'route4',
      await this._routeRepository.save({
        id: lastRouteId++,
        routingTableId: this.fwc.routingTable.id,
        gatewayId: this.fwc.ipobjs.get('gateway').id,
        interfaceId: this.fwc.interfaces.get('firewall-interface1').id,
        route_order: 4,
      }),
    );

    this.fwc.routes.set(
      'route5',
      await this._routeRepository.save({
        id: lastRouteId++,
        routingTableId: this.fwc.routingTable.id,
        gatewayId: this.fwc.ipobjs.get('gateway').id,
        interfaceId: this.fwc.interfaces.get('firewall-interface1').id,
        firewallApplyToId: this.fwc.firewall.id,
        route_order: 5,
      }),
    );

    this.fwc.routes.set(
      'route6',
      await this._routeRepository.save({
        id: lastRouteId++,
        routingTableId: this.fwc.routingTable.id,
        gatewayId: this.fwc.ipobjs.get('gateway').id,
        interfaceId: this.fwc.interfaces.get('firewall-interface1').id,
        firewallApplyToId: this.fwc.firewall.id,
        route_order: 6,
      }),
    );

    this.fwc.routes.set(
      'route7',
      await this._routeRepository.save({
        id: lastRouteId++,
        routingTableId: this.fwc.routingTable.id,
        gatewayId: this.fwc.ipobjs.get('gateway').id,
        firewallApplyToId: this.fwc.firewall.id,
        route_order: 7,
      }),
    );

    this.fwc.routingRules.set(
      'routing-rule-1',
      await this._routingRuleRepository.save({
        id: lastRoutingRuleId++,
        routingTableId: this.fwc.routingTable.id,
        rule_order: 1,
      }),
    );

    this.fwc.routingRules.set(
      'routing-rule-2',
      await this._routingRuleRepository.save({
        id: lastRoutingRuleId++,
        routingTableId: this.fwc.routingTable.id,
        rule_order: 2,
      }),
    );

    this.fwc.routingRules.set(
      'routing-rule-3',
      await this._routingRuleRepository.save({
        id: lastRoutingRuleId++,
        routingTableId: this.fwc.routingTable.id,
        rule_order: 3,
      }),
    );

    this.fwc.routingRules.set(
      'routing-rule-4',
      await this._routingRuleRepository.save({
        id: lastRoutingRuleId++,
        routingTableId: this.fwc.routingTable.id,
        firewallApplyToId: this.fwc.firewall.id,
        rule_order: 4,
      }),
    );

    this.fwc.routingRules.set(
      'routing-rule-5',
      await this._routingRuleRepository.save({
        id: lastRoutingRuleId++,
        routingTableId: this.fwc.routingTable.id,
        firewallApplyToId: this.fwc.firewall.id,
        rule_order: 5,
      }),
    );

    await routeService.update(this.fwc.routes.get('route1').id, {
      ipObjIds: [
        { id: this.fwc.ipobjs.get('address').id, order: 1 },
        { id: this.fwc.ipobjs.get('addressRange').id, order: 2 },
        { id: this.fwc.ipobjs.get('network').id, order: 3 },
        { id: this.fwc.ipobjs.get('networkNoCIDR').id, order: 4 },
        { id: this.fwc.ipobjs.get('host').id, order: 5 },
      ],
      openVPNIds: [{ id: this.fwc.openvpnClients.get('OpenVPN-Cli-3').id, order: 6 }],
      openVPNPrefixIds: [{ id: this.fwc.openvpnPrefix.id, order: 7 }],
      ipsecIds: [{ id: this.fwc.ipsecClients.get('IPSec-Cli-3').id, order: 6 }],
      ipsecPrefixIds: [{ id: this.fwc.ipsecPrefix.id, order: 7 }],
    });

    await routeService.update(this.fwc.routes.get('route2').id, {
      ipObjGroupIds: [{ id: this.fwc.ipobjGroup.id, order: 1 }],
    });

    await routeService.update(this.fwc.routes.get('route6').id, {
      ipObjIds: [
        { id: this.fwc.ipobjs.get('address').id, order: 1 },
        { id: this.fwc.ipobjs.get('addressRange').id, order: 2 },
        { id: this.fwc.ipobjs.get('network').id, order: 3 },
        { id: this.fwc.ipobjs.get('networkNoCIDR').id, order: 4 },
        { id: this.fwc.ipobjs.get('host').id, order: 5 },
      ],
      openVPNIds: [{ id: this.fwc.openvpnClients.get('OpenVPN-Cli-3').id, order: 6 }],
      openVPNPrefixIds: [{ id: this.fwc.openvpnPrefix.id, order: 7 }],
    });

    await routeService.update(this.fwc.routes.get('route7').id, {
      ipObjGroupIds: [{ id: this.fwc.ipobjGroup.id, order: 1 }],
    });

    await routingRuleService.update(this.fwc.routingRules.get('routing-rule-1').id, {
      ipObjIds: [
        { id: this.fwc.ipobjs.get('address').id, order: 1 },
        { id: this.fwc.ipobjs.get('addressRange').id, order: 2 },
        { id: this.fwc.ipobjs.get('network').id, order: 3 },
        { id: this.fwc.ipobjs.get('networkNoCIDR').id, order: 4 },
        { id: this.fwc.ipobjs.get('host').id, order: 5 },
      ],
      openVPNIds: [{ id: this.fwc.openvpnClients.get('OpenVPN-Cli-3').id, order: 6 }],
      openVPNPrefixIds: [{ id: this.fwc.openvpnPrefix.id, order: 7 }],
      ipSecIds: [{ id: this.fwc.ipsecClients.get('IPSec-Cli-3').id, order: 6 }],
      ipSecPrefixIds: [{ id: this.fwc.ipsecPrefix.id, order: 7 }],
      markIds: [
        {
          id: this.fwc.mark.id,
          order: 8,
        },
      ],
    });

    await routingRuleService.update(this.fwc.routingRules.get('routing-rule-4').id, {
      ipObjIds: [
        { id: this.fwc.ipobjs.get('address').id, order: 1 },
        { id: this.fwc.ipobjs.get('addressRange').id, order: 2 },
        { id: this.fwc.ipobjs.get('network').id, order: 3 },
        { id: this.fwc.ipobjs.get('networkNoCIDR').id, order: 4 },
        { id: this.fwc.ipobjs.get('host').id, order: 5 },
      ],
      openVPNIds: [{ id: this.fwc.openvpnClients.get('OpenVPN-Cli-3').id, order: 6 }],
      openVPNPrefixIds: [{ id: this.fwc.openvpnPrefix.id, order: 7 }],
      ipSecIds: [{ id: this.fwc.ipsecClients.get('IPSec-Cli-3').id, order: 6 }],
      ipSecPrefixIds: [{ id: this.fwc.ipsecPrefix.id, order: 7 }],
      markIds: [
        {
          id: this.fwc.mark.id,
          order: 8,
        },
      ],
    });

    await routingRuleService.update(this.fwc.routingRules.get('routing-rule-2').id, {
      ipObjGroupIds: [{ id: this.fwc.ipobjGroup.id, order: 1 }],
      openVPNPrefixIds: [{ id: this.fwc.openvpnPrefix.id, order: 2 }],
      ipSecPrefixIds: [{ id: this.fwc.ipsecPrefix.id, order: 3 }],
    });

    await routingRuleService.update(this.fwc.routingRules.get('routing-rule-5').id, {
      ipObjGroupIds: [{ id: this.fwc.ipobjGroup.id, order: 1 }],
      openVPNPrefixIds: [{ id: this.fwc.openvpnPrefix.id, order: 2 }],
      ipSecPrefixIds: [{ id: this.fwc.ipsecPrefix.id, order: 3 }],
    });
  }

  private async makeMark(): Promise<void> {
    this.fwc.mark = await this._markRepository.save(
      this._markRepository.create({
        id: this.randomId(10, 100000),
        code: this.randomId(10, 3000),
        name: 'mark',
        fwCloudId: this.fwc.fwcloud.id,
      }),
    );
  }
}
