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
import { ProgressNoticePayload } from '../../sockets/messages/socket-message';
import { dangerousRules, typeMap } from '../../config/policy/dangerousRules';
import { VyOSCompiler } from './vyos/vyos-compiler';
import { FireWallOptMask, Firewall } from '../../models/firewall/Firewall';
import db from '../../database/database-manager';

export type PolicyCompilerClasses = IPTablesCompiler | NFTablesCompiler | VyOSCompiler;
export type AvailablePolicyCompilers = 'IPTables' | 'NFTables' | 'VyOS';

export class PolicyCompiler {
  private static checkRuleSafety(
    rule: string,
    dangerousRules: string[],
    compiler: AvailablePolicyCompilers,
    checkForWarnings: boolean = true,
    checkForCritical: boolean = true,
  ): number {
    let processedRule = rule;
    if (processedRule.endsWith('\n')) {
      processedRule = processedRule.slice(0, -1);
    }
    // Remove the lines that tells if the cluster rule is for any specific node
    processedRule = processedRule
      .split('\n')
      .filter((line) => !line.startsWith('if ') && !line.startsWith('fi'))
      .join('\n');

    const interfaceNames: string[] = [];
    const stripQuotes = (value?: string) => {
      if (!value) return null;
      const normalized = value.replace(/^['"]+|['"]+$/g, '').trim();
      if (!normalized) return null;
      return normalized;
    };
    const sanitizeInterface = (iface?: string) => {
      const normalized = stripQuotes(iface);
      if (!normalized) return null;
      return normalized.toLowerCase();
    };
    const sanitizeGroupName = (groupName?: string) => {
      const normalized = stripQuotes(groupName);
      if (!normalized) return null;
      // Quita uno o varios '!' iniciales (por si acaso)
      return normalized.replace(/^!+/, '');
    };
    const registerInterface = (iface?: string) => {
      const normalized = sanitizeInterface(iface);
      if (!normalized) return;
      interfaceNames.push(normalized);
    };
    const normalizeRuleString = (ruleStr: string) => {
      const seen = new Set<string>();
      const normalizedLines: string[] = [];
      ruleStr
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length)
        .forEach((line) => {
          if (seen.has(line)) return;
          seen.add(line);
          normalizedLines.push(line);
        });
      return normalizedLines.join('\n');
    };

    const collapseIptablesHelperChains = (ruleStr: string): string => {
      const lines = ruleStr
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length);

      const helperChains = new Set<string>();
      const returnChains = new Set<string>();
      const acceptChains = new Set<string>();

      // Detect helper chains of the type:
      // $IPTABLES/-A FWCRULEXXX.CH1 -j RETURN
      // $IPTABLES/-A FWCRULEXXX.CH1 -j ACCEPT
      for (const line of lines) {
        let m = line.match(/^\$(?:IPTABLES|IP6TABLES)\s+-A\s+(\S+)\s+-j\s+RETURN\b/);
        if (m) {
          returnChains.add(m[1]);
          continue;
        }
        m = line.match(/^\$(?:IPTABLES|IP6TABLES)\s+-A\s+(\S+)\s+-j\s+ACCEPT\b/);
        if (m) {
          acceptChains.add(m[1]);
        }
      }

      for (const chain of returnChains) {
        if (acceptChains.has(chain)) helperChains.add(chain);
      }

      const newLines: string[] = [];

      for (const line of lines) {
        // Remove creation of the helper chain
        let m = line.match(/^\$(?:IPTABLES|IP6TABLES)\s+-N\s+(\S+)/);
        if (m && helperChains.has(m[1])) continue;

        // Remove rules that add to the helper chain
        m = line.match(/^\$(?:IPTABLES|IP6TABLES)\s+-A\s+(\S+)\b/);
        if (m && helperChains.has(m[1])) continue;

        // Rewrite jumps from INPUT/FORWARD to the helper chain as a direct ACCEPT
        m = line.match(
          /^(\$(?:IPTABLES|IP6TABLES)\s+-A\s+(INPUT|FORWARD)\b.*?\s)-j\s+(\S+)(\s.*)?$/,
        );
        if (m && helperChains.has(m[3])) {
          newLines.push(`${m[1]}-j ACCEPT${m[4] ?? ''}`.trim());
          continue;
        }

        newLines.push(line);
      }

      return newLines.join('\n');
    };

    const collapseNftablesHelperChains = (ruleStr: string): string => {
      const lines = ruleStr
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length);

      const helperChains = new Set<string>();
      const returnChains = new Set<string>();
      const acceptChains = new Set<string>();

      // Detect helper chains of the type:
      // $NFT add rule ip filter FWCRULEXXX.CH1 ... return
      // $NFT add rule ip filter FWCRULEXXX.CH1 counter accept
      for (const line of lines) {
        let m = line.match(/^\$NFT\s+add\s+rule\s+\S+\s+\S+\s+(\S+)\s+return\b/);
        if (m) {
          returnChains.add(m[1]);
          continue;
        }
        m = line.match(/^\$NFT\s+add\s+rule\s+\S+\s+\S+\s+(\S+)\s+counter\s+accept\b/);
        if (m) {
          acceptChains.add(m[1]);
        }
      }

      for (const chain of returnChains) {
        if (acceptChains.has(chain)) helperChains.add(chain);
      }

      const newLines: string[] = [];

      for (const line of lines) {
        // Remove creation of the helper chain
        let m = line.match(/^\$NFT\s+add\s+chain\s+\S+\s+\S+\s+(\S+)/);
        if (m && helperChains.has(m[1])) continue;

        // Remove rules inside the helper chain
        m = line.match(/^\$NFT\s+add\s+rule\s+\S+\s+\S+\s+(\S+)\b/);
        if (m && helperChains.has(m[1])) continue;

        // Rewrite jumps from INPUT/FORWARD to the helper chain as a direct ACCEPT
        m = line.match(
          /^(\$NFT\s+add\s+rule\s+\S+\s+\S+\s+(INPUT|FORWARD)\b.*\s)jump\s+(\S+)(\s.*)?$/,
        );
        if (m && helperChains.has(m[3])) {
          // Example: ... ct state new counter jump FWCRULE -> ... ct state new counter accept
          newLines.push(`${m[1]}accept${m[4] ?? ''}`.trim());
          continue;
        }

        newLines.push(line);
      }

      return newLines.join('\n');
    };

    if (compiler === 'IPTables') {
      const interfaceRegex = /(?:!\s*)?-(?:i|o)\s+(\S+)/g;
      let interfaceMatch: RegExpExecArray | null;

      // 1) Extract all interfaces (including those from FWCRULE chains)
      while ((interfaceMatch = interfaceRegex.exec(processedRule)) !== null) {
        registerInterface(interfaceMatch[1]);
      }

      // 2) Remove comments
      processedRule = processedRule.replace(/-m comment --comment\s+'[^']*'\s*/g, '');

      // 3) Remove interface specifications (-i / -o), but keep the structure
      processedRule = processedRule.replace(/(?:!\s*)?-(?:i|o)\s+\S+\s*/g, '');

      // 4) Flatten helper chains of the type FWCRULEXXX.CH1 that implement "negated interfaces"
      processedRule = collapseIptablesHelperChains(processedRule);
    } else if (compiler === 'NFTables') {
      const interfaceRegex = /\b(?:iifname|oifname)\s+(?:!=|==)?\s*"([^"]+)"/g;
      let interfaceMatch: RegExpExecArray | null;

      // 1) Extract interfaces (including those from FWCRULEXXX.CH1 chains)
      while ((interfaceMatch = interfaceRegex.exec(processedRule)) !== null) {
        registerInterface(interfaceMatch[1]);
      }

      // 2) Remove comments (including those with group info)
      processedRule = processedRule.replace(/\s*comment\s+\\"(?:\\.|[^\\"])*\\"\s*/g, '');

      // 3) Remove references to interfaces (iifname/oifname)
      processedRule = processedRule.replace(/\b(?:iifname|oifname)\s+(?:!=|==)?\s*"[^"]+"\s*/g, '');

      // 4) Flatten helper chains of the type FWCRULEXXX.CH1 that implement "negated interfaces"
      processedRule = collapseNftablesHelperChains(processedRule);
    } else if (compiler === 'VyOS') {
      // If VyOS compiler is used, both warnings and critical checks are always enabled. We can't change firewall options here.
      checkForWarnings = true;
      checkForCritical = true;

      const groupInterfaces = new Map<string, Set<string>>();
      let ruleLines = processedRule.split('\n').map((line) => line.trim());

      ruleLines.forEach((line) => {
        const groupMatch = line.match(
          /^set\s+firewall\s+group\s+interface-group\s+(\S+)\s+interface\s+(\S+)/,
        );
        if (groupMatch) {
          const [, groupName, iface] = groupMatch;
          const sanitizedGroupName = sanitizeGroupName(groupName);
          const sanitizedInterface = sanitizeInterface(iface);
          if (!sanitizedGroupName || !sanitizedInterface) return;
          if (!groupInterfaces.has(sanitizedGroupName)) {
            groupInterfaces.set(sanitizedGroupName, new Set());
          }
          groupInterfaces.get(sanitizedGroupName)!.add(sanitizedInterface);
        }
      });

      ruleLines = ruleLines.filter((line) => {
        const trimmed = line.trim();
        if (!trimmed) return false;
        if (trimmed.includes('description ')) return false;
        if (trimmed.startsWith('delete firewall group interface-group')) return false;
        if (trimmed.startsWith('set firewall group interface-group')) return false;
        if (trimmed.includes('inbound-interface') || trimmed.includes('outbound-interface')) {
          const groupMatch = trimmed.match(
            /\b(?:inbound-interface|outbound-interface)\s+group\s+(\S+)/,
          );
          if (groupMatch) {
            const groupName = sanitizeGroupName(groupMatch[1]);
            if (!groupName) return false;
            const interfaces = groupInterfaces.get(groupName);
            if (interfaces?.size) {
              interfaces.forEach((iface) => registerInterface(iface));
            }
            return false;
          }
          const tokens = trimmed.split(/\s+/);
          const ifaceIndex = tokens.findIndex(
            (token) => token === 'inbound-interface' || token === 'outbound-interface',
          );
          if (ifaceIndex !== -1 && tokens[ifaceIndex + 1])
            registerInterface(tokens[ifaceIndex + 1]);
          return false;
        }
        return true;
      });

      // Remove 'rule <number>' from each line
      ruleLines = ruleLines.map((line) => line.replace(/rule\s+\d+\s*/, '').trim());
      processedRule = ruleLines.join('\n');
    }

    processedRule = normalizeRuleString(processedRule);

    if (!dangerousRules.includes(processedRule)) return 0;

    if (!interfaceNames.length) return checkForCritical ? 2 : 0;

    const uniqueInterfaces = [...new Set(interfaceNames)];
    const hasNonLoopbackInterface = uniqueInterfaces.some((iface) => iface !== 'lo');
    const usesMultipleInterfaces = uniqueInterfaces.length > 1;

    if ((hasNonLoopbackInterface || usesMultipleInterfaces) && checkForWarnings) return 1;

    return 0;
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

        const firewallOptionsCache = new Map<number, number>();
        const firewallRepository = (() => {
          try {
            return db.getSource().manager.getRepository(Firewall);
          } catch {
            return null;
          }
        })();

        for (let i = 0; i < rulesData.length; i++) {
          if (eventEmitter)
            eventEmitter.emit(
              'message',
              new ProgressNoticePayload(
                `Rule ${i + 1} (ID: ${rulesData[i].id})${!rulesData[i].active ? ' [DISABLED]' : ''}`,
              ),
            );

          let compiler: PolicyCompilerClasses;

          // Obtain rule type, it may change during the compilation process
          const ruleType = rulesData[i].type;

          if (compileFor == 'IPTables') compiler = new IPTablesCompiler(rulesData[i]);
          else if (compileFor == 'NFTables') compiler = new NFTablesCompiler(rulesData[i]);
          else compiler = new VyOSCompiler(rulesData[i]);

          const compilationString =
            rulesData[i].active || rulesData.length === 1 ? compiler.ruleCompile() : '';

          let dangerous: number = 0;

          const targetFirewallId = (() => {
            const candidates = [rulesData[i]?.fw_apply_to, rulesData[i]?.firewall];
            for (const candidate of candidates) {
              if (typeof candidate === 'number' && Number.isFinite(candidate)) return candidate;
              if (typeof candidate === 'string') {
                const parsed = Number(candidate);
                if (!Number.isNaN(parsed)) return parsed;
              }
            }
            return null;
          })();

          const rawFirewallOptions = rulesData[i]?.firewall_options;
          let optionsMask = 0;
          if (typeof rawFirewallOptions === 'number') optionsMask = rawFirewallOptions;
          else if (typeof rawFirewallOptions === 'string') {
            const parsed = Number(rawFirewallOptions);
            if (!Number.isNaN(parsed)) optionsMask = parsed;
          }

          if (targetFirewallId !== null) {
            if (!firewallOptionsCache.has(targetFirewallId)) {
              if (firewallRepository) {
                const firewallRecord = await firewallRepository.findOne({
                  select: ['id', 'options'],
                  where: { id: targetFirewallId },
                });
                firewallOptionsCache.set(targetFirewallId, firewallRecord?.options ?? 0);
              } else {
                firewallOptionsCache.set(targetFirewallId, optionsMask);
              }
            }

            const cachedMask = firewallOptionsCache.get(targetFirewallId);
            if (typeof cachedMask === 'number') optionsMask = cachedMask;
          }

          const checkForWarnings = (optionsMask & FireWallOptMask.PDR_WARNING) !== 0;
          const checkForCritical = (optionsMask & FireWallOptMask.PDR_CRITICAL) !== 0;

          // Check if rule is dangerous
          const { ipType, chain } = typeMap[ruleType];
          const dangerousRulesArray = dangerousRules[ipType][compileFor][chain];
          if (rulesData[i].special === 0 && (checkForWarnings || checkForCritical)) {
            dangerous =
              dangerousRulesArray.length === 0
                ? 0
                : this.checkRuleSafety(
                    compilationString,
                    dangerousRulesArray,
                    compileFor,
                    checkForWarnings,
                    checkForCritical,
                  );
          }

          result.push({
            id: rulesData[i].id,
            active: rulesData[i].active,
            comment: rulesData[i].comment,
            cs: compilationString,
            ...(dangerous
              ? {
                  dangerousRuleData: {
                    ruleIPType: ipType,
                    ruleChainType: chain,
                    critical: dangerous === 2,
                  },
                }
              : {}), // Only add 'dangerous' properties if rule is dangerous
          });
        }

        resolve(result);
      } catch (error) {
        return reject(error);
      }
    });
  }
}
