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
 * Official contract for creating a user-defined ("custom") policy template
 * profile.
 *
 * The MVP contract intentionally distinguishes:
 * - built-in/global profiles: seeded by migrations, owned by no FWCloud. The
 *   client can never create one — `isBuiltin`/`isActive`/`isDeprecated`/
 *   `fwcloud_id` are not part of this DTO, so the global whitelist validation
 *   (`forbidNonWhitelisted`) rejects any attempt to set them.
 * - custom FWCloud profiles: created through this contract, always scoped to
 *   the FWCloud of the request.
 */

import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsPositive,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  registerDecorator,
} from 'class-validator';
import {
  REPLICATION_PROFILE_INTERFACE_ROLES,
  REPLICATION_PROFILE_RULE_ACTIONS,
  REPLICATION_PROFILE_TARGET_KINDS,
} from '../../../models/replication-profile/replication-profile.model';
import { findSecretLikePaths } from '../../../models/replication-profile/replication-profile-secret.guard';

const TARGET_KINDS: readonly string[] = REPLICATION_PROFILE_TARGET_KINDS;
const ROLES: readonly string[] = REPLICATION_PROFILE_INTERFACE_ROLES;
const RULE_ACTIONS: readonly string[] = REPLICATION_PROFILE_RULE_ACTIONS;

/** Codes are used verbatim as URL path segments (`/profiles/:code/:version`). */
const CODE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function isStringIn(value: unknown, allowed: readonly string[]): boolean {
  return typeof value === 'string' && allowed.includes(value);
}

function isArraySubsetOf(value: unknown, allowed: readonly string[]): boolean {
  return Array.isArray(value) && value.every((item) => isStringIn(item, allowed));
}

function isNonEmptyArraySubsetOf(value: unknown, allowed: readonly string[]): boolean {
  return Array.isArray(value) && value.length > 0 && isArraySubsetOf(value, allowed);
}

function isArrayOfNonEmptyStrings(value: unknown): boolean {
  return (
    Array.isArray(value) &&
    value.every((item) => typeof item === 'string' && item.trim().length > 0)
  );
}

/**
 * Builds a property decorator that registers the given constraint class, so each
 * custom validator below stays a single declarative line instead of repeating
 * the class-validator registration boilerplate.
 */
function profileValidator(name: string, validator: new () => ValidatorConstraintInterface) {
  return (validationOptions?: ValidationOptions) =>
    (object: object, propertyName: string): void => {
      registerDecorator({
        name,
        target: object.constructor,
        propertyName,
        constraints: [],
        options: validationOptions,
        validator,
      });
    };
}

/**
 * `model.compatibility` (required): declares which target kinds the profile
 * supports and, optionally, which interface roles it relies on. Both the
 * camelCase (`targetKinds`) and snake_case (`target_kinds`) spellings are
 * accepted, mirroring the tolerant reader in ReplicationProfileService.
 */
@ValidatorConstraint()
class IsProfileCompatibilityConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    const record = asRecord(value);
    if (!record) {
      return false;
    }

    const targetKinds = record.targetKinds ?? record.target_kinds;
    if (!isNonEmptyArraySubsetOf(targetKinds, TARGET_KINDS)) {
      return false;
    }

    const supportedRoles = record.supportedRoles ?? record.supported_roles;
    if (supportedRoles !== undefined && !isArraySubsetOf(supportedRoles, ROLES)) {
      return false;
    }

    return true;
  }

  defaultMessage(args: ValidationArguments): string {
    return `${args.property} must declare targetKinds (a non-empty array of ${TARGET_KINDS.join('/')}) and, if present, supportedRoles limited to ${ROLES.join('/')}`;
  }
}

const IsProfileCompatibility = profileValidator(
  'isProfileCompatibility',
  IsProfileCompatibilityConstraint,
);

/**
 * `model.roleAssignments` (required): the interface roles (and optionally node
 * roles) the profile exposes. These are role NAMES, not role->id maps: the
 * concrete interface/node ids are only known when the wizard applies the
 * profile, so they cannot be part of a reusable definition.
 */
@ValidatorConstraint()
class IsProfileRoleAssignmentsConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    const record = asRecord(value);
    if (!record) {
      return false;
    }

    if (!isNonEmptyArraySubsetOf(record.interfaceRoles, ROLES)) {
      return false;
    }

    if (record.nodeRoles !== undefined && !isArrayOfNonEmptyStrings(record.nodeRoles)) {
      return false;
    }

    return true;
  }

  defaultMessage(args: ValidationArguments): string {
    return `${args.property} must declare interfaceRoles (a non-empty array of ${ROLES.join('/')}) and, if present, nodeRoles as an array of non-empty strings`;
  }
}

const IsProfileRoleAssignments = profileValidator(
  'isProfileRoleAssignments',
  IsProfileRoleAssignmentsConstraint,
);

/**
 * `model.provision` (optional): when present, its declarative interfaces and
 * policy rules must stay within the MVP vocabulary — actions limited to
 * allow/deny and roles limited to wan/lan/dmz. Unknown extra keys are tolerated
 * so the block can grow without breaking older clients.
 */
@ValidatorConstraint()
class IsMvpProvisionModelConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (value === undefined || value === null) {
      return true;
    }

    const record = asRecord(value);
    if (!record) {
      return false;
    }

    if (record.rules !== undefined && !this.areRulesValid(record.rules)) {
      return false;
    }

    if (record.interfaces !== undefined && !this.areInterfacesValid(record.interfaces)) {
      return false;
    }

    return true;
  }

  private areRulesValid(rules: unknown): boolean {
    if (!Array.isArray(rules)) {
      return false;
    }

    return rules.every((rule) => {
      const record = asRecord(rule);
      if (!record) {
        return false;
      }

      if (!isStringIn(record.action, RULE_ACTIONS)) {
        return false;
      }

      for (const roleField of ['sourceRole', 'destinationRole'] as const) {
        if (record[roleField] !== undefined && !isStringIn(record[roleField], ROLES)) {
          return false;
        }
      }

      if (record.service !== undefined && typeof record.service !== 'string') {
        return false;
      }

      return true;
    });
  }

  private areInterfacesValid(interfaces: unknown): boolean {
    if (!Array.isArray(interfaces)) {
      return false;
    }

    return interfaces.every((item) => {
      const record = asRecord(item);
      if (!record || !isStringIn(record.role, ROLES)) {
        return false;
      }

      return record.name === undefined || typeof record.name === 'string';
    });
  }

  defaultMessage(args: ValidationArguments): string {
    return `${args.property} rules must use action ${RULE_ACTIONS.join('/')} and roles limited to ${ROLES.join('/')}`;
  }
}

const IsMvpProvisionModel = profileValidator('isMvpProvisionModel', IsMvpProvisionModelConstraint);

/**
 * Rejects credentials/secrets stored anywhere inside the value. Reuses the same
 * key scan that guards persistence, so the contract refuses secrets at the API
 * boundary before they ever reach the database.
 */
@ValidatorConstraint()
class IsSecretFreeConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return findSecretLikePaths(value).length === 0;
  }

  defaultMessage(args: ValidationArguments): string {
    const paths = findSecretLikePaths(args.value);
    return `${args.property} must not contain credentials or secrets. Offending fields: ${paths.join(', ')}`;
  }
}

const IsSecretFree = profileValidator('isSecretFree', IsSecretFreeConstraint);

/**
 * `model` object of the create contract. Required parts (compatibility,
 * roleAssignments) are strictly validated; the open, wizard-facing parts
 * (uiDefaults, topologyPreset, options) are accepted as plain objects so the
 * profile model can carry forward-compatible metadata the wizard reads
 * defensively.
 */
export class ReplicationProfileStoreModelDto {
  @IsProfileCompatibility()
  compatibility: Record<string, unknown>;

  @IsProfileRoleAssignments()
  roleAssignments: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  uiDefaults?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  topologyPreset?: Record<string, unknown>;

  @IsOptional()
  @IsMvpProvisionModel()
  provision?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  options?: Record<string, unknown>;
}

export class ReplicationProfileStoreDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  @Matches(CODE_PATTERN, {
    message: 'code must start with a letter or digit and use only letters, digits, ".", "_" or "-"',
  })
  code: string;

  @IsInt()
  @IsPositive()
  version: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  scope: string;

  @IsIn(REPLICATION_PROFILE_TARGET_KINDS)
  targetKind: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  category?: string;

  @IsObject()
  @IsSecretFree()
  @ValidateNested()
  @Type(() => ReplicationProfileStoreModelDto)
  model: ReplicationProfileStoreModelDto;
}
