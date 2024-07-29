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

import { PolicyCompilerTools } from '../PolicyCompilerTools';

export class NFTablesCompiler extends PolicyCompilerTools {
  constructor(ruleData: any) {
    super();

    this._compiler = 'NFTables';
    this._ruleData = ruleData;
    this._policyType = ruleData.type;
    this._cmd = '$NFT';
    this._cs = `${this._cmd} `; // Compilation string.
    this._comment = this.ruleComment();
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

    this.addAccounting();
    this.addLog();
    this.addMark();

    return this.afterCompilation();
  }
}
