import type { AssistedProfileAssumption } from '../assistant-contract/assisted-profile-assumptions';

export const FIREWALL_PROFILE_DRAFT_STATUSES = [
  'validated',
  'preview_ok',
  'apply_pending',
  'applied',
  'apply_failed',
  'discarded',
  'expired',
] as const;

export type FirewallProfileDraftStatus = (typeof FIREWALL_PROFILE_DRAFT_STATUSES)[number];

export interface FirewallProfileDraftStepLogEntry {
  step: string;
  status: 'started' | 'success' | 'failed';
  timestamp: string;
  message?: string;
  requestId?: string;
  errorCode?: string;
}

export interface FirewallProfileDraftTargetIds {
  firewallId?: number;
  clusterId?: number;
  nodeIds?: number[];
  profileId?: number;
  profileVersion?: number;
  operationId?: number | string;
}

/**
 * The content a preview hash is calculated from and which therefore invalidates
 * a preview when it changes. `proposal` is absent on purpose: the entity guards
 * it as immutable once persisted.
 */
export interface PreviewBoundDraftContent {
  contractVersion?: string;
  assumptions?: AssistedProfileAssumption[] | null;
}

export interface DraftTransitionContext {
  fwCloudId?: number;
  userId?: number | null;
  requestId?: string | null;
  step?: string;
  message?: string;
  errorCode?: string;
  previewHash?: string | null;
  applyHash?: string | null;
  targetIds?: FirewallProfileDraftTargetIds | null;
  /**
   * Explicit `previewed_at` write. The transition normally only sets the
   * timestamp matching its target status; preview invalidation additionally
   * has to clear a timestamp belonging to the status it is leaving.
   */
  previewedAt?: Date | null;
  /**
   * Step-log entries recorded by the caller before the guarded update, written
   * in the same transaction and ahead of the transition's own entry. Lets a
   * multi-step operation keep one atomic write instead of logging progress onto
   * a draft that may still lose the compare-and-set race.
   */
  precedingSteps?: readonly FirewallProfileDraftStepLogEntry[];
  /**
   * Preview-bound content written by the same guarded update as the transition.
   * Set only by `FirewallProfileDraftStateService.updatePreviewBoundContent()`.
   */
  previewBoundContent?: PreviewBoundDraftContent;
}
