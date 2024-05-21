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
import { HAProxyRulesData } from "../../../models/system/haproxy/haproxy_r/haproxy_r.service";
import { HAProxyRuleItemForCompiler } from "../../../models/system/haproxy/shared";
import { ProgressNoticePayload } from "../../../sockets/messages/socket-message";

export type HAProxyCompiled = {
    id: number;
    active: boolean;
    cs: string;
}

export class HAProxyCompiler {
    public ruleCompile(ruleData: HAProxyRulesData<HAProxyRuleItemForCompiler>): string {
        let cs = '';

        switch (ruleData.rule_type) {
            case 2:
                cs = ruleData.cfg_text ? ruleData.cfg_text : '';
                break;
            default:
                if (ruleData.comment) {
                    cs += `# ${ruleData.comment}\n`;
                }
                cs += `frontend front_${ruleData.frontendIp.name}\n`;
                cs += `\tmode\ttcp\n`;
                cs += `\tbind\t${ruleData.frontendIp.address}:${ruleData.frontendPort.destination_port_start}\n`;
                cs += `\ttimeout\tclient 86400s\n`;
                cs += `\toption\ttcplog\n`;
                cs += `\tuse_backend\tback_${ruleData.frontendIp.name}\n`;
                cs += `\n`;
                cs += `backend\tback_${ruleData.frontendIp.name}\n`;
                cs += `\tmode\ttcp\n`;
                cs += `\ttimeout\tconnect 30s\n`;
                cs += `\ttimeout\tserver 86400s\n`;
                cs += `\tbalance\tleastconn\n`;
                cs += `\n`;
                cs += `default-server\tinter 15s maxconn 50000\n`;
                for (let i = 0; i < ruleData.items.length; i++) {
                    cs += `\tserver\t${(ruleData.items[i] as HAProxyRuleItemForCompiler).name}\t${ruleData.items[i].address}:${ruleData.backendPort.destination_port_end}\n`;
                }
        }
        return cs;
    }

    public compile(data: HAProxyRulesData<HAProxyRuleItemForCompiler>[], eventEmitter?: EventEmitter): HAProxyCompiled[] {
        const compiled: HAProxyCompiled[] = [];

        if (!data) {
            return compiled;
        }

        for (let i = 0; i < data.length; i++) {
            if (eventEmitter) {
                eventEmitter.emit('progress', new ProgressNoticePayload(`Compiling HAProxy rule ${i} (ID: ${data[i].id})${!(data[i].active) ? ' [DISABLED]' : ''}`));
            }

            compiled.push({
                id: data[i].id,
                active: data[i].active,
                cs: (data[i].active || data.length === 1) ? this.ruleCompile(data[i] as HAProxyRulesData<HAProxyRuleItemForCompiler>) : ''
            });
        }

        return compiled;
    }
}