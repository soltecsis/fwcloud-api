const base = 'http://127.0.0.1:3131';
const routes = Object.freeze(Object.assign(Object.create(null), require('./routes.json')));
const routePattern = (route) => new RegExp(`^${route.replace(/\{[a-z]+\}/g, '[0-9]+')}$`);
function pathFor(operationId, resources) {
  return routes[operationId].route.replace(/\{([a-z]+)\}/g, (_, key) => {
    if (!Number.isSafeInteger(resources[key]) || resources[key] < 1)
      throw new Error('Invalid synthetic resource identifier');
    return resources[key];
  });
}
const tableUrl = (r) => pathFor('table', r);

function describe(method, path) {
  const pathname = path.split('?')[0];
  const entry = Object.entries(routes).find(
    ([, definition]) =>
      definition.method === method && routePattern(definition.route).test(pathname),
  );
  if (!entry) throw new Error('HTTP request is outside the declared report catalog');
  return { operationId: entry[0], ...entry[1] };
}

function queries(r) {
  return [
    { name: 'cloud-list', method: 'GET', path: '/fwcloud/all/get' },
    { name: 'cloud', method: 'PUT', path: '/fwcloud/get', body: { fwcloud: r.cloud } },
    {
      name: 'firewall',
      method: 'PUT',
      path: '/firewall/get',
      body: { fwcloud: r.cloud, firewall: r.firewall },
    },
    { name: 'address', method: 'PUT', path: '/ipobj/get', body: { fwcloud: r.cloud, id: r.ipobj } },
    {
      name: 'policy',
      method: 'PUT',
      path: '/policy/rule/get',
      body: { fwcloud: r.cloud, firewall: r.firewall, type: 1, rule: r.rule },
    },
    { name: 'table-list', method: 'GET', path: pathFor('table-list', r) },
    { name: 'table', method: 'GET', path: tableUrl(r) },
    { name: 'route', method: 'GET', path: pathFor('route', r) },
    { name: 'audit-list', method: 'GET', path: '/auditlogs' },
    { name: 'audit', method: 'GET', path: pathFor('audit', r) },
  ];
}

function openapi(r) {
  const paths = {};
  for (const q of queries(r)) {
    const operation = {
      operationId: q.name,
      responses: { 200: { description: 'Authorized synthetic data' } },
    };
    if (q.body)
      operation.requestBody = {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: Object.keys(q.body),
              properties: Object.fromEntries(
                Object.entries(q.body).map(([name, value]) => [
                  name,
                  { type: 'integer', example: value },
                ]),
              ),
            },
            example: q.body,
          },
        },
      };
    paths[q.path] = { [q.method.toLowerCase()]: operation };
  }
  return {
    openapi: '3.0.3',
    info: { title: 'Synthetic manager query scope', version: '1.0.0' },
    servers: [{ url: base }],
    paths,
  };
}
module.exports = { base, routes, queries, tableUrl, openapi, describe };
