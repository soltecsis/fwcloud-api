/*!
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

import { describeName, expect } from '../../../mocha/global-setup';
import sinon from 'sinon';
import { EventEmitter } from 'events';
import fs from 'fs';
import { PolicyCompiler } from '../../../../src/compiler/policy/PolicyCompiler';
import { VyOSCompiler } from '../../../../src/compiler/policy/vyos/vyos-compiler';
import { PolicyScript } from '../../../../src/compiler/policy/PolicyScript';
import { ProgressNoticePayload } from '../../../../src/sockets/messages/socket-message';
import { FireWallOptMask, Firewall } from '../../../../src/models/firewall/Firewall';
import {
  PolicyRule,
  PolicyRuleOptMask,
  SpecialPolicyRules,
} from '../../../../src/models/policy/PolicyRule';
import { PolicyTypesMap } from '../../../../src/models/policy/PolicyType';
import config from '../../../../src/config/config';

describe(describeName('Policy Compiler VyOS'), () => {
  const compiler = new VyOSCompiler({ type: 0 });

  afterEach(() => {
    sinon.restore();
  });

  it('should use the VyOS header and footer templates when compiling scripts', async () => {
    const policyConfig = config.get('policy');
    const readFileStub = sinon.stub(fs, 'readFileSync');
    readFileStub.withArgs(policyConfig.vyos_header_file, 'utf8').returns('');
    readFileStub.withArgs(policyConfig.vyos_footer_file, 'utf8').returns('');

    const fakeStream: any = {
      write: sinon.stub().returns(true),
      end: sinon.stub(),
      on(event: string, handler: () => void | Promise<void>) {
        if (event === 'open') handler();
        return this;
      },
    };

    sinon.stub(fs, 'createWriteStream').returns(fakeStream);
    sinon.stub(Firewall, 'getFirewallCompiler').resolves('VyOS');
    sinon.stub(Firewall, 'updateFirewallStatus').resolves();
    sinon.stub(Firewall, 'updateFirewallCompileDate').resolves();
    sinon.stub(PolicyRule, 'firewallWithMarkRules').resolves(false);

    const script = new PolicyScript({}, 1, 1);
    sinon.stub(script as any, 'dumpVyOSPolicy').resolves();

    await script.dump();

    expect(readFileStub.calledWith(policyConfig.vyos_header_file, 'utf8')).to.be.true;
    expect(readFileStub.calledWith(policyConfig.vyos_footer_file, 'utf8')).to.be.true;
    const wrotePolicyCompilerLine = fakeStream.write
      .getCalls()
      .some((call: sinon.SinonSpyCall<[string]>) => /POLICY_COMPILER/.test(call.args[0] ?? ''));
    expect(wrotePolicyCompilerLine).to.be.false;
  });

  it('should compile active rules and emit progress messages', async () => {
    const rules = [
      { id: 1, active: 1, comment: null, type: 1 },
      { id: 2, active: 0, comment: null, type: 1 },
    ];

    const ruleCompileStub = sinon.stub(VyOSCompiler.prototype, 'ruleCompile').returns('vyos-cs');

    const emitter = new EventEmitter();
    const emitStub = sinon.stub(emitter, 'emit');

    const result = await PolicyCompiler.compile('VyOS', rules, emitter as any);

    expect(ruleCompileStub.called).to.be.true;
    expect(result).to.eql([
      { id: 1, active: 1, comment: null, cs: 'vyos-cs' },
      { id: 2, active: 0, comment: null, cs: '' },
    ]);

    expect(emitStub.calledTwice).to.be.true;
    expect(emitStub.firstCall.args[0]).to.equal('message');
    expect((emitStub.firstCall.args[1] as ProgressNoticePayload).message).to.equal(
      'Rule 1 (ID: 1)',
    );
    expect((emitStub.secondCall.args[1] as ProgressNoticePayload).message).to.equal(
      'Rule 2 (ID: 2) [DISABLED]',
    );
  });

  it('should compile hook script rules using the IPTables output format', async () => {
    const runBefore = 'echo "Hook script"';
    const rules = [
      {
        id: 5,
        active: 1,
        comment: null,
        type: PolicyTypesMap.get('IPv4:INPUT'),
        action: 1,
        options: 0,
        firewall_options: 0,
        special: SpecialPolicyRules.HOOKSCRIPT,
        run_before: runBefore,
        run_after: 'echo "ignored"',
        positions: [{ ipobjs: [] }, { ipobjs: [] }, { ipobjs: [] }, { ipobjs: [] }],
      },
    ];

    const result = await PolicyCompiler.compile('VyOS', rules);

    expect(result).to.eql([
      {
        id: 5,
        active: 1,
        comment: null,
        cs: `###########################\n# Hook script rule code:\n${runBefore}\n###########################\n`,
      },
    ]);
  });

  describe('formatAddress()', () => {
    it('should return DNS name', () => {
      const result = (compiler as any).formatAddress({ type: 9, name: 'example.com' });
      expect(result).to.equal('example.com');
    });

    it('should return single address', () => {
      const result = (compiler as any).formatAddress({ type: 5, address: '192.0.2.1' });
      expect(result).to.equal('192.0.2.1');
    });

    it('should return network objects', () => {
      const obj = { type: 7, address: '10.0.0.0', netmask: '255.255.255.0' };
      const result = (compiler as any).formatAddress(obj);
      expect(result).to.equal('10.0.0.0/24');
    });

    it('should return range objects', () => {
      const result = (compiler as any).formatAddress({
        type: 6,
        range_start: '192.0.2.1',
        range_end: '192.0.2.10',
      });
      expect(result).to.equal('192.0.2.1-192.0.2.10');
    });

    it('returns undefined for undefined input', () => {
      const result = (compiler as any).formatAddress(undefined);
      expect(result).to.equal(undefined);
    });
  });

  describe('ruleCompile()', () => {
    it('should build rule with interfaces, geoip, networks, ranges, services and options', () => {
      const ruleData: any = {
        id: 100,
        type: PolicyTypesMap.get('IPv4:FORWARD'),
        action: 1,
        options: PolicyRuleOptMask.STATEFUL,
        firewall_options: FireWallOptMask.STATEFUL,
        mark_code: '25',
        positions: [
          { ipobjs: [{ name: 'eth0' }] },
          { ipobjs: [{ name: 'eth1' }] },
          {
            ipobjs: [
              { type: 24, code: 'ES' },
              { type: 7, address: '192.168.1.0', netmask: '/24' },
              { type: 6, range_start: '10.0.0.1', range_end: '10.0.0.10' },
            ],
          },
          {
            ipobjs: [
              { type: 7, address: '172.16.0.0', netmask: '/16' },
              { type: 6, range_start: '192.0.2.1', range_end: '192.0.2.5' },
            ],
          },
          {
            ipobjs: [
              {
                protocol: 6,
                source_port_start: 1000,
                source_port_end: 1000,
                destination_port_start: 80,
                destination_port_end: 80,
              },
              { protocol: 17, destination_port_start: 53, destination_port_end: 53 },
              { protocol: 1, icmp_type: 8, icmp_code: 0 },
            ],
          },
        ],
      };

      const compiler = new VyOSCompiler(ruleData);
      const result = compiler.ruleCompile();

      expect(result).to.include('set firewall name FORWARD rule 100 inbound-interface eth0');
      expect(result).to.include('set firewall name FORWARD rule 100 outbound-interface eth1');
      expect(result).to.include('set firewall name FORWARD rule 100 source geoip country-code ES');
      expect(result).to.include('delete firewall group address-group FWC_FORWARD_100_SRC_ADDR_V4');
      expect(result).to.include(
        'set firewall group address-group FWC_FORWARD_100_SRC_ADDR_V4 address 192.168.1.0/24',
      );
      expect(result).to.include(
        'set firewall group address-group FWC_FORWARD_100_SRC_ADDR_V4 address 10.0.0.1-10.0.0.10',
      );
      expect(result).to.include(
        'set firewall name FORWARD rule 100 source group address-group FWC_FORWARD_100_SRC_ADDR_V4',
      );
      expect(result).to.include('delete firewall group address-group FWC_FORWARD_100_DST_ADDR_V4');
      expect(result).to.include(
        'set firewall group address-group FWC_FORWARD_100_DST_ADDR_V4 address 172.16.0.0/16',
      );
      expect(result).to.include(
        'set firewall group address-group FWC_FORWARD_100_DST_ADDR_V4 address 192.0.2.1-192.0.2.5',
      );
      expect(result).to.include(
        'set firewall name FORWARD rule 100 destination group address-group FWC_FORWARD_100_DST_ADDR_V4',
      );
      expect(result).to.include('set firewall name FORWARD rule 100 protocol tcp');
      expect(result).to.include('set firewall name FORWARD rule 100 source port 1000');
      expect(result).to.include('set firewall name FORWARD rule 100 destination port 80');
      expect(result).to.include('set firewall name FORWARD rule 100 protocol udp');
      expect(result).to.include('set firewall name FORWARD rule 100 destination port 53');
      expect(result).to.include('set firewall name FORWARD rule 100 protocol icmp');
      expect(result).to.include('set firewall name FORWARD rule 100 icmp type 8');
      expect(result).to.include('set firewall name FORWARD rule 100 icmp code 0');
      expect(result).to.include('set firewall name FORWARD rule 100 state new enable');
      expect(result).to.include('set firewall name FORWARD rule 100 set-mark 25');
      expect(result).to.include('set firewall name FORWARD rule 100 action accept');
    });

    it('should use interface and address groups when multiple inbound interfaces and sources exist', () => {
      const ruleData: any = {
        id: 42,
        type: PolicyTypesMap.get('IPv4:INPUT'),
        action: 1,
        options: 0,
        firewall_options: 0,
        mark_code: '0',
        negate: '',
        positions: [
          { id: 101, ipobjs: [{ name: 'ens18' }, { name: 'ens19' }] },
          {
            id: 102,
            ipobjs: [
              { type: 5, address: '78.128.113.67' },
              { type: 5, address: '185.143.223.5' },
            ],
          },
          { id: 103, ipobjs: [] },
          { id: 104, ipobjs: [] },
        ],
      };

      const compiler = new VyOSCompiler(ruleData);
      const result = compiler.ruleCompile();

      expect(result).to.include('delete firewall group interface-group FWC_INPUT_42_IN_IF');
      expect(result).to.include(
        'set firewall group interface-group FWC_INPUT_42_IN_IF interface ens18',
      );
      expect(result).to.include(
        'set firewall group interface-group FWC_INPUT_42_IN_IF interface ens19',
      );
      expect(result).to.include(
        'set firewall name INPUT rule 42 inbound-interface group FWC_INPUT_42_IN_IF',
      );
      expect(result).to.include('delete firewall group address-group FWC_INPUT_42_SRC_ADDR_V4');
      expect(result).to.include(
        'set firewall group address-group FWC_INPUT_42_SRC_ADDR_V4 address 78.128.113.67',
      );
      expect(result).to.include(
        'set firewall group address-group FWC_INPUT_42_SRC_ADDR_V4 address 185.143.223.5',
      );
      expect(result).to.include(
        'set firewall name INPUT rule 42 source group address-group FWC_INPUT_42_SRC_ADDR_V4',
      );
    });

    it('should prefix negation on single selector values', () => {
      const ruleData: any = {
        id: 55,
        type: PolicyTypesMap.get('IPv4:INPUT'),
        action: 1,
        options: 0,
        firewall_options: 0,
        mark_code: '0',
        negate: '201 203',
        positions: [
          { id: 201, ipobjs: [{ name: 'ens18' }] },
          { id: 202, ipobjs: [{ type: 5, address: '10.1.1.10' }] },
          { id: 203, ipobjs: [{ type: 5, address: '203.0.113.8' }] },
          { id: 204, ipobjs: [] },
        ],
      };

      const compiler = new VyOSCompiler(ruleData);
      const result = compiler.ruleCompile();

      expect(result).to.include('set firewall name INPUT rule 55 inbound-interface !ens18');
      expect(result).to.include('set firewall name INPUT rule 55 source address 10.1.1.10');
      expect(result).to.include('set firewall name INPUT rule 55 destination address !203.0.113.8');
    });

    it('should prefix negation on generated address groups', () => {
      const ruleData: any = {
        id: 56,
        type: PolicyTypesMap.get('IPv4:INPUT'),
        action: 1,
        options: 0,
        firewall_options: 0,
        mark_code: '0',
        negate: '302',
        positions: [
          { id: 301, ipobjs: [] },
          {
            id: 302,
            ipobjs: [
              { type: 5, address: '10.0.0.1' },
              { type: 5, address: '10.0.0.2' },
            ],
          },
          { id: 303, ipobjs: [] },
          { id: 304, ipobjs: [] },
        ],
      };

      const compiler = new VyOSCompiler(ruleData);
      const result = compiler.ruleCompile();

      expect(result).to.include('delete firewall group address-group FWC_INPUT_56_SRC_ADDR_V4');
      expect(result).to.include(
        'set firewall name INPUT rule 56 source group address-group !FWC_INPUT_56_SRC_ADDR_V4',
      );
    });

    it('should split IPv4 and IPv6 sources into separate groups', () => {
      const ruleData: any = {
        id: 60,
        type: PolicyTypesMap.get('IPv6:INPUT'),
        action: 1,
        options: 0,
        firewall_options: 0,
        mark_code: '0',
        negate: '',
        positions: [
          { id: 401, ipobjs: [] },
          {
            id: 402,
            ipobjs: [
              { type: 5, address: '192.0.2.10' },
              { type: 5, address: '198.51.100.5' },
              { type: 7, address: '2001:db8::', netmask: '/64' },
              { type: 7, address: '2001:db8:1::', netmask: '/64' },
            ],
          },
          { id: 403, ipobjs: [] },
          { id: 404, ipobjs: [] },
        ],
      };

      const compiler = new VyOSCompiler(ruleData);
      const result = compiler.ruleCompile();

      expect(result).to.include('delete firewall group address-group FWC_INPUT_60_SRC_ADDR_V4');
      expect(result).to.include(
        'set firewall group address-group FWC_INPUT_60_SRC_ADDR_V4 address 192.0.2.10',
      );
      expect(result).to.include(
        'set firewall group address-group FWC_INPUT_60_SRC_ADDR_V4 address 198.51.100.5',
      );
      expect(result).to.include(
        'set firewall ipv6-name INPUT rule 60 source group address-group FWC_INPUT_60_SRC_ADDR_V4',
      );

      expect(result).to.include(
        'delete firewall group ipv6-address-group FWC_INPUT_60_SRC_ADDR_V6',
      );
      expect(result).to.include(
        'set firewall group ipv6-address-group FWC_INPUT_60_SRC_ADDR_V6 address 2001:db8::/64',
      );
      expect(result).to.include(
        'set firewall group ipv6-address-group FWC_INPUT_60_SRC_ADDR_V6 address 2001:db8:1::/64',
      );
      expect(result).to.include(
        'set firewall ipv6-name INPUT rule 60 source group address-group FWC_INPUT_60_SRC_ADDR_V6',
      );
    });

    it('should use IPv6-specific keywords for IPv6 ICMP services', () => {
      const ruleData: any = {
        id: 200,
        type: PolicyTypesMap.get('IPv6:INPUT'),
        action: 1,
        options: 0,
        firewall_options: 0,
        mark_code: '0',
        negate: '',
        positions: [
          { id: 701, ipobjs: [] },
          { id: 702, ipobjs: [] },
          { id: 703, ipobjs: [] },
          {
            id: 704,
            ipobjs: [
              {
                protocol: 1,
                icmp_type: 128,
                icmp_code: 0,
              },
            ],
          },
        ],
      };

      const compiler = new VyOSCompiler(ruleData);
      const result = compiler.ruleCompile();

      expect(result).to.include('set firewall ipv6-name INPUT rule 200 protocol ipv6-icmp');
      expect(result).to.include('set firewall ipv6-name INPUT rule 200 icmpv6 type 128');
      expect(result).to.include('set firewall ipv6-name INPUT rule 200 icmpv6 code 0');
    });

    it('should avoid duplicates and empty values when defining groups', () => {
      const ruleData: any = {
        id: 70,
        type: PolicyTypesMap.get('IPv4:INPUT'),
        action: 1,
        options: 0,
        firewall_options: 0,
        mark_code: '0',
        negate: '',
        positions: [
          { id: 501, ipobjs: [] },
          {
            id: 502,
            ipobjs: [
              { type: 5, address: '198.51.100.5' },
              { type: 5, address: '198.51.100.5' },
              { type: 5, address: '' },
              { type: 5, address: '203.0.113.10' },
            ],
          },
          { id: 503, ipobjs: [] },
          { id: 504, ipobjs: [] },
        ],
      };

      const compiler = new VyOSCompiler(ruleData);
      const result = compiler.ruleCompile();

      const firstAddressOccurrences = result.match(
        /set firewall group address-group FWC_INPUT_70_SRC_ADDR_V4 address 198\.51\.100\.5/g,
      );
      const secondAddressOccurrences = result.match(
        /set firewall group address-group FWC_INPUT_70_SRC_ADDR_V4 address 203\.0\.113\.10/g,
      );

      expect(firstAddressOccurrences).to.have.lengthOf(1);
      expect(secondAddressOccurrences).to.have.lengthOf(1);
    });

    it('should include metadata in description and escape quotes', () => {
      const ruleData: any = {
        id: 61,
        type: PolicyTypesMap.get('IPv4:INPUT'),
        action: 1,
        options: 0,
        firewall_options: 0,
        mark_code: '0',
        comment: '  comment "with quotes"  ',
        style: 'rule-style',
        group_name: 'groupA',
        group_style: 'styleA',
        positions: [
          { id: 601, ipobjs: [{ name: 'eth0' }] },
          { id: 602, ipobjs: [] },
          { id: 603, ipobjs: [] },
          { id: 604, ipobjs: [] },
        ],
      };

      const compiler = new VyOSCompiler(ruleData);
      const result = compiler.ruleCompile();

      const meta = { fwc_rs: 'rule-style', fwc_rgn: 'groupA', fwc_rgs: 'styleA' };
      const rawComment = `${JSON.stringify(meta)}${ruleData.comment}`;
      const expectedDescription = `set firewall name INPUT rule 61 description "${rawComment
        .trim()
        .replace(/"/g, '\\"')}"`;

      expect(result).to.include(expectedDescription);
    });
  });

  describe('Inactive rules', () => {
    it('should compile a single inactive rule and emit progress notice', async () => {
      const ruleData = {
        id: 1,
        active: 0,
        comment: '',
        type: PolicyTypesMap.get('IPv4:INPUT'),
        action: 1,
        options: 0,
        firewall_options: 0,
      };

      const emitter: EventEmitter = new EventEmitter();
      const spy = sinon.spy(emitter, 'emit');

      const result = await PolicyCompiler.compile('VyOS', [ruleData], emitter);

      expect(result).to.have.lengthOf(1);
      expect(result[0].cs).to.not.be.empty;
      expect(spy.calledOnce).to.be.true;
      expect(spy.firstCall.args[0]).to.equal('message');
      expect(spy.firstCall.args[1]).to.be.instanceOf(ProgressNoticePayload);
      expect((spy.firstCall.args[1] as ProgressNoticePayload).message).to.equal(
        `Rule 1 (ID: 1) [DISABLED]`,
      );
    });

    it('should emit once per rule and skip compilation for inactive rules when multiple provided', async () => {
      const rulesData = [
        {
          id: 1,
          active: 1,
          comment: '',
          type: PolicyTypesMap.get('IPv4:INPUT'),
          action: 1,
          options: 0,
          firewall_options: 0,
        },
        {
          id: 2,
          active: 0,
          comment: '',
          type: PolicyTypesMap.get('IPv4:INPUT'),
          action: 1,
          options: 0,
          firewall_options: 0,
        },
      ];

      const emitter: EventEmitter = new EventEmitter();
      const spy = sinon.spy(emitter, 'emit');

      const result = await PolicyCompiler.compile('VyOS', rulesData, emitter);

      expect(result).to.have.lengthOf(2);
      expect(result[0].cs).to.not.be.empty;
      expect(result[1].cs).to.equal('');

      expect(spy.callCount).to.equal(2);
      expect((spy.getCall(0).args[1] as ProgressNoticePayload).message).to.equal(`Rule 1 (ID: 1)`);
      expect((spy.getCall(1).args[1] as ProgressNoticePayload).message).to.equal(
        `Rule 2 (ID: 2) [DISABLED]`,
      );
    });
  });
});
