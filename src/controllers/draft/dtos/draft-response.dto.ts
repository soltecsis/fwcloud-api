import type {
  FirewallProfileDraftStatus,
  FirewallProfileDraftStepLogEntry,
  FirewallProfileDraftTargetIds,
} from '../../../models/firewall-profile-draft/firewall-profile-draft.types';

/** Draft history view without internal or detail-only payloads. */
export interface FirewallProfileDraftSummaryDto {
  id: number;
  fwcloud_id: number;
  user_id: number | null;
  status: FirewallProfileDraftStatus;
  contract_version: string;
  request_id: string | null;
  instruction_original: string | null;
  created_at: string;
  updated_at: string;
  validated_at: string | null;
  previewed_at: string | null;
  apply_pending_at: string | null;
  applied_at: string | null;
  failed_at: string | null;
  discarded_at: string | null;
  expired_at: string | null;
}

/** Detailed view; integrity and idempotency artifacts remain internal. */
export interface FirewallProfileDraftDetailDto extends FirewallProfileDraftSummaryDto {
  proposal: unknown;
  target_ids: FirewallProfileDraftTargetIds | null;
  step_log: FirewallProfileDraftStepLogEntry[] | null;
}
