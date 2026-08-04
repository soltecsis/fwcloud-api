/*!
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

import type { Application } from '../../../../src/Application';
import db from '../../../../src/database/database-manager';
import { AuditLog } from '../../../../src/models/audit/AuditLog';
import { FwCloud } from '../../../../src/models/fwcloud/FwCloud';
import { User } from '../../../../src/models/user/User';
import { AssistedProfileProposalMapper } from '../../../../src/models/assistant-contract/assisted-profile-proposal.mapper';
import type { AssistedProfileAssumption } from '../../../../src/models/assistant-contract/assisted-profile-assumptions';
import { FirewallProfileDraft } from '../../../../src/models/firewall-profile-draft/firewall-profile-draft.model';
import {
  FirewallProfileDraftStateService,
  FIREWALL_PROFILE_DRAFT_TRANSITION_AUDIT_CALL,
} from '../../../../src/models/firewall-profile-draft/firewall-profile-draft-state.service';
import { FIREWALL_PROFILE_DRAFT_PREVIEW_AUDIT_CALL } from '../../../../src/models/firewall-profile-draft/firewall-profile-draft-preview.service';
import { FIREWALL_PROFILE_DRAFT_PREVIEW_CONTRACT_VERSION } from '../../../../src/models/firewall-profile-draft/firewall-profile-draft-preview.hasher';
import { FirewallProfileDraftTransitionConflictError } from '../../../../src/models/firewall-profile-draft/firewall-profile-draft.errors';
import type { FirewallProfileDraftStatus } from '../../../../src/models/firewall-profile-draft/firewall-profile-draft.types';
import { ReplicationProfileValidationService } from '../../../../src/models/replication-profile/replication-profile-validation.service';
import StringHelper from '../../../../src/utils/string.helper';
import { describeName, expect, testSuite } from '../../../mocha/global-setup';
import {
  attachSession,
  createFwCloudMemberSession,
  createUser,
  generateSession,
} from '../../../utils/utils';
import { makeFirewallProfileDraftAttributes } from '../../../utils/firewall-profile-draft-factory';
import {
  makeAssistedProfileProposalFixture,
  validateAssistedProfileFixtureAtGateway,
} from '../../../utils/assisted-profile-proposal-fixtures';
import { In, type Repository } from 'typeorm';
import request = require('supertest');

/** Tables a preview must never touch, however the proposal is shaped. */
const TARGET_TABLES = ['firewall', 'cluster', 'interface', 'policy_r'] as const;

function mapFixture(options: Parameters<typeof makeAssistedProfileProposalFixture>[0] = {}): {
  proposal: unknown;
  assumptions: AssistedProfileAssumption[];
} {
  const mapped = new AssistedProfileProposalMapper().mapWithAssumptions(
    validateAssistedProfileFixtureAtGateway(makeAssistedProfileProposalFixture(options)),
  );
  return { proposal: mapped.dto, assumptions: mapped.assumptions };
}

describe(describeName('Firewall Profile Draft preview E2E Tests'), () => {
  let app: Application;
  let adminUser: User;
  let adminUserSessionId: string;
  let fwCloud: FwCloud;
  let repository: Repository<FirewallProfileDraft>;
  let fwCloudRepository: Repository<FwCloud>;
  let auditLogRepository: Repository<AuditLog>;
  let stateService: FirewallProfileDraftStateService;
  const draftIds: number[] = [];

  const previewUrl = (draftId: number, cloudId: number = fwCloud.id) =>
    `/fwclouds/${cloudId}/assistant/drafts/${draftId}/preview`;

  const makeDraft = async (
    status: FirewallProfileDraftStatus,
    overrides: Partial<FirewallProfileDraft> = {},
  ): Promise<FirewallProfileDraft> => {
    const { proposal, assumptions } = mapFixture();
    const draft = repository.create(
      makeFirewallProfileDraftAttributes(fwCloud.id, status, {
        proposal,
        assumptions,
        requestId: `req-${StringHelper.randomize(8)}`,
        ...overrides,
      }),
    );

    const saved = await repository.save(draft);
    draftIds.push(saved.id);
    return saved;
  };

  const countTargetRows = async (): Promise<Record<string, number>> => {
    const counts: Record<string, number> = {};
    for (const table of TARGET_TABLES) {
      const [row] = await db.getSource().query(`SELECT COUNT(*) AS total FROM \`${table}\``);
      counts[table] = Number(row.total);
    }
    return counts;
  };

  const previewHashOf = (draftId: number): Promise<string> =>
    request(app.express)
      .post(previewUrl(draftId))
      .set('Cookie', [attachSession(adminUserSessionId)])
      .expect(200)
      .then((response) => response.body.data.preview_hash);

  const previewAudits = (): Promise<AuditLog[]> =>
    auditLogRepository.find({
      where: { call: FIREWALL_PROFILE_DRAFT_PREVIEW_AUDIT_CALL, fwCloudId: fwCloud.id },
    });

  beforeEach(async () => {
    app = testSuite.app;
    repository = db.getSource().manager.getRepository(FirewallProfileDraft);
    fwCloudRepository = db.getSource().manager.getRepository(FwCloud);
    auditLogRepository = db.getSource().manager.getRepository(AuditLog);
    stateService = await app.getService<FirewallProfileDraftStateService>(
      FirewallProfileDraftStateService.name,
    );

    adminUser = await createUser({ role: 1 });
    adminUserSessionId = generateSession(adminUser);

    fwCloud = await fwCloudRepository.save({
      name: StringHelper.randomize(10),
      locked: false,
      locked_by: null,
    });
  });

  afterEach(async () => {
    await auditLogRepository.delete({
      fwCloudId: fwCloud.id,
      call: In([
        FIREWALL_PROFILE_DRAFT_PREVIEW_AUDIT_CALL,
        FIREWALL_PROFILE_DRAFT_TRANSITION_AUDIT_CALL,
      ]),
    });

    const ids = draftIds.splice(0);
    if (ids.length > 0) {
      await repository.delete(ids);
    }
  });

  describe('authorization', () => {
    it('should reject guest users and leave the draft untouched', async () => {
      const draft = await makeDraft('validated');

      await request(app.express).post(previewUrl(draft.id)).expect(401);

      const persisted = await repository.findOneOrFail({ where: { id: draft.id } });
      expect(persisted.status).to.equal('validated');
      expect(persisted.previewHash).to.be.null;
    });

    it('should reject users without access to the FWCloud', async () => {
      const draft = await makeDraft('validated');
      const regularUserSessionId = generateSession(await createUser({ role: 0 }));

      await request(app.express)
        .post(previewUrl(draft.id))
        .set('Cookie', [attachSession(regularUserSessionId)])
        .expect(401);

      const persisted = await repository.findOneOrFail({ where: { id: draft.id } });
      expect(persisted.status).to.equal('validated');
    });

    it('should let any FWCloud member preview a draft they did not create', async () => {
      const creator = await createUser({ role: 0 });
      const draft = await makeDraft('validated', { createdBy: creator.id });
      const regularUserSessionId = await createFwCloudMemberSession(fwCloud);

      await request(app.express)
        .post(previewUrl(draft.id))
        .set('Cookie', [attachSession(regularUserSessionId)])
        .expect(200)
        .then((response) => {
          // The creator stays informational; ownership is not required.
          expect(response.body.data.user_id).to.equal(creator.id);
        });
    });

    it('should not disclose a draft belonging to another FWCloud', async () => {
      const otherFwCloud = await fwCloudRepository.save({
        name: StringHelper.randomize(10),
        locked: false,
        locked_by: null,
      });
      const otherSessionId = await createFwCloudMemberSession(otherFwCloud);
      const draft = await makeDraft('validated');

      await request(app.express)
        .post(previewUrl(draft.id, otherFwCloud.id))
        .set('Cookie', [attachSession(otherSessionId)])
        .expect(404);

      const persisted = await repository.findOneOrFail({ where: { id: draft.id } });
      expect(persisted.status).to.equal('validated');
      expect(persisted.previewHash).to.be.null;
    });
  });

  describe('successful preview', () => {
    it('should return the synthetic preview, persist the hash and transition to preview_ok', async () => {
      const creator = await createUser({ role: 0 });
      const draft = await makeDraft('validated', { createdBy: creator.id });

      const body = await request(app.express)
        .post(previewUrl(draft.id))
        .set('Cookie', [attachSession(adminUserSessionId)])
        .expect(200)
        .then((response) => response.body.data);

      expect(body).to.include({
        draft_id: draft.id,
        fwcloud_id: fwCloud.id,
        user_id: creator.id,
        status: 'preview_ok',
        contract_version: 'apg.mvp.v1',
        proposal_hash: draft.proposalHash,
        preview_contract_version: FIREWALL_PROFILE_DRAFT_PREVIEW_CONTRACT_VERSION,
      });
      expect(body.preview_hash).to.match(/^[0-9a-f]{64}$/);
      expect(body.previewed_at).to.be.a('string');

      // The complete proposal, not a summary of it.
      expect(body.proposal).to.deep.equal(draft.proposal);
      expect(body.validation).to.deep.equal({ valid: true, errors: [], warnings: [] });
      expect(body.target).to.deep.include({
        kind: 'firewall',
        name: 'Assisted firewall',
        interface_count: 2,
        rule_count: 1,
      });

      const persisted = await repository.findOneOrFail({ where: { id: draft.id } });
      expect(persisted.status).to.equal('preview_ok');
      expect(persisted.previewHash).to.equal(body.preview_hash);
      expect(persisted.previewedAt).to.not.be.null;
      expect(persisted.stepLog?.map((entry) => entry.step)).to.include.members([
        'preview_started',
        'preview_validation_completed',
        'preview_hash_created',
        'preview_completed',
      ]);
    });

    it('should create one audit event carrying the preview hash', async () => {
      const creator = await createUser({ role: 0 });
      const draft = await makeDraft('validated', { createdBy: creator.id });

      const previewHash = await request(app.express)
        .post(previewUrl(draft.id))
        .set('Cookie', [attachSession(adminUserSessionId)])
        .expect(200)
        .then((response) => response.body.data.preview_hash);

      const audits = await previewAudits();
      expect(audits).to.have.lengthOf(1);

      const data = JSON.parse(audits[0].data);
      expect(data).to.include({
        draftId: draft.id,
        fwCloudId: fwCloud.id,
        creatorUserId: creator.id,
        actorUserId: adminUser.id,
        previousStatus: 'validated',
        newStatus: 'preview_ok',
        contractVersion: 'apg.mvp.v1',
        proposalHash: draft.proposalHash,
        previewHash,
        validationValid: true,
      });
      expect(data.assumptionCount).to.be.a('number');

      // Neither the proposal nor the original instruction may be audited.
      expect(audits[0].data).to.not.contain('provision');
      expect(audits[0].data).to.not.contain('instruction');
    });

    it('should describe a cluster target including its node count', async () => {
      const cluster = mapFixture({ targetKind: 'cluster' });
      const draft = await makeDraft('validated', {
        proposal: cluster.proposal,
        assumptions: cluster.assumptions,
      });

      await request(app.express)
        .post(previewUrl(draft.id))
        .set('Cookie', [attachSession(adminUserSessionId)])
        .expect(200)
        .then((response) => {
          expect(response.body.data.target).to.deep.include({
            kind: 'cluster',
            node_count: 2,
            interface_count: 3,
          });
          // The mapper's synchronization rule is part of what would be created.
          expect(response.body.data.target.rule_count).to.equal(2);
        });
    });
  });

  describe('assumptions', () => {
    it('should return every persisted assumption, marked as an assumption', async () => {
      const cluster = mapFixture({ targetKind: 'cluster', includeSync: false });
      const agentAssumption: AssistedProfileAssumption = {
        id: 'agent.warning.0.assumption_default_zone',
        path: null,
        reason: 'Assumed LAN zone for unspecified interface',
        source: 'agent',
      };
      const stored = [agentAssumption, ...cluster.assumptions];
      const draft = await makeDraft('validated', {
        proposal: cluster.proposal,
        assumptions: stored,
      });

      const assumptions = await request(app.express)
        .post(previewUrl(draft.id))
        .set('Cookie', [attachSession(adminUserSessionId)])
        .expect(200)
        .then((response) => response.body.data.assumptions);

      expect(assumptions).to.have.lengthOf(stored.length);
      expect(assumptions.map((item: { id: string }) => item.id)).to.deep.equal(
        stored.map((item) => item.id),
      );
      assumptions.forEach((item: Record<string, unknown>, index: number) => {
        expect(item.requires_acknowledgement).to.equal(true);
        expect(item.reason).to.equal(stored[index].reason);
        expect(item.path).to.equal(stored[index].path);
        expect(item.source).to.equal(stored[index].source);
      });

      // An assumption with no addressable editor field survives intact.
      expect(assumptions[0]).to.deep.include({ path: null, source: 'agent' });

      const sync = assumptions.find(
        (item: { id: string }) => item.id === 'normalization.cluster.default-sync-interface',
      );
      expect(sync).to.deep.include({ value: 'sync0', source: 'normalization' });
    });

    it('should bind assumptions into the preview hash', async () => {
      const base = mapFixture();
      const draft = await makeDraft('validated', {
        proposal: base.proposal,
        assumptions: base.assumptions,
      });

      // The hash binds the draft id too, so both previews must be of the same
      // draft: the assumption reason is then the only thing that differs.
      const before = await previewHashOf(draft.id);
      await stateService.updatePreviewBoundContent(
        draft.id,
        {
          assumptions: base.assumptions.map((item, index) =>
            index === 0 ? { ...item, reason: 'A different justification.' } : item,
          ),
        },
        { fwCloudId: fwCloud.id },
      );
      const after = await previewHashOf(draft.id);

      expect(after).to.not.equal(before);
    });

    it('should reject malformed assumption metadata instead of dropping it', async () => {
      const draft = await makeDraft('validated', {
        assumptions: [{ id: '', reason: 'no id', source: 'normalization', path: null }] as never,
      });

      await request(app.express)
        .post(previewUrl(draft.id))
        .set('Cookie', [attachSession(adminUserSessionId)])
        .expect(422)
        .then((response) => {
          expect(response.body.code).to.equal('FIREWALL_PROFILE_DRAFT_PREVIEW_ASSUMPTIONS_INVALID');
        });

      const persisted = await repository.findOneOrFail({ where: { id: draft.id } });
      expect(persisted.status).to.equal('validated');
      expect(persisted.previewHash).to.be.null;
    });

    it('should preview a draft that recorded no assumptions without inventing any', async () => {
      const draft = await makeDraft('validated', { assumptions: null });

      await request(app.express)
        .post(previewUrl(draft.id))
        .set('Cookie', [attachSession(adminUserSessionId)])
        .expect(200)
        .then((response) => {
          expect(response.body.data.assumptions).to.deep.equal([]);
        });
    });
  });

  describe('deterministic hashing', () => {
    it('should reproduce the same hash when nothing preview-bound changed', async () => {
      const draft = await makeDraft('validated');

      // Re-previewing the same draft goes through the whole flow again —
      // load, validate, read assumptions, hash — so a stable result proves
      // volatile metadata (timestamps, request ids, row updates, JSON key
      // order coming back from the database) takes no part in the hash.
      const first = await previewHashOf(draft.id);
      await stateService.updatePreviewBoundContent(draft.id, {}, { fwCloudId: fwCloud.id });
      const second = await previewHashOf(draft.id);

      expect(second).to.equal(first);
    });

    it('should produce a different hash when the contract version changes', async () => {
      const draft = await makeDraft('validated');

      const before = await previewHashOf(draft.id);
      await stateService.updatePreviewBoundContent(
        draft.id,
        { contractVersion: '1.0.0' },
        { fwCloudId: fwCloud.id },
      );
      const after = await previewHashOf(draft.id);

      expect(after).to.not.equal(before);
    });
  });

  describe('preview invalidation', () => {
    it('should invalidate the hash when preview-bound content changes and require a new preview', async () => {
      const draft = await makeDraft('validated');

      const originalHash = await request(app.express)
        .post(previewUrl(draft.id))
        .set('Cookie', [attachSession(adminUserSessionId)])
        .expect(200)
        .then((response) => response.body.data.preview_hash);

      const previewed = await repository.findOneOrFail({ where: { id: draft.id } });
      expect(previewed.status).to.equal('preview_ok');
      expect(previewed.previewHash).to.equal(originalHash);

      await stateService.updatePreviewBoundContent(
        draft.id,
        {
          assumptions: [
            {
              id: 'normalization.injected',
              path: 'name',
              value: 'changed',
              reason: 'Content changed after the preview was reviewed.',
              source: 'normalization',
            },
          ],
        },
        { fwCloudId: fwCloud.id, userId: adminUser.id },
      );

      // The draft no longer advertises a preview at all.
      const invalidated = await repository.findOneOrFail({ where: { id: draft.id } });
      expect(invalidated.status).to.equal('validated');
      expect(invalidated.previewHash).to.be.null;
      expect(invalidated.previewedAt).to.be.null;
      expect(invalidated.stepLog?.map((entry) => entry.step)).to.include('preview_invalidated');

      // A new preview is possible, and its hash does not match the old one.
      const newHash = await request(app.express)
        .post(previewUrl(draft.id))
        .set('Cookie', [attachSession(adminUserSessionId)])
        .expect(200)
        .then((response) => response.body.data.preview_hash);

      expect(newHash).to.not.equal(originalHash);

      const repreviewed = await repository.findOneOrFail({ where: { id: draft.id } });
      expect(repreviewed.previewHash).to.equal(newHash);
      expect(repreviewed.previewHash).to.not.equal(originalHash);
    });

    it('should clear a stale hash when preview-bound content changes while still validated', async () => {
      const draft = await makeDraft('validated', { previewHash: 'b'.repeat(64) });

      await stateService.updatePreviewBoundContent(
        draft.id,
        { assumptions: [] },
        { fwCloudId: fwCloud.id },
      );

      const persisted = await repository.findOneOrFail({ where: { id: draft.id } });
      expect(persisted.status).to.equal('validated');
      expect(persisted.previewHash).to.be.null;
      expect(persisted.assumptions).to.deep.equal([]);
    });

    it('should refuse to rewrite the content of a draft that already reached apply', async () => {
      const draft = await makeDraft('applied');

      await expect(
        stateService.updatePreviewBoundContent(
          draft.id,
          { assumptions: [] },
          { fwCloudId: fwCloud.id },
        ),
      ).to.be.rejectedWith(FirewallProfileDraftTransitionConflictError);

      // The applied draft's own history is left intact.
      const persisted = await repository.findOneOrFail({ where: { id: draft.id } });
      expect(persisted.status).to.equal('applied');
      expect(persisted.assumptions).to.not.deep.equal([]);
    });
  });

  describe('illegal states', () => {
    (
      ['preview_ok', 'apply_pending', 'applied', 'apply_failed', 'discarded', 'expired'] as const
    ).forEach((status) => {
      it(`should reject a preview from '${status}' with 409 and report the current state`, async () => {
        const draft = await makeDraft(status);

        await request(app.express)
          .post(previewUrl(draft.id))
          .set('Cookie', [attachSession(adminUserSessionId)])
          .expect(409)
          .then((response) => {
            expect(response.body.code).to.equal('FIREWALL_PROFILE_DRAFT_TRANSITION_CONFLICT');
            expect(response.body.draftId).to.equal(draft.id);
            expect(response.body.currentStatus).to.equal(status);
            expect(response.body.attemptedStatus).to.equal('preview_ok');
          });

        const persisted = await repository.findOneOrFail({ where: { id: draft.id } });
        expect(persisted.status).to.equal(status);
        expect(persisted.previewHash).to.be.null;
      });
    });

    it('should not run the domain validator for an illegal state', async () => {
      const draft = await makeDraft('applied');
      const validationService = await app.getService<ReplicationProfileValidationService>(
        ReplicationProfileValidationService.name,
      );
      const original = validationService.validate.bind(validationService);
      let calls = 0;
      validationService.validate = ((...args: Parameters<typeof original>) => {
        calls++;
        return original(...args);
      }) as typeof validationService.validate;

      try {
        await request(app.express)
          .post(previewUrl(draft.id))
          .set('Cookie', [attachSession(adminUserSessionId)])
          .expect(409);
      } finally {
        validationService.validate = original;
      }

      expect(calls).to.equal(0);
    });

    it('should audit the rejected attempt without a successful preview event', async () => {
      const draft = await makeDraft('expired');

      await request(app.express)
        .post(previewUrl(draft.id))
        .set('Cookie', [attachSession(adminUserSessionId)])
        .expect(409);

      const audits = await previewAudits();
      expect(audits).to.have.lengthOf(1);

      const data = JSON.parse(audits[0].data);
      expect(data).to.include({
        result: 'preview_rejected',
        failureReason: 'illegal_state',
        currentStatus: 'expired',
      });
      expect(data.previewHash).to.equal(undefined);
    });
  });

  describe('unsupported contract version', () => {
    it('should reject explicitly, without validating, hashing or transitioning', async () => {
      const draft = await makeDraft('validated', { contractVersion: 'apg.legacy.v0' });
      const validationService = await app.getService<ReplicationProfileValidationService>(
        ReplicationProfileValidationService.name,
      );
      const original = validationService.validate.bind(validationService);
      let calls = 0;
      validationService.validate = ((...args: Parameters<typeof original>) => {
        calls++;
        return original(...args);
      }) as typeof validationService.validate;

      try {
        await request(app.express)
          .post(previewUrl(draft.id))
          .set('Cookie', [attachSession(adminUserSessionId)])
          .expect(409)
          .then((response) => {
            expect(response.body.code).to.equal(
              'UNSUPPORTED_FIREWALL_PROFILE_DRAFT_CONTRACT_VERSION',
            );
            expect(response.body.receivedVersion).to.equal('apg.legacy.v0');
          });
      } finally {
        validationService.validate = original;
      }

      expect(calls).to.equal(0);

      const persisted = await repository.findOneOrFail({ where: { id: draft.id } });
      expect(persisted.status).to.equal('validated');
      expect(persisted.previewHash).to.be.null;
      expect(await previewAudits()).to.have.lengthOf(0);
    });
  });

  describe('domain validation failure', () => {
    it('should return a typed failure, keep the draft validated and persist no hash', async () => {
      // Contract-valid and mappable, but the rule references a role the
      // profile never declares — rejected by the existing domain validator.
      const invalid = mapFixture();
      const proposal = JSON.parse(JSON.stringify(invalid.proposal));
      proposal.model.provision.rules[0].outRole = 'dmz';
      const draft = await makeDraft('validated', { proposal });

      await request(app.express)
        .post(previewUrl(draft.id))
        .set('Cookie', [attachSession(adminUserSessionId)])
        .expect(422)
        .then((response) => {
          expect(response.body.code).to.equal('FIREWALL_PROFILE_DRAFT_PREVIEW_VALIDATION_FAILED');
          expect(response.body.draftId).to.equal(draft.id);
          expect(response.body.errors.profile).to.be.an('array').that.is.not.empty;
          expect(response.body.errors.profile[0].code).to.equal('invalid_rule_role');
        });

      const persisted = await repository.findOneOrFail({ where: { id: draft.id } });
      expect(persisted.status).to.equal('validated');
      expect(persisted.previewHash).to.be.null;
      expect(persisted.previewedAt).to.be.null;
      expect(persisted.stepLog?.map((entry) => entry.step)).to.include('preview_failed');

      const audits = await previewAudits();
      expect(audits).to.have.lengthOf(1);
      expect(JSON.parse(audits[0].data).failureReason).to.equal('domain_validation_failed');
    });
  });

  describe('concurrent previews', () => {
    it('should transition exactly once, 409 the loser and persist one authoritative hash', async () => {
      const draft = await makeDraft('validated');

      const responses = await Promise.all([
        request(app.express)
          .post(previewUrl(draft.id))
          .set('Cookie', [attachSession(adminUserSessionId)]),
        request(app.express)
          .post(previewUrl(draft.id))
          .set('Cookie', [attachSession(adminUserSessionId)]),
      ]);

      const statuses = responses.map((response) => response.status).sort();
      expect(statuses).to.deep.equal([200, 409]);

      const winner = responses.find((response) => response.status === 200);
      const persisted = await repository.findOneOrFail({ where: { id: draft.id } });
      expect(persisted.status).to.equal('preview_ok');
      expect(persisted.previewHash).to.equal(winner.body.data.preview_hash);

      const successful = (await previewAudits()).filter(
        (entry) => JSON.parse(entry.data).result === 'preview_ok',
      );
      expect(successful).to.have.lengthOf(1);
    });
  });

  describe('side-effect boundary', () => {
    it('should not create or modify any firewall, cluster, interface or rule row', async () => {
      const cluster = mapFixture({ targetKind: 'cluster' });
      const draft = await makeDraft('validated', {
        proposal: cluster.proposal,
        assumptions: cluster.assumptions,
      });

      const before = await countTargetRows();

      await request(app.express)
        .post(previewUrl(draft.id))
        .set('Cookie', [attachSession(adminUserSessionId)])
        .expect(200)
        .then((response) => {
          // A target is described, never allocated.
          expect(response.body.data.target.kind).to.equal('cluster');
        });

      expect(await countTargetRows()).to.deep.equal(before);

      const persisted = await repository.findOneOrFail({ where: { id: draft.id } });
      expect(persisted.targetIds).to.be.null;
      expect(persisted.applyHash).to.be.null;
      expect(persisted.idempotencyKeyRef).to.be.null;
    });

    it('should leave target tables untouched when the preview is rejected', async () => {
      const draft = await makeDraft('applied');
      const before = await countTargetRows();

      await request(app.express)
        .post(previewUrl(draft.id))
        .set('Cookie', [attachSession(adminUserSessionId)])
        .expect(409);

      expect(await countTargetRows()).to.deep.equal(before);
    });
  });
});
