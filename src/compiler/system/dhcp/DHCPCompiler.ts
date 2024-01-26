/*
    Copyright 2023 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
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
import { EventEmitter } from "typeorm/platform/PlatformTools";
import { DHCPRulesData } from "../../../models/system/dhcp/dhcp_r/dhcp_r.service";
import { DHCPRuleItemForCompiler } from "../../../models/system/shared";
import ip from 'ip';
import { ProgressNoticePayload } from "../../../sockets/messages/socket-message";

export type DHCPCompiled = {
    id: number;
    active: boolean;
    comment: string;
    cs: string;
}

export class DHCPCompiler {
    public ruleCompile(ruleData: DHCPRulesData<DHCPRuleItemForCompiler>): string {
        let cs = '';

        switch (ruleData.rule_type) {
            case 1:
                cs += `# ${ruleData.comment}\n`;
                cs += `subnet ${ruleData.network.address} netmask ${ruleData.network.netmask} {\n`;
                cs += `\toption subnet-mask ${ruleData.network.netmask};\n`;
                cs += `\toption routers ${ruleData.router.address};\n`;
                cs += `\toption broadcast-address ${ip.subnet(ruleData.network.address, ruleData.network.netmask).broadcastAddress};\n`;
                if(ruleData.items && ruleData.items.length > 0) {
                    cs += `\toption domain-name-servers `;
                    for(let i = 0; i < ruleData.items.length-1; i++) {
                        cs += `${ruleData.items[i].address}, `;
                    }
                    cs += `${ruleData.items[ruleData.items.length].address};\n`;
                    cs += `;\n`;
                }
                cs += `\tpool {\n`;
                cs += `\t\tmax-lease-time ${ruleData.max_lease};\n`;
                cs += `\t\trange ${ruleData.range.range_start} ${ruleData.range.range_end};\n`;
                cs += `\t}\n`;
                cs += `}\n`;
                break;
            case 2:
                cs += `# ${ruleData.comment}\n`;
                cs += `host ${ruleData.interface.name} {\n`;
                cs += `\thardware ethernet ${ruleData.interface.mac};\n`;
                cs += `\tfixed-address ${ruleData.router.address};\n`;
                cs += `}\n`;
                break;
            case 3:
                cs = ruleData.cfg_text;
                break;
        }

        return cs;
    }

    public compile(data: DHCPRulesData<DHCPRuleItemForCompiler>[], eventEmitter?: EventEmitter): DHCPCompiled[] {
        let result: DHCPCompiled[] = [];

        if (!data) {
            return result;
        }
        
        for (let i = 0; i < data.length; i++) {
            if (eventEmitter) {
                eventEmitter.emit('progress', new ProgressNoticePayload(`Compiling DHCP rule ${i} (ID: ${data[i].id})${!(data[i].active) ? ' [DISABLED]' : ''}`));
            }

            result.push({
                id: data[i].id,
                active: data[i].active,
                comment: data[i].comment,
                cs: (data[i].active || data.length === 1) ? this.ruleCompile(data[i] as DHCPRulesData<DHCPRuleItemForCompiler>) : ''
            });
        }

        return result;
    }
};