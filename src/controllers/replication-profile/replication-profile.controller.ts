import { Request } from 'express';
import { Validate, ValidateQuery } from '../../decorators/validate.decorator';
import { Controller } from '../../fonaments/http/controller';
import { ResponseBuilder } from '../../fonaments/http/response-builder';
import { NotFoundException } from '../../fonaments/exceptions/not-found-exception';
import { FwCloud } from '../../models/fwcloud/FwCloud';
import {
  isReplicationProfileTargetKind,
  ReplicationProfile,
  ReplicationProfileTargetKind,
} from '../../models/replication-profile/replication-profile.model';
import { ReplicationProfileService } from '../../models/replication-profile/replication-profile.service';
import { FwCloudPolicy } from '../../policies/fwcloud.policy';
import { ReplicationProfileListQueryDto } from './dtos/replication-profile-query.dto';
import { ReplicationProfileResponseDto } from './dtos/replication-profile-response.dto';

export class ReplicationProfileController extends Controller {
  protected _fwCloud: FwCloud;
  protected _replicationProfileService: ReplicationProfileService;

  public async make(request: Request): Promise<void> {
    this._replicationProfileService = await this._app.getService<ReplicationProfileService>(
      ReplicationProfileService.name,
    );

    this._fwCloud = await FwCloud.findOneOrFail({
      where: { id: parseInt(String(request.params.fwcloud)) },
    });
  }

  @Validate()
  @ValidateQuery(ReplicationProfileListQueryDto)
  public async index(request: Request): Promise<ResponseBuilder> {
    (await FwCloudPolicy.show(request.session.user, this._fwCloud)).authorize();

    const profiles = await this._replicationProfileService.findActive(
      this.parseTargetKind(request.query.targetKind),
    );

    return ResponseBuilder.buildResponse()
      .status(200)
      .body(profiles.map((profile) => this.toResponse(profile)));
  }

  @Validate()
  public async show(request: Request): Promise<ResponseBuilder> {
    (await FwCloudPolicy.show(request.session.user, this._fwCloud)).authorize();

    const version = parseInt(String(request.params.version), 10);

    if (Number.isNaN(version)) {
      throw new NotFoundException('Replication profile not found');
    }

    const profile = await this._replicationProfileService.findByCodeAndVersion(
      String(request.params.code),
      version,
    );

    if (!profile) {
      throw new NotFoundException('Replication profile not found');
    }

    return ResponseBuilder.buildResponse().status(200).body(this.toResponse(profile));
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
