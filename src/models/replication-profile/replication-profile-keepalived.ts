import type { KeepalivedRule } from '../system/keepalived/keepalived_r/keepalived_r.model';
import {
  PROFILE_SYSTEM_RULE_SETTINGS_FIELDS,
  profileSystemRuleErrors,
  readProfileSystemRuleSettings,
} from './replication-profile-system-rule';

/** Native settings; missing rule_type denotes the existing structured template format. */
export type ProfileKeepalivedSettings = Partial<
  Pick<KeepalivedRule, (typeof PROFILE_SYSTEM_RULE_SETTINGS_FIELDS)[number]>
>;

export function readProfileKeepalivedSettings(entry: object): ProfileKeepalivedSettings {
  return readProfileSystemRuleSettings(entry);
}

export function profileKeepalivedErrors(entry: ProfileKeepalivedSettings): string[] {
  return profileSystemRuleErrors(entry, 'Keepalived');
}
