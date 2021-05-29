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

type FWCloudProduct = {
    fwcloud: FwCloud;
    firewall: Firewall;
    ipobjs: Map<string, IPObj>;
    ipobjGroup: IPObjGroup;
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

    fwc: FWCloudProduct;


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

        this.fwc.ipobjs = new Map<string, IPObj>();
    }

    async make() {
        this.makeFwcAndFw();
        this.makeIpobjGroup();
        this.makeIPOBjs();
        this.makeHost();
    }

    private async makeFwcAndFw() {
        this.fwc.fwcloud = await this._fwcloudRepository.save(this._fwcloudRepository.create({
            name: StringHelper.randomize(10)
        }));

        this.fwc.firewall = await this._firewallRepository.save(this._firewallRepository.create({
            name: StringHelper.randomize(10),
            fwCloudId: this.fwc.fwcloud.id
        }));

    }

    private async makeIpobjGroup() {
        this.fwc.ipobjGroup = await this._ipobjGroupRepository.save(this._ipobjGroupRepository.create({
            name: 'ipobjs group',
            type: 20,
            fwCloudId: this.fwc.fwcloud.id
        }));
    }

    private async makeIPOBjs() {
        this.fwc.ipobjs.set('gateway', await this._ipobjRepository.save(this._ipobjRepository.create({
            name: 'gateway',
            address: '1.2.3.4',
            ipObjTypeId: 5,
            interfaceId: null
        })));

        this.fwc.ipobjs.set('address', await this._ipobjRepository.save(this._ipobjRepository.create({
            name: 'address',
            address: '10.20.30.40',
            ipObjTypeId: 5,
            interfaceId: null
        })));

        this.fwc.ipobjs.set('addressRange', await this._ipobjRepository.save(this._ipobjRepository.create({
            name: 'addressRange',
            range_start: '10.10.10.50',
            range_end: '10.10.10.80',
            ipObjTypeId: 6,
            interfaceId: null
        })));

        this.fwc.ipobjs.set('network', await this._ipobjRepository.save(this._ipobjRepository.create({
            name: 'network',
            address: '10.20.30.0',
            netmask: '/24',
            ipObjTypeId: 7,
            interfaceId: null
        })));
    }

    private async makeHost() {
        let interface1: Interface;
        let interface2: Interface;
        let interface3: Interface;

        this.fwc.ipobjs.set('host', await this._ipobjRepository.save(this._ipobjRepository.create({
            name: 'host',
            ipObjTypeId: 8,
            interfaceId: null
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
            name: 'host-eth2-addr1',
            address: '192.168.10.1',
            ipObjTypeId: 5,
            interfaceId: interface2.id
        })));

        this.fwc.ipobjs.set('host-eth3-addr1', await this._ipobjRepository.save(this._ipobjRepository.create({
            name: 'host-eth3-addr1',
            address: '172.26.20.5',
            ipObjTypeId: 5,
            interfaceId: interface3.id
        })));

        this.fwc.ipobjs.set('host-eth3-addr2', await this._ipobjRepository.save(this._ipobjRepository.create({
            name: 'host-eth3-addr2',
            address: '172.26.20.6',
            ipObjTypeId: 5,
            interfaceId: interface3.id
        })));
    }

} 