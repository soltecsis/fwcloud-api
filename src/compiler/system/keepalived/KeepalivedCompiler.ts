/*
    Copyright 2024 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
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
import { EventEmitter } from 'typeorm/platform/PlatformTools';
import { KeepalivedRulesData } from '../../../models/system/keepalived/keepalived_r/keepalived_r.service';
import { KeepalivedRuleItemForCompiler } from '../../../models/system/keepalived/shared';
import { ProgressNoticePayload } from '../../../sockets/messages/socket-message';

export type KeepalivedCompiled = {
  id: number;
  active: boolean;
  cs: string;
};

export class KeepalivedCompiler {
  public ruleCompile(
    ruleData: KeepalivedRulesData<KeepalivedRuleItemForCompiler>,
  ): string {
    let cs: string = '';

    switch (ruleData.rule_type) {
      case 2:
        cs = ruleData.cfg_text ? ruleData.cfg_text : '';
        break;
      default:
        if (ruleData.comment) {
          cs += `# ${ruleData.comment}\n`;
        }

        cs += `vrrp_script VI_${ruleData.interface?.name} {\n`;
        cs += `\tinterface ${ruleData.interface?.name}\n`;
        cs += `\tstate BACKUP\n`;
        if (ruleData.interface?.hosts?.length > 0) {
          cs += `\tvirtual_router_id ${ruleData.interface.hosts[0].ipObjId}\n`;
        }
        cs += `\tpriority ${ruleData.masterNode === ruleData.firewall ? 99 : 50}\n`;
        cs += '\tadvert_int 5\n';
        if (ruleData.virtualIps?.length) {
          cs += '\tvirtual_ipaddress {\n';
          for (const vip of ruleData.virtualIps) {
            const ipobj = vip.ipObj;
            const ipSplit = ipobj.address.split('.');
            cs += `\t\t${ipobj.address} label ${ruleData.interface.name}:${ipSplit[ipSplit.length - 1]} dev ${ruleData.interface.name}\n`;
          }
          cs += '\t}\n';
        }
        cs += '}\n';
        break;
    }

    return cs;
  }

  public compile(
    data: KeepalivedRulesData<KeepalivedRuleItemForCompiler>[],
    eventEmitter?: EventEmitter,
  ): KeepalivedCompiled[] {
    const compiled: KeepalivedCompiled[] = [];

    if (!data) {
      return compiled;
    }

    for (let i: number = 0; i < data.length; i++) {
      if (eventEmitter) {
        eventEmitter.emit(
          'progress',
          new ProgressNoticePayload(
            `Compiling Keepalived rule ${i} (ID: ${data[i].id})${!data[i].active ? ' [DISABLED]' : ''}`,
          ),
        );
      }
      const ruleData = data[i];
      const cs = this.ruleCompile(ruleData);
      compiled.push({
        id: ruleData.id,
        active: ruleData.active,
        cs: cs,
      });
    }

    return compiled;
  }
}
