/*
    Copyright 2026 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
    https://soltecsis.com
    info@soltecsis.com


    This file is part of FWCloud (https://fwcloud.net).

    FWCloud is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    FWCloud is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with FWCloud.  If not, see <https://www.gnu.org/licenses/>.
*/

/**
 * Guard against persisting credentials inside replication profile
 * definitions. Access credentials may only exist as transient runtime input
 * of the wizard flow: they must never be stored in the profile/preset model
 * nor in any persisted profile metadata.
 */

const SECRET_KEY_PATTERNS = [
  'password',
  'passcode',
  'passwd',
  'passphrase',
  'secret',
  'token',
  'apikey',
  'api_key',
  'accesskey',
  'access_key',
  'privatekey',
  'private_key',
  'sshkey',
  'ssh_key',
  'credential',
  'otp',
];

export function isSecretLikeKey(key: string): boolean {
  const normalized = key.toLowerCase();
  return SECRET_KEY_PATTERNS.some((pattern) => normalized.includes(pattern));
}

/**
 * Returns the dotted paths of every secret-like key found inside the value,
 * scanning nested objects and arrays.
 */
export function findSecretLikePaths(value: unknown, basePath: string = ''): string[] {
  if (value === null || typeof value !== 'object') {
    return [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item, index) =>
      findSecretLikePaths(item, basePath ? `${basePath}[${index}]` : `[${index}]`),
    );
  }

  return Object.entries(value as Record<string, unknown>).flatMap(([key, item]) => {
    const path = basePath ? `${basePath}.${key}` : key;
    return isSecretLikeKey(key) ? [path] : findSecretLikePaths(item, path);
  });
}

export class ProfileSecretPersistenceError extends Error {
  constructor(public readonly secretPaths: string[]) {
    super(
      `Replication profile definitions must not contain credentials or secrets. Offending fields: ${secretPaths.join(', ')}`,
    );
    Object.setPrototypeOf(this, ProfileSecretPersistenceError.prototype);
  }
}

/** Throws when the profile definition contains any secret-like field. */
export function assertProfileDefinitionHasNoSecrets(definition: unknown): void {
  const secretPaths = findSecretLikePaths(definition);

  if (secretPaths.length > 0) {
    throw new ProfileSecretPersistenceError(secretPaths);
  }
}
