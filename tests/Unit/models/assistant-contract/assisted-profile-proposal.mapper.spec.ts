import { describeName, expect } from '../../../mocha/global-setup';
import {
  AssistedProfileProposalMapper,
  UnsupportedAssistedProfileContractVersionError,
} from '../../../../src/models/assistant-contract/assisted-profile-proposal.mapper';
import {
  AssistantContractCustoms,
  ValidatedAssistedProfileProposal,
} from '../../../../src/models/assistant-contract/assistant-contract-customs';
import apgMvpV1Schema from '../../../../src/models/assistant-contract/schemas/apg.mvp.v1.schema.json';
import {
  VendoredContractSchema,
  VENDORED_CONTRACT_SCHEMAS,
} from '../../../../src/models/assistant-contract/schemas/manifest';
import { REPLICATION_PROFILE_INTERFACE_ROLES } from '../../../../src/models/replication-profile/replication-profile.constants';
import { validateReplicationProfilePayload } from '../../../../src/models/replication-profile/replication-profile-validation.service';
import {
  makeAssistedProfileProposalFixture,
  validateAssistedProfileFixtureAtGateway,
} from '../../../utils/assisted-profile-proposal-fixtures';

function expectDomainValid(dto: unknown): void {
  expect(validateReplicationProfilePayload(dto)).to.deep.equal([]);
}

describe(describeName('AssistedProfileProposalMapper Unit Tests'), () => {
  const mapper = new AssistedProfileProposalMapper();

  it('maps a validated standalone firewall proposal into a domain-valid store DTO', () => {
    const dto = mapper.map(
      validateAssistedProfileFixtureAtGateway(makeAssistedProfileProposalFixture()),
    );
    const provision = dto.model.provision as Record<string, any>;

    expect(dto).to.include({
      code: 'assisted-firewall',
      version: 1,
      name: 'Assisted firewall',
      targetKind: 'firewall',
    });
    expect(provision.interfaces).to.deep.equal([
      { name: 'wan0', role: 'wan' },
      { name: 'lan0', role: 'lan' },
    ]);
    expect(provision.rules[0]).to.deep.include({
      chain: 'forward',
      action: 'accept',
      inRole: 'lan',
      outRole: 'wan',
      service: 'tcp/443',
    });
    expectDomainValid(dto);
  });

  it('maps cluster nodes, preserves sync0, and generates the synchronization rule', () => {
    const dto = mapper.map(
      validateAssistedProfileFixtureAtGateway(
        makeAssistedProfileProposalFixture({ targetKind: 'cluster' }),
      ),
    );
    const provision = dto.model.provision as Record<string, any>;
    const topology = dto.model.topologyPreset as Record<string, any>;

    expect(dto.targetKind).to.equal('cluster');
    expect(topology.nodes).to.deep.equal([
      { name: 'node-a', role: 'primary' },
      { name: 'node-b', role: 'secondary' },
    ]);
    expect(provision.interfaces).to.deep.include({
      name: 'sync0',
      role: 'sync',
      node: 'primary',
    });
    expect(provision.rules).to.deep.include({
      chain: 'forward',
      action: 'accept',
      inRole: 'sync',
      outRole: 'sync',
      comment: 'Allow cluster synchronization traffic.',
      generated: 'cluster-sync',
    });
    expectDomainValid(dto);
  });

  it('generates a default sync0 interface when a cluster proposal omits it', () => {
    const dto = mapper.map(
      validateAssistedProfileFixtureAtGateway(
        makeAssistedProfileProposalFixture({ targetKind: 'cluster', includeSync: false }),
      ),
    );
    const provision = dto.model.provision as Record<string, any>;

    expect(provision.interfaces).to.deep.include({ name: 'sync0', role: 'sync' });
    expectDomainValid(dto);
  });

  it('preserves wan, lan, dmz and sync roles and their rule references', () => {
    const dto = mapper.map(
      validateAssistedProfileFixtureAtGateway(
        makeAssistedProfileProposalFixture({ targetKind: 'cluster', dmz: true }),
      ),
    );
    const provision = dto.model.provision as Record<string, any>;

    expect(provision.interfaces.map((item) => item.role)).to.deep.equal([
      'wan',
      'lan',
      'dmz',
      'sync',
    ]);
    expect(provision.rules).to.deep.include({
      chain: 'forward',
      action: 'accept',
      inRole: 'wan',
      outRole: 'dmz',
      service: 'tcp/443',
      comment: 'Publish HTTPS to the DMZ',
    });
    expectDomainValid(dto);
  });

  it('keeps sync in the shared interface-role contract', () => {
    expect(REPLICATION_PROFILE_INTERFACE_ROLES).to.include('sync');
  });

  it('maps both N and N-1 through explicit version adapters', () => {
    const previousSchema = structuredClone(apgMvpV1Schema) as Record<string, any>;
    previousSchema.$id = 'urn:fwcloud:contract:apg.mvp.v1:0.9.0-test';
    previousSchema.$defs.GenerationMetadataResponse.properties.schemaVersion.const = '0.9.0';
    previousSchema['x-payload-schema-version'] = '0.9.0';
    const previousEntry: VendoredContractSchema = {
      ...VENDORED_CONTRACT_SCHEMAS[0],
      schemaVersion: '0.9.0',
      schema: previousSchema,
      sourceCommit: 'unit-test-n-minus-one',
      sha256: 'unit-test-n-minus-one',
    };
    const manifest = [previousEntry, VENDORED_CONTRACT_SCHEMAS[0]];
    const customs = new AssistantContractCustoms(manifest);
    const versionedMapper = new AssistedProfileProposalMapper(manifest);
    const current = customs.check(makeAssistedProfileProposalFixture());
    const previous = customs.check(makeAssistedProfileProposalFixture({ schemaVersion: '0.9.0' }));

    expect(current.ok).to.be.true;
    expect(previous.ok).to.be.true;
    if (current.ok === false || previous.ok === false) {
      throw new Error('Expected N and N-1 fixtures to pass their gateway schemas');
    }

    const currentDto = versionedMapper.map(current.payload);
    const previousDto = versionedMapper.map(previous.payload);
    expect(currentDto).to.deep.equal(previousDto);
    expect(versionedMapper.supportedVersions).to.deep.equal(['0.9.0', '1.0.0']);
    expectDomainValid(currentDto);
    expectDomainValid(previousDto);
  });

  it('rejects an unsupported version with a typed error and version details', () => {
    const unsupported = makeAssistedProfileProposalFixture({ schemaVersion: '9.9.9' });
    let thrown: unknown;

    try {
      mapper.map(unsupported as unknown as ValidatedAssistedProfileProposal);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).to.be.instanceOf(UnsupportedAssistedProfileContractVersionError);
    const typed = thrown as UnsupportedAssistedProfileContractVersionError;
    expect(typed.details).to.deep.equal({
      code: 'UNSUPPORTED_ASSISTED_PROFILE_CONTRACT_VERSION',
      receivedVersion: '9.9.9',
      supportedVersions: ['1.0.0'],
    });
    expect(typed.message).to.contain("contract version '9.9.9' is not supported");
  });
});
