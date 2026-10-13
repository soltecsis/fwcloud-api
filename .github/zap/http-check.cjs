const fs = require('node:fs');
const { requireLab, privateFile } = require('./environment.cjs');
const { base, queries, tableUrl, openapi } = require('./scope.cjs');
const checks = [];
function verify(condition, name) {
  checks.push({ name, passed: Boolean(condition) });
  if (!condition) throw new Error(name);
}
async function call(method, path, session, body, token) {
  const response = await fetch(base + path, { method, redirect: 'error', signal: AbortSignal.timeout(10000),
    headers: { Origin: 'https://zap.invalid', 'Content-Type': 'application/json',
      ...(session ? { Cookie: session.cookie } : {}), ...(token ? { 'x-fwc-confirm-token': token } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}) });
  const text = await response.text();
  if (response.headers.get('x-content-type-options') !== 'nosniff') verify(false, 'API responses prevent content sniffing');
  return { status: response.status, body: text ? JSON.parse(text) : null, headers: response.headers };
}
async function login(account, authCode = null) {
  const response = await call('POST', '/user/login', null,
    { customer: account.customer, username: account.username, password: account.password,
      publicKey: 'synthetic-client-public-key', authCode });
  return { ...response, cookie: response.headers.getSetCookie()
    .find(value => value.startsWith('FWCloud.net-cookie='))?.split(';')[0] };
}
async function protectedQueries(session, r, phase) {
  for (const q of queries(r)) {
    const response = await call(q.method, q.name === 'audit-list' && phase === 'after' ? `${q.path}?limit=0` : q.path, session, q.body);
    const data = response.body?.data ?? response.body;
    let content = false;
    switch (q.name) {
      case 'cloud-list': content = Array.isArray(data) && data.length === 1 && data[0].id === r.cloud; break;
      case 'table-list': content = Array.isArray(data) && data.length === 1 && data[0].id === r.table; break;
      case 'audit-list': content = data.auditLogs.some(row => row.id === r.audit) &&
        data.auditLogs.every(row => row.userId === session.id); break;
      case 'audit': content = data.auditLog.id === r.audit && data.auditLog.userId === session.id; break;
      default: content = data.id === r[{ cloud: 'cloud', firewall: 'firewall', address: 'ipobj',
        policy: 'rule', table: 'table', route: 'route' }[q.name]];
    }
    verify(response.status === 200 && content, `${phase}/${q.name}: protected content`);
  }
}
async function run() {
  requireLab();
  fs.mkdirSync('reports/dast', { recursive: true });
  const phase = process.argv[2];
  if (!['before', 'after'].includes(phase)) throw new Error('Invalid HTTP verification phase');
  const f = JSON.parse(fs.readFileSync(privateFile('fixture'), 'utf8'));
  const { accounts: users, resources: r } = f;
  const db = await require('mysql2/promise').createConnection({ host: process.env.TYPEORM_HOST,
    port: Number(process.env.TYPEORM_PORT), database: process.env.TYPEORM_DATABASE,
    user: process.env.TYPEORM_USERNAME, password: process.env.TYPEORM_PASSWORD });
  const comment = async id => (await db.execute('SELECT comment FROM routing_table WHERE id=?', [id]))[0][0].comment;
  try {
    if (phase === 'after') {
      const sessions = JSON.parse(fs.readFileSync(privateFile('sessions'), 'utf8'));
      for (const name of ['a', 'b']) await protectedQueries(sessions[name], r[name], 'after');
      verify(await comment(r.a.table) === 'authorized CI comment' && await comment(r.b.table) === 'original',
        'after/scan preserved business state');
      for (const name of ['admin', 'a', 'b']) {
        // Invalid scan probes can rotate confirmation tokens. Use the persisted
        // current token without handing it to ZAP or weakening the token gate.
        const [rows] = await db.execute('SELECT confirmation_token FROM user WHERE id=?', [users[name].id]);
        const response = await call('POST', '/user/logout', sessions[name], null, rows[0].confirmation_token);
        verify(response.status === 204, `after/${name}: logout`);
        const rejected = await call('GET', tableUrl(r.a), sessions[name]);
        verify(rejected.status === 400 && rejected.body.fwcErr === 1010, `after/${name}: old cookie rejected`);
      }
      fs.unlinkSync(privateFile('sessions'));
      return;
    }
    const anonymous = await call('GET', tableUrl(r.a));
    verify(anonymous.status === 400 && anonymous.body.fwcErr === 1010, 'anonymous protected access rejected');
    for (const code of [null, 'invalid-code']) {
      const response = await login(users.mfa, code);
      verify(response.status === 401 && response.body.fwcErr === 1001, 'activated 2FA rejects absent/incorrect code');
      const protectedResponse = await call('GET', '/config', { cookie: response.cookie || '' });
      verify(protectedResponse.status === 400, 'failed 2FA leaves no protected session');
    }
    const mfa = await login(users.mfa, require('speakeasy').totp({ secret: users.mfa.secret, encoding: 'base32' }));
    verify(mfa.status === 200 && mfa.body.user === users.mfa.id && !JSON.stringify(mfa.body).includes(users.mfa.secret),
      'activated 2FA accepts valid code without disclosing secret');
    verify((await call('GET', '/config', mfa)).status === 200, 'valid 2FA grants protected access');
    verify((await call('POST', '/user/logout', mfa, null, users.mfa.token)).status === 204, '2FA session logout');
    const sessions = {};
    for (const name of ['admin', 'a', 'b']) {
      const response = await login(users[name]);
      verify(response.status === 200 && response.body.user === users[name].id && response.body.role === users[name].role &&
        Boolean(response.cookie), `${name}: optional 2FA login identity and cookie`);
      sessions[name] = { cookie: response.cookie, id: users[name].id };
      verify((await call('PUT', '/ping', sessions[name])).status === 200, `${name}: session keepalive`);
    }
    for (const q of [{ method: 'GET', path: '/backups', deniedStatus: 401 }, { method: 'PUT', path: '/user/get', deniedStatus: 400,
      body: { customer: users.b.customer, user: users.b.id } }]) {
      verify((await call(q.method, q.path, sessions.admin, q.body)).status === 200, 'admin allowed administrative read');
      const denial = await call(q.method, q.path, sessions.a, q.body);
      verify(denial.status === q.deniedStatus && (q.deniedStatus !== 400 || denial.body.fwcErr === 1008),
        `manager denied administrative read ${q.path}`);
    }
    for (const name of ['a', 'b']) {
      const other = name === 'a' ? 'b' : 'a';
      verify((await call('GET', tableUrl(r[name]), sessions[name])).status === 200, `${name}: own table exists`);
      verify((await call('GET', tableUrl(r[other]), sessions[name])).status === 401, `${name}: existing foreign table denied`);
      const denial = await call('PUT', '/firewall/get', sessions[name], { fwcloud: r[other].cloud, firewall: r[other].firewall });
      verify(denial.status === 400 && denial.body.fwcErr === 7000, `${name}: foreign legacy cloud denied`);
    }
    const substituted = `/fwclouds/${r.a.cloud}/firewalls/${r.a.firewall}/routingTables/${r.b.table}`;
    verify((await call('GET', substituted, sessions.a)).status === 404, 'foreign child under own parent rejected');
    for (const token of [undefined, 'invalid-token']) {
      const response = await call('PUT', tableUrl(r.a), sessions.a, { comment: 'forbidden' }, token);
      verify(response.status === 403 && typeof response.body.fwc_confirm_token === 'string', 'invalid confirmation token rejected');
      users.a.token = response.body.fwc_confirm_token;
      verify(await comment(r.a.table) === 'original', 'invalid token leaves persisted comment intact');
    }
    verify((await call('PUT', tableUrl(r.b), sessions.a, { comment: 'forbidden' }, users.a.token)).status === 401,
      'valid token cannot authorize foreign write');
    verify(await comment(r.b.table) === 'original', 'foreign persisted comment intact');
    verify((await call('PUT', tableUrl(r.a), sessions.a, { comment: 'authorized CI comment' }, users.a.token)).status === 200,
      'authorized synthetic write accepted');
    verify(await comment(r.a.table) === 'authorized CI comment', 'authorized write persisted');
    verify((await call('PUT', tableUrl(r.b), sessions.b, { comment: 'original' }, users.b.token)).status === 200,
      'manager B can write its own unchanged synthetic comment');
    // Audit completion is asynchronous. Read the real HTTP-generated entries, not seeded evidence.
    for (let attempt = 0; attempt < 50; attempt++) {
      const [rows] = await db.execute('SELECT id, user_id, ts, `call`, status, fwcloud_id, firewall_id FROM audit_logs WHERE user_id IN (?,?)',
        [users.a.id, users.b.id]);
      const write = rows.find(row => row.user_id === users.a.id && row.call === `PUT ${tableUrl(r.a)}` && row.status === 200);
      const denial = rows.find(row => row.user_id === users.a.id && row.call === `PUT ${tableUrl(r.b)}` && row.status === 401);
      const ownB = rows.find(row => row.user_id === users.b.id && row.call === `PUT ${tableUrl(r.b)}` && row.status === 200);
      if (write && denial && ownB) {
        verify(Boolean(write.ts) && write.fwcloud_id === r.a.cloud && write.firewall_id === r.a.firewall,
          'real audit contains identity, timestamp, resource, event and outcome');
        r.a.audit = write.id; r.b.audit = ownB.id;
        break;
      }
      if (attempt === 49) verify(false, 'real audit records successful and denied writes');
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    for (const name of ['a', 'b']) {
      await protectedQueries(sessions[name], r[name], 'before');
      const foreign = await call('GET', `/auditlogs/${r[name === 'a' ? 'b' : 'a'].audit}`, sessions[name]);
      verify(foreign.status === 404, `${name}: existing foreign audit denied`);
    }
    const details = await call('GET', `/auditlogs/${r.a.audit}`, sessions.admin);
    const serialized = JSON.stringify(details.body);
    verify(details.status === 200 && !Object.values(sessions).some(s => serialized.includes(s.cookie)) &&
      !Object.values(users).some(u => serialized.includes(u.password) || serialized.includes(u.token)), 'audit detail protects credentials');
    fs.writeFileSync(privateFile('fixture'), JSON.stringify(f), { mode: 0o600 });
    fs.writeFileSync(privateFile('sessions'), JSON.stringify(sessions), { mode: 0o600 });
    fs.writeFileSync('reports/dast/authenticated.openapi.json', JSON.stringify(openapi(r.a), null, 2));
    if (process.env.GITHUB_ENV) {
      console.log(`::add-mask::${sessions.a.cookie}`);
      fs.appendFileSync(process.env.GITHUB_ENV, `ZAP_AUTH_HEADER_VALUE=${sessions.a.cookie}\n`);
    }
  } finally {
    await db.end();
  }
}
run().catch(() => { checks.push({ name: 'HTTP verification completed', passed: false });
  console.error('HTTP security verification failed; see the named aggregate checks.'); process.exitCode = 1; })
  .finally(() => {
    const output = { phase: process.argv[2], commit: process.env.GITHUB_SHA || null,
      runId: process.env.GITHUB_RUN_ID || null, generatedAt: new Date().toISOString(), checks };
    fs.mkdirSync('reports/dast', { recursive: true });
    fs.writeFileSync(`reports/dast/http-${process.argv[2]}.json`, JSON.stringify(output, null, 2));
    console.log(`HTTP checks: ${checks.filter(c => c.passed).length}/${checks.length} passed.`);
  });
