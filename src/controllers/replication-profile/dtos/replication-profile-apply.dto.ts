import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsPositive,
  IsString,
  ValidateNested,
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  registerDecorator,
} from 'class-validator';
import { POLICY_REPLICATION_MODES } from '../../../models/replication-profile/policy-replication.types';
import {
  asReplicationProfileNonEmptyString,
  asReplicationProfileRecord,
  REPLICATION_PROFILE_TARGET_KINDS,
} from '../../../models/replication-profile/replication-profile.constants';

@ValidatorConstraint()
class IsRoleIdMapConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    const record = asReplicationProfileRecord(value);
    if (!record) {
      return false;
    }

    return Object.entries(record).every(
      ([role, id]) =>
        asReplicationProfileNonEmptyString(role) !== null &&
        typeof id === 'number' &&
        Number.isInteger(id) &&
        id > 0,
    );
  }

  defaultMessage(args: ValidationArguments): string {
    return `${args.property} must be an object mapping role names to positive integer ids`;
  }
}

function IsRoleIdMap(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isRoleIdMap',
      target: object.constructor,
      propertyName: propertyName,
      constraints: [],
      options: validationOptions,
      validator: IsRoleIdMapConstraint,
    });
  };
}

@ValidatorConstraint()
class IsRoleNameMapConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    const record = asReplicationProfileRecord(value);
    if (!record) {
      return false;
    }

    return Object.entries(record).every(
      ([role, name]) =>
        asReplicationProfileNonEmptyString(role) !== null &&
        asReplicationProfileNonEmptyString(name) !== null,
    );
  }

  defaultMessage(args: ValidationArguments): string {
    return `${args.property} must be an object mapping role names to interface names`;
  }
}

function IsRoleNameMap(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isRoleNameMap',
      target: object.constructor,
      propertyName: propertyName,
      constraints: [],
      options: validationOptions,
      validator: IsRoleNameMapConstraint,
    });
  };
}

export class ReplicationProfileApplyTargetDto {
  @IsIn(REPLICATION_PROFILE_TARGET_KINDS)
  kind: string;

  @IsInt()
  @IsPositive()
  id: number;
}

export class ReplicationProfileApplySourceProfileDto {
  @IsInt()
  @IsPositive()
  firewallId: number;

  @IsRoleIdMap()
  interfaceRoles: Record<string, number>;

  @IsOptional()
  @IsRoleIdMap()
  nodeRoles?: Record<string, number>;
}

export class ReplicationProfileApplyDto {
  // Optional: provisioning profiles are applied with just the target (no source).
  @IsOptional()
  @ValidateNested()
  @Type(() => ReplicationProfileApplySourceProfileDto)
  sourceProfile?: ReplicationProfileApplySourceProfileDto;

  @ValidateNested()
  @Type(() => ReplicationProfileApplyTargetDto)
  target: ReplicationProfileApplyTargetDto;

  @IsOptional()
  @IsRoleIdMap()
  interfaceRoleMapping?: Record<string, number>;

  @IsOptional()
  @IsRoleIdMap()
  nodeRoleMapping?: Record<string, number>;

  /**
   * Provisioning profiles only: role → name of an existing target interface
   * (e.g. one discovered by the wizard) to bind instead of creating a new one.
   */
  @IsOptional()
  @IsRoleNameMap()
  interfaceNameMapping?: Record<string, string>;

  @IsIn(POLICY_REPLICATION_MODES)
  mode: string;

  /**
   * Values for the profile's declared parameters, keyed by parameter name.
   * They are what turn a reusable template into concrete policy on this target.
   */
  @IsOptional()
  @IsObject()
  parameters?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  scope?: string;

  /**
   * Transient runtime credentials of the wizard flow. They are forwarded to
   * the application service as runtime input only and are never persisted.
   */
  @IsOptional()
  @IsObject()
  credentials?: Record<string, unknown>;
}
