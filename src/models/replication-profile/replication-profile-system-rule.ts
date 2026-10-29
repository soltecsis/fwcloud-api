/** Native fields shared by HAProxy and Keepalived profile entries. */
export const PROFILE_SYSTEM_RULE_SETTINGS_FIELDS = [
  'rule_type',
  'cfg_text',
  'active',
  'style',
] as const;

interface ProfileSystemRuleSettings {
  rule_type?: number;
  cfg_text?: string;
  active?: boolean;
  style?: string;
}

/** Retain own fields verbatim, including explicit undefined and malformed values for validation. */
export function readProfileSystemRuleSettings(entry: object): ProfileSystemRuleSettings {
  const settings: Record<string, unknown> = {};
  for (const field of PROFILE_SYSTEM_RULE_SETTINGS_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(entry, field)) settings[field] = entry[field];
  }
  return settings;
}

/** Validate native storage representation without parsing or rewriting directives. */
export function profileSystemRuleErrors(
  entry: ProfileSystemRuleSettings,
  service: 'HAProxy' | 'Keepalived',
): string[] {
  const errors: string[] = [];
  if (entry.rule_type !== undefined && entry.rule_type !== 1 && entry.rule_type !== 2) {
    errors.push(`unsupported ${service} rule_type ${JSON.stringify(entry.rule_type)}.`);
  }
  if (entry.active !== undefined && typeof entry.active !== 'boolean') {
    errors.push('active must be a boolean.');
  }
  if (entry.style !== undefined && (typeof entry.style !== 'string' || entry.style.length > 50)) {
    errors.push('style must be a string of at most 50 characters.');
  }
  if (entry.rule_type === 2) {
    if (typeof entry.cfg_text !== 'string' || !entry.cfg_text.trim()) {
      errors.push(`manual ${service} configuration requires non-empty cfg_text.`);
    } else if (entry.cfg_text.includes('\0')) {
      errors.push(`manual ${service} cfg_text must not contain NUL characters.`);
    } else if (Buffer.byteLength(entry.cfg_text, 'utf8') > 65535) {
      errors.push(
        `manual ${service} cfg_text exceeds the native TEXT storage limit of 65535 bytes.`,
      );
    }
  } else if (entry.cfg_text !== undefined) {
    errors.push(`cfg_text requires explicit manual ${service} rule_type 2.`);
  }
  return errors;
}
