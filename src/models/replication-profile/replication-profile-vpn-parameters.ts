/** Shared with the UI: keep VPN identities and request their deployment settings. */
export function normalizeProfileVpnRuleParameters<T>(model: T): T {
  type RecordValue = Record<string, any>;
  const record = (v: unknown): v is RecordValue =>
    !!v && typeof v === 'object' && !Array.isArray(v);
  const source = model as unknown;
  if (
    !record(source) ||
    !record(source.vpnTemplate) ||
    !Array.isArray(source.vpnTemplate.connections)
  )
    return model;
  const normalized: RecordValue = JSON.parse(JSON.stringify(model));
  const connections: RecordValue[] = normalized.vpnTemplate.connections.filter(record);
  const parameters: RecordValue[] = (normalized.parameters ?? normalized.params ?? []).filter(
    record,
  );
  const parameterNames = new Set(parameters.map((parameter) => parameter.name));
  const obsolete = new Set<string>();
  const clients = connections.filter((c) => c.role === 'client');
  const referenced = new Set<string>();
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (!record(value)) return;
    const kind = value.kind ?? value.type;
    const reference = record(value.value) ? value.value.param : value.value;
    const client = ['vpnClient', 'network'].includes(kind)
      ? typeof value.vpnId === 'string' && value.vpnId
        ? clients.find((c) => c.id === value.vpnId)
        : (clients.find((c) => typeof c.id === 'string' && c.id === reference) ??
          clients.find(
            (c) => typeof c.name === 'string' && (c.name === reference || c.name === value.name),
          ))
      : undefined;
    if (client) {
      referenced.add(client.id);
      if (record(value.value) && typeof value.value.param === 'string')
        obsolete.add(value.value.param);
      delete value.value;
      value.kind = 'vpnClient';
      value.type = 'vpnClient';
      value.vpnId = client.id;
      value.name = client.name;
      return;
    }
    Object.values(value).forEach(visit);
  };
  for (const field of [
    'provision',
    'policyStructure',
    'policy_structure',
    'templateStructure',
    'template_structure',
  ])
    visit(normalized[field]);
  const runtime: RecordValue = record(normalized.vpnRuntime) ? normalized.vpnRuntime : {};
  // Only VPN connections a rule actually references (or that referenced client's own server, whose
  // endpoint the client's config needs) get asked for at apply time — an unused connection in the
  // template shouldn't turn into a required parameter nobody will ever supply a value for.
  const referencedServerIds = new Set(
    connections
      .filter((connection) => referenced.has(connection.id))
      .map((connection) => connection.serverId),
  );
  const serverIdsWithConnections = new Set(connections.map((connection) => connection.serverId));
  const needed = connections.filter(
    (connection) =>
      referenced.has(connection.id) ||
      (connection.role === 'server' && referencedServerIds.has(connection.id)),
  );
  for (const connection of needed) {
    const fields: RecordValue = record(runtime[connection.id]) ? runtime[connection.id] : {};
    const requirements: Array<[string, string, string]> = [];
    if (connection.kind === 'ipsec' && connection.role === 'server') {
      requirements.push(['localNetwork', 'network', 'LAN (CIDR)']);
    } else {
      requirements.push([
        'network',
        connection.kind === 'openvpn' && connection.role === 'server' ? 'network' : 'address',
        'IP/CIDR',
      ]);
    }
    if (connection.role === 'server' && serverIdsWithConnections.has(connection.id)) {
      requirements.push(['endpoint', 'text', 'Endpoint']);
    }
    if (connection.kind === 'wireguard' && connection.role === 'client') {
      requirements.push(['remoteNetwork', 'network', 'AllowedIPs (CIDR)']);
    }
    for (const [field, type, label] of requirements) {
      const previous = fields[field]?.param;
      let name =
        typeof previous === 'string' && parameterNames.has(previous) ? previous : undefined;
      if (!name) {
        const base = `vpn_${String(connection.id)
          .replace(/[^A-Za-z0-9_]/g, '_')
          .slice(0, 36)}_${field}`;
        name = base;
        for (let suffix = 2; parameterNames.has(name); suffix++) name = `${base}_${suffix}`;
        const parameter: RecordValue = {
          name,
          type,
          required: true,
          label: `${String(connection.kind).toUpperCase()} · ${connection.name} · ${label}`,
          ...(type !== 'text' ? { ipVersion: 4 } : {}),
          ...(connection[field] ? { default: connection[field] } : {}),
        };
        parameters.push(parameter);
        parameterNames.add(name);
      }
      fields[field] = { param: name };
    }
    runtime[connection.id] = fields;
  }
  normalized.vpnRuntime = runtime;
  if (obsolete.size === 0) {
    normalized.parameters = parameters;
    return normalized as T;
  }
  // Remove the network substitutions produced by older versions only if no real object still uses them.
  const used = new Set<string>();
  const collect = (v: unknown): void => {
    if (Array.isArray(v)) {
      v.forEach(collect);
      return;
    }
    if (!record(v)) return;
    if (typeof v.param === 'string') used.add(v.param);
    Object.values(v).forEach(collect);
  };
  Object.entries(normalized)
    .filter(([k]) => k !== 'parameters' && k !== 'params')
    .forEach(([, v]) => collect(v));
  normalized.parameters = parameters.filter((p) => !obsolete.has(p.name) || used.has(p.name));
  return normalized as T;
}
