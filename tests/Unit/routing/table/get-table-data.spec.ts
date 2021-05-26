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

import { getCustomRepository, getRepository } from "typeorm";
import { Firewall } from "../../../../src/models/firewall/Firewall";
import { FwCloud } from "../../../../src/models/fwcloud/FwCloud";
import { IPObj } from "../../../../src/models/ipobj/IPObj";
import { RoutingRule } from "../../../../src/models/routing/routing-rule/routing-rule.model";
import { RoutingRuleRepository } from "../../../../src/models/routing/routing-rule/routing-rule.repository";
import { RoutingTable } from "../../../../src/models/routing/routing-table/routing-table.model";
import { RoutingTableService } from "../../../../src/models/routing/routing-table/routing-table.service";
import { Tree } from "../../../../src/models/tree/Tree";
import { OpenVPN } from "../../../../src/models/vpn/openvpn/OpenVPN";
import { OpenVPNOption } from "../../../../src/models/vpn/openvpn/openvpn-option.model";
import { OpenVPNPrefix } from "../../../../src/models/vpn/openvpn/OpenVPNPrefix";
import { Ca } from "../../../../src/models/vpn/pki/Ca";
import { Crt } from "../../../../src/models/vpn/pki/Crt";
import StringHelper from "../../../../src/utils/string.helper";
import { expect, testSuite } from "../../../mocha/global-setup";

describe('Route data fetch for compiler or grid', () => {
    let fwcloud: number;
    let firewall: number;
    let vpnSrv: number;
    let vpnCli1: number;
    let vpnCli1IP: number;
    let crtCli2: number;
    let vpnCli2: number;
    let vpnCli2IP: number;
    let vpnPrefix: number;
    let natIP: number;
    let group: number;
    let useGroup = false;
    let usePrefix = false; 
   
    before(async () => {
        fwcloud = (await getRepository(FwCloud).save(getRepository(FwCloud).create({ name: StringHelper.randomize(10) }))).id;
        firewall = (await getRepository(Firewall).save(getRepository(Firewall).create({ name: StringHelper.randomize(10), fwCloudId: fwcloud }))).id;
        const ca = (await getRepository(Ca).save(getRepository(Ca).create({ cn: StringHelper.randomize(10), fwCloudId: fwcloud, days: 18250 }))).id;
        const crtSrv = (await getRepository(Crt).save(getRepository(Crt).create({ caId: ca, cn: StringHelper.randomize(10), days: 18250, type: 2 }))).id;
        const crtCli1 = (await getRepository(Crt).save(getRepository(Crt).create({ caId: ca, cn: `SOLTECSIS-${StringHelper.randomize(10)}`, days: 18250, type: 1 }))).id;
        crtCli2 = (await getRepository(Crt).save(getRepository(Crt).create({ caId: ca, cn: `SOLTECSIS-${StringHelper.randomize(10)}`, days: 18250, type: 1 }))).id;
        vpnSrv = (await getRepository(OpenVPN).save(getRepository(OpenVPN).create({ firewallId: firewall, crtId: crtSrv }))).id;
        vpnPrefix = (await getRepository(OpenVPNPrefix).save(getRepository(OpenVPNPrefix).create({ openVPNId: vpnSrv, name: 'SOLTECSIS-' }))).id;
        vpnCli1 = (await getRepository(OpenVPN).save(getRepository(OpenVPN).create({ firewallId: firewall, crtId: crtCli1, parentId: vpnSrv }))).id;
        vpnCli1IP = (await getRepository(IPObj).save(getRepository(IPObj).create({ fwCloudId: fwcloud, name: '10.20.30.2', ipObjTypeId: 5, address: '10.20.30.2', netmask: '/32', ip_version: 4  }))).id;
        await getRepository(OpenVPNOption).save(getRepository(OpenVPNOption).create({ openVPNId: vpnCli1, ipObjId: vpnCli1IP, name: 'ifconfig-push', order: 1, scope: 0 }));
        natIP = (await getRepository(IPObj).save(getRepository(IPObj).create({ fwCloudId: fwcloud, name: '192.168.0.50', ipObjTypeId: 5, address: '192.168.0.50', netmask: '/32', ip_version: 4  }))).id;
    });
    
    describe('For compiler', () => {
        it('should ', async () => {
        });

  })
})