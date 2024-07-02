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
    this._cmd =
      this._policyType < PolicyTypesMap.get('IPv6:INPUT')
        ? '$IPTABLES'
        : '$IP6TABLES'; // iptables command variable.
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
      this._cs = '';
      for (let i = 0; i < lines.length; i++) {
        if (lines[i] === '') continue; // Ignore empty lines.
        if ((lines[i].match(/ -p tcp /g) || []).length > 1)
          this._cs += `${this._policyType === PolicyTypesMap.get('IPv4:SNAT') ? lines[i].replace(/ -j SNAT -p tcp /, ' -j SNAT ') : lines[i].replace(/ -j DNAT -p tcp /, ' -j DNAT ')}\n`;
        else if ((lines[i].match(/ -p udp /g) || []).length > 1)
          this._cs += `${this._policyType === PolicyTypesMap.get('IPv4:SNAT') ? lines[i].replace(/ -j SNAT -p udp /, ' -j SNAT ') : lines[i].replace(/ -j DNAT -p udp /, ' -j DNAT ')}\n`;
        else this._cs += `${lines[i]}\n`;
      }
    }
  }

  public ruleCompile(): string {
    // Prepare for compilation.
    this.beforeCompilation();

    // Compile special rules.
    this.specialRuleCompilation();

    // Compile items of each rule position.
    this.compileRulePositions();

    // Generate the compilation string.
    this._cs = this.generateCompilationString(this._ruleData.id, this._cs);

    // If we are using UDP or TCP ports in translated service position for NAT rules,
    // make sure that we have only one -p flag per line into the compilation string.
    this.natCheck();

    this.addAccounting();
    this.addLog();
    this.addMark();

    return this.afterCompilation();
  }
}
