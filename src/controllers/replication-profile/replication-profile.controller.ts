import { Request } from 'express';
import { Validate, ValidateQuery } from '../../decorators/validate.decorator';
import { Controller } from '../../fonaments/http/controller';
import { ResponseBuilder } from '../../fonaments/http/response-builder';
import { NotFoundException } from '../../fonaments/exceptions/not-found-exception';
import { FwCloud } from '../../models/fwcloud/FwCloud';
import { AuditLogHelper } from '../../models/audit/audit-log.helper';
import {
  isReplicationProfileTargetKind,
  ReplicationProfile,
  ReplicationProfileTargetKind,
} from '../../models/replication-profile/replication-profile.model';
import { ReplicationProfileService } from '../../models/replication-profile/replication-profile.service';
import { ProfileApplicationService } from '../../models/replication-profile/profile-application.service';
import {
  PolicyReplicationMode,
  PolicyReplicationRequest,
} from '../../models/replication-profile/policy-replication.types';
import { ReplicationProfilePolicy } from '../../policies/replication-profile.policy';
import { ReplicationProfileListQueryDto } from './dtos/replication-profile-query.dto';
import { ReplicationProfileResponseDto } from './dtos/replication-profile-response.dto';
import { ReplicationProfileApplyDto } from './dtos/replication-profile-apply.dto';

export class ReplicationProfileController extends Controller {
  protected _fwCloud: FwCloud;
  protected _replicationProfileService: ReplicationProfileService;
  protected _profileApplicationService: ProfileApplicationService;

  public async make(request: Request): Promise<void> {
    this._replicationProfileService = await this._app.getService<ReplicationProfileService>(
      ReplicationProfileService.name,
    );

    this._profileApplicationService = await this._app.getService<ProfileApplicationService>(
      ProfileApplicationService.name,
    );

    this._fwCloud = await FwCloud.findOneOrFail({
      where: { id: parseInt(String(request.params.fwcloud)) },
    });
  }

  @Validate()
  @ValidateQuery(ReplicationProfileListQueryDto)
  public async index(request: Request): Promise<ResponseBuilder> {
    (await ReplicationProfilePolicy.index(request.session.user, this._fwCloud)).authorize();

    const profiles = await this._replicationProfileService.findActive(
      this.parseTargetKind(request.query.targetKind),
    );

    return ResponseBuilder.buildResponse()
      .status(200)
      .body(profiles.map((profile) => this.toResponse(profile)));
  }

  @Validate()
  public async show(request: Request): Promise<ResponseBuilder> {
    (await ReplicationProfilePolicy.show(request.session.user, this._fwCloud)).authorize();

    const version = this.parseVersionParam(request);

    const profile = await this._replicationProfileService.findByCodeAndVersion(
      String(request.params.code),
      version,
    );

    if (!profile) {
      throw new NotFoundException('Replication profile not found');
    }

    return ResponseBuilder.buildResponse().status(200).body(this.toResponse(profile));
  }

  @Validate(ReplicationProfileApplyDto)
  public async apply(request: Request): Promise<ResponseBuilder> {
    const version = this.parseVersionParam(request);
    const body = request.body as ReplicationProfileApplyDto;
    const replication: PolicyReplicationRequest = {
      sourceProfile: {
        firewallId: body.sourceProfile.firewallId,
        interfaceRoles: body.sourceProfile.interfaceRoles,
        nodeRoles: body.sourceProfile.nodeRoles,
      },
      target: {
        kind: body.target.kind as ReplicationProfileTargetKind,
        id: body.target.id,
      },
      interfaceRoleMapping: body.interfaceRoleMapping,
      nodeRoleMapping: body.nodeRoleMapping,
      mode: body.mode as PolicyReplicationMode,
    };

    const result = await this._profileApplicationService.apply(
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

  private parseTargetKind(value: unknown): ReplicationProfileTargetKind | undefined {
    if (typeof value !== 'string') {
      return undefined;
    }

    const normalized = value.trim().toLowerCase();

    return isReplicationProfileTargetKind(normalized) ? normalized : undefined;
  }

  private toResponse(profile: ReplicationProfile): ReplicationProfileResponseDto {
    return {
      id: profile.id,
      code: profile.code,
      version: profile.version,
      name: profile.name,
      description: profile.description,
      scope: profile.scope,
      targetKind: profile.targetKind,
      model: profile.model,
    };
  }
}
