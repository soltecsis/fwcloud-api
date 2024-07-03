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

import {
  TableTerraformer,
  TerraformHandlerCollection,
} from '../table-terraformer';
import { ImportMapping } from '../mapper/import-mapping';
import { Firewall } from '../../../../models/firewall/Firewall';
import { Ca } from '../../../../models/vpn/pki/Ca';
import { Cluster } from '../../../../models/firewall/Cluster';
import { Crt } from '../../../../models/vpn/pki/Crt';
import Model from '../../../../models/Model';
import { Interface } from '../../../../models/interface/Interface';
import { OpenVPN } from '../../../../models/vpn/openvpn/OpenVPN';
import { IPObj } from '../../../../models/ipobj/IPObj';
import { IPObjGroup } from '../../../../models/ipobj/IPObjGroup';
import { Mark } from '../../../../models/ipobj/Mark';
import { CaPrefix } from '../../../../models/vpn/pki/CaPrefix';
import { OpenVPNPrefix } from '../../../../models/vpn/openvpn/OpenVPNPrefix';
import { EventEmitter } from 'typeorm/platform/PlatformTools';
import { RoutingTable } from '../../../../models/routing/routing-table/routing-table.model';

export class FwcTreeTerraformer extends TableTerraformer {
  protected _typeToTableNameMapping: { [type: string]: typeof Model } = {
    CA: Ca,
    CL: Cluster,
    CRT: Crt,
    FCA: null,
    FCF: Firewall,
    FCR: null,
    FD: null,
    FDC: null,
    FDF: null,
    FDI: Firewall,
    FDO: null,
    FDS: null,
    FDT: null,
    FP: Firewall,
    FP6: Firewall,
    FW: Firewall,
    IFF: Interface,
    IFH: Interface,
    MRK: Mark,
    ND6: Firewall,
    NS6: Firewall,
    NT: null,
    NTD: Firewall,
    NTS: Firewall,
    OCL: OpenVPN,
    OIA: IPObj,
    OIG: IPObjGroup,
    OIH: IPObj,
    OIN: IPObj,
    OIR: IPObj,
    ONS: IPObj,
    OPN: Firewall,
    OSR: OpenVPN,
    PF: Firewall,
    PF6: Firewall,
    PI: Firewall,
    PI6: Firewall,
    PO: Firewall,
    PO6: Firewall,
    PRE: CaPrefix,
    PRO: OpenVPNPrefix,
    SOC: null,
    SOG: IPObjGroup,
    SOI: IPObj,
    SOM: IPObj,
    SOT: IPObj,
    SOU: IPObj,
    STD: null,

    ROU: Firewall,
    RTS: Firewall,
    RT: RoutingTable,
    RR: Firewall,

    SYS: Firewall,
    S01: Firewall,
    S02: Firewall,
    S03: Firewall,
    S04: Firewall,
  };

  public static async make(
    mapper: ImportMapping,
    eventEmitter: EventEmitter = new EventEmitter(),
  ): Promise<FwcTreeTerraformer> {
    return new FwcTreeTerraformer(mapper, eventEmitter);
  }

  protected getCustomHandlers(): TerraformHandlerCollection {
    const result = {};

    /**
     * id_obj references an id which table is depends on "ipObjType". For that reason, a custom handler is required.
     * This custom handler gets the ipObjType referenced and based on the mapping localized in _typeToTableNameMapping,
     * it calls the mapper in order to get the terraformed id
     */
    result['id_obj'] = (mapper: ImportMapping, row: any, value: any) => {
      if (
        'node_type' in row &&
        row.node_type !== null &&
        row.node_type in this._typeToTableNameMapping &&
        this._typeToTableNameMapping[row.node_type] !== null
      ) {
        const referencedEntity: typeof Model =
          this._typeToTableNameMapping[row.node_type];
        return mapper.getMappedId(
          referencedEntity._getTableName(),
          referencedEntity.getPrimaryKeys()[0].propertyName,
          value,
        );
      }
    };

    return result;
  }
}
