import { describeName, expect } from '../../../mocha/global-setup';
import {
  canonicalizeFirewallProfileDraftValue,
  hashFirewallProfileDraftValue,
} from '../../../../src/models/firewall-profile-draft/firewall-profile-draft.hash';
import { FirewallProfileDraft } from '../../../../src/models/firewall-profile-draft/firewall-profile-draft.model';

describe(describeName('FirewallProfileDraft model Unit Tests'), () => {
  it('hashes semantically identical object key order deterministically with SHA-256', () => {
    const first = { z: [3, 2, 1], a: { second: true, first: 'value' } };
    const second = { a: { first: 'value', second: true }, z: [3, 2, 1] };

    expect(canonicalizeFirewallProfileDraftValue(first)).to.equal(
      canonicalizeFirewallProfileDraftValue(second),
    );
    expect(hashFirewallProfileDraftValue(first)).to.equal(hashFirewallProfileDraftValue(second));
    expect(hashFirewallProfileDraftValue(first)).to.match(/^[a-f0-9]{64}$/);
  });

  it('computes the proposal hash and rejects later proposal mutation', () => {
    const draft = new FirewallProfileDraft();
    draft.proposal = { generated: { target: { type: 'firewall' } } };
    draft.setProposalHash();
    draft.rememberProposalHash();
    draft.proposal = { generated: { target: { type: 'cluster' } } };

    expect(() => draft.rejectProposalMutation()).to.throw(
      'A validated Firewall Profile draft proposal is immutable',
    );
  });

  it('rejects secret-bearing proposal and step-log fields', () => {
    const draft = new FirewallProfileDraft();
    draft.proposal = { runtime: { password: 'do-not-store' } };
    draft.stepLog = [];

    expect(() => draft.rejectSecrets()).to.throw('must not contain credentials or secrets');
  });
});
