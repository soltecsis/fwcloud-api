import { PolicyTypesMap } from '../policy/PolicyType';
import {
  asReplicationProfileRecord,
  isReplicationProfileIpVersion,
  isReplicationProfileRuleOptions,
  isReplicationProfileStringValue,
  type ReplicationProfileIpVersion,
} from './replication-profile.constants';

/** The filter policies FWCloud ends with a catch-all rule (PolicyRule.checkCatchAllRules). */
const CHAINS = ['input', 'output', 'forward'] as const;
export type ProfileCatchAllChain = (typeof CHAINS)[number];

/** The policy_r.action of each action a catch-all rule can have (see routes/policy/rule.js). */
const ACTION_CODES = { accept: 1, deny: 2, reject: 3 } as const;
export type ProfileCatchAllAction = keyof typeof ACTION_CODES;
const ACTIONS = Object.keys(ACTION_CODES) as ProfileCatchAllAction[];

/**
 * A catch-all rule of a template: the settings the destination's own catch-all rule of the same
 * policy takes. `catchAllRules` sits next to `rules` in `provision` and `policyStructure`.
 */
export interface ProfileCatchAllRule {
  chain: ProfileCatchAllChain;
  ipVersion: ReplicationProfileIpVersion;
  /** Required: a template never leaves the action of a policy to the destination's default. */
  action: ProfileCatchAllAction;
  /** Native policy_r.active. Omitted, the destination keeps its own. */
  active?: boolean;
  /** Native policy_r.options bitmask (LOG, STATELESS). Omitted, the destination keeps its own. */
  options?: number;
  /** Omitted, the destination keeps its own. */
  comment?: string;
}

const FIELDS: readonly string[] = ['chain', 'ipVersion', 'action', 'active', 'options', 'comment'];

export function getProfileCatchAllAction(code: number): ProfileCatchAllAction | undefined {
  return ACTIONS.find((action) => ACTION_CODES[action] === Number(code));
}

export function getProfileCatchAllActionCode(action: ProfileCatchAllAction): number {
  return ACTION_CODES[action];
}

export function getProfileCatchAllPolicyTypeId(
  rule: Pick<ProfileCatchAllRule, 'chain' | 'ipVersion'>,
): number {
  return PolicyTypesMap.get(`IPv${rule.ipVersion}:${rule.chain.toUpperCase()}`)!;
}

/** "OUTPUT IPv4", the policy label used by FWCloud and by policy capture errors. */
export function profileCatchAllLabel(rule: Pick<ProfileCatchAllRule, 'chain' | 'ipVersion'>) {
  return `${rule.chain.toUpperCase()} IPv${rule.ipVersion}`;
}

/** Read every entry as-is, malformed ones included, so validation reports them instead. */
export function readProfileCatchAllRules(value: unknown): ProfileCatchAllRule[] {
  return Array.isArray(value)
    ? value.map((entry) => {
        const record = asReplicationProfileRecord(entry);
        return (record ? { ...record } : entry) as ProfileCatchAllRule;
      })
    : [];
}

export interface ProfileCatchAllRuleError {
  index: number;
  /** The field at fault; none when it is the entry itself. */
  field?: string;
  message: string;
}

/**
 * Checks the catch-all rules of one structure before they are saved or applied: one per policy,
 * with an action every policy compiler supports. A catch-all rule matches whatever reaches the end
 * of its policy, so a field it cannot have is rejected instead of being left out.
 */
export function getProfileCatchAllRuleErrors(rules: unknown[]): ProfileCatchAllRuleError[] {
  const errors: ProfileCatchAllRuleError[] = [];
  const seen = new Set<string>();

  rules.forEach((value, index) => {
    const error = (message: string, field?: string) => errors.push({ index, field, message });
    const rule = asReplicationProfileRecord(value);
    if (!rule) {
      error('Catch-all rule entries must be objects.');
      return;
    }

    const { chain, ipVersion } = rule;
    const validChain = isReplicationProfileStringValue(chain, CHAINS);
    const validIpVersion = isReplicationProfileIpVersion(ipVersion);
    if (!validChain) {
      error(
        `Catch-all rule chain must be one of: ${CHAINS.join(', ')}; NAT policies have no catch-all rule.`,
        'chain',
      );
    }
    if (!validIpVersion) {
      error('Catch-all rule ipVersion must be 4 or 6.', 'ipVersion');
    }
    if (validChain && validIpVersion) {
      const label = profileCatchAllLabel({ chain, ipVersion });
      if (seen.has(label)) {
        error(`Policy ${label} can only have one catch-all rule.`);
      }
      seen.add(label);
    }

    if (rule.action === undefined) {
      error(
        'Catch-all rule action is required: it is never taken as ACCEPT or DENY by default.',
        'action',
      );
    } else if (!isReplicationProfileStringValue(rule.action, ACTIONS)) {
      error(
        `Catch-all rule action ${JSON.stringify(rule.action)} is not supported; use one of: ${ACTIONS.join(', ')}.`,
        'action',
      );
    }
    if (rule.active !== undefined && typeof rule.active !== 'boolean') {
      error('Catch-all rule active must be a boolean.', 'active');
    }
    if (rule.options !== undefined && !isReplicationProfileRuleOptions(rule.options)) {
      error('Catch-all rule options must be an integer between 0 and 65535.', 'options');
    }
    if (rule.comment !== undefined && typeof rule.comment !== 'string') {
      error('Catch-all rule comment must be a string.', 'comment');
    }
    for (const field of Object.keys(rule).filter((key) => !FIELDS.includes(key))) {
      error(
        `Catch-all rules cannot have ${field}: they match all the traffic that reaches the end of their policy.`,
        field,
      );
    }
  });

  return errors;
}
