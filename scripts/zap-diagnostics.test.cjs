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
  assert.equal(output.split('\n').filter((line) => line.startsWith('Alert:')).length, 1);
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

test('timestamp comparison prints only consistent numeric counts', () => {
  const report = {
    timestampSessionDiagnostics: {
      instances: 2,
      checkedInstances: 2,
      matchingSessionId: 2,
      uncheckedInstances: 0,
      evidence: 'private-session-cookie',
    },
  };
  const output = diagnostics(2, report);
  assert.match(
    output,
    /Timestamp alerts \(10096\): 2; checked: 2; matching sessionId: 2; unchecked: 0/,
  );
  assert.ok(!output.includes('private-session-cookie'));
  for (const invalid of [
    { ...report.timestampSessionDiagnostics, matchingSessionId: 'private-session-cookie' },
    { ...report.timestampSessionDiagnostics, matchingSessionId: 3 },
    { ...report.timestampSessionDiagnostics, uncheckedInstances: 1 },
  ]) {
    assert.ok(
      !diagnostics(2, { timestampSessionDiagnostics: invalid }).includes('Timestamp alerts'),
    );
  }
});
