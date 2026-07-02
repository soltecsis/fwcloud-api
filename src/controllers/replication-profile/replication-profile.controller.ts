import { Request } from 'express';
import { Validate, ValidateQuery } from '../../decorators/validate.decorator';
import { Controller } from '../../fonaments/http/controller';
import { ResponseBuilder } from '../../fonaments/http/response-builder';
import { HttpException } from '../../fonaments/exceptions/http/http-exception';
import { NotFoundException } from '../../fonaments/exceptions/not-found-exception';
import { FwCloud } from '../../models/fwcloud/FwCloud';
import { AuditLogHelper } from '../../models/audit/audit-log.helper';
import { ReplicationProfile } from '../../models/replication-profile/replication-profile.model';
import { normalizeReplicationProfileTargetKind } from '../../models/replication-profile/replication-profile.constants';
import type { ReplicationProfileTargetKind } from '../../models/replication-profile/replication-profile.constants';
import {
  ReplicationProfileService,
  type CreateCustomReplicationProfileOptions,
  type DeactivateCustomReplicationProfileOptions,
} from '../../models/replication-profile/replication-profile.service';
import { ProfileApplicationService } from '../../models/replication-profile/profile-application.service';
import type {
  PolicyReplicationMode,
  PolicyReplicationRequest,
} from '../../models/replication-profile/policy-replication.types';
import { ReplicationProfilePolicy } from '../../policies/replication-profile.policy';
import { ReplicationProfileListQueryDto } from './dtos/replication-profile-query.dto';
import { ReplicationProfileResponseDto } from './dtos/replication-profile-response.dto';
import { ReplicationProfileApplyDto } from './dtos/replication-profile-apply.dto';
import {
  ReplicationProfileStoreDto,
  ReplicationProfileVersionStoreDto,
} from './dtos/replication-profile-store.dto';

export class ReplicationProfileController extends Controller {
  protected _fwCloud: FwCloud;

  public async make(request: Request): Promise<void> {
    this._fwCloud = await FwCloud.findOneOrFail({
      where: { id: parseInt(String(request.params.fwcloud)) },
    });
  }

  @Validate()
  @ValidateQuery(ReplicationProfileListQueryDto)
  public async index(request: Request): Promise<ResponseBuilder> {
    (await ReplicationProfilePolicy.index(request.session.user, this._fwCloud)).authorize();
    const replicationProfileService = await this.replicationProfileService();

    const profiles = await replicationProfileService.findActive(
      this.parseTargetKind(request.query.targetKind),
      this._fwCloud.id,
    );

    return ResponseBuilder.buildResponse()
      .status(200)
      .body(profiles.map((profile) => this.toResponse(profile)));
  }

  @Validate()
  public async show(request: Request): Promise<ResponseBuilder> {
    (await ReplicationProfilePolicy.show(request.session.user, this._fwCloud)).authorize();
    const replicationProfileService = await this.replicationProfileService();

    const version = this.parseVersionParam(request);

    const profile = await replicationProfileService.findByCodeAndVersion(
      String(request.params.code),
      version,
      this._fwCloud.id,
    );

    if (!profile) {
      throw new NotFoundException('Replication profile not found');
    }

    return ResponseBuilder.buildResponse().status(200).body(this.toResponse(profile));
  }

  @Validate(ReplicationProfileStoreDto)
  public async store(request: Request): Promise<ResponseBuilder> {
    const authorization = await ReplicationProfilePolicy.store(request.session.user, this._fwCloud);
    if (!authorization.can()) {
      throw new HttpException('Forbidden', 403);
    }
    const replicationProfileService = await this.replicationProfileService();

    const profile = await replicationProfileService.createCustomProfile(
      request.body as ReplicationProfileStoreDto,
      this.customProfileOptions(request),
    );

    return ResponseBuilder.buildResponse().status(201).body(this.toResponse(profile));
  }

  @Validate(ReplicationProfileVersionStoreDto)
  public async storeVersion(request: Request): Promise<ResponseBuilder> {
    const authorization = await ReplicationProfilePolicy.storeVersion(
      request.session.user,
      this._fwCloud,
    );
    if (!authorization.can()) {
      throw new HttpException('Forbidden', 403);
    }
    const replicationProfileService = await this.replicationProfileService();

    const profile = await replicationProfileService.createCustomProfileVersion(
      String(request.params.code),
      request.body as ReplicationProfileVersionStoreDto,
      this.customProfileOptions(request),
    );

    return ResponseBuilder.buildResponse().status(201).body(this.toResponse(profile));
  }

  @Validate()
  public async destroy(request: Request): Promise<ResponseBuilder> {
    const authorization = await ReplicationProfilePolicy.destroy(
      request.session.user,
      this._fwCloud,
    );
    if (!authorization.can()) {
      throw new HttpException('Forbidden', 403);
    }
    const replicationProfileService = await this.replicationProfileService();

    const version = this.parseVersionParam(request);

    const profile = await replicationProfileService.deactivateCustomProfile(
      String(request.params.code),
      version,
      this.deactivationOptions(request),
    );

    return ResponseBuilder.buildResponse().status(200).body(this.toResponse(profile));
  }

  @Validate(ReplicationProfileApplyDto)
  public async apply(request: Request): Promise<ResponseBuilder> {
    const version = this.parseVersionParam(request);
    const body = request.body as ReplicationProfileApplyDto;
    const replication = this.toPolicyReplicationRequest(body);

    const profileApplicationService = await this.profileApplicationService();
    const result = await profileApplicationService.apply(
      {
        user: request.session.user,
        sessionId: AuditLogHelper.resolveSessionId(request),
        sourceIp: request.ip ?? null,
      },
      {
        fwCloudId: this._fwCloud.id,
        profileCode: String(request.params.code),
        profileVersion: version,
        expectedScope: body.scope,
        replication,
        credentials: body.credentials,
      },
    );

    return ResponseBuilder.buildResponse()
      .status(result.errors.length > 0 ? 422 : 200)
      .body(result);
  }

  private parseVersionParam(request: Request): number {
    const version = parseInt(String(request.params.version), 10);

    if (Number.isNaN(version)) {
      throw new NotFoundException('Replication profile not found');
    }

    return version;
  }

  private toPolicyReplicationRequest(body: ReplicationProfileApplyDto): PolicyReplicationRequest {
    const replication: PolicyReplicationRequest = {
      target: {
        kind: body.target.kind as ReplicationProfileTargetKind,
        id: body.target.id,
      },
      nodeRoleMapping: body.nodeRoleMapping,
      mode: body.mode as PolicyReplicationMode,
    };

    // Source side is only present for regular (source-based) profiles; provisioning
    // profiles are applied with just the target.
    if (body.sourceProfile) {
      replication.sourceProfile = {
        firewallId: body.sourceProfile.firewallId,
        interfaceRoles: body.sourceProfile.interfaceRoles,
        nodeRoles: body.sourceProfile.nodeRoles,
      };
    }

    if (body.interfaceRoleMapping) {
      replication.interfaceRoleMapping = body.interfaceRoleMapping;
    }

    return replication;
  }

  private parseTargetKind(value: unknown): ReplicationProfileTargetKind | undefined {
    return normalizeReplicationProfileTargetKind(value) ?? undefined;
  }

  // Services are resolved lazily so read endpoints never build the heavier
  // apply-service dependency chain. The DI container already returns cached
  // singletons, so no per-request memoization is needed here.
  private replicationProfileService(): Promise<ReplicationProfileService> {
    return this._app.getService<ReplicationProfileService>(ReplicationProfileService.name);
  }

  private profileApplicationService(): Promise<ProfileApplicationService> {
    return this._app.getService<ProfileApplicationService>(ProfileApplicationService.name);
  }

  private customProfileOptions(request: Request): CreateCustomReplicationProfileOptions {
    return {
      fwCloudId: this._fwCloud.id,
      userId: request.session.user?.id ?? request.session.user_id ?? null,
    };
  }

  private deactivationOptions(request: Request): DeactivateCustomReplicationProfileOptions {
    const user = request.session.user;

    return {
      fwCloudId: this._fwCloud.id,
      actor: {
        userId: user?.id ?? request.session.user_id ?? null,
        userName: user?.username ?? null,
        sessionId: AuditLogHelper.resolveSessionId(request),
        sourceIp: request.ip ?? null,
      },
    };
  }

  private toResponse(profile: ReplicationProfile): ReplicationProfileResponseDto {
    return {
      id: profile.id,
      code: profile.code,
      version: profile.version,
      name: profile.name,
      description: profile.description,
      scope: profile.scope,
      category: profile.category,
      targetKind: profile.targetKind,
      model: profile.model,
      is_built_in: profile.isBuiltin,
      is_active: profile.isActive,
      is_deprecated: profile.isDeprecated,
      fwcloud_id: profile.fwCloudId,
    };
  }
}
