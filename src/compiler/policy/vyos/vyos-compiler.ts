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
import { FireWallOptMask } from '../../../models/firewall/Firewall';
import { PolicyRuleOptMask, SpecialPolicyRules } from '../../../models/policy/PolicyRule';
import { IpUtils } from '../../../utils/ip-utils';

export class VyOSCompiler extends PolicyCompilerTools {
  constructor(ruleData: any) {
    super();
    this._compiler = 'VyOS';
    this._ruleData = ruleData;
    this._policyType = ruleData.type;
    this._cs = '';
  }

  private isIPv6Policy(): boolean {
    const ipv6Input = PolicyTypesMap.get('IPv6:INPUT');
    if (ipv6Input === undefined) return false;
    return typeof this._policyType === 'number' && this._policyType >= ipv6Input;
  }

  private sanitizeName(name: string): string {
    return name.replace(/[^A-Za-z0-9_-]/g, '_');
  }

  private formatNegatedValue(value: string, negated: boolean): string {
    if (!negated || !value) return value;
    return value.startsWith('!') ? value : `!${value}`;
  }

  private isPositionNegated(positionIndex: number | undefined): boolean {
    if (positionIndex === undefined) return false;
    const positionId = this._ruleData.positions?.[positionIndex]?.id;
    return PolicyCompilerTools.isPositionNegated(this._ruleData.negate, positionId);
  }

  private buildGroupName(suffix: string): string {
    const chain = POLICY_TYPE[this._policyType] || 'RULE';
    return this.sanitizeName(`FWC_${chain}_${this._ruleData.id}_${suffix}`);
  }

  private defineGroup(
    groupType: string,
    valueKeyword: string,
    values: string[],
    suffix: string,
  ): string | undefined {
    const uniqueValues = Array.from(new Set(values.filter((value) => value)));
    if (!uniqueValues.length) return;

    const groupName = this.buildGroupName(suffix);
    this._cs += `delete firewall group ${groupType} ${groupName}\n`;
    for (const value of uniqueValues) {
      this._cs += `set firewall group ${groupType} ${groupName} ${valueKeyword} ${value}\n`;
    }
    return groupName;
  }

  private splitByFamily(addresses: string[]): { v4: string[]; v6: string[] } {
    const result = { v4: [] as string[], v6: [] as string[] };
    for (const address of addresses) {
      if (address && address.includes(':')) result.v6.push(address);
      else if (address) result.v4.push(address);
    }
    return result;
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

  private compileHookScript(): string {
    const runBefore = this._ruleData.run_before ? `${this._ruleData.run_before}` : '';
    let script = '###########################\n# Hook script rule code:\n';
    script += `${runBefore}\n###########################\n`;

    if (this._ruleData.fw_apply_to && this._ruleData.firewall_name)
      return `if [ "$HOSTNAME" = "${this._ruleData.firewall_name}" ]; then\n${script}fi\n`;

    return script;
  }

  public ruleCompile(): string {
    const special = Number.isInteger(this._ruleData.special)
      ? this._ruleData.special
      : parseInt(this._ruleData.special, 10);
    if (special === SpecialPolicyRules.HOOKSCRIPT) return this.compileHookScript();

    const chain = POLICY_TYPE[this._policyType];
    const firewallKeyword = this.isIPv6Policy() ? 'ipv6-name' : 'name';
    const base = (opt: string) =>
      `set firewall ${firewallKeyword} ${chain} rule ${this._ruleData.id} ${opt}`;
    const isIPv6Rule = this.isIPv6Policy();

    // Interface IN
    const inIfs = this._ruleData.positions?.[0]?.ipobjs || [];
    const inboundNegated = this.isPositionNegated(0);
    const inboundNames = inIfs.map((iface: any) => iface?.name).filter(Boolean);
    if (inboundNames.length === 1) {
      this._cs += `${base('inbound-interface')} ${this.formatNegatedValue(
        inboundNames[0],
        inboundNegated,
      )}\n`;
    } else if (inboundNames.length > 1) {
      const groupName = this.defineGroup('interface-group', 'interface', inboundNames, 'IN_IF');
      if (groupName)
        this._cs += `${base('inbound-interface group')} ${this.formatNegatedValue(
          groupName,
          inboundNegated,
        )}\n`;
    }

    // Interface OUT for FORWARD rules
    if (
      this._policyType === PolicyTypesMap.get('IPv4:FORWARD') ||
      this._policyType === PolicyTypesMap.get('IPv6:FORWARD')
    ) {
      const outIfs = this._ruleData.positions?.[1]?.ipobjs || [];
      const outboundNegated = this.isPositionNegated(1);
      const outboundNames = outIfs.map((iface: any) => iface?.name).filter(Boolean);
      if (outboundNames.length === 1) {
        this._cs += `${base('outbound-interface')} ${this.formatNegatedValue(
          outboundNames[0],
          outboundNegated,
        )}\n`;
      } else if (outboundNames.length > 1) {
        const groupName = this.defineGroup('interface-group', 'interface', outboundNames, 'OUT_IF');
        if (groupName)
          this._cs += `${base('outbound-interface group')} ${this.formatNegatedValue(
            groupName,
            outboundNegated,
          )}\n`;
      }
    }

    // Determine positions
    const forward =
      this._policyType === PolicyTypesMap.get('IPv4:FORWARD') ||
      this._policyType === PolicyTypesMap.get('IPv6:FORWARD');
    const srcPos = forward ? 2 : 1;
    const dstPos = forward ? 3 : 2;
    const svcPos = forward ? 4 : 3;

    // Source
    const srcObjs = this._ruleData.positions?.[srcPos]?.ipobjs || [];
    const srcNegated = this.isPositionNegated(srcPos);
    const srcAddresses: string[] = [];
    for (const obj of srcObjs) {
      if (obj?.type === 24) {
        const cc = obj.name || obj.code;
        if (cc)
          this._cs += `${base('source geoip country-code')} ${this.formatNegatedValue(
            cc,
            srcNegated,
          )}\n`;
        continue;
      }
      const srcAddr = this.formatAddress(obj);
      if (srcAddr) srcAddresses.push(srcAddr);
    }
    if (srcAddresses.length === 1) {
      this._cs += `${base('source address')} ${this.formatNegatedValue(
        srcAddresses[0],
        srcNegated,
      )}\n`;
    } else if (srcAddresses.length > 1) {
      const { v4, v6 } = this.splitByFamily(srcAddresses);
      if (v4.length) {
        const groupName = this.defineGroup('address-group', 'address', v4, 'SRC_ADDR_V4');
        if (groupName)
          this._cs += `${base('source group address-group')} ${this.formatNegatedValue(
            groupName,
            srcNegated,
          )}\n`;
      }
      if (v6.length) {
        const groupName = this.defineGroup('ipv6-address-group', 'address', v6, 'SRC_ADDR_V6');
        if (groupName)
          this._cs += `${base('source group address-group')} ${this.formatNegatedValue(
            groupName,
            srcNegated,
          )}\n`;
      }
    }

    // Destination
    const dstObjs = this._ruleData.positions?.[dstPos]?.ipobjs || [];
    const dstNegated = this.isPositionNegated(dstPos);
    const dstAddresses: string[] = [];
    for (const obj of dstObjs) {
      if (obj?.type === 24) {
        const cc = obj.name || obj.code;
        if (cc)
          this._cs += `${base('destination geoip country-code')} ${this.formatNegatedValue(
            cc,
            dstNegated,
          )}\n`;
        continue;
      }
      const dstAddr = this.formatAddress(obj);
      if (dstAddr) dstAddresses.push(dstAddr);
    }
    if (dstAddresses.length === 1) {
      this._cs += `${base('destination address')} ${this.formatNegatedValue(
        dstAddresses[0],
        dstNegated,
      )}\n`;
    } else if (dstAddresses.length > 1) {
      const { v4, v6 } = this.splitByFamily(dstAddresses);
      if (v4.length) {
        const groupName = this.defineGroup('address-group', 'address', v4, 'DST_ADDR_V4');
        if (groupName)
          this._cs += `${base('destination group address-group')} ${this.formatNegatedValue(
            groupName,
            dstNegated,
          )}\n`;
      }
      if (v6.length) {
        const groupName = this.defineGroup('ipv6-address-group', 'address', v6, 'DST_ADDR_V6');
        if (groupName)
          this._cs += `${base('destination group address-group')} ${this.formatNegatedValue(
            groupName,
            dstNegated,
          )}\n`;
      }
    }

    // Service / protocol
    const svcObjs = this._ruleData.positions?.[svcPos]?.ipobjs || [];
    for (const svc of svcObjs) {
      const proto = svc.protocol;
      let protoName: string;
      if (typeof proto === 'number') {
        if (proto === 6) protoName = 'tcp';
        else if (proto === 17) protoName = 'udp';
        else if (proto === 1 || proto === 58) protoName = isIPv6Rule ? 'ipv6-icmp' : 'icmp';
        else protoName = `${proto}`;
      } else if (typeof proto === 'string') {
        const normalized = proto.toLowerCase();
        if (normalized === 'icmp' || normalized === 'ipv6-icmp')
          protoName = isIPv6Rule ? 'ipv6-icmp' : 'icmp';
        else protoName = proto;
      } else protoName = `${proto}`;
      this._cs += `${base('protocol')} ${protoName}\n`;
      if (protoName === 'icmp' || protoName === 'ipv6-icmp') {
        const typeKeyword = isIPv6Rule ? 'icmpv6 type' : 'icmp type';
        const codeKeyword = isIPv6Rule ? 'icmpv6 code' : 'icmp code';
        if (svc.icmp_type !== undefined && svc.icmp_type !== -1)
          this._cs += `${base(typeKeyword)} ${svc.icmp_type}\n`;
        if (svc.icmp_code !== undefined && svc.icmp_code !== -1)
          this._cs += `${base(codeKeyword)} ${svc.icmp_code}\n`;
      }
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

    // Connection state
    const needsState =
      this._ruleData.action === 1 &&
      (this._ruleData.options & PolicyRuleOptMask.STATEFUL ||
        (this._ruleData.firewall_options & FireWallOptMask.STATEFUL &&
          !(this._ruleData.options & PolicyRuleOptMask.STATELESS)));
    if (needsState) this._cs += `${base('state new')} enable\n`;

    // Packet mark
    const markCode = parseInt(this._ruleData.mark_code);
    if (markCode && this._policyType <= PolicyTypesMap.get('IPv4:FORWARD')) {
      this._cs += `${base('set-mark')} ${markCode}\n`;
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
