import Joi from 'joi';

/** Native policy_r fields. JSON uses the same date strings as the policy API. */
export interface PolicyRuleValidityPeriod {
  time_start?: string | null;
  time_end?: string | null;
}

export const policyRuleDateSchema = Joi.date().allow(null).allow('').optional();

/** Parse only at the database/compiler boundary; never rewrite dates in template JSON. */
export function parsePolicyRuleDate(value: unknown): Date | null {
  if (value === undefined || value === null || value === '') return null;
  const result = policyRuleDateSchema.validate(value);
  if (result.error) throw result.error;
  return result.value;
}

type PolicyRuleValidityInput = Partial<Record<keyof PolicyRuleValidityPeriod, unknown>>;

/** Parse each boundary once and retain all validation errors in their original order. */
export function readPolicyRuleValidityPeriod(rule: PolicyRuleValidityInput) {
  const errors: { field: keyof PolicyRuleValidityPeriod; message: string }[] = [];
  const dates: Record<keyof PolicyRuleValidityPeriod, Date | null> = {
    time_start: null,
    time_end: null,
  };
  for (const field of ['time_start', 'time_end'] as const) {
    try {
      dates[field] = parsePolicyRuleDate(rule[field]);
    } catch {
      errors.push({ field, message: `Rule ${field} must be a valid policy date.` });
    }
  }
  if (dates.time_start && dates.time_end && dates.time_start > dates.time_end) {
    errors.push({ field: 'time_end', message: 'Rule time_start must not be later than time_end.' });
  }
  return { dates, errors };
}

export function getPolicyRuleValidityErrors(rule: PolicyRuleValidityInput) {
  return readPolicyRuleValidityPeriod(rule).errors;
}

/** Match the policy API's Date JSON representation without changing the represented instant. */
export function policyRuleDateKey(value: unknown): string {
  return parsePolicyRuleDate(value)?.toISOString() ?? '';
}
