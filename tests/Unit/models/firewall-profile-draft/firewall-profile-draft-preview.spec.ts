import { describeName, expect } from '../../../mocha/global-setup';
import { AssistedProfileProposalMapper } from '../../../../src/models/assistant-contract/assisted-profile-proposal.mapper';
import { collectAgentAssumptions } from '../../../../src/models/assistant-contract/assisted-profile-assumptions';
import {
  FirewallProfileDraftPreviewHasher,
  FIREWALL_PROFILE_DRAFT_PREVIEW_CONTRACT_VERSION,
} from '../../../../src/models/firewall-profile-draft/firewall-profile-draft-preview.hasher';
import { FirewallProfileDraftPreviewHashError } from '../../../../src/models/firewall-profile-draft/firewall-profile-draft-preview.errors';
import type {
  AssistedProfilePreviewAssumption,
  FirewallProfileDraftPreviewHashInput,
} from '../../../../src/models/firewall-profile-draft/firewall-profile-draft-preview.types';
import {
  makeAssistedProfileProposalFixture,
  validateAssistedProfileFixtureAtGateway,
} from '../../../utils/assisted-profile-proposal-fixtures';

const ASSUMPTION: AssistedProfilePreviewAssumption = {
  id: 'normalization.cluster.default-sync-interface',
  path: 'model.provision.interfaces[2].name',
  value: 'sync0',
  reason: 'No synchronization interface was provided for the cluster.',
  source: 'normalization',
  requires_acknowledgement: true,
};

function makeHashInput(
  overrides: Partial<FirewallProfileDraftPreviewHashInput> = {},
): FirewallProfileDraftPreviewHashInput {
  return {
    preview_contract_version: FIREWALL_PROFILE_DRAFT_PREVIEW_CONTRACT_VERSION,
    draft_id: 7,
    fwcloud_id: 3,
    contract_version: 'apg.mvp.v1',
    proposal_hash: 'a'.repeat(64),
    proposal: { targetKind: 'firewall', name: 'edge', model: { provision: { rules: [] } } },
    target_kind: 'firewall',
    validation: { valid: true, errors: [], warnings: [] },
    assumptions: [ASSUMPTION],
    ...overrides,
  };
}

describe(describeName('Firewall Profile draft preview hashing Unit Tests'), () => {
  const hasher = new FirewallProfileDraftPreviewHasher();

  it('produces the same hash for identical preview-bound content', () => {
    expect(hasher.calculatePreviewHash(makeHashInput())).to.equal(
      hasher.calculatePreviewHash(makeHashInput()),
    );
  });

  it('produces a lower-case SHA-256 hex digest', () => {
    expect(hasher.calculatePreviewHash(makeHashInput())).to.match(/^[0-9a-f]{64}$/);
  });

  it('ignores property insertion order in the proposal and in assumptions', () => {
    const ordered = makeHashInput({
      proposal: { targetKind: 'firewall', name: 'edge', model: { provision: { rules: [] } } },
      assumptions: [
        {
          id: ASSUMPTION.id,
          path: ASSUMPTION.path,
          value: ASSUMPTION.value,
          reason: ASSUMPTION.reason,
          source: ASSUMPTION.source,
          requires_acknowledgement: true,
        },
      ],
    });
    const shuffled = makeHashInput({
      proposal: { model: { provision: { rules: [] } }, name: 'edge', targetKind: 'firewall' },
      assumptions: [
        {
          requires_acknowledgement: true,
          source: ASSUMPTION.source,
          reason: ASSUMPTION.reason,
          value: ASSUMPTION.value,
          path: ASSUMPTION.path,
          id: ASSUMPTION.id,
        },
      ],
    });

    expect(hasher.calculatePreviewHash(ordered)).to.equal(hasher.calculatePreviewHash(shuffled));
  });

  it('changes when a proposal value changes', () => {
    const changed = makeHashInput({
      proposal: { targetKind: 'firewall', name: 'renamed', model: { provision: { rules: [] } } },
    });

    expect(hasher.calculatePreviewHash(changed)).to.not.equal(
      hasher.calculatePreviewHash(makeHashInput()),
    );
  });

  it('changes when an assumption value or reason changes', () => {
    const changedValue = makeHashInput({
      assumptions: [{ ...ASSUMPTION, value: 'sync1' }],
    });
    const changedReason = makeHashInput({
      assumptions: [{ ...ASSUMPTION, reason: 'A different justification.' }],
    });
    const baseline = hasher.calculatePreviewHash(makeHashInput());

    expect(hasher.calculatePreviewHash(changedValue)).to.not.equal(baseline);
    expect(hasher.calculatePreviewHash(changedReason)).to.not.equal(baseline);
    expect(hasher.calculatePreviewHash(changedValue)).to.not.equal(
      hasher.calculatePreviewHash(changedReason),
    );
  });

  it('changes when the contract version changes', () => {
    expect(
      hasher.calculatePreviewHash(makeHashInput({ contract_version: 'apg.mvp.v2' })),
    ).to.not.equal(hasher.calculatePreviewHash(makeHashInput()));
  });

  it('changes when the validator verdict changes', () => {
    const failed = makeHashInput({
      validation: {
        valid: false,
        errors: [{ code: 'invalid_rule_role', message: 'Unknown role.', severity: 'error' }],
        warnings: [],
      },
    });

    expect(hasher.calculatePreviewHash(failed)).to.not.equal(
      hasher.calculatePreviewHash(makeHashInput()),
    );
  });

  it('changes when the draft or FWCloud identity changes', () => {
    const baseline = hasher.calculatePreviewHash(makeHashInput());

    expect(hasher.calculatePreviewHash(makeHashInput({ draft_id: 8 }))).to.not.equal(baseline);
    expect(hasher.calculatePreviewHash(makeHashInput({ fwcloud_id: 4 }))).to.not.equal(baseline);
  });

  it('distinguishes an omitted optional field from an explicit null', () => {
    const omitted = makeHashInput({ assumptions: [{ ...ASSUMPTION, path: null }] });
    const explicit = makeHashInput({ assumptions: [{ ...ASSUMPTION, path: 'name' }] });

    expect(hasher.calculatePreviewHash(omitted)).to.not.equal(
      hasher.calculatePreviewHash(explicit),
    );
  });

  it('rejects a hash input declaring another preview contract version', () => {
    expect(() =>
      hasher.calculatePreviewHash(makeHashInput({ preview_contract_version: 'preview.v0' })),
    ).to.throw(FirewallProfileDraftPreviewHashError);
  });

  it('refuses to bind proposal content carrying credential-like keys', () => {
    expect(() =>
      hasher.calculatePreviewHash(
        makeHashInput({ proposal: { targetKind: 'firewall', model: { password: 'hunter2' } } }),
      ),
    ).to.throw(FirewallProfileDraftPreviewHashError);
  });
});

describe(describeName('Assisted Profile assumption capture Unit Tests'), () => {
  const mapper = new AssistedProfileProposalMapper();

  it('reports nothing for a proposal that specifies everything itself', () => {
    const { assumptions } = mapper.mapWithAssumptions(
      validateAssistedProfileFixtureAtGateway(makeAssistedProfileProposalFixture()),
    );

    expect(assumptions.filter((item) => item.source === 'normalization')).to.deep.equal([]);
  });

  it('reports the cluster synchronization rule the mapper adds', () => {
    const { dto, assumptions } = mapper.mapWithAssumptions(
      validateAssistedProfileFixtureAtGateway(
        makeAssistedProfileProposalFixture({ targetKind: 'cluster' }),
      ),
    );
    const syncRule = assumptions.find((item) => item.id === 'normalization.cluster.sync-rule');
    const rules = (dto.model.provision as Record<string, unknown>).rules as unknown[];

    expect(syncRule).to.not.equal(undefined);
    expect(syncRule?.source).to.equal('normalization');
    expect(syncRule?.path).to.equal(`model.provision.rules[${rules.length - 1}]`);
    expect(syncRule?.reason).to.be.a('string').and.not.empty;
  });

  it('reports the default synchronization interface generated for a cluster', () => {
    const { dto, assumptions } = mapper.mapWithAssumptions(
      validateAssistedProfileFixtureAtGateway(
        makeAssistedProfileProposalFixture({ targetKind: 'cluster', includeSync: false }),
      ),
    );
    const generated = assumptions.find(
      (item) => item.id === 'normalization.cluster.default-sync-interface',
    );
    const interfaces = (dto.model.provision as Record<string, unknown>).interfaces as Array<
      Record<string, unknown>
    >;

    expect(generated?.value).to.equal('sync0');
    expect(generated?.path).to.equal(`model.provision.interfaces[${interfaces.length - 1}].name`);
    expect(interfaces[interfaces.length - 1]).to.include({ name: 'sync0', role: 'sync' });
  });

  it('reports a profile name taken from the target when none was requested', () => {
    const fixture = makeAssistedProfileProposalFixture() as Record<string, any>;
    fixture.generated.profile.name = null;

    const { dto, assumptions } = mapper.mapWithAssumptions(
      validateAssistedProfileFixtureAtGateway(fixture),
    );
    const named = assumptions.find((item) => item.id === 'normalization.profile.name-from-target');

    expect(dto.name).to.equal('edge-firewall');
    expect(named).to.deep.include({
      path: 'name',
      value: 'edge-firewall',
      source: 'normalization',
    });
  });

  it('always reports the defaulted connection type', () => {
    const { assumptions } = mapper.mapWithAssumptions(
      validateAssistedProfileFixtureAtGateway(makeAssistedProfileProposalFixture()),
    );

    expect(assumptions.find((item) => item.id === 'default.ui.connection-type')).to.deep.include({
      path: 'model.uiDefaults.connectionType',
      value: 'agent',
      source: 'default',
    });
  });

  it('keeps assumption ids stable across repeated mappings of the same proposal', () => {
    const fixture = makeAssistedProfileProposalFixture({
      targetKind: 'cluster',
      includeSync: false,
    });
    const first = mapper.mapWithAssumptions(
      validateAssistedProfileFixtureAtGateway(fixture),
    ).assumptions;
    const second = mapper.mapWithAssumptions(
      validateAssistedProfileFixtureAtGateway(fixture),
    ).assumptions;

    expect(first.map((item) => item.id)).to.deep.equal(second.map((item) => item.id));
  });

  it('turns agent warnings into pathless assumptions', () => {
    const fixture = makeAssistedProfileProposalFixture() as Record<string, any>;
    fixture.warnings = [
      {
        code: 'assumption_default_zone',
        message: 'Assumed LAN zone for unspecified interface',
        severity: 'info',
      },
      { code: '', message: '   ', severity: 'info' },
    ];

    const assumptions = collectAgentAssumptions(validateAssistedProfileFixtureAtGateway(fixture));

    // The blank-message warning carries nothing a reviewer could act on.
    expect(assumptions).to.have.length(1);
    expect(assumptions[0]).to.deep.equal({
      id: 'agent.warning.0.assumption_default_zone',
      path: null,
      reason: 'Assumed LAN zone for unspecified interface',
      source: 'agent',
    });
  });

  it('leaves map() behaving exactly as before', () => {
    const proposal = validateAssistedProfileFixtureAtGateway(
      makeAssistedProfileProposalFixture({ targetKind: 'cluster' }),
    );

    expect(mapper.map(proposal)).to.deep.equal(mapper.mapWithAssumptions(proposal).dto);
  });
});
