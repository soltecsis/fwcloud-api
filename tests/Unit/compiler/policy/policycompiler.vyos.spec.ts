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

describe(describeName('Policy Compiler VyOS'), () => {
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
});
