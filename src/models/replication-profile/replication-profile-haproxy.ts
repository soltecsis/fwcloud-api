import type { HAProxyRule } from '../system/haproxy/haproxy_r/haproxy_r.model';

const HAPROXY_SETTINGS_FIELDS = ['rule_type', 'cfg_text', 'active', 'style'] as const;

/** Native HAProxy fields; missing rule_type is the legacy structured template format. */
export type ProfileHAProxySettings = Partial<
  Pick<HAProxyRule, (typeof HAPROXY_SETTINGS_FIELDS)[number]>
>;

/** Preserve own fields verbatim, including explicit undefined and invalid values for validation. */
export function readProfileHAProxySettings(entry: object): ProfileHAProxySettings {
  const settings: Record<string, unknown> = {};
  for (const field of HAPROXY_SETTINGS_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(entry, field)) settings[field] = entry[field];
  }
  return settings;
}

/** Check the representation without parsing or rewriting the user's HAProxy directives. */
export function profileHAProxyErrors(entry: ProfileHAProxySettings): string[] {
  const errors: string[] = [];
  if (entry.rule_type !== undefined && entry.rule_type !== 1 && entry.rule_type !== 2) {
    errors.push(`unsupported HAProxy rule_type ${JSON.stringify(entry.rule_type)}.`);
  }
  if (entry.active !== undefined && typeof entry.active !== 'boolean') {
    errors.push('active must be a boolean.');
  }
  if (entry.style !== undefined && (typeof entry.style !== 'string' || entry.style.length > 50)) {
    errors.push('style must be a string of at most 50 characters.');
  }
  if (entry.rule_type === 2) {
    if (typeof entry.cfg_text !== 'string' || !entry.cfg_text.trim()) {
      errors.push('manual HAProxy configuration requires non-empty cfg_text.');
    } else if (entry.cfg_text.includes('\0')) {
      errors.push('manual HAProxy cfg_text must not contain NUL characters.');
    } else if (Buffer.byteLength(entry.cfg_text, 'utf8') > 65535) {
      errors.push('manual HAProxy cfg_text exceeds the native TEXT storage limit of 65535 bytes.');
    }
  } else if (entry.cfg_text !== undefined) {
    errors.push('cfg_text requires explicit manual HAProxy rule_type 2.');
  }
  return errors;
}
