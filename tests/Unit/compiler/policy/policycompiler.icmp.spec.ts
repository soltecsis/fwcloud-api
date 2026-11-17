import { strict as assert } from 'node:assert';
import { PolicyCompilerTools } from '../../../../src/compiler/policy/PolicyCompilerTools';

describe('ICMP service compilation', () => {
  const cases = [
    { name: 'null type and code', type: null, code: null, suffix: 'any' },
    { name: 'undefined type and code', type: undefined, code: undefined, suffix: 'any' },
    { name: 'wildcard type and code', type: -1, code: -1, suffix: 'any' },
    { name: 'mixed absent fields', type: null, code: -1, suffix: 'any' },
    { name: 'type with null code', type: 8, code: null, suffix: '8' },
    { name: 'type with undefined code', type: 8, code: undefined, suffix: '8' },
    { name: 'type with wildcard code', type: 8, code: -1, suffix: '8' },
    { name: 'specific type and code', type: 3, code: 1, suffix: '3/1' },
    { name: 'zero type with absent code', type: 0, code: null, suffix: '0' },
    { name: 'zero type and code', type: 0, code: 0, suffix: '0/0' },
  ];

  for (const compiler of ['IPTables', 'NFTables']) {
    for (const ipv of [4, 6]) {
      for (const testCase of cases) {
        it(`${compiler} IPv${ipv}: compiles ${testCase.name} without null/undefined restrictions`, () => {
          const tools = Object.create(PolicyCompilerTools.prototype) as any;
          tools._compiler = compiler;
          tools._family = ipv === 4 ? 'ip' : 'ip6';
          tools._compiledPositions = [];

          tools.compileSvc(
            [{ protocol: 1, icmp_type: testCase.type, icmp_code: testCase.code }],
            false,
            ipv,
          );

          const iptablesOpt =
            ipv === 4 ? '-p icmp -m icmp --icmp-type' : '-p icmpv6 -m ipv6-icmp --icmpv6-type';
          let expected: string;
          if (compiler === 'IPTables') {
            expected = `${iptablesOpt} ${testCase.suffix}`;
          } else if (testCase.suffix === 'any') {
            expected = `${tools._family} protocol icmp`;
          } else {
            expected = `icmp type ${testCase.type}`;
            if (testCase.suffix.includes('/')) expected += ` icmp code ${testCase.code}`;
          }

          assert.deepEqual(tools._compiledPositions, [{ negate: false, items: [expected] }]);
        });
      }
    }
  }
});
