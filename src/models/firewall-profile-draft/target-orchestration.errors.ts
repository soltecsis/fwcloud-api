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

export const TARGET_ORCHESTRATION_ERROR_CODES = Object.freeze({
  TARGET_CREATION_FAILED: 'TARGET_CREATION_FAILED',
  INTERFACE_CREATION_FAILED: 'INTERFACE_CREATION_FAILED',
  PROFILE_APPLY_FAILED: 'PROFILE_APPLY_FAILED',
});

export const TARGET_ORCHESTRATION_INVALID_STATE = 'TARGET_ORCHESTRATION_INVALID_STATE' as const;
export const TARGET_ORCHESTRATION_ALREADY_STARTED = 'TARGET_ORCHESTRATION_ALREADY_STARTED' as const;
export const TARGET_ORCHESTRATION_PROPOSAL_INVALID =
  'TARGET_ORCHESTRATION_PROPOSAL_INVALID' as const;

interface TargetOrchestrationErrorPayload extends ErrorPayload {
  code: string;
  draftId: number;
}

/** The draft was not `apply_pending` when orchestration was asked to run. */
export class TargetOrchestrationInvalidStateError extends HttpException {
  public readonly code = TARGET_ORCHESTRATION_INVALID_STATE;

  constructor(
    public readonly draftId: number,
    public readonly currentStatus: string,
  ) {
    super(
      `Firewall Profile draft ${draftId} is '${currentStatus}', not 'apply_pending': target orchestration must only run inside a confirmed apply operation`,
      409,
    );
  }

  public toResponse(): TargetOrchestrationErrorPayload {
    return { ...super.toResponse(), code: this.code, draftId: this.draftId };
  }
}

/**
 * The draft's step log already carries a target-orchestration step. Running
 * orchestration again could re-create resources that already exist: this is
 * a hard stop, never an automatic resume.
 */
export class TargetOrchestrationAlreadyStartedError extends HttpException {
  public readonly code = TARGET_ORCHESTRATION_ALREADY_STARTED;

  constructor(public readonly draftId: number) {
    super(
      `Firewall Profile draft ${draftId} already has target orchestration progress recorded; it must be reconciled manually, not re-run`,
      409,
    );
  }

  public toResponse(): TargetOrchestrationErrorPayload {
    return { ...super.toResponse(), code: this.code, draftId: this.draftId };
  }
}

/** The draft's stored proposal is not a provisioning-mode profile with a target. */
export class TargetOrchestrationProposalError extends HttpException {
  public readonly code = TARGET_ORCHESTRATION_PROPOSAL_INVALID;

  constructor(
    public readonly draftId: number,
    public readonly reason: string,
  ) {
    super(`Firewall Profile draft ${draftId} cannot be orchestrated: ${reason}`, 422);
  }

  public toResponse(): TargetOrchestrationErrorPayload {
    return { ...super.toResponse(), code: this.code, draftId: this.draftId };
  }
}
