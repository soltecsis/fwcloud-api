import { RulePositionsMap } from '../policy/PolicyPosition';
import type { PolicyReplicationProvisionRule } from './policy-replication.types';

const INVALID_NEGATION =
  'Rule negate must be null or a string of positive position IDs separated by spaces.';

/** The native policy_r.negate representation, canonicalized for rule comparisons. */
export function normalizeRuleNegation(value: unknown): string | null {
  if (value === undefined || value === null || (typeof value === 'string' && !value.trim())) {
    return null;
  }

  if (typeof value !== 'string' || !/^\s*[1-9]\d*(?:\s+[1-9]\d*)*\s*$/.test(value)) {
    throw new Error(INVALID_NEGATION);
  }

  const positions = value.trim().split(/\s+/).map(Number);
  if (positions.some((position) => !Number.isSafeInteger(position))) {
    throw new Error(INVALID_NEGATION);
  }

  return Array.from(new Set(positions))
    .sort((left, right) => left - right)
    .join(' ');
}

/** Checks the same position-wide negation contract for validation, capture and application. */
export function getProvisionRuleNegationError(rule: PolicyReplicationProvisionRule): string | null {
  let normalized: string | null;
  try {
    normalized = normalizeRuleNegation(rule.negate);
  } catch (error) {
    return (error as Error).message;
  }

  if (!normalized) {
    return null;
  }

  const prefix = `IPv${rule.ipVersion}:${rule.chain.toUpperCase()}`;
  const positions = new Map<number, { name: string; items: unknown[] }>();
  for (const [name, items] of [
    ['In', rule.inRoles],
    ['Out', rule.outRoles],
    ['Source', rule.source],
    ['Destination', rule.destination],
    ['Service', rule.services],
  ] as const) {
    const id = RulePositionsMap.get(`${prefix}:${name}`);
    if (id !== undefined) {
      positions.set(id, { name, items });
    }
  }

  const translatedPositions = new Set(
    ['Translated Source', 'Translated Destination', 'Translated Service'].map((name) =>
      RulePositionsMap.get(`${prefix}:${name}`),
    ),
  );

  for (const id of normalized.split(' ').map(Number)) {
    if (translatedPositions.has(id)) {
      return `Translated NAT positions cannot be negated (position ${id}).`;
    }

    const position = positions.get(id);
    if (!position) {
      return `Position ${id} does not belong to the negatable positions of IPv${rule.ipVersion} ${rule.chain.toUpperCase()}.`;
    }

    if (!position.items.length) {
      return `Empty rule positions cannot be negated (position ${id}, ${position.name}).`;
    }
  }

  return null;
}
