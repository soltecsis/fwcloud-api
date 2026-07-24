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

import type { ValidatedAssistedProfileProposal } from '../../models/assistant-contract/assistant-contract-customs';

export const GENERATION_QUEUED_EVENT = 'assistant.generation.queued' as const;
export const GENERATION_POSITION_CHANGED_EVENT = 'assistant.generation.position_changed' as const;
export const GENERATION_STARTED_EVENT = 'assistant.generation.started' as const;
export const GENERATION_COMPLETED_EVENT = 'assistant.generation.completed' as const;
export const GENERATION_FAILED_EVENT = 'assistant.generation.failed' as const;

export type GenerationQueueEventName =
  | typeof GENERATION_QUEUED_EVENT
  | typeof GENERATION_POSITION_CHANGED_EVENT
  | typeof GENERATION_STARTED_EVENT
  | typeof GENERATION_COMPLETED_EVENT
  | typeof GENERATION_FAILED_EVENT;

export type GenerationQueueStatus = 'queued' | 'running' | 'completed' | 'failed';

/**
 * Channel payload. `position=0` is executing, `position=1` is next, and higher
 * values are one-based positions among waiting jobs.
 */
export interface GenerationQueueEvent {
  readonly event: GenerationQueueEventName;
  readonly generation_id: string;
  readonly fwcloud_id: number;
  readonly user_id: number;
  readonly status: GenerationQueueStatus;
  readonly position?: number;
  /** Waiting jobs only; the active generation is counted separately. */
  readonly queue_depth: number;
  readonly timestamp: string;
}

/** Minimal subset implemented by the existing request-scoped Channel. */
export interface GenerationQueueChannel {
  emit(event: 'message', payload: GenerationQueueEvent): boolean;
}

export interface GenerationQueueExecutionContext {
  readonly generationId: string;
}

export interface GenerationQueueRequest {
  /**
   * Callers may assign an id before enqueueing. When omitted, the queue
   * assigns a UUIDv7-based id before it creates the accepted queue entry.
   */
  readonly generationId?: string;
  readonly fwcloudId: number;
  readonly userId: number;
  readonly requestId?: string;
  /**
   * Must be the request-scoped Channel created after FWCloud authorization.
   * Omitting it is supported for non-HTTP tools and focused tests.
   */
  readonly channel?: GenerationQueueChannel;
  /** The only callback in production that may invoke AgentHttpClient.generate. */
  readonly execute: (
    context: GenerationQueueExecutionContext,
  ) => Promise<ValidatedAssistedProfileProposal>;
}

export interface GenerationQueueResult {
  readonly generationId: string;
  readonly proposal: ValidatedAssistedProfileProposal;
}

export type GenerationQueueObservationType =
  | 'enqueued'
  | 'started'
  | 'position_changed'
  | 'completed'
  | 'failed'
  | 'overflow_rejected'
  | 'duplicate_rejected';

/** Safe operational metadata. It never contains prompt or proposal bodies. */
export interface GenerationQueueObservation {
  readonly type: GenerationQueueObservationType;
  readonly generationId?: string;
  readonly requestId?: string;
  readonly fwcloudId: number;
  readonly userId: number;
  readonly queueDepth: number;
  readonly activeGenerationId?: string;
  readonly position?: number;
  readonly waitingMs?: number;
  readonly executionMs?: number;
  readonly errorCode?: string;
}

export interface GenerationQueueObserver {
  record(observation: GenerationQueueObservation): void;
}

export interface GenerationQueueStats {
  readonly maxDepth: number;
  readonly queueDepth: number;
  readonly activeGenerationId: string | null;
  readonly enqueueCount: number;
  readonly overflowRejectionCount: number;
  readonly duplicateRejectionCount: number;
  readonly completedCount: number;
  readonly failedCount: number;
}
