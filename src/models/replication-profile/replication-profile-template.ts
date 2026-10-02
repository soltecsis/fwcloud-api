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

import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { app } from '../../fonaments/abstract-application';
import { HttpException } from '../../fonaments/exceptions/http/http-exception';
import type { ErrorPayload } from '../../fonaments/http/response-builder';
import { assertProfileDefinitionHasNoSecrets } from './replication-profile-secret.guard';
import {
  assertReplicationProfilePayloadIsValid,
  validateReplicationProfilePayload,
  type ReplicationProfileValidationError,
} from './replication-profile-validation.service';

/**
 * Replication profile models are stored as JSON templates, not in the
 * database: `replication_profiles.path` holds where, relative to
 * `config/templates`. Built-in templates are version-controlled there. The
 * templates of the custom profiles owned by each user go below `custom/`,
 * which is served from the `replication_profiles.data_dir` directory
 * (`config/templates/custom` by default) so backups include them.
 *
 * Every read, write and removal of a template goes through this module.
 */

export type ReplicationProfileModel = Record<string, unknown>;

/** The profile fields a template is located and validated with. */
export interface ReplicationProfileTemplateReference {
  code: string;
  version: number;
  targetKind: string;
  path: string;
}

export type ReplicationProfileTemplateErrorReason =
  'invalid_path' | 'not_found' | 'unreadable' | 'invalid_json' | 'invalid_model' | 'unwritable';

const CUSTOM_TEMPLATES_SEGMENT = 'custom';
/** Keeps the user directories apart from the former `custom/<fwcloud>/` ones. */
const USER_TEMPLATES_SEGMENT = 'users';
const TEMPLATE_EXTENSION = '.json';
/**
 * No segment can be empty, `.` or `..`. Profile codes use the same charset, but
 * this guard on file paths is kept apart from REPLICATION_PROFILE_CODE_PATTERN
 * on purpose, so widening what a code accepts can never widen what a path does.
 */
const TEMPLATE_PATH_SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

/** A missing, unreadable or invalid template is a server-side fault. */
export class ReplicationProfileTemplateException extends HttpException {
  constructor(
    public readonly reason: ReplicationProfileTemplateErrorReason,
    message: string,
    public readonly validationErrors: ReplicationProfileValidationError[] = [],
  ) {
    super(message, 500);
  }

  public toResponse(): ErrorPayload {
    const response = super.toResponse();

    if (this.validationErrors.length > 0) {
      response.errors = {
        template: this.validationErrors,
      };
    }

    return response;
  }
}

/**
 * Version-controlled templates of the built-in profiles. Relative to the
 * working directory, like the configuration files and the data directories.
 */
export function getReplicationProfileTemplatesDirectory(): string {
  return path.resolve('config', 'templates');
}

/** Templates of the custom profiles, one directory per owning user. */
export function getCustomReplicationProfileTemplatesDirectory(): string {
  return path.resolve(app().config.get('replication_profiles').data_dir);
}

/** Where the `custom/users/<user>/` templates of one user are stored. */
export function getUserReplicationProfileTemplatesDirectory(userId: number): string {
  return path.join(
    getCustomReplicationProfileTemplatesDirectory(),
    USER_TEMPLATES_SEGMENT,
    String(userId),
  );
}

/**
 * Deterministic template path of a profile, derived from the same
 * (owner, code, version) key the database keeps unique: built-in profiles
 * (no owner) use `<code>.v<version>.json` and custom ones
 * `custom/users/<user>/<code>.v<version>.json`.
 */
export function buildReplicationProfileTemplatePath(identity: {
  code: string;
  version: number;
  userId: number | null;
}): string {
  const fileName = `${identity.code}.v${identity.version}${TEMPLATE_EXTENSION}`;

  return typeof identity.userId === 'number'
    ? `${CUSTOM_TEMPLATES_SEGMENT}/${USER_TEMPLATES_SEGMENT}/${identity.userId}/${fileName}`
    : fileName;
}

/**
 * Absolute file of a stored template path. Only relative `.json` paths made of
 * plain segments are accepted, so a path can never leave its templates
 * directory.
 */
export function resolveReplicationProfileTemplatePath(
  profile: ReplicationProfileTemplateReference,
): string {
  return resolveTemplate(profile).file;
}

/** Reads, parses and validates the model of a profile from its template. */
export function loadReplicationProfileModel(
  profile: ReplicationProfileTemplateReference,
): ReplicationProfileModel {
  const { directory, file } = resolveTemplate(profile);
  let content: string;

  try {
    assertRealPathInside(directory, file, profile);
    content = fs.readFileSync(file, 'utf8');
  } catch (error) {
    if (error instanceof ReplicationProfileTemplateException) {
      throw error;
    }

    throw error?.code === 'ENOENT'
      ? templateError('not_found', profile, 'does not exist.')
      : templateError('unreadable', profile, `could not be read (${errorCode(error)}).`);
  }

  let model: unknown;
  try {
    model = JSON.parse(content);
  } catch (error) {
    throw templateError('invalid_json', profile, `is not valid JSON: ${error.message}`);
  }

  const validationErrors = validateReplicationProfilePayload({
    targetKind: profile.targetKind,
    model,
  });

  if (validationErrors.length > 0) {
    throw templateError(
      'invalid_model',
      profile,
      'does not contain a valid replication profile model.',
      validationErrors,
    );
  }

  return model as ReplicationProfileModel;
}

/** Outcome of reading a template where a broken one must not stop the caller. */
export type ReplicationProfileTemplateRead =
  | { model: ReplicationProfileModel; error: null }
  | { model: null; error: ReplicationProfileTemplateException };

/** Like loadReplicationProfileModel(), but returns the template error instead of throwing it. */
export function readReplicationProfileModel(
  profile: ReplicationProfileTemplateReference,
): ReplicationProfileTemplateRead {
  try {
    return { model: loadReplicationProfileModel(profile), error: null };
  } catch (error) {
    if (error instanceof ReplicationProfileTemplateException) {
      return { model: null, error };
    }

    throw error;
  }
}

/**
 * Writes the model of a profile to its template. Secrets and invalid
 * definitions are rejected before anything touches the disk, so no template
 * can be stored without passing the checks a read applies.
 */
export function writeReplicationProfileModel(
  profile: ReplicationProfileTemplateReference,
  model: unknown,
): void {
  assertProfileDefinitionHasNoSecrets(model);
  assertReplicationProfilePayloadIsValid(
    {
      targetKind: profile.targetKind,
      model,
    },
    {
      validateSecrets: false,
    },
  );

  const { directory, file } = resolveTemplate(profile);
  const temporaryFile = `${file}.${randomUUID()}.tmp`;

  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    assertRealPathInside(directory, path.dirname(file), profile);
    // Written aside and renamed, so a template is never read half written.
    fs.writeFileSync(temporaryFile, `${JSON.stringify(model, null, 2)}\n`);
    fs.renameSync(temporaryFile, file);
  } catch (error) {
    // Checked first: removing it throws when its directory could not be created.
    if (fs.existsSync(temporaryFile)) {
      fs.rmSync(temporaryFile);
    }

    if (error instanceof ReplicationProfileTemplateException) {
      throw error;
    }

    throw templateError('unwritable', profile, `could not be written (${errorCode(error)}).`);
  }
}

/** Removes the template of a profile; a template already gone is not an error. */
export function removeReplicationProfileModel(profile: ReplicationProfileTemplateReference): void {
  const { file } = resolveTemplate(profile);

  try {
    fs.rmSync(file, { force: true });
  } catch (error) {
    throw templateError('unwritable', profile, `could not be removed (${errorCode(error)}).`);
  }
}

function resolveTemplate(profile: ReplicationProfileTemplateReference): {
  directory: string;
  file: string;
} {
  const segments =
    typeof profile.path === 'string' && profile.path.endsWith(TEMPLATE_EXTENSION)
      ? profile.path.split('/')
      : [];

  if (segments.length === 0 || !segments.every((segment) => TEMPLATE_PATH_SEGMENT.test(segment))) {
    throw templateError(
      'invalid_path',
      profile,
      'must be a relative .json path inside config/templates.',
    );
  }

  const isCustom = segments[0] === CUSTOM_TEMPLATES_SEGMENT;
  const directory = isCustom
    ? getCustomReplicationProfileTemplatesDirectory()
    : getReplicationProfileTemplatesDirectory();

  return { directory, file: path.join(directory, ...(isCustom ? segments.slice(1) : segments)) };
}

/** Rejects templates reached through a symbolic link that leads out of their directory. */
function assertRealPathInside(
  directory: string,
  target: string,
  profile: ReplicationProfileTemplateReference,
): void {
  const realDirectory = fs.realpathSync(directory);
  const realTarget = fs.realpathSync(target);

  if (realTarget !== realDirectory && !realTarget.startsWith(`${realDirectory}${path.sep}`)) {
    throw templateError('invalid_path', profile, 'resolves outside its templates directory.');
  }
}

/** Every message names the template and its profile the same way. */
function templateError(
  reason: ReplicationProfileTemplateErrorReason,
  profile: ReplicationProfileTemplateReference,
  detail: string,
  validationErrors: ReplicationProfileValidationError[] = [],
): ReplicationProfileTemplateException {
  return new ReplicationProfileTemplateException(
    reason,
    `Template "${profile.path}" of replication profile ${profile.code} v${profile.version} ${detail}`,
    validationErrors,
  );
}

function errorCode(error: any): string {
  return error?.code ?? error?.message ?? 'unknown error';
}
