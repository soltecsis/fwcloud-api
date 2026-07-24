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

import type { ErrorPayload } from '../../fonaments/http/response-builder';
import { HttpException } from '../../fonaments/exceptions/http/http-exception';

export const ASSISTED_PROFILE_GENERATION_QUEUE_SATURATED =
  'ASSISTED_PROFILE_GENERATION_QUEUE_SATURATED' as const;
export const ASSISTED_PROFILE_GENERATION_ALREADY_IN_PROGRESS =
  'ASSISTED_PROFILE_GENERATION_ALREADY_IN_PROGRESS' as const;

interface GenerationQueueErrorPayload extends ErrorPayload {
  code: string;
  [key: string]: unknown;
}

export class GenerationQueueSaturatedError extends HttpException {
  public readonly code = ASSISTED_PROFILE_GENERATION_QUEUE_SATURATED;
  public readonly httpStatus = 503;

  constructor(public readonly maxDepth: number) {
    super('The Assisted Profile generation queue is full. Please try again later.', 503);
  }

  public toResponse(): GenerationQueueErrorPayload {
    return {
      ...super.toResponse(),
      code: this.code,
      maxDepth: this.maxDepth,
    };
  }
}

export class GenerationAlreadyInProgressError extends HttpException {
  public readonly code = ASSISTED_PROFILE_GENERATION_ALREADY_IN_PROGRESS;
  public readonly httpStatus = 409;

  constructor(
    public readonly generationId: string,
    public readonly userId: number,
    public readonly fwcloudId: number,
  ) {
    super('A generation is already in progress for this user and FWCloud.', 409);
  }

  public toResponse(): GenerationQueueErrorPayload {
    return {
      ...super.toResponse(),
      code: this.code,
      generation_id: this.generationId,
    };
  }
}
