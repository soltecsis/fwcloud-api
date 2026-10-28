import type { HAProxyRule } from '../system/haproxy/haproxy_r/haproxy_r.model';
import {
  PROFILE_SYSTEM_RULE_SETTINGS_FIELDS,
  profileSystemRuleErrors,
  readProfileSystemRuleSettings,
} from './replication-profile-system-rule';

/** Native settings; missing rule_type denotes the existing structured template format. */
export type ProfileHAProxySettings = Partial<
  Pick<HAProxyRule, (typeof PROFILE_SYSTEM_RULE_SETTINGS_FIELDS)[number]>
>;

export function readProfileHAProxySettings(entry: object): ProfileHAProxySettings {
  return readProfileSystemRuleSettings(entry);
}

export function profileHAProxyErrors(entry: ProfileHAProxySettings): string[] {
  return profileSystemRuleErrors(entry, 'HAProxy');
}
