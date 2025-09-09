/*
        Copyright 2025 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
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

import { PolicyCompilerTools, POLICY_TYPE } from '../PolicyCompilerTools';
import { PolicyTypesMap } from '../../../models/policy/PolicyType';
import { IpUtils } from '../../../utils/ip-utils';

export class VyOSCompiler extends PolicyCompilerTools {
  constructor(ruleData: any) {
    super();
    this._compiler = 'VyOS';
    this._ruleData = ruleData;
    this._policyType = ruleData.type;
    this._cs = '';
  }

  private buildComment(): string {
    const metaData: any = {};
    let comment: string = this._ruleData.comment ? this._ruleData.comment : '';

    if (this._ruleData.style) metaData['fwc_rs'] = this._ruleData.style;
    if (this._ruleData.group_name) metaData['fwc_rgn'] = this._ruleData.group_name;
    if (this._ruleData.group_style) metaData['fwc_rgs'] = this._ruleData.group_style;

    if (Object.keys(metaData).length) comment = `${JSON.stringify(metaData)}${comment}`;

    return comment.trim();
  }

  private formatAddress(ipobj: any): string | undefined {
    if (!ipobj) return;
    if (ipobj.type === 9) return ipobj.name; // DNS
    if (ipobj.type === 5) return ipobj.address; // Single address
    if (ipobj.type === 7) {
      // Network
      if (ipobj.netmask[0] === '/') return `${ipobj.address}${ipobj.netmask}`;
      const net = IpUtils.subnet(ipobj.address, ipobj.netmask);
      return `${ipobj.address}/${net.subnetMaskLength}`;
    }
    if (ipobj.type === 6) return `${ipobj.range_start}-${ipobj.range_end}`; // Range
    return;
  }

  public ruleCompile(): string {
    const chain = POLICY_TYPE[this._policyType];
    const base = (opt: string) => `set firewall name ${chain} rule ${this._ruleData.id} ${opt}`;

    // Interface IN
    const inIf = this._ruleData.positions?.[0]?.ipobjs?.[0]?.name;
    if (inIf) this._cs += `${base('inbound-interface')} ${inIf}\n`;

    // Interface OUT for FORWARD rules
    if (
      this._policyType === PolicyTypesMap.get('IPv4:FORWARD') ||
      this._policyType === PolicyTypesMap.get('IPv6:FORWARD')
    ) {
      const outIf = this._ruleData.positions?.[1]?.ipobjs?.[0]?.name;
      if (outIf) this._cs += `${base('outbound-interface')} ${outIf}\n`;
    }

    // Determine positions
    const forward =
      this._policyType === PolicyTypesMap.get('IPv4:FORWARD') ||
      this._policyType === PolicyTypesMap.get('IPv6:FORWARD');
    const srcPos = forward ? 2 : 1;
    const dstPos = forward ? 3 : 2;
    const svcPos = forward ? 4 : 3;

    // Source
    const srcAddr = this.formatAddress(this._ruleData.positions?.[srcPos]?.ipobjs?.[0]);
    if (srcAddr) this._cs += `${base('source address')} ${srcAddr}\n`;

    // Destination
    const dstAddr = this.formatAddress(this._ruleData.positions?.[dstPos]?.ipobjs?.[0]);
    if (dstAddr) this._cs += `${base('destination address')} ${dstAddr}\n`;

    // Service / protocol
    const svc = this._ruleData.positions?.[svcPos]?.ipobjs?.[0];
    if (svc) {
      const proto = svc.protocol;
      const protoName = proto === 6 ? 'tcp' : proto === 17 ? 'udp' : proto === 1 ? 'icmp' : proto;
      this._cs += `${base('protocol')} ${protoName}\n`;
      if (svc.source_port_end && svc.source_port_end !== 0) {
        const srange =
          svc.source_port_start === svc.source_port_end
            ? svc.source_port_start
            : `${svc.source_port_start}-${svc.source_port_end}`;
        this._cs += `${base('source port')} ${srange}\n`;
      }
      if (svc.destination_port_end && svc.destination_port_end !== 0) {
        const drange =
          svc.destination_port_start === svc.destination_port_end
            ? svc.destination_port_start
            : `${svc.destination_port_start}-${svc.destination_port_end}`;
        this._cs += `${base('destination port')} ${drange}\n`;
      }
    }

    // Action
    const actionMap: Record<number, string> = {
      1: 'accept',
      2: 'drop',
      3: 'reject',
      4: 'accounting',
    };
    const action = actionMap[this._ruleData.action];
    if (action) this._cs += `${base('action')} ${action}\n`;

    // Comment / description
    const comment = this.buildComment();
    if (comment) this._cs += `${base('description')} "${comment.replace(/"/g, '\\"')}"\n`;

    return this._cs;
  }
}
