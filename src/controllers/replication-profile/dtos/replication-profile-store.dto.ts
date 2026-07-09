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
  asReplicationProfileNonEmptyString,
  asReplicationProfileRecord,
  isReplicationProfilePort,
  isReplicationProfileStringValue,
  REPLICATION_PROFILE_INTERFACE_ROLE_FIELDS,
  REPLICATION_PROFILE_RULE_ACTIONS,
  REPLICATION_PROFILE_RULE_PROTOCOLS,
  REPLICATION_PROFILE_TARGET_KINDS,
} from '../../../models/replication-profile/replication-profile.constants';
import { findSecretLikePaths } from '../../../models/replication-profile/replication-profile-secret.guard';

const TARGET_KINDS: readonly string[] = REPLICATION_PROFILE_TARGET_KINDS;
const RULE_ACTIONS: readonly string[] = REPLICATION_PROFILE_RULE_ACTIONS;
const RULE_PROTOCOLS: readonly string[] = REPLICATION_PROFILE_RULE_PROTOCOLS;

/** Codes are used verbatim as URL path segments (`/profiles/:code/:version`). */
const CODE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

function isArraySubsetOf(value: unknown, allowed: readonly string[]): boolean {
  return (
    Array.isArray(value) && value.every((item) => isReplicationProfileStringValue(item, allowed))
  );
}

function isNonEmptyArraySubsetOf(value: unknown, allowed: readonly string[]): boolean {
  return Array.isArray(value) && value.length > 0 && isArraySubsetOf(value, allowed);
}

function isArrayOfNonEmptyStrings(value: unknown): boolean {
  return (
    Array.isArray(value) && value.every((item) => asReplicationProfileNonEmptyString(item) !== null)
  );
}

function isNonEmptyArrayOfNonEmptyStrings(value: unknown): boolean {
  return Array.isArray(value) && value.length > 0 && isArrayOfNonEmptyStrings(value);
}

function isProvisionService(value: unknown): boolean {
  if (asReplicationProfileNonEmptyString(value)) {
    return true;
  }

  const record = asReplicationProfileRecord(value);
  if (!record) {
    return false;
  }

  return (
    isReplicationProfileStringValue(record.protocol, RULE_PROTOCOLS) &&
    isReplicationProfilePort(record.port)
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
 * supports and, optionally, which logical interface names it relies on. Both the
 * camelCase (`targetKinds`) and snake_case (`target_kinds`) spellings are
 * accepted, mirroring the tolerant reader in ReplicationProfileService.
 */
@ValidatorConstraint()
class IsProfileCompatibilityConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    const record = asReplicationProfileRecord(value);
    const targetKinds = record?.targetKinds ?? record?.target_kinds;
    const supportedRoles = record?.supportedRoles ?? record?.supported_roles;

    return (
      !!record &&
      isNonEmptyArraySubsetOf(targetKinds, TARGET_KINDS) &&
      (supportedRoles === undefined || isArrayOfNonEmptyStrings(supportedRoles))
    );
  }

  defaultMessage(args: ValidationArguments): string {
    return `${args.property} must declare targetKinds (a non-empty array of ${TARGET_KINDS.join('/')}) and, if present, supportedRoles as non-empty strings`;
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
    const record = asReplicationProfileRecord(value);

    return (
      !!record &&
      isNonEmptyArrayOfNonEmptyStrings(record.interfaceRoles) &&
      (record.nodeRoles === undefined || isArrayOfNonEmptyStrings(record.nodeRoles))
    );
  }

  defaultMessage(args: ValidationArguments): string {
    return `${args.property} must declare interfaceRoles and, if present, nodeRoles as arrays of non-empty strings`;
  }
}

const IsProfileRoleAssignments = profileValidator(
  'isProfileRoleAssignments',
  IsProfileRoleAssignmentsConstraint,
);

/**
 * `model.provision` (optional): when present, its declarative interfaces and
 * policy rules must stay within the MVP action/service vocabulary while allowing
 * custom logical interface names. Unknown extra keys are tolerated so the block
 * can grow without breaking older clients.
 */
@ValidatorConstraint()
class IsMvpProvisionModelConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (value === undefined || value === null) {
      return true;
    }

    const record = asReplicationProfileRecord(value);
    return (
      !!record &&
      (record.rules === undefined || this.areRulesValid(record.rules)) &&
      (record.interfaces === undefined || this.areInterfacesValid(record.interfaces))
    );
  }

  private areRulesValid(rules: unknown): boolean {
    if (!Array.isArray(rules)) {
      return false;
    }

    return rules.every((rule) => {
      const record = asReplicationProfileRecord(rule);

      return (
        !!record &&
        (record.action === undefined ||
          isReplicationProfileStringValue(record.action, RULE_ACTIONS)) &&
        REPLICATION_PROFILE_INTERFACE_ROLE_FIELDS.every(
          (roleField) =>
            record[roleField] === undefined ||
            asReplicationProfileNonEmptyString(record[roleField]) !== null,
        ) &&
        (record.service === undefined || isProvisionService(record.service))
      );
    });
  }

  private areInterfacesValid(interfaces: unknown): boolean {
    if (!Array.isArray(interfaces)) {
      return false;
    }

    return interfaces.every((item) => {
      const record = asReplicationProfileRecord(item);
      if (!record || asReplicationProfileNonEmptyString(record.role) === null) {
        return false;
      }

      return record.name === undefined || typeof record.name === 'string';
    });
  }

  defaultMessage(args: ValidationArguments): string {
    return `${args.property} rules must use action ${RULE_ACTIONS.join('/')} and non-empty interface role strings`;
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
 * `model` object accepted by both custom profile creation and version
 * creation. Compatibility is strictly validated; role assignments are optional
 * because provisioning-only profiles can define their reusable roles through
 * `provision.interfaces`. The open,
 * wizard-facing parts (uiDefaults, topologyPreset, options) are accepted as
 * plain objects so the profile model can carry forward-compatible metadata the
 * wizard reads defensively.
 */
export class ReplicationProfileStoreModelDto {
  @IsProfileCompatibility()
  compatibility: Record<string, unknown>;

  @IsOptional()
  @IsProfileRoleAssignments()
  roleAssignments?: Record<string, unknown>;

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
  templateStructure?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  template_structure?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  policyStructure?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  policy_structure?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  options?: Record<string, unknown>;
}

export class ReplicationProfileVersionStoreDto {
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
  scope: string;

  @IsOptional()
  @IsIn(REPLICATION_PROFILE_TARGET_KINDS)
  targetKind?: string;

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

export class ReplicationProfileStoreDto extends ReplicationProfileVersionStoreDto {
  /** Defaults to a stable slug generated from `name` when omitted. */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  @Matches(CODE_PATTERN, {
    message: 'code must start with a letter or digit and use only letters, digits, ".", "_" or "-"',
  })
  code?: string;

  /** Defaults to version 1 when omitted. */
  @IsOptional()
  @IsInt()
  @IsPositive()
  version?: number;
}

export class ReplicationProfileCloneDto {
  /** Defaults to the source profile code suffixed with "-copy" when omitted. */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  @Matches(CODE_PATTERN, {
    message: 'code must start with a letter or digit and use only letters, digits, ".", "_" or "-"',
  })
  code?: string;

  /** Defaults to the source profile name suffixed with " copy" when omitted. */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  scope?: string;

  @IsOptional()
  @IsIn(REPLICATION_PROFILE_TARGET_KINDS)
  targetKind?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  category?: string;
}
