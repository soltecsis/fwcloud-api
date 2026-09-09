import type { FirewallProfileDraft } from '../../src/models/firewall-profile-draft/firewall-profile-draft.model';
import type { FirewallProfileDraftStatus } from '../../src/models/firewall-profile-draft/firewall-profile-draft.types';
import StringHelper from '../../src/utils/string.helper';

/**
 * Attributes for a draft row parked in an arbitrary lifecycle state.
 *
 * Tests that exercise a transition need a draft that already looks like it
 * reached the state it is transitioning from — including the lifecycle
 * timestamp that state implies. That status-to-timestamp mapping is the part
 * worth sharing; everything else is per-suite and comes from `overrides`.
 */
export function makeFirewallProfileDraftAttributes(
  fwCloudId: number,
  status: FirewallProfileDraftStatus,
  overrides: Partial<FirewallProfileDraft> = {},
): Partial<FirewallProfileDraft> {
  const now = new Date();

  return {
    fwCloudId,
    createdBy: null,
    updatedBy: null,
    status,
    contractVersion: 'apg.mvp.v1',
    assumptions: null,
    previewHash: null,
    applyHash: null,
    stepLog: [],
    targetIds: null,
    idempotencyKeyRef: null,
    requestId: null,
    createdAt: now,
    updatedAt: now,
    validatedAt: now,
    previewedAt: status === 'preview_ok' ? now : null,
    applyPendingAt: status === 'apply_pending' ? now : null,
    appliedAt: status === 'applied' ? now : null,
    failedAt: status === 'apply_failed' ? now : null,
    discardedAt: status === 'discarded' ? now : null,
    expiredAt: status === 'expired' ? now : null,
    ...overrides,
  };
}

/**
 * A stored proposal in provisioning mode: the minimal WAN/LAN firewall the
 * apply and orchestration suites need a draft to carry. Shared because every
 * suite that applies a draft needs the same shape, and a divergence between
 * copies shows up as an unrelated-looking apply failure.
 */
export function makeProvisioningProposal(overrides: Record<string, unknown> = {}) {
  return {
    name: `Assisted Profile ${StringHelper.randomize(8)}`,
    description: null,
    scope: 'generic',
    targetKind: 'firewall',
    category: 'Assisted Profile',
    model: {
      compatibility: { targetKinds: ['firewall'] },
      provision: {
        interfaces: [
          { name: 'WAN', role: 'wan' },
          { name: 'LAN', role: 'lan' },
        ],
        rules: [{ chain: 'forward', action: 'accept', inRole: 'lan', outRole: 'wan' }],
      },
    },
    ...overrides,
  };
}
