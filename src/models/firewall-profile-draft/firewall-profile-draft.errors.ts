import type { ErrorPayload } from '../../fonaments/http/response-builder';
import { HttpException } from '../../fonaments/exceptions/http/http-exception';
import type { FirewallProfileDraftStatus } from './firewall-profile-draft.types';

export const FIREWALL_PROFILE_DRAFT_TRANSITION_CONFLICT =
  'FIREWALL_PROFILE_DRAFT_TRANSITION_CONFLICT' as const;
export const UNSUPPORTED_FIREWALL_PROFILE_DRAFT_CONTRACT_VERSION =
  'UNSUPPORTED_FIREWALL_PROFILE_DRAFT_CONTRACT_VERSION' as const;

interface DraftErrorPayload extends ErrorPayload {
  code: string;
  [key: string]: unknown;
}

export class FirewallProfileDraftTransitionConflictError extends HttpException {
  public readonly code = FIREWALL_PROFILE_DRAFT_TRANSITION_CONFLICT;

  constructor(
    public readonly draftId: number,
    public readonly currentStatus: FirewallProfileDraftStatus,
    public readonly attemptedStatus: FirewallProfileDraftStatus,
  ) {
    super(`Draft cannot transition from '${currentStatus}' to '${attemptedStatus}'.`, 409);
  }

  public toResponse(): DraftErrorPayload {
    return {
      ...super.toResponse(),
      code: this.code,
      draftId: this.draftId,
      currentStatus: this.currentStatus,
      attemptedStatus: this.attemptedStatus,
    };
  }
}

export class UnsupportedFirewallProfileDraftContractVersionError extends HttpException {
  public readonly code = UNSUPPORTED_FIREWALL_PROFILE_DRAFT_CONTRACT_VERSION;

  constructor(
    public readonly draftId: number,
    public readonly receivedVersion: string,
    public readonly supportedVersions: string[],
  ) {
    super(
      `Draft ${draftId} uses unsupported contract version '${receivedVersion}'. Supported versions: ${supportedVersions.join(', ')}.`,
      409,
    );
  }

  public toResponse(): DraftErrorPayload {
    return {
      ...super.toResponse(),
      code: this.code,
      draftId: this.draftId,
      receivedVersion: this.receivedVersion,
      supportedVersions: [...this.supportedVersions],
    };
  }
}
