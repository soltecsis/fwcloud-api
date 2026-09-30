/*
    Copyright 2026 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
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

import { expect } from 'chai';
import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { describeName, testSuite } from '../../mocha/global-setup';
import { PolicyRuleService } from '../../../src/policy-rule/policy-rule.service';
import { FwCloudFactory, FwCloudProduct } from '../../utils/fwcloud-factory';
import db from '../../../src/database/database-manager';
import { Firewall, FireWallOptMask } from '../../../src/models/firewall/Firewall';
import { PolicyRule, SpecialPolicyRules } from '../../../src/models/policy/PolicyRule';
import { PolicyTypesMap } from '../../../src/models/policy/PolicyType';
import { RulePositionsMap } from '../../../src/models/policy/PolicyPosition';
import { IPObj } from '../../../src/models/ipobj/IPObj';
import { populateRule } from '../compiler/policy/utils';

const NFTABLES_COMPILER = 0x1000;
const VYOS_COMPILER = 0x2000;
const OPTIMIZED = FireWallOptMask.IPTABLES_OPTIMIZED_COMPILATION;

// Stub of the commands managed by the policy script: it logs every invocation and simulates the
// command output used by the script.
const STUB = `#!/bin/sh
echo "\${0##*/} $*" >> "$FWC_TEST_DIR/calls"
case "\${0##*/}" in
  iptables|ip6tables)
    case "$1" in
      -nL)
        i=0
        while [ $i -lt \${FWC_TEST_LISTED_LINES:-10} ]; do echo "line $i"; i=$((i + 1)); done
        ;;
      -C)
        # Legacy ip6tables on a system without IPv6.
        if [ "\${0##*/}" = "ip6tables" -a -n "$FWC_TEST_IP6TABLES_UNSUPPORTED" ]; then
          echo "ip6tables: can't initialize ip6tables table 'filter': Address family not supported by protocol"
          exit 3
        fi
        exit 1
        ;;
      -D)
        # Rule not found.
        exit 1
        ;;
    esac
    ;;
  iptables-restore|ip6tables-restore)
    cat > /dev/null
    ;;
  nft)
    test "$1" = "-f" && cat > /dev/null
    ;;
  sysctl)
    if [ "\${2%%=*}" = "$FWC_TEST_SYSCTL_FAIL" ]; then
      echo "sysctl: permission denied on key \\"\${2%%=*}\\"" >&2
      exit 1
    fi
    echo "\${2%%=*} = \${2#*=}"
    ;;
  modprobe)
    # IPv6 built as a kernel module, not loaded yet.
    if [ "$1" = "ipv6" -a -n "$FWC_TEST_IPV6_MODULE" ]; then
      mkdir -p "$FWC_TEST_DIR/sys/net/ipv6/conf/all"
      echo 0 > "$FWC_TEST_DIR/sys/net/ipv6/conf/all/forwarding"
    fi
    ;;
  uname|hostname)
    echo "fwcloud-test"
    ;;
  systemctl)
    echo "running"
    ;;
esac
exit 0
`;

const STUB_COMMANDS = [
  'iptables',
  'ip6tables',
  'iptables-restore',
  'ip6tables-restore',
  'nft',
  'sysctl',
  'modprobe',
  'lsmod',
  'ip',
  'uname',
  'hostname',
  'systemctl',
];
const REAL_TOOLS = [
  'which',
  'date',
  'expr',
  'find',
  'sed',
  'grep',
  'tr',
  'cat',
  'wc',
  'rm',
  'mkdir',
];

// Beginning of the footer file, where the script starts running the action.
const FOOTER = '\n# Verify that we have all the needed commands.\n';

describe(describeName('PolicyScript Unit tests - IP versions available on the firewall'), () => {
  let fwcProduct: FwCloudProduct;
  let firewall: Firewall;
  let service: PolicyRuleService;
  let sandbox: string;

  async function addRule(
    policyType: string,
    data: { special?: number; run_before?: string; mark?: number } = {},
  ): Promise<number> {
    return PolicyRule.insertPolicy_r({
      firewall: firewall.id,
      type: PolicyTypesMap.get(policyType),
      rule_order: 1,
      action: 1,
      active: 1,
      special: data.special ?? 0,
      options: 0,
      mark: data.mark,
      run_before: data.run_before ?? null,
      run_after: null,
    });
  }

  async function compileScript(options: number = 0): Promise<string> {
    firewall.options = options;
    await db.getSource().manager.getRepository(Firewall).save(firewall);
    await service.compile(fwcProduct.fwcloud.id, firewall.id);
    return fs.readFileSync(firewall.getPolicyFilePath(), 'utf8');
  }

  function shellFunction(script: string, name: string): string {
    return script.match(new RegExp(`\\n${name}\\(\\) \\{\\n[\\s\\S]*?\\n\\}\\n`))[0].slice(1);
  }

  // Policy of an IP version, which the script only loads if that IP version is available.
  function ipVersionPolicy(script: string, ipv: 'IPv4' | 'IPv6'): string {
    const policy = script.match(
      new RegExp(
        `\\nif policy_ip_available ${ipv.slice(-1)}; then\\n([\\s\\S]*?)\\n` +
          `else\\n  echo\\n  echo "${ipv} not available on this system, ${ipv} policy skipped."\\nfi\\n`,
      ),
    );
    expect(policy, `${ipv} policy`).not.to.be.null;
    return policy[1];
  }

  // Simulated system for the script: the commands it manages are stubs, and the kernel parameters tree
  // only has the IP versions given.
  function createSystem(ipVersions: number[]): void {
    for (const ipv of ipVersions) {
      fs.mkdirSync(path.join(sandbox, `sys/net/ipv${ipv}/conf/all`), { recursive: true });
      fs.writeFileSync(path.join(sandbox, `sys/net/ipv${ipv}/conf/all/forwarding`), '0\n');
    }

    const bin = path.join(sandbox, 'bin');
    fs.mkdirSync(bin);
    for (const cmd of STUB_COMMANDS) fs.writeFileSync(path.join(bin, cmd), STUB, { mode: 0o755 });
    for (const tool of REAL_TOOLS) {
      const real = (process.env.PATH ?? '')
        .split(path.delimiter)
        .map((dir) => path.join(dir, tool))
        .find((file) => fs.existsSync(file));
      fs.symlinkSync(real, path.join(bin, tool));
    }
  }

  // Runs the script action, or the given shell commands with the script functions, on the simulated
  // system. Returns the exit status, the output and the invocations of the stub commands.
  function run(
    script: string,
    action: string,
    env: Record<string, string> = {},
    commands?: string,
  ): { status: number; output: string; calls: string[] } {
    const footer = script.indexOf(FOOTER);
    expect(footer).to.be.greaterThan(0);

    const file = path.join(sandbox, 'fwcloud.sh');
    fs.writeFileSync(
      file,
      script.slice(0, footer) +
        `\nSYSCTL_DIR="${sandbox}/sys"\nPOLICY_STATUS_FILE="${sandbox}/fwcloud-policy.status"\n` +
        (commands ?? script.slice(footer)),
    );
    const result = spawnSync('/bin/sh', [file, action], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { PATH: path.join(sandbox, 'bin'), FWC_TEST_DIR: sandbox, ...env },
    });

    const callsFile = path.join(sandbox, 'calls');
    const calls = fs.existsSync(callsFile)
      ? fs.readFileSync(callsFile, 'utf8').split('\n').filter(Boolean)
      : [];
    fs.rmSync(callsFile, { force: true });

    return { status: result.status, output: result.stdout + result.stderr, calls };
  }

  function policyStatus(): string {
    return fs.readFileSync(path.join(sandbox, 'fwcloud-policy.status'), 'utf8');
  }

  beforeEach(async () => {
    await testSuite.resetDatabaseData();
    fwcProduct = await new FwCloudFactory().make();
    firewall = fwcProduct.firewall;
    service = await testSuite.app.getService<PolicyRuleService>(PolicyRuleService.name);
    sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'fwcloud-policy-script-'));

    await addRule('IPv4:INPUT', { special: SpecialPolicyRules.STATEFUL });
    await addRule('IPv6:INPUT', { special: SpecialPolicyRules.STATEFUL });
  });

  afterEach(() => {
    fs.rmSync(sandbox, { recursive: true, force: true });
  });

  describe('generated script', () => {
    it('should be a valid shell script for every compiler and compilation mode', async () => {
      await addRule('IPv4:INPUT', { mark: fwcProduct.mark.id });

      for (const options of [0, OPTIMIZED, NFTABLES_COMPILER, NFTABLES_COMPILER | OPTIMIZED]) {
        const file = path.join(sandbox, `fwcloud-${options}.sh`);
        fs.writeFileSync(file, await compileScript(options));

        const result = spawnSync('/bin/sh', ['-n', file], { encoding: 'utf8' });
        expect(result.status, `options ${options}: ${result.stderr}`).to.equal(0);
      }
    });

    it('should load the policy of each IP version only if it is available', async () => {
      const script = await compileScript();

      const ipv4 = ipVersionPolicy(script, 'IPv4');
      expect(ipv4).to.contain('echo "* FILTER TABLE (IPv4) *"');
      expect(ipv4).to.contain('echo "* NAT TABLE (IPv4) *"');
      expect(ipv4).to.contain('$IPTABLES -A INPUT');
      expect(ipv4).not.to.contain('$IP6TABLES');

      const ipv6 = ipVersionPolicy(script, 'IPv6');
      expect(ipv6).to.contain('echo "* FILTER TABLE (IPv6) *"');
      expect(ipv6).to.contain('echo "* NAT TABLE (IPv6) *"');
      expect(ipv6).to.contain('$IP6TABLES -A INPUT');
      expect(ipv6).not.to.contain('$IPTABLES ');

      // The policy load status is the status of its last command, in the IPv6 policy.
      expect(shellFunction(script, 'policy_load')).to.match(/IPv6 policy skipped\."\nfi\n\n\}\n$/);
    });

    it('should load the policy of each IP version only if it is available in optimized mode', async () => {
      const script = await compileScript(OPTIMIZED);

      expect(ipVersionPolicy(script, 'IPv4')).to.contain(
        "cat <<'FWC_IPTABLES_RESTORE' | $IPTABLES_RESTORE\n*filter",
      );
      expect(ipVersionPolicy(script, 'IPv4')).not.to.contain('$IP6TABLES');
      expect(ipVersionPolicy(script, 'IPv6')).to.contain(
        "cat <<'FWC_IPTABLES_RESTORE' | $IP6TABLES_RESTORE\n*filter",
      );
      expect(ipVersionPolicy(script, 'IPv6')).not.to.contain('$IPTABLES');
    });

    it('should create the NFTables tables and chains of each IP version only if it is available', async () => {
      for (const options of [NFTABLES_COMPILER, NFTABLES_COMPILER | OPTIMIZED]) {
        const script = await compileScript(options);
        const tables = script.match(
          /\nif policy_ip_available 4; then\n([\s\S]*?)fi\nif policy_ip_available 6; then\n([\s\S]*?)fi\n/,
        );

        expect(tables, `options ${options}`).not.to.be.null;
        expect(tables[1]).to.contain('add table ip filter');
        expect(tables[1]).not.to.match(/ ip6 /);
        expect(tables[2]).to.contain('add table ip6 filter');
        expect(tables[2]).not.to.match(/ ip /);
      }
    });

    it('should apply every forwarding option and fail the policy load if any of them fails', async () => {
      const script = await compileScript(
        FireWallOptMask.IPv4_FORWARDING | FireWallOptMask.DOCKER_COMPAT,
      );

      expect(shellFunction(script, 'options_load')).to.equal(
        'options_load() {\n' +
          '  echo\n' +
          '  echo "OPTIONS"\n' +
          '  echo "-------"\n' +
          '  FWC_OPTIONS_STATUS=0\n' +
          '  policy_sysctl net.ipv4.conf.all.forwarding 1 || FWC_OPTIONS_STATUS=1\n' +
          '  policy_sysctl net.ipv6.conf.all.forwarding 0 || FWC_OPTIONS_STATUS=1\n' +
          '\n' +
          '  DOCKER_COMPATIBILITY=1\n' +
          '  return $FWC_OPTIONS_STATUS\n' +
          '}\n',
      );
    });

    it('should not check the IP versions available in VyOS scripts', async () => {
      expect(await compileScript(VYOS_COMPILER)).not.to.contain('policy_ip_available');
    });
  });

  describe('policy load', () => {
    it('should load the policy on a system without IPv6', async () => {
      createSystem([4]);
      const result = run(await compileScript(), 'policy');

      expect(result.status, result.output).to.equal(0);
      expect(result.output).to.contain('IPv6 not available on this system, IPv6 policy skipped.');
      expect(result.output).to.contain('net.ipv4.conf.all.forwarding = 0');
      expect(result.output).to.contain(
        'net.ipv6.conf.all.forwarding: not available on this system, skipped.',
      );
      expect(result.output).not.to.contain('ERROR');
      expect(result.calls).to.include('iptables -P INPUT DROP');
      expect(result.calls.some((call) => call.startsWith('iptables -A INPUT'))).to.be.true;
      expect(result.calls.filter((call) => call.startsWith('ip6tables'))).to.be.empty;
      expect(result.calls).not.to.include('sysctl -w net.ipv6.conf.all.forwarding=0');
      // The IPv6 kernel module is only looked for once.
      expect(result.calls.filter((call) => call === 'modprobe ipv6')).to.have.length(1);
      expect(policyStatus()).to.equal('OK\n');
    });

    it('should load the policy on a system without IPv4', async () => {
      createSystem([6]);
      const result = run(await compileScript(), 'policy');

      expect(result.status, result.output).to.equal(0);
      expect(result.output).to.contain('IPv4 not available on this system, IPv4 policy skipped.');
      expect(result.output).to.contain(
        'net.ipv4.conf.all.forwarding: not available on this system, skipped.',
      );
      expect(result.output).to.contain('net.ipv6.conf.all.forwarding = 0');
      expect(result.output).not.to.contain('ERROR');
      expect(result.calls).to.include('ip6tables -P INPUT DROP');
      expect(result.calls.some((call) => call.startsWith('ip6tables -A INPUT'))).to.be.true;
      expect(result.calls.filter((call) => call.startsWith('iptables'))).to.be.empty;
      expect(policyStatus()).to.equal('OK\n');
    });

    it('should load the IPv6 policy when IPv6 is a kernel module not loaded yet', async () => {
      createSystem([4]);
      const result = run(await compileScript(), 'policy', { FWC_TEST_IPV6_MODULE: '1' });

      expect(result.status, result.output).to.equal(0);
      expect(result.output).not.to.contain('IPv6 policy skipped');
      expect(result.calls).to.include('modprobe ipv6');
      expect(result.calls.some((call) => call.startsWith('ip6tables -A INPUT'))).to.be.true;
      expect(result.calls).to.include('sysctl -w net.ipv6.conf.all.forwarding=0');
    });

    it('should load the IPv6 policy when IPv6 is disabled through sysctl', async () => {
      // As systemd or NetworkManager do, globally or per interface: it can be enabled at any time.
      createSystem([4, 6]);
      fs.writeFileSync(path.join(sandbox, 'sys/net/ipv6/conf/all/disable_ipv6'), '1\n');
      const result = run(await compileScript(), 'policy');

      expect(result.status, result.output).to.equal(0);
      expect(result.output).not.to.contain('IPv6 policy skipped');
      expect(result.calls).to.include('ip6tables -P INPUT DROP');
      expect(result.calls.some((call) => call.startsWith('ip6tables -A INPUT'))).to.be.true;
    });

    it('should skip the kernel parameters of an interface without them', async () => {
      createSystem([4]);
      fs.mkdirSync(path.join(sandbox, 'sys/net/ipv4/conf/eth0.100'));
      fs.writeFileSync(path.join(sandbox, 'sys/net/ipv4/conf/eth0.100/forwarding'), '0\n');
      const result = run(
        await compileScript(),
        '',
        {},
        'policy_sysctl net.ipv4.conf.eth0/100.forwarding 1; echo "rc=$?"\n' +
          'policy_sysctl net.ipv4.conf.eth1.forwarding 1; echo "rc=$?"\n',
      );

      // The sysctl syntax for interface names with dots (VLANs).
      expect(result.calls).to.include('sysctl -w net.ipv4.conf.eth0/100.forwarding=1');
      expect(result.output).to.equal(
        'net.ipv4.conf.eth0/100.forwarding = 1\nrc=0\n' +
          'net.ipv4.conf.eth1.forwarding: not available on this system, skipped.\nrc=0\n',
      );
    });

    it('should write the options to the kernel parameters without the sysctl command', async () => {
      createSystem([4]);
      fs.rmSync(path.join(sandbox, 'bin', 'sysctl'));
      const result = run(await compileScript(FireWallOptMask.IPv4_FORWARDING), 'policy');

      expect(result.status, result.output).to.equal(0);
      expect(result.output).to.contain('net.ipv4.conf.all.forwarding = 1');
      expect(
        fs.readFileSync(path.join(sandbox, 'sys/net/ipv4/conf/all/forwarding'), 'utf8'),
      ).to.equal('1\n');
    });

    it('should report a failed option and fall back to DROP default policies', async () => {
      createSystem([4, 6]);
      const result = run(await compileScript(), 'policy', {
        FWC_TEST_SYSCTL_FAIL: 'net.ipv4.conf.all.forwarding',
      });

      expect(result.status).to.equal(1);
      expect(result.output).to.contain(
        'sysctl: permission denied on key "net.ipv4.conf.all.forwarding"',
      );
      expect(result.output).to.contain('ERROR: Policy load failed');
      // The remaining options are applied anyway.
      const failure = result.calls.indexOf('sysctl -w net.ipv4.conf.all.forwarding=0');
      expect(result.calls.indexOf('sysctl -w net.ipv6.conf.all.forwarding=0')).to.be.greaterThan(
        failure,
      );
      const fallback = result.calls.slice(failure);
      for (const cmd of ['iptables', 'ip6tables'])
        for (const chain of ['INPUT', 'OUTPUT', 'FORWARD'])
          expect(fallback).to.include(`${cmd} -P ${chain} DROP`);
      expect(result.calls.filter((call) => call.match(/ -P \w+ ACCEPT$/))).to.be.empty;
      expect(policyStatus()).to.equal('ERROR\n');
    });

    it('should fall back to DROP default policies with the NFTables compiler too', async () => {
      createSystem([4, 6]);
      const result = run(await compileScript(NFTABLES_COMPILER), 'policy', {
        FWC_TEST_SYSCTL_FAIL: 'net.ipv6.conf.all.forwarding',
      });

      expect(result.status).to.equal(1);
      expect(result.output).to.contain('ERROR: Policy load failed');
      // The NFTables policy lets all the packets through iptables...
      expect(result.calls).to.include('iptables -P INPUT ACCEPT');
      // ... until the policy load fails.
      const fallback = result.calls.slice(
        result.calls.indexOf('sysctl -w net.ipv6.conf.all.forwarding=0'),
      );
      expect(fallback).to.include('iptables -P INPUT DROP');
      expect(fallback).to.include('ip6tables -P INPUT DROP');
    });

    it('should report a failure at the end of the policy load', async () => {
      await addRule('IPv6:DNAT', { special: SpecialPolicyRules.HOOKSCRIPT, run_before: 'false' });
      const script = await compileScript();

      createSystem([4, 6]);
      const result = run(script, 'policy');
      expect(result.status).to.equal(1);
      expect(result.output).to.contain('ERROR: Policy load failed');
      expect(policyStatus()).to.equal('ERROR\n');

      // The hook script is part of the IPv6 policy, which is not loaded without IPv6.
      fs.rmSync(path.join(sandbox, 'sys/net/ipv6'), { recursive: true });
      expect(run(script, 'policy').status).to.equal(0);
      expect(policyStatus()).to.equal('OK\n');
    });

    it('should not check the DNS objects of an IP version not available', async () => {
      const dns = await db.getSource().manager.getRepository(IPObj).save({
        name: 'www.fwcloud.net',
        ipObjTypeId: 9,
        fwCloudId: fwcProduct.fwcloud.id,
      });
      const rule = await addRule('IPv6:INPUT');
      await populateRule(rule, RulePositionsMap.get('IPv6:INPUT:Source'), dns.id);
      const script = await compileScript();
      // The install action runs this check, with DNS resolution temporarily allowed.
      const installCheck =
        'policy_dns_resolution allow\npolicy_dns_check\necho "rc=$?"\npolicy_dns_resolution revoke\n';
      const env = { FWC_TEST_IP6TABLES_UNSUPPORTED: '1' };

      createSystem([4]);
      let result = run(script, '', env, installCheck);
      expect(result.output).to.contain('rc=0');
      expect(result.calls.filter((call) => call.startsWith('ip6tables'))).to.be.empty;
      expect(result.calls).to.include(
        'iptables -I OUTPUT 1 -p udp --dport 53 -m comment --comment FWCloud DNS resolution -j ACCEPT',
      );

      fs.mkdirSync(path.join(sandbox, 'sys/net/ipv6'));
      result = run(script, '', env, installCheck);
      expect(result.output).to.contain('rc=1');
      expect(result.output).to.contain('(IPv6) cannot be resolved on this firewall.');
    });
  });

  describe('status', () => {
    it('should report the result of the last policy load', async () => {
      const script = await compileScript();
      createSystem([4, 6]);

      expect(run(script, 'status')).to.include({ status: 1, output: 'ERROR: Policy not loaded\n' });

      run(script, 'policy');
      expect(run(script, 'status')).to.include({ status: 0, output: 'OK. Policy loaded.\n' });

      run(script, 'policy', { FWC_TEST_SYSCTL_FAIL: 'net.ipv6.conf.all.forwarding' });
      expect(run(script, 'status')).to.include({
        status: 1,
        output: 'ERROR: Policy load failed\n',
      });

      run(script, 'policy');
      run(script, 'stop');
      expect(run(script, 'status')).to.include({ status: 1, output: 'ERROR: Policy not loaded\n' });

      run(script, 'policy');
      run(script, 'block');
      expect(run(script, 'status')).to.include({ status: 1, output: 'ERROR: Policy not loaded\n' });
    });

    it('should report an IPTables policy flushed after loading it', async () => {
      const script = await compileScript();
      createSystem([4, 6]);
      run(script, 'policy');

      // Empty filter table: just the headers of the INPUT, FORWARD and OUTPUT chains.
      expect(run(script, 'status', { FWC_TEST_LISTED_LINES: '8' })).to.include({
        status: 1,
        output: 'ERROR: Policy not loaded\n',
      });
    });

    it('should report the policy of a system without IPv4', async () => {
      const script = await compileScript();
      createSystem([6]);
      run(script, 'policy');

      const result = run(script, 'status');
      expect(result).to.include({ status: 0, output: 'OK. Policy loaded.\n' });
      expect(result.calls).to.include('ip6tables -nL');
      expect(result.calls.filter((call) => call.startsWith('iptables'))).to.be.empty;
    });
  });
});
