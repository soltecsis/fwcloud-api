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
import { PolicyCompiler } from '../../../../src/compiler/policy/PolicyCompiler';
import { VyOSCompiler } from '../../../../src/compiler/policy/vyos/vyos-compiler';
import { ProgressNoticePayload } from '../../../../src/sockets/messages/socket-message';
import { FireWallOptMask } from '../../../../src/models/firewall/Firewall';
import { PolicyRuleOptMask } from '../../../../src/models/policy/PolicyRule';
import { PolicyTypesMap } from '../../../../src/models/policy/PolicyType';

describe.only(describeName('Policy Compiler VyOS'), () => {
  const compiler = new VyOSCompiler({ type: 0 });

  afterEach(() => {
    sinon.restore();
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

    expect(ruleCompileStub.calledOnce).to.be.true;
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
    expect(result).to.include('set firewall name FORWARD rule 100 source address 192.168.1.0/24');
    expect(result).to.include(
      'set firewall name FORWARD rule 100 source address 10.0.0.1-10.0.0.10',
    );
    expect(result).to.include(
      'set firewall name FORWARD rule 100 destination address 172.16.0.0/16',
    );
    expect(result).to.include(
      'set firewall name FORWARD rule 100 destination address 192.0.2.1-192.0.2.5',
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
});
