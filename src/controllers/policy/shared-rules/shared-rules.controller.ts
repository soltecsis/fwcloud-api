import { Request, Response } from 'express';
import { Validate } from '../../../decorators/validate.decorator';
import { logger } from '../../../fonaments/abstract-application';
import { Controller } from '../../../fonaments/http/controller';
import { SharedRulesService } from '../../../models/policy/shared-rules.service';

class LegacyResponseBuilder {
  private _response: Response;
  private _status = 200;
  private _payload: unknown;
  private _hasPayload = false;

  public status(status: number): LegacyResponseBuilder {
    this._status = status;
    return this;
  }

  public body(payload: unknown): LegacyResponseBuilder {
    this._payload = payload;
    this._hasPayload = true;
    return this;
  }

  public build(response: Response): LegacyResponseBuilder {
    this._response = response;
    this._response.status(this._status);
    return this;
  }

  public send(): Response {
    if (this._status === 204 || this._status === 304 || !this._hasPayload) {
      return this._response.end();
    }

    return this._response.json(this._payload);
  }
}

interface LegacyHandlerOptions {
  successStatus?: number;
  emptyStatus?: number;
}

export class SharedRulesController extends Controller {
  private _sharedRulesService: SharedRulesService;

  public async make(): Promise<void> {
    this._sharedRulesService = await this._app.getService<SharedRulesService>(
      SharedRulesService.name,
    );
  }

  private legacyResponse(status: number, payload?: unknown): LegacyResponseBuilder {
    const builder = new LegacyResponseBuilder().status(status);

    if (payload !== undefined) {
      builder.body(payload);
    }

    return builder;
  }

  private async handleLegacyRequest(
    action: () => Promise<unknown>,
    errorMessage: string,
    options: LegacyHandlerOptions = {},
  ): Promise<LegacyResponseBuilder> {
    const successStatus = options.successStatus ?? 200;
    const emptyStatus = options.emptyStatus ?? 204;

    try {
      const payload = await action();

      if (payload === undefined) {
        return this.legacyResponse(emptyStatus);
      }

      return this.legacyResponse(successStatus, payload);
    } catch (error) {
      logger().error(`${errorMessage}: ${error?.message ? error.message : JSON.stringify(error)}`);
      return this.legacyResponse(400, error);
    }
  }

  @Validate()
  public async get(req: Request): Promise<LegacyResponseBuilder> {
    return this.handleLegacyRequest(
      () => this._sharedRulesService.get(req.body),
      'Error getting shared rule sets',
    );
  }

  @Validate()
  public async store(req: Request): Promise<LegacyResponseBuilder> {
    return this.handleLegacyRequest(
      () => this._sharedRulesService.create(req.body),
      'Error creating shared rule set',
    );
  }

  @Validate()
  public async update(req: Request): Promise<LegacyResponseBuilder> {
    return this.handleLegacyRequest(
      () => this._sharedRulesService.update(req.body),
      'Error updating shared rule set',
      { successStatus: 204 },
    );
  }

  @Validate()
  public async delete(req: Request): Promise<LegacyResponseBuilder> {
    return this.handleLegacyRequest(
      () => this._sharedRulesService.delete(req.body),
      'Error deleting shared rule set',
      { successStatus: 204 },
    );
  }

  @Validate()
  public async applications(req: Request): Promise<LegacyResponseBuilder> {
    return this.handleLegacyRequest(
      () => this._sharedRulesService.getApplications(req.body),
      'Error getting shared rule set applications',
    );
  }

  @Validate()
  public async apply(req: Request): Promise<LegacyResponseBuilder> {
    return this.handleLegacyRequest(
      () => this._sharedRulesService.apply(req.body),
      'Error applying shared rule set',
    );
  }

  @Validate()
  public async updateApplication(req: Request): Promise<LegacyResponseBuilder> {
    return this.handleLegacyRequest(
      () => this._sharedRulesService.updateApplication(req.body),
      'Error updating shared rule set application',
      { successStatus: 204 },
    );
  }

  @Validate()
  public async unapply(req: Request): Promise<LegacyResponseBuilder> {
    return this.handleLegacyRequest(
      () => this._sharedRulesService.unapply(req.body),
      'Error unapplying shared rule set',
      { successStatus: 204 },
    );
  }

  @Validate()
  public async rules(req: Request): Promise<LegacyResponseBuilder> {
    return this.handleLegacyRequest(
      () => this._sharedRulesService.getRules(req.body),
      'Error getting shared rules',
    );
  }

  @Validate()
  public async storeRule(req: Request): Promise<LegacyResponseBuilder> {
    return this.handleLegacyRequest(
      () => this._sharedRulesService.createRule(req.body),
      'Error creating shared rule',
    );
  }

  @Validate()
  public async updateRule(req: Request): Promise<LegacyResponseBuilder> {
    return this.handleLegacyRequest(
      () => this._sharedRulesService.updateRule(req.body),
      'Error updating shared rule',
      { successStatus: 204 },
    );
  }

  @Validate()
  public async deleteRules(req: Request): Promise<LegacyResponseBuilder> {
    return this.handleLegacyRequest(
      () => this._sharedRulesService.deleteRules(req.body),
      'Error deleting shared rules',
      { successStatus: 204 },
    );
  }
}
