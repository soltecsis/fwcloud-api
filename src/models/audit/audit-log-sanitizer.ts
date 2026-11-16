const AUDIT_SENSITIVE_KEY_PATTERNS = [
  'password',
  'passcode',
  'passwd',
  'secret',
  'token',
  'apikey',
  'api_key',
  'accesskey',
  'access_key',
  'auth',
  'credential',
  'otp',
  'cookie',
  'tfa',
  '2fa',
  'passphrase',
  'privatekey',
  'private_key',
] as const;

export function isSensitiveAuditKey(key: string | null | undefined): boolean {
  if (!key) return false;
  const normalized = key.toLowerCase();
  return AUDIT_SENSITIVE_KEY_PATTERNS.some((pattern) => normalized.includes(pattern));
}

export function sanitizeAuditData(
  input: any,
  seen: WeakSet<object> = new WeakSet(),
  isSensitiveKey: (key: string) => boolean = isSensitiveAuditKey,
  sanitizeChild?: (value: any) => any,
): any {
  if (input === null || input === undefined) return input ?? null;
  if (typeof input === 'string' || typeof input === 'number' || typeof input === 'boolean') {
    return input;
  }
  if (input instanceof Date) return input.toISOString();
  if (Buffer.isBuffer(input)) return `[buffer:${input.length}]`;
  const sanitize =
    sanitizeChild ?? ((value: any) => sanitizeAuditData(value, seen, isSensitiveKey));
  if (Array.isArray(input)) {
    return input.map((item) => sanitize(item));
  }
  if (typeof input === 'object') {
    if (seen.has(input)) return '[circular]';
    seen.add(input);

    const output: Record<string, any> = {};
    for (const key of Object.keys(input)) {
      const value = input[key];
      if (isSensitiveKey(key)) {
        output[key] = '[REDACTED]';
        continue;
      }
      try {
        output[key] = sanitize(value);
      } catch (error) {
        output[key] = `[unserializable:${error?.message ?? 'error'}]`;
      }
    }
    return output;
  }
  return String(input);
}

export function maskSensitiveAuditText(value: string): string {
  return AUDIT_SENSITIVE_KEY_PATTERNS.reduce<string>((current, pattern) => {
    const escapedPattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const quotedKeyPattern = new RegExp(
      `("[^"]*${escapedPattern}[^"]*"\\s*:\\s*)("[^"]*"|[^,}\\]]+)`,
      'gi',
    );
    const bareKeyPattern = new RegExp(
      `([^\\s,}\\]]*${escapedPattern}[^\\s,}\\]]*\\s*[=:]\\s*)("[^"]*"|'[^']*'|[^\\s,}\\]]+)`,
      'gi',
    );

    return current
      .replace(quotedKeyPattern, '$1"[REDACTED]"')
      .replace(bareKeyPattern, '$1[REDACTED]');
  }, value);
}
