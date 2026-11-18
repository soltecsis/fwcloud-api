const fs = require('node:fs');
const { requireLab, privateFile } = require('./environment.cjs');
const { base, queries, tableUrl, openapi, describe } = require('./scope.cjs');
const { context, writeJson } = require('../../scripts/ci-context.cjs');
const ci = context();
const checks = [];
const requests = [];
let completed = false;
function save() {
  const phase = process.argv[2];
  if (['before', 'after'].includes(phase))
    writeJson(`reports/dast/http-${phase}.json`, {
      ...ci,
      phase,
      generatedAt: new Date().toISOString(),
      completed,
      requests,
      checks,
    });
}
function verify(
  condition,
  name,
  expectedStatus = null,
  request = expectedStatus === null ? null : requests.at(-1),
) {
  checks.push({
    name,
    passed: Boolean(condition),
    kind: expectedStatus === null ? 'assertion' : 'http',
    ...(request
      ? {
          requestId: request.id,
          operationId: request.operationId,
          method: request.method,
          route: request.route,
          actor: request.actor,
          actualStatus: request.actualStatus,
        }
      : {}),
    ...(expectedStatus === null ? {} : { expectedStatus }),
  });
  save();
  if (!condition) throw new Error(name);
}
async function call(method, path, session, body, token, actor = session?.actor || 'anonymous') {
  const request = {
    id: requests.length + 1,
    ...describe(method, path),
    actor,
    actualStatus: null,
    outcome: 'pending',
  };
  requests.push(request);
  save();
  try {
    const response = await fetch(base + path, {
      method,
      redirect: 'error',
      signal: AbortSignal.timeout(10000),
      headers: {
        Origin: 'https://zap.invalid',
        'Content-Type': 'application/json',
        ...(session ? { Cookie: session.cookie } : {}),
        ...(token ? { 'x-fwc-confirm-token': token } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    request.actualStatus = response.status;
    const text = await response.text();
    if (response.headers.get('x-content-type-options') !== 'nosniff')
      verify(false, 'API responses prevent content sniffing', null, request);
    const parsed = text ? JSON.parse(text) : null;
    request.outcome = 'observed';
    save();
    return {
      status: response.status,
      body: parsed,
      headers: response.headers,
    };
  } catch {
    request.outcome = 'error';
    verify(false, 'HTTP request completed', null, request);
  }
}
async function login(account, authCode = null) {
  const { securityLoginPayload } = require('../../dist/tests/utils/security-data');
  const response = await call(
    'POST',
    '/user/login',
    null,
    securityLoginPayload(account, authCode),
    undefined,
    account.actor,
  );
  return {
    ...response,
    actor: account.actor,
    cookie: response.headers
      .getSetCookie()
      .find((value) => value.startsWith('FWCloud.net-cookie='))
      ?.split(';')[0],
  };
}
async function protectedQueries(session, r, phase) {
  for (const q of queries(r)) {
    const response = await call(
      q.method,
      q.name === 'audit-list' && phase === 'after' ? `${q.path}?limit=0` : q.path,
      session,
      q.body,
    );
    const data = response.body?.data ?? response.body;
    let content;
    switch (q.name) {
      case 'cloud-list':
        content = Array.isArray(data) && data.length === 1 && data[0].id === r.cloud;
        break;
      case 'table-list':
        content = Array.isArray(data) && data.length === 1 && data[0].id === r.table;
        break;
      case 'audit-list':
        content =
          data.auditLogs.some((row) => row.id === r.audit) &&
          data.auditLogs.every((row) => row.userId === session.id);
        break;
      case 'audit':
        content = data.auditLog.id === r.audit && data.auditLog.userId === session.id;
        break;
      default:
        content =
          data.id ===
          r[
            {
              cloud: 'cloud',
              firewall: 'firewall',
              address: 'ipobj',
              policy: 'rule',
              table: 'table',
              route: 'route',
            }[q.name]
          ];
    }
    verify(response.status === 200 && content, `${phase}/${q.name}: protected content`, 200);
  }
}
async function run() {
  requireLab();
  fs.mkdirSync('reports/dast', { recursive: true });
  const phase = process.argv[2];
  if (!['before', 'after'].includes(phase)) throw new Error('Invalid HTTP verification phase');
  save();
  const f = JSON.parse(fs.readFileSync(privateFile('fixture'), 'utf8'));
  const { accounts: users, resources: r } = f;
  for (const [name, actor] of Object.entries({
    admin: 'admin',
    a: 'manager-a',
    b: 'manager-b',
    mfa: 'mfa-user',
  })) {
    users[name].actor = actor;
  }
  const db = await require('mysql2/promise').createConnection({
    host: process.env.TYPEORM_HOST,
    port: Number(process.env.TYPEORM_PORT),
    database: process.env.TYPEORM_DATABASE,
    user: process.env.TYPEORM_USERNAME,
    password: process.env.TYPEORM_PASSWORD,
  });
  const comment = async (id) =>
    (await db.execute('SELECT comment FROM routing_table WHERE id=?', [id]))[0][0].comment;
  try {
    if (phase === 'after') {
      const sessions = JSON.parse(fs.readFileSync(privateFile('sessions'), 'utf8'));
      for (const name of ['a', 'b']) await protectedQueries(sessions[name], r[name], 'after');
      verify(
        (await comment(r.a.table)) === 'authorized CI comment' &&
          (await comment(r.b.table)) === 'original',
        'after/scan preserved business state',
      );
      for (const name of ['admin', 'a', 'b']) {
        // Invalid scan probes can rotate confirmation tokens. Use the persisted
        // current token without handing it to ZAP or weakening the token gate.
        const [rows] = await db.execute('SELECT confirmation_token FROM user WHERE id=?', [
          users[name].id,
        ]);
        const response = await call(
          'POST',
          '/user/logout',
          sessions[name],
          null,
          rows[0].confirmation_token,
        );
        verify(response.status === 204, `after/${name}: logout`, 204);
        const rejected = await call('GET', tableUrl(r.a), sessions[name]);
        verify(
          rejected.status === 400 && rejected.body.fwcErr === 1010,
          `after/${name}: old cookie rejected`,
          400,
        );
      }
      fs.unlinkSync(privateFile('sessions'));
      return;
    }
    const anonymous = await call('GET', tableUrl(r.a));
    verify(
      anonymous.status === 400 && anonymous.body.fwcErr === 1010,
      'anonymous protected access rejected',
      400,
    );
    for (const code of [null, 'invalid-code']) {
      const response = await login(users.mfa, code);
      verify(
        response.status === 401 && response.body.fwcErr === 1001,
        `activated 2FA rejects ${code === null ? 'absent' : 'incorrect'} code`,
        401,
      );
      const protectedResponse = await call('GET', '/config', {
        cookie: response.cookie || '',
        actor: 'mfa-user',
      });
      verify(protectedResponse.status === 400, 'failed 2FA leaves no protected session', 400);
    }
    const mfa = await login(
      users.mfa,
      require('speakeasy').totp({ secret: users.mfa.secret, encoding: 'base32' }),
    );
    verify(
      mfa.status === 200 &&
        mfa.body.user === users.mfa.id &&
        !JSON.stringify(mfa.body).includes(users.mfa.secret),
      'activated 2FA accepts valid code without disclosing secret',
      200,
    );
    verify(
      (await call('GET', '/config', mfa)).status === 200,
      'valid 2FA grants protected access',
      200,
    );
    verify(
      (await call('POST', '/user/logout', mfa, null, users.mfa.token)).status === 204,
      '2FA session logout',
      204,
    );
    const sessions = {};
    for (const name of ['admin', 'a', 'b']) {
      const response = await login(users[name]);
      verify(
        response.status === 200 &&
          response.body.user === users[name].id &&
          response.body.role === users[name].role &&
          Boolean(response.cookie),
        `${name}: optional 2FA login identity and cookie`,
        200,
      );
      sessions[name] = { cookie: response.cookie, id: users[name].id, actor: users[name].actor };
      verify(
        (await call('PUT', '/ping', sessions[name])).status === 200,
        `${name}: session keepalive`,
        200,
      );
    }
    for (const q of [
      { method: 'GET', path: '/backups', deniedStatus: 401 },
      {
        method: 'PUT',
        path: '/user/get',
        deniedStatus: 400,
        body: { customer: users.b.customer, user: users.b.id },
      },
    ]) {
      verify(
        (await call(q.method, q.path, sessions.admin, q.body)).status === 200,
        'admin allowed administrative read',
        200,
      );
      const denial = await call(q.method, q.path, sessions.a, q.body);
      verify(
        denial.status === q.deniedStatus && (q.deniedStatus !== 400 || denial.body.fwcErr === 1008),
        `manager denied administrative read ${q.path}`,
        q.deniedStatus,
      );
    }
    for (const name of ['a', 'b']) {
      const other = name === 'a' ? 'b' : 'a';
      verify(
        (await call('GET', tableUrl(r[name]), sessions[name])).status === 200,
        `${name}: own table exists`,
        200,
      );
      verify(
        (await call('GET', tableUrl(r[other]), sessions[name])).status === 401,
        `${name}: existing foreign table denied`,
        401,
      );
      const denial = await call('PUT', '/firewall/get', sessions[name], {
        fwcloud: r[other].cloud,
        firewall: r[other].firewall,
      });
      verify(
        denial.status === 400 && denial.body.fwcErr === 7000,
        `${name}: foreign legacy cloud denied`,
        400,
      );
    }
    const substituted = `/fwclouds/${r.a.cloud}/firewalls/${r.a.firewall}/routingTables/${r.b.table}`;
    verify(
      (await call('GET', substituted, sessions.a)).status === 404,
      'foreign child under own parent rejected',
      404,
    );
    for (const token of [undefined, 'invalid-token']) {
      const response = await call(
        'PUT',
        tableUrl(r.a),
        sessions.a,
        { comment: 'forbidden' },
        token,
      );
      verify(
        response.status === 403 && typeof response.body.fwc_confirm_token === 'string',
        `${token === undefined ? 'missing' : 'incorrect'} confirmation token rejected`,
        403,
      );
      users.a.token = response.body.fwc_confirm_token;
      verify(
        (await comment(r.a.table)) === 'original',
        'invalid token leaves persisted comment intact',
      );
    }
    verify(
      (await call('PUT', tableUrl(r.b), sessions.a, { comment: 'forbidden' }, users.a.token))
        .status === 401,
      'valid token cannot authorize foreign write',
      401,
    );
    verify((await comment(r.b.table)) === 'original', 'foreign persisted comment intact');
    verify(
      (
        await call(
          'PUT',
          tableUrl(r.a),
          sessions.a,
          { comment: 'authorized CI comment' },
          users.a.token,
        )
      ).status === 200,
      'authorized synthetic write accepted',
      200,
    );
    verify((await comment(r.a.table)) === 'authorized CI comment', 'authorized write persisted');
    verify(
      (await call('PUT', tableUrl(r.b), sessions.b, { comment: 'original' }, users.b.token))
        .status === 200,
      'manager B can write its own unchanged synthetic comment',
      200,
    );
    // Audit completion is asynchronous. Read the real HTTP-generated entries, not seeded evidence.
    for (let attempt = 0; attempt < 50; attempt++) {
      const [rows] = await db.execute(
        'SELECT id, user_id, session_id, ts, `call`, status, fwcloud_id, firewall_id FROM audit_logs WHERE user_id IN (?,?)',
        [users.a.id, users.b.id],
      );
      const write = rows.find(
        (row) =>
          row.user_id === users.a.id && row.call === `PUT ${tableUrl(r.a)}` && row.status === 200,
      );
      const denial = rows.find(
        (row) =>
          row.user_id === users.a.id && row.call === `PUT ${tableUrl(r.b)}` && row.status === 401,
      );
      const ownB = rows.find(
        (row) =>
          row.user_id === users.b.id && row.call === `PUT ${tableUrl(r.b)}` && row.status === 200,
      );
      if (write && denial && ownB) {
        verify(
          Boolean(write.ts) && write.fwcloud_id === r.a.cloud && write.firewall_id === r.a.firewall,
          'real audit contains identity, timestamp, resource, event and outcome',
        );
        r.a.audit = write.id;
        r.b.audit = ownB.id;
        r.a.auditSessionId = write.session_id;
        break;
      }
      if (attempt === 49) verify(false, 'real audit records successful and denied writes');
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    for (const name of ['a', 'b']) {
      await protectedQueries(sessions[name], r[name], 'before');
      const foreign = await call(
        'GET',
        `/auditlogs/${r[name === 'a' ? 'b' : 'a'].audit}`,
        sessions[name],
      );
      verify(foreign.status === 404, `${name}: existing foreign audit denied`, 404);
    }
    const details = await call('GET', `/auditlogs/${r.a.audit}`, sessions.admin);
    const serialized = JSON.stringify(details.body);
    verify(
      details.status === 200 &&
        !Object.values(sessions).some((s) => serialized.includes(s.cookie)) &&
        !Object.values(users).some(
          (u) => serialized.includes(u.password) || serialized.includes(u.token),
        ),
      'audit detail protects credentials',
      200,
    );
    fs.writeFileSync(privateFile('fixture'), JSON.stringify(f), { mode: 0o600 });
    fs.writeFileSync(privateFile('sessions'), JSON.stringify(sessions), { mode: 0o600 });
    fs.writeFileSync(
      'reports/dast/authenticated.openapi.json',
      JSON.stringify(openapi(r.a), null, 2),
    );
    if (process.env.GITHUB_ENV) {
      console.log(`::add-mask::${sessions.a.cookie}`);
      verify(
        Number.isSafeInteger(r.a.auditSessionId) && r.a.auditSessionId >= 0,
        'audit session identifier is a persisted numeric correlation value',
      );
      fs.appendFileSync(
        process.env.GITHUB_ENV,
        `ZAP_AUTH_HEADER_VALUE=${sessions.a.cookie}\nZAP_AUDIT_SESSION_ID=${r.a.auditSessionId}\n`,
      );
    }
  } finally {
    await db.end();
  }
}
run()
  .then(() => {
    completed = true;
  })
  .catch(() => {
    checks.push({ name: 'HTTP verification completed', passed: false });
    console.error('HTTP security verification failed; see the named aggregate checks.');
    process.exitCode = 1;
  })
  .finally(() => {
    save();
    console.log(`HTTP checks: ${checks.filter((c) => c.passed).length}/${checks.length} passed.`);
  });
