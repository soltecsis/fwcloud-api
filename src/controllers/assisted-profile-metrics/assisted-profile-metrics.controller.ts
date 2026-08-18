/*!
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

import type { Request } from 'express';
import { Validate } from '../../decorators/validate.decorator';
import { Controller } from '../../fonaments/http/controller';
import { ResponseBuilder } from '../../fonaments/http/response-builder';
import { isAssistedProfileDeploymentEnabled } from '../../communications/assistant-agent/assisted-profile-deployment.config';
import {
  AssistedProfileMetricsService,
  type AssistedProfileMetricsSnapshot,
} from '../../models/assisted-profile-metrics/assisted-profile-metrics.service';
import type { AssistedProfileMetricsDto } from './dto/assisted-profile-metrics-response.dto';

/**
 * Renames the snapshot's fields to the API's snake_case convention. Nothing is
 * copied: `AssistedProfileMetricsService.snapshot()` already builds fresh
 * families, samples and label objects on every call, so a second defensive copy
 * here would only duplicate work.
 */
const toDto = (
  snapshot: AssistedProfileMetricsSnapshot,
  deploymentEnabled: boolean,
): AssistedProfileMetricsDto => ({
  deployment_enabled: deploymentEnabled,
  collection_started_at: snapshot.collectionStartedAt,
  collected_at: snapshot.collectedAt,
  families: snapshot.families.map(({ name, type, help, labelNames, samples }) => ({
    name,
    type,
    help,
    label_names: labelNames,
    samples,
  })),
});

/**
 * Read-only operator access to the Assisted Profile adoption counters (API-17).
 *
 * Administrator-gated at the route (`isAdmin`) because the funnel describes the
 * whole installation rather than one FWCloud, and unlike every other Assisted
 * Profile route it is deliberately *not* hidden when the deployment flag is
 * off: an operator closing a pilot still needs to read what the pilot produced,
 * and the payload reports the flag's state instead. Nothing here mutates
 * anything, so there is no confirm-token or Idempotency-Key involvement.
 */
export class AssistedProfileMetricsController extends Controller {
  @Validate()
  public async show(request: Request): Promise<ResponseBuilder> {
    const metricsService = await this._app.getService<AssistedProfileMetricsService>(
      AssistedProfileMetricsService.name,
    );

    return ResponseBuilder.buildResponse()
      .status(200)
      .body(toDto(metricsService.snapshot(), isAssistedProfileDeploymentEnabled(this._app)));
  }
}
