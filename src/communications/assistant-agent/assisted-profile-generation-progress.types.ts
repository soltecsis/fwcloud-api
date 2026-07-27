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

import type { StatusType } from '../../sockets/messages/socket-message';
import { ProgressPayload } from '../../sockets/messages/socket-message';

export type AssistedProfileGenerationStage =
  | 'queued'
  | 'generating'
  | 'validating_contract'
  | 'needs_clarification'
  | 'mapping'
  | 'validating_domain'
  | 'persisting_draft'
  | 'completed'
  | 'failed';

export interface AssistedProfileGenerationProgressErrorDetail {
  readonly path?: string;
  readonly message: string;
}

export interface AssistedProfileGenerationProgressError {
  readonly code: string;
  readonly message: string;
  /** Present only for domain-validation failures; safe paths/messages for the UI. */
  readonly errors?: AssistedProfileGenerationProgressErrorDetail[];
}

export interface AssistedProfileGenerationProgressClarification {
  readonly question: string;
  readonly options?: string[];
}

export interface AssistedProfileGenerationProgressInput {
  readonly generationId: string;
  readonly fwcloudId: number;
  readonly userId: number;
  readonly stage: AssistedProfileGenerationStage;
  readonly message: string;
  readonly progress?: number;
  readonly queuePosition?: number;
  readonly draftId?: number;
  readonly error?: AssistedProfileGenerationProgressError;
  readonly clarification?: AssistedProfileGenerationProgressClarification;
}

const STATUS_TYPE_BY_STAGE: Record<AssistedProfileGenerationStage, StatusType> = {
  queued: 'info',
  generating: 'info',
  validating_contract: 'info',
  needs_clarification: 'notice',
  mapping: 'info',
  validating_domain: 'info',
  persisting_draft: 'info',
  completed: 'success',
  failed: 'error',
};

/**
 * Assisted Profile generation progress, reported through the existing
 * Socket.IO Channel/ProgressPayload mechanism. Deliberately never carries
 * raw prompts, full agent responses, credentials, secrets, or stack traces
 * — only safe, structured, UI-facing fields.
 */
export class AssistedProfileGenerationProgressPayload extends ProgressPayload {
  readonly generation_id: string;
  readonly fwcloud_id: number;
  readonly user_id: number;
  readonly stage: AssistedProfileGenerationStage;
  readonly progress?: number;
  readonly queue_position?: number;
  readonly draft_id?: number;
  readonly error?: AssistedProfileGenerationProgressError;
  readonly clarification?: AssistedProfileGenerationProgressClarification;

  constructor(input: AssistedProfileGenerationProgressInput) {
    super(STATUS_TYPE_BY_STAGE[input.stage], false, input.message, input.generationId);
    this.generation_id = input.generationId;
    this.fwcloud_id = input.fwcloudId;
    this.user_id = input.userId;
    this.stage = input.stage;
    if (input.progress !== undefined) this.progress = input.progress;
    if (input.queuePosition !== undefined) this.queue_position = input.queuePosition;
    if (input.draftId !== undefined) this.draft_id = input.draftId;
    if (input.error !== undefined) this.error = input.error;
    if (input.clarification !== undefined) this.clarification = input.clarification;
  }
}

/** Minimal subset implemented by the existing request-scoped Channel. */
export interface AssistedProfileGenerationChannel {
  emit(event: 'message', payload: object): boolean;
}
