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
}
