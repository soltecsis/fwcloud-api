const assert = require('node:assert/strict');
const { test } = require('node:test');
const { diagnostics } = require('../.github/zap/diagnostics.cjs');

test('ZAP diagnostics never copy sensitive fields or invalid numeric values', () => {
  const canary = 'private-cookie-token\n::error::injected';
  const output = diagnostics(2, {
    completed: true,
    packagedRules: { fail: 0, warn: 1, pass: 112, extra: canary },
    alerts: [
      { pluginId: 10021, riskCode: 1, instances: 2, evidence: canary },
      { pluginId: canary, riskCode: 1, instances: 2 },
      { pluginId: 10021, riskCode: 1, instances: -1 },
      null,
    ],
    requestHeader: canary,
  });
  assert.match(output, /exit code: 2 \(WARN findings\)/);
  assert.match(output, /Scan completed: true/);
  assert.match(output, /FAIL=0, WARN=1, PASS=112/);
  assert.match(output, /pluginId=10021, riskCode=1, instances=2/);
  assert.equal(output.split('\n').filter(line => line.startsWith('Alert:')).length, 1);
  assert.ok(!output.includes(canary));
});

test('missing evidence and incomplete scans retain the actual exit classification', () => {
  for (const report of [undefined, null, [], 'invalid']) {
    const output = diagnostics(3, report);
    assert.match(output, /exit code: 3 \(operational error\)/);
    assert.match(output, /evidence unavailable/);
  }
  assert.match(diagnostics(1, { completed: false }), /Scan completed: false/);
  assert.match(diagnostics(125), /exit code: 125 \(unexpected scanner\/container failure\)/);
  assert.match(diagnostics(NaN), /exit code: unknown/);
  assert.match(diagnostics(0, { completed: true }), /exit code: 0 \(success\)/);
});
