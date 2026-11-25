export enum AuditEventType {
  Compilation = 'compilation',
  Installation = 'installation',
  Creation = 'creation',
  Modification = 'modification',
  Deletion = 'deletion',
  Login = 'login',
  Logout = 'logout',
  Other = 'other',
}

export type AuditOutcome = 'success' | 'failure';

// Legacy collection routes create records but commonly return 200 or 204 rather than 201.
const LEGACY_CREATION_PATHS = new Set([
  '/user',
  '/customer',
  '/cluster',
  '/firewall',
  '/interface',
  '/ipobj',
  '/ipobj/group',
  '/ipobj/mark',
  '/tree/folder',
  '/vpn/pki/ca',
  '/vpn/pki/crt',
  '/vpn/pki/prefix',
  '/vpn/openvpn',
  '/vpn/openvpn/prefix',
  '/policy/rule',
  '/policy/ipobj',
  '/policy/interface',
  '/policy/group',
  '/policy/openvpn',
  '/policy/prefix',
  '/policy/wireguard',
  '/policy/ipsec',
]);

export function normalizeAuditPath(path: string): string {
  const queryStart = path.indexOf('?');
  let end = queryStart === -1 ? path.length : queryStart;
  while (end > 0 && path[end - 1] === '/') end--;
  return path.slice(0, end).toLowerCase();
}

// Only route/operation metadata belongs here; never inspect descriptions or request bodies.
export function classifyAuditEvent(
  method: string,
  path: string,
  action?: string | null,
  status?: number | null,
): AuditEventType {
  const httpMethod = method.toUpperCase();
  const normalizedPath = normalizeAuditPath(path);
  if (httpMethod === 'POST') {
    if (['/user/login', '/login'].includes(normalizedPath)) return AuditEventType.Login;
    if (['/user/logout', '/logout'].includes(normalizedPath)) return AuditEventType.Logout;
  }

  const operations = (action || normalizedPath.split('/').pop() || '').toLowerCase();
  if (/^\/policy\/compile(?:\/|$)/.test(normalizedPath) || operations === 'compile') {
    return AuditEventType.Compilation;
  }
  if (
    /^\/policy\/install(?:\/|$)/.test(normalizedPath) ||
    operations === 'install' ||
    operations === 'installclusterpolicy'
  ) {
    return AuditEventType.Installation;
  }
  if (
    httpMethod === 'DELETE' ||
    /^(del|delete|destroy|remove|bulkremove|delfromcluster|deleteconfig|deletesetup)$/.test(
      operations,
    )
  ) {
    return AuditEventType.Deletion;
  }
  if (/^(add|create|store|clone|copy)$/.test(operations)) return AuditEventType.Creation;
  if (httpMethod === 'POST' && LEGACY_CREATION_PATHS.has(normalizedPath)) {
    return AuditEventType.Creation;
  }
  if (
    /^(update|bulkupdate|patch|save|set|rename|move|movefrom|replace|assign|unassign|attach|detach|enable|disable|lock|unlock|sync|ccdsync|updateconfig)$/.test(
      operations,
    )
  ) {
    return AuditEventType.Modification;
  }
  if (httpMethod === 'PUT' || httpMethod === 'PATCH') return AuditEventType.Modification;
  if (httpMethod === 'POST' && status === 201) return AuditEventType.Creation;
  return AuditEventType.Other;
}

export function isAuthenticationEvent(type: AuditEventType | null | undefined): boolean {
  return type === AuditEventType.Login || type === AuditEventType.Logout;
}

export function parseAuditEventTypes(value: unknown): unknown {
  if (typeof value !== 'string' && !Array.isArray(value)) return value;
  const items: unknown[] = Array.isArray(value) ? value : [value];
  return items.flatMap((item) =>
    typeof item === 'string' ? item.split(',').map((part) => part.trim()) : [item],
  );
}
