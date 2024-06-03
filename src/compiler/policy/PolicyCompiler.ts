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

import { IPTablesCompiler } from './iptables/iptables-compiler'
import { NFTablesCompiler } from './nftables/nftables-compiler'
import { RuleCompilationResult } from './PolicyCompilerTools'
import { EventEmitter } from 'typeorm/platform/PlatformTools';
import { ProgressNoticePayload } from '../../sockets/messages/socket-message';
import { PolicyRule } from '../../models/policy/PolicyRule';

export type PolicyCompilerClasses = IPTablesCompiler | NFTablesCompiler;
export type AvailablePolicyCompilers = 'IPTables' | 'NFTables';
 
export class PolicyCompiler {

  public static compile(compileFor: AvailablePolicyCompilers, rulesData: any, eventEmitter?: EventEmitter): Promise<RuleCompilationResult[]> {
    return new Promise(async (resolve, reject) => {
      try {
        const result: RuleCompilationResult[] = [];
        
        if (!rulesData) return resolve(result);

        for (let i=0; i<rulesData.length; i++) {
          if (eventEmitter) eventEmitter.emit('message', new ProgressNoticePayload(`Rule ${i+1} (ID: ${rulesData[i].id})${!(rulesData[i].active) ? ' [DISABLED]' : ''}`));

          let compiler: PolicyCompilerClasses;

          if (compileFor == 'IPTables')
            compiler = new IPTablesCompiler(rulesData[i]);
          else // NFTables
            compiler = new NFTablesCompiler(rulesData[i]);

          result.push({
            id: rulesData[i].id,
            active: rulesData[i].active,
            comment: rulesData[i].comment,
            cs: (rulesData[i].active || rulesData.length===1) ? compiler.ruleCompile() : ''
          });
        }

        resolve(result);
      } catch (error) { return reject(error) }
    });
  }
  
 }