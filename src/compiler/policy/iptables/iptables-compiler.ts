/*
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

import { PolicyTypesMap } from '../../../models/policy/PolicyType';
import { PolicyCompilerTools } from '../PolicyCompilerTools';

export class IPTablesCompiler extends PolicyCompilerTools {
  constructor(ruleData: any) {
    super();

    this._compiler = 'IPTables';
    this._ruleData = ruleData;
    this._policyType = ruleData.type;
    this._cmd = this._policyType < PolicyTypesMap.get('IPv6:INPUT') ? '$IPTABLES' : '$IP6TABLES'; // iptables command variable.
    this._cs = `${this._cmd} `; // Compilation string.
    this._comment = this.ruleComment();
  }

  private natCheck(): void {
    if (
      (this._policyType === PolicyTypesMap.get('IPv4:SNAT') ||
        this._policyType === PolicyTypesMap.get('IPv4:DNAT')) &&
      this._ruleData.positions[5].ipobjs.length === 1
    ) {
      // SNAT or DNAT
      const lines = this._cs.split('\n');
      const action = this._policyType === PolicyTypesMap.get('IPv4:SNAT') ? 'SNAT' : 'DNAT';
      this._cs = '';
      for (const line of lines) {
        if (line === '') continue; // Ignore empty lines.
        const protocol =
          (line.match(/ -p tcp /g) || []).length > 1
            ? 'tcp'
            : (line.match(/ -p udp /g) || []).length > 1
              ? 'udp'
              : null;
        this._cs += `${protocol ? line.replace(` -j ${action} -p ${protocol} `, ` -j ${action} `) : line}\n`;
      }
    }
  }

  public ruleCompile(): string {
    return this.compileRule(() => this.natCheck());
  }
}
