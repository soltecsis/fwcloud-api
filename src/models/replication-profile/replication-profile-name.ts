import { ValidationException } from '../../fonaments/exceptions/validation-exception';
import {
  REPLICATION_PROFILE_CODE_MESSAGE,
  REPLICATION_PROFILE_CODE_PATTERN,
} from './replication-profile.constants';

export const REPLICATION_PROFILE_NAME_PATTERN = /^[^.\x2f\\<>:"|?*\x00-\x1f\x7f]+$/;
export const REPLICATION_PROFILE_NAME_MESSAGE =
  'Template names cannot contain dots (.), path separators or unsafe filesystem characters.';

/** Also used below the HTTP layer, before any template file is touched. */
export function assertReplicationProfileName(name: unknown): asserts name is string {
  if (
    typeof name !== 'string' ||
    !name.trim() ||
    name.length > 255 ||
    !REPLICATION_PROFILE_NAME_PATTERN.test(name)
  ) {
    throw new ValidationException(REPLICATION_PROFILE_NAME_MESSAGE, {
      name: [REPLICATION_PROFILE_NAME_MESSAGE],
    });
  }
}

export const REPLICATION_PROFILE_NAME_TAKEN_MESSAGE = 'A template with this name already exists.';

/** Names are unique among the current templates of an owner, whatever their case and outer spaces. */
export function replicationProfileNameKey(name: string): string {
  return name.normalize('NFC').trim().toLowerCase();
}

export function replicationProfileNameTakenException(): ValidationException {
  return new ValidationException(
    REPLICATION_PROFILE_NAME_TAKEN_MESSAGE,
    { name: [REPLICATION_PROFILE_NAME_TAKEN_MESSAGE] },
    409,
  );
}

/** The first of `base`, `base<separator>2`, `base<separator>3`… not taken, within 255 characters. */
export function firstFreeReplicationProfileValue(
  base: string,
  separator: string,
  isTaken: (candidate: string) => boolean,
): string {
  for (let index = 1; ; index++) {
    const suffix = index === 1 ? '' : `${separator}${index}`;
    const candidate = `${base.slice(0, 255 - suffix.length)}${suffix}`;
    if (!isTaken(candidate)) return candidate;
  }
}

export function assertReplicationProfileCode(code: unknown): asserts code is string {
  if (
    typeof code !== 'string' ||
    code.length > 255 ||
    !REPLICATION_PROFILE_CODE_PATTERN.test(code)
  ) {
    throw new ValidationException('Invalid replication profile code.', {
      code: [`${REPLICATION_PROFILE_CODE_MESSAGE}.`],
    });
  }
}
