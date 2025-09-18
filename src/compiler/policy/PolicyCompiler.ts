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

import { IPTablesCompiler } from './iptables/iptables-compiler';
import { NFTablesCompiler } from './nftables/nftables-compiler';
import { RuleCompilationResult } from './PolicyCompilerTools';
import { EventEmitter } from 'typeorm/platform/PlatformTools';
import {
  ProgressNoticePayload,
  ProgressWarningPayload,
} from '../../sockets/messages/socket-message';
import { dangerousRules, typeMap } from '../../config/policy/dangerousRules';

export type PolicyCompilerClasses = IPTablesCompiler | NFTablesCompiler;
export type AvailablePolicyCompilers = 'IPTables' | 'NFTables';

export class PolicyCompiler {
  private static checkRuleSafety(rule: string, dangerousRules: any[]): boolean {
    let processedRule = rule;
    if (processedRule.endsWith('\n')) {
      processedRule = processedRule.slice(0, -1);
    }
    // Remove '-m comment --comment "string_comment"' from the rule if present
    processedRule = processedRule.replace(/-m comment --comment\s+'[^']*'\s*/g, '');
    return dangerousRules.includes(processedRule);
  }

  public static compile(
    compileFor: AvailablePolicyCompilers,
    rulesData: any,
    eventEmitter?: EventEmitter,
  ): Promise<RuleCompilationResult[]> {
    return new Promise(async (resolve, reject) => {
      try {
        const result: RuleCompilationResult[] = [];

        if (!rulesData) return resolve(result);

        for (let i = 0; i < rulesData.length; i++) {
          let compiler: PolicyCompilerClasses;
          const ruleType = rulesData[i].type;

          if (compileFor == 'IPTables') compiler = new IPTablesCompiler(rulesData[i]);
          // NFTables
          else compiler = new NFTablesCompiler(rulesData[i]);

          const compiledRule = compiler.ruleCompile();

          // Check if rule is dangerous
          const { ipType, chain } = typeMap[ruleType];
          const dangerousRulesArray = dangerousRules[ipType][compileFor.toLowerCase()][chain];
          const dangerous = dangerousRulesArray.isEmpty
            ? false
            : this.checkRuleSafety(compiledRule, dangerousRulesArray);

          result.push({
            id: rulesData[i].id,
            active: rulesData[i].active,
            comment: rulesData[i].comment,
            cs: rulesData[i].active || rulesData.length === 1 ? compiledRule : '',
            ...(dangerous ? { dangerous: true } : {}), // Only add 'dangerous' property if true
          });

          if (eventEmitter) {
            if (!dangerous)
              eventEmitter.emit(
                'message',
                new ProgressNoticePayload(
                  `Rule ${i + 1} (ID: ${rulesData[i].id})${!rulesData[i].active ? ' [DISABLED]' : ''}`,
                ),
              );
            else
              eventEmitter.emit(
                'message',
                new ProgressWarningPayload(`Rule ${i + 1} (ID: ${rulesData[i].id}) [DANGEROUS]`),
              );
          }
        }

        resolve(result);
      } catch (error) {
        return reject(error);
      }
    });
  }
}
