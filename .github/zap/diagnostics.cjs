// Print fixed labels and validated numeric evidence only, never private ZAP logs.
const fs = require('node:fs');

function diagnostics(status, report) {
  const integer = (value) => Number.isSafeInteger(value) && value >= 0;
  const descriptions = {
    0: 'success',
    1: 'FAIL findings',
    2: 'WARN findings',
    3: 'operational error',
  };
  const lines = [
    `Authenticated ZAP exit code: ${integer(status) ? status : 'unknown'} (${(integer(status) && descriptions[status]) || 'unexpected scanner/container failure'}).`,
  ];
  if (!report || typeof report !== 'object' || Array.isArray(report)) {
    lines.push('Numeric ZAP evidence unavailable; scan completion cannot be confirmed.');
    return lines.join('\n');
  }
  lines.push(`Scan completed: ${report.completed === true}.`);
  const counts = report.packagedRules;
  if (counts && ['fail', 'warn', 'pass'].every((key) => integer(counts[key]))) {
    lines.push(`Packaged rules: FAIL=${counts.fail}, WARN=${counts.warn}, PASS=${counts.pass}.`);
  }
  for (const alert of Array.isArray(report.alerts) ? report.alerts : []) {
    if (alert && ['pluginId', 'riskCode', 'instances'].every((key) => integer(alert[key]))) {
      lines.push(
        `Alert: pluginId=${alert.pluginId}, riskCode=${alert.riskCode}, instances=${alert.instances}.`,
      );
    }
  }
  const timestamps = report.timestampSessionDiagnostics;
  if (
    timestamps &&
    ['instances', 'checkedInstances', 'matchingSessionId', 'uncheckedInstances'].every((key) =>
      integer(timestamps[key]),
    ) &&
    timestamps.matchingSessionId <= timestamps.checkedInstances &&
    timestamps.checkedInstances + timestamps.uncheckedInstances === timestamps.instances
  ) {
    lines.push(
      `Timestamp alerts (10096): ${timestamps.instances}; checked: ${timestamps.checkedInstances}; matching sessionId: ${timestamps.matchingSessionId}; unchecked: ${timestamps.uncheckedInstances}.`,
    );
  }
  return lines.join('\n');
}

function main() {
  let report;
  try {
    report = JSON.parse(fs.readFileSync('reports/dast/authenticated.json', 'utf8'));
  } catch {
    // Missing or malformed evidence must not hide the scanner's exit code.
  }
  const output = diagnostics(Number(process.argv[2]), report);
  console.log(output);
  if (process.env.GITHUB_STEP_SUMMARY) {
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, output.replaceAll('\n', '\n\n') + '\n');
  }
}

if (require.main === module) main();
module.exports = { diagnostics };
