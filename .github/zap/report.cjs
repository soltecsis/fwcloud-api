// Render selected evidence, never native ZAP traffic or arbitrary URLs.
const fs = require('node:fs');
const path = require('node:path');
const { context, exitCode } = require('../../scripts/ci-context.cjs');
const { routes } = require('./scope.cjs');
const integer = (value) => Number.isSafeInteger(value) && value >= 0;
const httpStatus = (value) => integer(value) && value >= 100 && value <= 599;
const md = (value) =>
  String(value)
    .slice(0, 220)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('\\', '\\\\')
    .replace(/[|`[\]]/g, '\\$&')
    .replace(/[\r\n]/g, ' ');
const actors = new Set(['anonymous', 'admin', 'manager-a', 'manager-b', 'mfa-user']);
const importStates = {
  not_attempted: 'No intentada',
  reached: 'Alcanzada',
  unexpected_response: 'Respuesta inesperada',
  not_reached: 'No alcanzada',
};
const levels = new Set(['INFO', 'WARN', 'FAIL', 'IGNORE']);
const count = (value) => (integer(value) ? value : '—');
const identifier = (value) => (/^[1-9][0-9]*$/.test(String(value)) ? String(value) : '—');

function declaredOperations(scope) {
  return Object.values(scope?.paths || {}).flatMap((methods) =>
    Object.entries(methods && typeof methods === 'object' ? methods : {})
      .filter(
        ([method, operation]) => routes[operation?.operationId]?.method === method.toUpperCase(),
      )
      .map(([, operation]) => operation.operationId),
  );
}

function alertLabel(alert) {
  if (!integer(alert?.pluginId) || !integer(alert.riskCode) || !integer(alert.instances))
    return 'Datos no disponibles';
  const level = levels.has(alert.gateLevel) ? alert.gateLevel : 'sin clasificación';
  return `[${alert.pluginId}](https://www.zaproxy.org/docs/alerts/${alert.pluginId}/) (riesgo ${alert.riskCode}; ${level}; ${alert.instances})`;
}

function render({ ci, scope, zap, before, after, scanExitCode, outcomes = {} }) {
  const expected = declaredOperations(scope);
  const operations = Array.isArray(zap?.operations) ? zap.operations : [];
  const failed =
    (scanExitCode !== null && scanExitCode !== 0) ||
    (integer(zap?.packagedRules?.fail) && zap.packagedRules.fail > 0) ||
    (integer(zap?.packagedRules?.warn) && zap.packagedRules.warn > 0) ||
    Object.values(outcomes).some((value) => ['failure', 'cancelled'].includes(value)) ||
    [before, after].some(
      (report) =>
        Array.isArray(report?.requests) &&
        report.requests.some((request) => request?.outcome === 'error'),
    ) ||
    [before, after].some(
      (report) =>
        Array.isArray(report?.checks) && report.checks.some((check) => check?.passed === false),
    );
  const complete =
    expected.length > 0 &&
    new Set(expected).size === expected.length &&
    zap?.completed === true &&
    scanExitCode === 0 &&
    expected.every((id) =>
      operations.some(
        (operation) =>
          operation?.operationId === id &&
          operation.method === routes[id].method &&
          operation.route === routes[id].route &&
          operation.importStatus === 'reached',
      ),
    ) &&
    ['fail', 'warn', 'pass'].every((key) => integer(zap?.packagedRules?.[key])) &&
    [before, after].every(
      (report) =>
        report?.completed === true &&
        Array.isArray(report.checks) &&
        report.checks.length > 0 &&
        Array.isArray(report.requests) &&
        report.requests.every((request) => request?.outcome === 'observed') &&
        report.checks.every(
          (check) =>
            check?.passed === true &&
            (check.kind !== 'http' ||
              (httpStatus(check.expectedStatus) && check.expectedStatus === check.actualStatus)),
        ),
    );
  const result = failed ? 'FAILED' : complete ? 'PASSED' : 'INCOMPLETE';
  const lines = [
    '# DAST — ZAP y controles HTTP',
    '',
    `Resultado conjunto: **${result}**`,
    '',
    `- Revisión: \`${/^[a-f0-9]{40}$/.test(ci.commit) ? ci.commit : 'no disponible'}\``,
    `- Ejecución/intento: ${identifier(ci.runId)}/${identifier(ci.runAttempt)}`,
    `- Versión ZAP: ${/^[0-9]+\.[0-9]+\.[0-9]+$/.test(zap?.zapVersion) ? zap.zapVersion : 'no disponible'}`,
    `- Código de salida ZAP: **${scanExitCode === null ? 'No ejecutado / no disponible' : count(scanExitCode)}**`,
    `- Escaneo completado: **${zap?.completed === true ? 'Sí' : 'No'}**`,
    `- Cola pasiva pendiente: ${count(zap?.passiveQueueRemaining)}`,
    '',
    '## Alcance autenticado observado por ZAP',
    '',
    'La tabla describe la importación verificada (HTTP 200 con cuerpo), no cobertura de todos los ataques ni una certificación de seguridad.',
    `Actor del escenario ZAP: **${actors.has(zap?.actor) ? zap.actor : 'no disponible'}**.`,
    '',
    '| Operación | Método | Ruta canónica | Importación | HTTP observados | Alertas en la ruta |',
    '| --- | --- | --- | --- | --- | --- |',
  ];
  if (!expected.length) lines.push('| Alcance no disponible | — | — | No ejecutada | — | — |');
  for (const id of expected) {
    const operation = operations.find((value) => value?.operationId === id);
    const statuses = Array.isArray(operation?.observedStatuses)
      ? operation.observedStatuses.filter(httpStatus).join(', ')
      : '';
    const alerts = Array.isArray(operation?.alerts)
      ? operation.alerts.map(alertLabel).join('; ')
      : '';
    lines.push(
      `| ${id} | ${routes[id].method} | \`${routes[id].route}\` | ${importStates[operation?.importStatus] || 'No intentada'} | ${statuses || '—'} | ${alerts || (zap?.completed === true ? 'Sin alertas registradas' : 'No disponible (escaneo incompleto)')} |`,
    );
  }
  lines.push(
    '',
    '## Controles HTTP específicos de FWCloud',
    '',
    'Estos controles los ejecutan los helpers antes/después de ZAP. Las aserciones de persistencia o estado no se presentan como respuestas HTTP.',
    '',
  );
  for (const [phase, report] of [
    ['before', before],
    ['after', after],
  ]) {
    lines.push(
      '',
      `### ${phase === 'before' ? 'Antes' : 'Después'} del escaneo`,
      '',
      `Fase completada: **${report?.completed === true ? 'Sí' : 'No'}**.`,
      '',
      '| Control | Actor del escenario | Método | Ruta canónica | HTTP esperado | HTTP observado | Resultado |',
      '| --- | --- | --- | --- | --- | --- | --- |',
    );
    if (!Array.isArray(report?.checks) || !report.checks.length)
      lines.push('| Sin comprobaciones disponibles | — | — | — | — | — | No ejecutado |');
    for (const check of Array.isArray(report?.checks) ? report.checks : []) {
      if (!check || typeof check.name !== 'string') continue;
      const definition = routes[check.operationId];
      lines.push(
        `| ${md(check.name)} | ${actors.has(check.actor) ? check.actor : '—'} | ${definition?.method || '—'} | ${definition ? '\x60' + definition.route + '\x60' : '—'} | ${httpStatus(check.expectedStatus) ? check.expectedStatus : '—'} | ${httpStatus(check.actualStatus) ? check.actualStatus : '—'} | ${check.passed === true ? 'Correcto' : 'Fallido / incompleto'} |`,
      );
    }
    for (const request of Array.isArray(report?.requests) ? report.requests : []) {
      if (!['error', 'pending'].includes(request?.outcome) || !routes[request.operationId])
        continue;
      const definition = routes[request.operationId];
      lines.push(
        `| Petición no completada | ${actors.has(request.actor) ? request.actor : '—'} | ${definition.method} | \`${definition.route}\` | — | ${httpStatus(request.actualStatus) ? request.actualStatus : '—'} | ${request.outcome === 'error' ? 'Error' : 'Pendiente'} |`,
      );
    }
    if (report?.completed !== true)
      lines.push(
        '',
        'La fase no terminó; las comprobaciones restantes no se consideran ejecutadas ni correctas.',
      );
  }
  lines.push(
    '',
    '## Alertas y política del gate',
    '',
    `Conteos oficiales: FAIL=${count(zap?.packagedRules?.fail)}, WARN=${count(zap?.packagedRules?.warn)}, PASS=${count(zap?.packagedRules?.pass)}.`,
    '',
    '| Regla, riesgo, tratamiento e instancias | Rutas asociadas | Instancias sin asociación |',
    '| --- | --- | --- |',
  );
  for (const alert of Array.isArray(zap?.alerts) ? zap.alerts : []) {
    const associated = Array.isArray(alert?.operations)
      ? alert.operations
          .filter((value) => routes[value?.operationId])
          .map((value) => `\`${routes[value.operationId].route}\` (${count(value.instances)})`)
          .join('; ')
      : '';
    lines.push(
      `| ${alertLabel(alert)} | ${associated || 'Sin asociación a una operación declarada'} | ${count(alert?.unmappedInstances)} |`,
    );
  }
  lines.push(
    '',
    'Las instancias proceden del informe nativo y pueden estar limitadas por ZAP. Las alertas se asocian por ruta; las sondas pueden variar el método.',
    'Riesgo ZAP y tratamiento del gate son distintos. Sin alertas registradas no equivale a ruta segura.',
    'No se publican cuerpos, cabeceras, cookies, credenciales, payloads ni URLs de ataques.',
    '',
  );
  return { markdown: lines.join('\n'), result };
}

function main() {
  const directory = process.env.DAST_REPORT_DIR || 'reports/dast';
  const ci = context();
  const read = (file) => {
    try {
      const value = JSON.parse(fs.readFileSync(path.join(directory, file), 'utf8'));
      if (file.endsWith('.openapi.json')) return value;
      if (file.startsWith('http-') && value.phase !== file.slice(5, -5)) return null;
      if (
        value.commit !== ci.commit ||
        String(value.runId) !== String(ci.runId) ||
        String(value.runAttempt) !== String(ci.runAttempt)
      )
        return null;
      return value;
    } catch {
      return null;
    }
  };
  const { markdown, result } = render({
    ci,
    scope: read('authenticated.openapi.json'),
    zap: read('authenticated.json'),
    before: read('http-before.json'),
    after: read('http-after.json'),
    scanExitCode: exitCode(process.env.ZAP_EXIT_CODE),
    outcomes: {
      before: process.env.HTTP_BEFORE_OUTCOME,
      after: process.env.HTTP_AFTER_OUTCOME,
      zap: process.env.ZAP_STEP_OUTCOME,
    },
  });
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, 'summary.md'), markdown);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown);
  console.log(`DAST report: ${result}. See summary.md and JSON evidence.`);
  return result === 'PASSED' ? 0 : 1;
}

if (require.main === module) process.exitCode = main();
module.exports = { render, main };
