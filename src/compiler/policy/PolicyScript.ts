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

/**
 * Property Model to manage compilation process
 *
 * @property RuleCompileModel
 * @type /models/compile/
 */
import { Firewall, FireWallOptMask, PolicyCompilationMode } from '../../models/firewall/Firewall';
import { ProgressNoticePayload, ProgressPayload } from '../../sockets/messages/socket-message';
import { AvailablePolicyCompilers, PolicyCompiler } from './PolicyCompiler';
import { RuleCompilationResult } from './PolicyCompilerTools';
import { PolicyTypesMap } from '../../models/policy/PolicyType';
import { PolicyRule } from '../../models/policy/PolicyRule';
import { RoutingCompiled, RoutingCompiler } from '../routing/RoutingCompiler';
import fs from 'fs';
import { RoutingTableService } from '../../models/routing/routing-table/routing-table.service';
import { app } from '../../fonaments/abstract-application';
import { RouteItemForCompiler, RoutingRuleItemForCompiler } from '../../models/routing/shared';
import { RoutingRuleService } from '../../models/routing/routing-rule/routing-rule.service';
import { EventEmitter } from 'typeorm/platform/PlatformTools';
import * as path from 'path';
import { mkdirpSync } from 'fs-extra';

const config = require('../../config/config');
const fwcError = require('../../utils/error_table');
const shellescape = require('shell-escape');

interface OptimizedBlockLine {
  key: string;
  line: string;
  render: (lines: string[]) => string;
}

export class PolicyScript {
  private routingCompiler: RoutingCompiler;
  private policyCompiler: AvailablePolicyCompilers;
  private policyCompilationMode: PolicyCompilationMode;
  private restoredCommands: Set<string> = new Set();
  private restoreFilterPolicies: Set<string> = new Set();
  private dnsChecks: string[] = [];
  private path: string;
  private stream: fs.WriteStream;

  constructor(
    private dbCon: any,
    private fwcloud: number,
    private firewall: number,
    private channel: EventEmitter = new EventEmitter(),
  ) {
    this.routingCompiler = new RoutingCompiler();
    this.buildPath();
  }

  public getScriptPath(): string {
    return this.path;
  }

  private buildPath(): void {
    this.path = path.join(
      config.get('policy').data_dir,
      this.fwcloud.toString(),
      this.firewall.toString(),
      config.get('policy').script_name,
    );

    mkdirpSync(path.dirname(this.path));
  }

  private greetingMessage(): void {
    this.stream.write(
      'greeting_msg() {\n' +
        `  log "FWCloud.net - Loading firewall policy generated: ${Date()} "\n` +
        '}\n',
    );
  }

  private async dumpFirewallOptions(): Promise<void> {
    const options = await Firewall.getFirewallOptions(this.fwcloud, this.firewall);

    this.stream.write(
      'options_load() {\n' + '  echo\n' + '  echo "OPTIONS"\n' + '  echo "-------"\n',
    );

    // IPv4 and IPv6 packet forwarding. Every option is applied and any failure fails the policy
    // load, except for the options of an IP version not available (skipped by policy_sysctl).
    const ipv4ForwardingAction = options & FireWallOptMask.IPv4_FORWARDING ? '1' : '0';
    const ipv6ForwardingAction = options & FireWallOptMask.IPv6_FORWARDING ? '1' : '0';
    this.stream.write(
      '  FWC_OPTIONS_STATUS=0\n' +
        `  policy_sysctl net.ipv4.conf.all.forwarding ${ipv4ForwardingAction} || FWC_OPTIONS_STATUS=1\n` +
        `  policy_sysctl net.ipv6.conf.all.forwarding ${ipv6ForwardingAction} || FWC_OPTIONS_STATUS=1\n`,
    );

    if (options & FireWallOptMask.DOCKER_COMPAT) this.stream.write('\n  DOCKER_COMPATIBILITY=1\n');

    this.stream.write('  return $FWC_OPTIONS_STATUS\n}\n\n');

    this.channel.emit(
      'message',
      new ProgressNoticePayload(
        `--- STATE${options & FireWallOptMask.STATEFUL ? 'FUL' : 'LESS'} FIREWALL ---`,
        true,
      ),
    );
  }

  private async dumpCompilation(type: number): Promise<RuleCompilationResult[]> {
    const rulesCompiled = await this.compileRules(type);

    const dangerous: Array<RuleCompilationResult> = [];

    if (this.useOptimizedPolicyCompilation()) {
      let optimized = '';
      let optimizedBuffer = '';
      let optimizedRuleLabels: string[] = [];

      const flushOptimizedBuffer = () => {
        if (!optimizedBuffer) return;
        optimized += this.renderOptimizedPolicyCommands(optimizedBuffer);
        optimized += `${optimizedRuleLabels.join('\n')}\n`;
        optimizedBuffer = '';
        optimizedRuleLabels = [];
      };

      for (let i = 0; i < rulesCompiled.length; i++) {
        const rule = rulesCompiled[i];
        if (rule.dangerousRuleData) dangerous.push(rule);
        if (!rule.active) continue;

        if (this.isOptimizedScriptRule(rule.cs)) {
          flushOptimizedBuffer();
          optimized = optimized.replace(/\n*$/, '\n\n');
          optimized += `echo "Rule ${i + 1} (ID: ${rule.id})"\n`;
          optimized += this.formatOptimizedScriptRule(rule.cs);
          continue;
        }

        optimizedBuffer += `# Rule ${i + 1} (ID: ${rule.id})\n`;
        optimizedBuffer += rule.cs;
        if (!rule.cs.endsWith('\n')) optimizedBuffer += '\n';
        optimizedRuleLabels.push(`echo "Rule ${i + 1} (ID: ${rule.id})"`);
      }

      flushOptimizedBuffer();
      optimized = optimized.replace(/\n+$/, '\n');
      this.stream.write(optimized);
      return dangerous;
    }

    let cs = '';
    for (let i = 0; i < rulesCompiled.length; i++) {
      const rule = rulesCompiled[i];
      cs += `\n${this.renderShellRule(rule, `Rule ${i + 1}`)}`;
      if (rule.dangerousRuleData) dangerous.push(rule);
    }
    this.stream.write(cs);
    return dangerous;
  }

  private renderShellRule(rule: RuleCompilationResult | RoutingCompiled, label: string): string {
    return (
      `echo "${label} (ID: ${rule.id})${!rule.active ? ' [DISABLED]' : ''}"\n` +
      this.shellComment(rule.comment) +
      (rule.active ? rule.cs : '')
    );
  }

  private shellComment(comment: string): string {
    return comment ? `# ${comment.replace(/\n/g, '\n# ')}\n` : '';
  }

  private async compileRules(type: number): Promise<RuleCompilationResult[]> {
    const rulesData: any = await PolicyRule.getPolicyData(
      'compiler',
      this.dbCon,
      this.fwcloud,
      this.firewall,
      type,
      null,
      null,
    );

    if (this.policyCompiler === 'IPTables') this.collectDnsChecks(type, rulesData);

    return PolicyCompiler.compile(this.policyCompiler, rulesData, this.channel);
  }

  // DNS objects are compiled as hostnames that iptables resolves on the firewall while loading the
  // policy (IPv4 rules need an A record, IPv6 rules an AAAA record). Collect one check per DNS object
  // used in the source or destination of an active rule, so the script install action can reject a
  // policy with unresolvable hostnames instead of loading it partially.
  private collectDnsChecks(type: number, rulesData: any): void {
    const ipv = type >= PolicyTypesMap.get('IPv6:INPUT') ? 6 : 4;
    const cmd = ipv === 4 ? '$IPTABLES' : '$IP6TABLES';

    for (const rule of rulesData ?? []) {
      if (!rule.active) continue;

      for (const position of rule.positions) {
        if (position.name !== 'Source' && position.name !== 'Destination') continue;

        for (const ipobj of position.ipobjs) {
          if (ipobj.type !== 9) continue; // DNS

          const context = `DNS object '${ipobj.name}' (ID: ${ipobj.id}) in ${position.name.toLowerCase()} of rule ${rule.id} (IPv${ipv})`;
          const check = `policy_check_dns "${cmd}" ${shellescape([ipobj.name, context])} || return 1\n`;
          // Rules applied to a single cluster node are only loaded on that node.
          this.dnsChecks.push(
            rule.fw_apply_to && rule.firewall_name
              ? `  if [ "$HOSTNAME" = ${shellescape([rule.firewall_name])} ]; then\n    ${check}  fi\n`
              : `  ${check}`,
          );
        }
      }
    }
  }

  // Writes the filter and NAT tables of both IP versions, in load order, and returns the dangerous rules.
  private async dumpPolicyTables(): Promise<RuleCompilationResult[]> {
    const isVyOS = this.policyCompiler === 'VyOS';
    const notice = (text: string, highlight = false) =>
      this.channel.emit('message', new ProgressNoticePayload(text, highlight));
    let dangerous: Array<RuleCompilationResult> = [];

    for (const version of [4, 6]) {
      const ipv = `IPv${version}`;
      // Skip the policy of an IP version not available on the firewall (see policy_ip_available).
      if (!isVyOS) this.stream.write(`\nif policy_ip_available ${version}; then`);

      const tables: [string, [string, string][]][] = [
        [
          `FILTER TABLE (${ipv})`,
          [
            ['INPUT CHAIN', 'INPUT'],
            ['OUTPUT CHAIN', 'OUTPUT'],
            ['FORWARD CHAIN', 'FORWARD'],
          ],
        ],
        [
          `NAT TABLE (${ipv})`,
          [
            ['SNAT', 'SNAT'],
            ['DNAT', 'DNAT'],
          ],
        ],
      ];

      for (const [table, chains] of tables) {
        const firstTable = ipv === 'IPv4' && table.startsWith('FILTER');
        const firstIPv6Table = ipv === 'IPv6' && table.startsWith('FILTER');
        const stars = `echo "${'*'.repeat(table.length + 4)}"\n`;
        const separator = isVyOS
          ? `${firstTable ? '\n' : '\n\n'}echo\n`
          : `${firstIPv6Table ? '\n\n' : ''}\n\necho\n${firstIPv6Table ? 'echo\n' : ''}`;
        this.stream.write(`${separator}${stars}echo "* ${table} *"\n${stars}`);
        if (firstIPv6Table) {
          notice('');
          notice('');
        }
        notice(`${table}:`, true);

        for (const [index, [title, chain]] of chains.entries()) {
          const echo = !isVyOS && index > 0 ? 'echo\n' : '';
          this.stream.write(`\n\n${echo}echo "${title}"\necho "${'-'.repeat(title.length)}"\n`);
          notice(`${title}:`, true);
          const type = PolicyTypesMap.get(`${ipv}:${chain}`);
          dangerous = dangerous.concat(
            await (isVyOS ? this.dumpVyOSRules(type) : this.dumpCompilation(type)),
          );
        }
      }

      if (!isVyOS)
        this.stream.write(
          `\nelse\n  echo\n  echo "${ipv} not available on this system, ${ipv} policy skipped."\nfi\n`,
        );
    }

    return dangerous;
  }

  private async dumpVyOSRules(type: number): Promise<RuleCompilationResult[]> {
    const rules = await this.compileRules(type);
    const dangerous: Array<RuleCompilationResult> = [];

    let cs = '';
    for (let i = 0; i < rules.length; i++) {
      const rule = rules[i];
      if (!rule.active) continue;

      cs += `\n# Rule ${i + 1} (ID: ${rule.id})\n`;
      cs += this.shellComment(rule.comment);
      cs += rule.cs;
      if (rule.dangerousRuleData) dangerous.push(rule);
    }

    if (cs) this.stream.write(cs);

    return dangerous;
  }

  private validatePolicyCompilationMode(): void {
    if (this.policyCompilationMode !== 'optimized') return;

    if (!this.useOptimizedIptablesRestore() && !this.useOptimizedNftablesFile()) {
      throw fwcError.other(
        'Optimized policy compilation is only supported for IPTables and NFTables firewalls',
      );
    }
  }

  private useOptimizedIptablesRestore(): boolean {
    return this.policyCompiler === 'IPTables' && this.policyCompilationMode === 'optimized';
  }

  private useOptimizedNftablesFile(): boolean {
    return this.policyCompiler === 'NFTables' && this.policyCompilationMode === 'optimized';
  }

  private useOptimizedPolicyCompilation(): boolean {
    return this.useOptimizedIptablesRestore() || this.useOptimizedNftablesFile();
  }

  private stripShellComments(line: string): string {
    let inSingleQuote = false;
    let inDoubleQuote = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === "'" && !inDoubleQuote) {
        inSingleQuote = !inSingleQuote;
      } else if (char === '"' && !inSingleQuote) {
        inDoubleQuote = !inDoubleQuote;
      } else if (char === '#' && !inSingleQuote && !inDoubleQuote) {
        return line.slice(0, i);
      }
    }

    return line;
  }

  private normalizeIptablesRestoreQuotes(command: string): string {
    return command.replace(/'([^']*)'/g, (_match, content) => {
      return `"${content.replace(/(["\\])/g, '\\$1')}"`;
    });
  }

  private parseIptablesRestoreLine(
    line: string,
  ): { iptables: string; table: string; restoreLine: string } | null {
    const commandMatch = line.trim().match(/^(\$IPTABLES|\$IP6TABLES)\s+(.+)$/);
    if (!commandMatch) return null;

    let command = commandMatch[2];
    command = this.stripShellComments(command).trim();
    command = this.normalizeIptablesRestoreQuotes(command);
    let table = 'filter';

    const tableMatch = command.match(/^-t\s+(\S+)\s+(.+)$/);
    if (tableMatch) {
      table = tableMatch[1];
      command = tableMatch[2];
    }

    if (!command.startsWith('-A ') && !command.startsWith('-N ')) return null;

    return { iptables: commandMatch[1], table, restoreLine: command };
  }

  private parseNftablesFileLine(
    line: string,
  ): { family: string; table: string; chain: string; fileLine: string } | null {
    const commandMatch = line.trim().match(/^\$NFT\s+(.+)$/);
    if (!commandMatch) return null;

    const command = this.normalizeNftablesFileQuotes(
      this.stripShellComments(commandMatch[1]).trim(),
    );
    const ruleMatch = command.match(/^add\s+rule\s+(ip|ip6)\s+(filter|nat|mangle)\s+(\S+)\s+(.+)$/);
    if (!ruleMatch) return null;

    return {
      family: ruleMatch[1],
      table: ruleMatch[2],
      chain: ruleMatch[3],
      fileLine: command,
    };
  }

  private normalizeNftablesFileQuotes(command: string): string {
    return command.replace(/\\"/g, '"').replace(/\\'/g, "'");
  }

  // iptables-restore block with the rules of a table, for the iptables command ($IPTABLES or $IP6TABLES)
  // of the rules.
  private renderIptablesRestoreBlock(iptables: string, table: string, lines: string[]): string {
    const firstRestore = !this.restoredCommands.has(iptables);
    this.restoredCommands.add(iptables);
    const chainPolicies = this.getIptablesRestoreChainPolicies(iptables, table);

    return (
      `cat <<'FWC_IPTABLES_RESTORE' | ${iptables}_RESTORE${firstRestore ? '' : ' --noflush'}\n` +
      `*${table}\n\n` +
      `${chainPolicies.length > 0 ? `${chainPolicies.join('\n')}\n\n` : ''}` +
      `${lines.join('\n')}\n\n` +
      'COMMIT\n' +
      'FWC_IPTABLES_RESTORE\n' +
      // The first restore flushes the table, including the temporary DNS resolution rules.
      `${firstRestore ? `policy_dns_resolution allow "${iptables}"\n` : ''}`
    );
  }

  private renderNftablesCommands(lines: string[]): string {
    return this.useOptimizedNftablesFile()
      ? this.renderNftablesFileCommands(lines)
      : lines.map((line) => `$NFT ${line.replace(/;/g, '\\;')}`).join('\n') + '\n';
  }

  private renderNftablesFileCommands(lines: string[]): string {
    if (lines.length === 0) return '';

    // Previous rules cleanup belongs to policy_empty/reset_nft;
    // partial nft -f blocks must not flush.
    return "cat <<'FWC_NFT_RULES' | $NFT -f -\n" + `${lines.join('\n')}\n` + 'FWC_NFT_RULES\n';
  }

  private getIptablesRestoreChainPolicies(iptables: string, table: string): string[] {
    if (table !== 'filter') return [];
    if (this.restoreFilterPolicies.has(iptables)) return [];

    this.restoreFilterPolicies.add(iptables);
    return [':INPUT DROP [0:0]', ':OUTPUT DROP [0:0]', ':FORWARD DROP [0:0]'];
  }

  private formatOptimizedScriptRule(cs: string): string {
    const formattedRule = cs.endsWith('\n') ? cs : `${cs}\n`;

    return `${formattedRule}\n`;
  }

  // A rule command that goes in an optimized block (iptables-restore or nft -f input): the consecutive
  // lines with the same key go in the same block.
  private parseOptimizedLine(rawLine: string): OptimizedBlockLine | null {
    if (this.useOptimizedIptablesRestore()) {
      const parsed = this.parseIptablesRestoreLine(rawLine);
      return (
        parsed && {
          key: `${parsed.iptables} ${parsed.table}`,
          line: parsed.restoreLine,
          render: (lines) => this.renderIptablesRestoreBlock(parsed.iptables, parsed.table, lines),
        }
      );
    }

    const parsed = this.parseNftablesFileLine(rawLine);
    return (
      parsed && {
        key: `${parsed.family} ${parsed.table} ${parsed.chain}`,
        line: parsed.fileLine,
        render: (lines) => this.renderNftablesFileCommands(lines),
      }
    );
  }

  private renderOptimizedPolicyCommands(cs: string): string {
    let optimized = '';
    let block: { key: string; lines: string[]; render: (lines: string[]) => string } | null = null;
    let pendingRuleLabel: string | null = null;

    const flushBlock = () => {
      if (block) optimized += block.render(block.lines);
      block = null;
    };

    for (const rawLine of cs.split('\n')) {
      const trimmedLine = rawLine.trim();

      if (trimmedLine.match(/^# Rule \d+ \(ID: \d+\)$/)) {
        pendingRuleLabel = trimmedLine;
        continue;
      }

      if (trimmedLine.startsWith('if [')) {
        flushBlock();
        if (pendingRuleLabel) {
          optimized = optimized.replace(/\n+$/, '\n');
          optimized += `\n${pendingRuleLabel}\n`;
          pendingRuleLabel = null;
        }
        optimized += `${rawLine}\n`;
        continue;
      }

      if (trimmedLine === 'fi') {
        flushBlock();
        optimized += `${rawLine}\n\n`;
        continue;
      }

      // Skip shell comment lines completely - they are handled separately in dumpCompilation
      if (trimmedLine.startsWith('#')) {
        continue;
      }

      const parsedLine = this.parseOptimizedLine(rawLine);

      if (!parsedLine) {
        flushBlock();
        if (pendingRuleLabel) {
          optimized += `${pendingRuleLabel}\n`;
          pendingRuleLabel = null;
        }
        optimized += `${rawLine}\n`;
        continue;
      }

      if (!block || block.key !== parsedLine.key) {
        flushBlock();
        block = { key: parsedLine.key, lines: [], render: parsedLine.render };
      }

      if (pendingRuleLabel) {
        if (block.lines.length > 0) {
          block.lines.push('');
        }
        block.lines.push(pendingRuleLabel);
        pendingRuleLabel = null;
      }

      block.lines.push(parsedLine.line);
    }

    flushBlock();

    if (pendingRuleLabel) {
      optimized += `${pendingRuleLabel}\n`;
    }

    return optimized;
  }

  private isOptimizedScriptRule(cs: string): boolean {
    return cs.includes('# Hook script rule code:');
  }

  public dump(): Promise<Array<RuleCompilationResult>> {
    return new Promise((resolve, reject) => {
      this.dnsChecks = [];
      this.stream = fs.createWriteStream(this.path);
      this.stream
        .on('open', async () => {
          try {
            // Array of dangerous rules
            let dangerous: Array<RuleCompilationResult> = [];

            /* Generate the policy script. */
            this.policyCompiler = await Firewall.getFirewallCompiler(this.fwcloud, this.firewall);
            this.policyCompilationMode = await Firewall.getPolicyCompilationMode(
              this.fwcloud,
              this.firewall,
            );
            this.validatePolicyCompilationMode();
            const policyConfig = config.get('policy');
            const headerFilePath =
              this.policyCompiler === 'VyOS' && policyConfig.vyos_header_file
                ? policyConfig.vyos_header_file
                : policyConfig.header_file;
            this.stream.write(fs.readFileSync(headerFilePath, 'utf8'));

            const isVyOS = this.policyCompiler === 'VyOS';

            if (!isVyOS) {
              this.stream.write(`\nPOLICY_COMPILER="${this.policyCompiler}"\n\n`);
              this.stream.write(`POLICY_COMPILATION_MODE="${this.policyCompilationMode}"\n\n`);
              this.greetingMessage();
              await this.dumpFirewallOptions();

              this.stream.write('policy_load() {\n');

              if (this.policyCompiler == 'NFTables') {
                this.stream.write('\n\n# What happens when you mix Iptables and Nftables?\n');
                this.stream.write('# How do they interact?\n');
                this.stream.write(
                  '#    nft       Empty     Accept  Accept      Block        Blank\n',
                );
                this.stream.write(
                  '#    iptables  Empty     Empty   Block       Accept       Accept\n',
                );
                this.stream.write(
                  '#    Results   Pass      Pass    Unreachable Unreachable  Pass \n',
                );
                this.stream.write(
                  '# For this reason, if we have Nftables policy we must allow pass all through Iptables.\n',
                );
                this.stream.write('iptables_default_filter_policy ACCEPT\n');
                this.dumpNFTablesStd(); // Create the standard NFTables tables and chains.
              } else {
                // IPTables compiler.
                this.stream.write('\n# Default IPTables chains policy.\n');
                this.stream.write('iptables_default_filter_policy DROP\n');
              }

              if (await PolicyRule.firewallWithMarkRules(this.dbCon, this.firewall))
                this.dumpMangleTableRules(); // Generate default rules for mangle table

              dangerous = await this.dumpPolicyTables();
              this.stream.write('\n}\n\n');

              // Used by policy_dns_resolution (header file) and the install action of the footer file.
              this.stream.write(
                `POLICY_DNS_OBJECTS="${this.dnsChecks.length > 0 ? 1 : 0}"\n\n` +
                  `policy_dns_check() {\n${this.dnsChecks.join('')}  return 0\n}\n\n`,
              );

              await this.dumpRouting();
            } else {
              dangerous = await this.dumpPolicyTables();
              this.stream.write('\n');
            }

            // Footer file.
            const footerFilePath =
              this.policyCompiler === 'VyOS' && policyConfig.vyos_footer_file
                ? policyConfig.vyos_footer_file
                : policyConfig.footer_file;
            this.stream.write(fs.readFileSync(footerFilePath, 'utf8'));

            /* Close stream and wait until the whole script is on disk: callers read it right away. */
            await new Promise<void>((flushed, failed) =>
              this.stream.end((error?: Error) => (error ? failed(error) : flushed())),
            );

            // Update firewall status flags.
            await Firewall.updateFirewallStatus(this.fwcloud, this.firewall, '&~1');
            // Update firewall compile date.
            await Firewall.updateFirewallCompileDate(this.fwcloud, this.firewall);

            this.channel.emit('message', new ProgressPayload('end', false, 'Compilation finished'));

            resolve(dangerous);
          } catch (error) {
            reject(error);
          }
        })
        .on('error', (error) => {
          return reject(error);
        });
    });
  }

  private dumpNFTablesStd(): void {
    // Code for create the standard nftables tables and chain.
    this.stream.write('\n\necho\n');
    this.stream.write('echo "******************************"\n');
    this.stream.write('echo "* NFTABLES TABLES AND CHAINS *"\n');
    this.stream.write('echo "******************************"\n');
    for (const family of ['ip', 'ip6']) {
      const nftablesStdCommands = [
        `add table ${family} filter`,
        `add chain ${family} filter INPUT { type filter hook input priority 0; policy drop; }`,
        `add chain ${family} filter FORWARD { type filter hook forward priority 0; policy drop; }`,
        `add chain ${family} filter OUTPUT { type filter hook output priority 0; policy drop; }`,
        `add table ${family} nat`,
        `add chain ${family} nat PREROUTING { type nat hook prerouting priority - 100; policy accept; }`,
        `add chain ${family} nat INPUT { type nat hook input priority 100; policy accept; }`,
        `add chain ${family} nat OUTPUT { type nat hook output priority - 100; policy accept; }`,
        `add chain ${family} nat POSTROUTING { type nat hook postrouting priority 100; policy accept; }`,
        `add table ${family} mangle`,
        `add chain ${family} mangle PREROUTING { type filter hook prerouting priority - 150; policy accept; }`,
        `add chain ${family} mangle INPUT { type filter hook input priority - 150; policy accept; }`,
        `add chain ${family} mangle FORWARD { type filter hook forward priority - 150; policy accept; }`,
        `add chain ${family} mangle OUTPUT { type route hook output priority - 150; policy accept; }`,
        `add chain ${family} mangle POSTROUTING { type filter hook postrouting priority - 150; policy accept; }`,
      ];

      // Only for the IP versions available on the firewall (see policy_ip_available), each one in
      // its own nft -f block since a failed command rejects the whole block.
      this.stream.write(`if policy_ip_available ${family === 'ip' ? 4 : 6}; then\n`);
      this.stream.write(this.renderNftablesCommands(nftablesStdCommands));
      this.stream.write('fi\n');
    }
  }

  private dumpMangleTableRules(): void {
    this.channel.emit('message', new ProgressNoticePayload('MANGLE TABLE:', true));
    this.channel.emit('message', new ProgressNoticePayload('Automatic rules.'));
    this.stream.write('\n\necho\n');
    this.stream.write('echo "****************"\n');
    this.stream.write('echo "* MANGLE TABLE *"\n');
    this.stream.write('echo "****************"\n');
    this.stream.write('#Automatic rules for mangle table.\n');
    // IPv4 only rules (see policy_ip_available).
    this.stream.write('if policy_ip_available 4; then\n');
    if (this.policyCompiler == 'IPTables') {
      const mangleRules =
        '$IPTABLES -t mangle -A PREROUTING -j CONNMARK --restore-mark\n' +
        '$IPTABLES -t mangle -A PREROUTING -m mark ! --mark 0 -j ACCEPT\n\n' +
        '$IPTABLES -t mangle -A OUTPUT -j CONNMARK --restore-mark\n' +
        '$IPTABLES -t mangle -A OUTPUT -m mark ! --mark 0 -j ACCEPT\n\n' +
        '$IPTABLES -t mangle -A POSTROUTING -j CONNMARK --restore-mark\n' +
        '$IPTABLES -t mangle -A POSTROUTING -m mark ! --mark 0 -j ACCEPT\n\n';
      this.stream.write(
        this.useOptimizedIptablesRestore()
          ? this.renderOptimizedPolicyCommands(mangleRules)
          : mangleRules,
      );
    } else {
      // NFTables
      const mangleRules = [
        'add rule ip mangle PREROUTING counter meta mark set ct mark',
        'add rule ip mangle PREROUTING mark != 0x0 counter accept',
        'add rule ip mangle OUTPUT counter meta mark set ct mark',
        'add rule ip mangle OUTPUT mark != 0x0 counter accept',
        'add rule ip mangle POSTROUTING counter meta mark set ct mark',
        'add rule ip mangle POSTROUTING mark != 0x0 counter accept',
      ];
      this.stream.write(this.renderNftablesCommands(mangleRules));
    }
    this.stream.write('fi\n');
  }

  private async dumpRouting(): Promise<void> {
    const routingTableService = await app().getService<RoutingTableService>(
      RoutingTableService.name,
    );
    const routingRuleService = await app().getService<RoutingRuleService>(RoutingRuleService.name);
    const routingTables = await routingTableService.findManyInPath({
      fwCloudId: this.fwcloud,
      firewallId: this.firewall,
    });

    this.stream.write('routing_apply() {\necho -n ""\n');

    // Only dump routing compilation if we have routing tables.
    if (routingTables.length > 0) {
      this.stream.write('echo\n');
      this.stream.write('echo\n');
      this.stream.write('echo "******************"\n');
      this.stream.write('echo "* ROUTING POLICY *"\n');
      this.stream.write('echo "******************"\n');
      this.channel.emit('message', new ProgressNoticePayload(''));
      this.channel.emit('message', new ProgressNoticePayload(''));
      this.channel.emit('message', new ProgressNoticePayload('ROUTING POLICY:', true));
      // Flush all routing tables except the main table.
      this.stream.write('echo -n "Flushing routing tables and rules ... "\n');
      this.stream.write('$IP route flush cache\n');
      this.stream.write('T=1\n');
      this.stream.write('while [ $T -lt 251 ]; do\n');
      this.stream.write('  $IP route flush table $T 2>/dev/null\n');
      this.stream.write('  T=`expr $T + 1`\n');
      this.stream.write('done\n');
      this.stream.write('$IP rule flush\n');
      this.stream.write('$IP rule add from all lookup main pref 32766\n');
      this.stream.write('$IP rule add from all lookup default pref 32767\n');
      this.stream.write('echo "DONE"\n\n');

      // Compile and dump all routing tables.
      for (const table of routingTables) {
        this.stream.write('echo\n');
        const msg = `ROUTING TABLE: ${table.number} (${table.name})`;
        this.stream.write(`echo "${msg}"\n`);
        // If the main table exists in our firewall, then flush it before loading its routes.
        if (table.number === 254) this.stream.write('$IP route flush scope global table main\n');
        this.channel.emit('message', new ProgressNoticePayload(msg, true));

        const routes = await routingTableService.getRoutingTableData<RouteItemForCompiler>(
          'compiler',
          this.fwcloud,
          this.firewall,
          table.id,
        );
        if (routes.length > 0) {
          const routesCompiled = this.routingCompiler.compile('Route', routes, this.channel);

          let cs = '';
          for (const [index, route] of routesCompiled.entries()) {
            cs += this.renderShellRule(route, `Route ${index + 1}`);
          }
          this.stream.write(cs);
        }
      }

      // Compile and dump routing policy.
      const rules = await routingRuleService.getRoutingRulesData<RoutingRuleItemForCompiler>(
        'compiler',
        this.fwcloud,
        this.firewall,
      );
      if (rules.length > 0) {
        const rulesCompiled = this.routingCompiler.compile('Rule', rules, this.channel);

        this.stream.write(`\necho\necho "ROUTING RULES:"n`);
        this.channel.emit('message', new ProgressNoticePayload('ROUTING RULES:', true));
        let cs = '';
        for (const [index, rule] of rulesCompiled.entries()) {
          cs += `\n${this.renderShellRule(rule, `Routing rule ${index + 1}`)}`;
        }
        this.stream.write(cs);
      }
    }

    this.stream.write('\n}\n\n');
  }
}
