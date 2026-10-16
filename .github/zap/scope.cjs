const base = 'http://127.0.0.1:3131';
const tableUrl = (r) => `/fwclouds/${r.cloud}/firewalls/${r.firewall}/routingTables/${r.table}`;

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
    { name: 'table-list', method: 'GET', path: tableUrl(r).replace(/\/\d+$/, '') },
    { name: 'table', method: 'GET', path: tableUrl(r) },
    { name: 'route', method: 'GET', path: `${tableUrl(r)}/routes/${r.route}` },
    { name: 'audit-list', method: 'GET', path: '/auditlogs' },
    { name: 'audit', method: 'GET', path: `/auditlogs/${r.audit}` },
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
module.exports = { base, queries, tableUrl, openapi };
