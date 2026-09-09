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
import { FirewallProfileDraft } from '../../../../src/models/firewall-profile-draft/firewall-profile-draft.model';
import { FIREWALL_PROFILE_DRAFT_TRANSITION_AUDIT_CALL } from '../../../../src/models/firewall-profile-draft/firewall-profile-draft-state.service';
import { FIREWALL_PROFILE_DRAFT_DISCARD_AUDIT_CALL } from '../../../../src/models/firewall-profile-draft/firewall-profile-draft.service';
import type { FirewallProfileDraftStatus } from '../../../../src/models/firewall-profile-draft/firewall-profile-draft.types';
import { ASSISTED_PROFILE_GENERATION_AUDIT_CALL } from '../../../../src/communications/assistant-agent/assisted-profile-generation.service';
import { PROFILE_APPLICATION_AUDIT_CALL } from '../../../../src/models/replication-profile/profile-application.service';
import { Interface } from '../../../../src/models/interface/Interface';
import { Firewall } from '../../../../src/models/firewall/Firewall';
import { Tree } from '../../../../src/models/tree/Tree';
import { User } from '../../../../src/models/user/User';
import StringHelper from '../../../../src/utils/string.helper';
import { describeName, expect, testSuite } from '../../../mocha/global-setup';
import {
  attachSession,
  createFwCloudMemberSession,
  createUser,
  generateSession,
} from '../../../utils/utils';
import { makeFirewallProfileDraftAttributes } from '../../../utils/firewall-profile-draft-factory';
import { FwCloudFactory, FwCloudProduct } from '../../../utils/fwcloud-factory';
import {
  makeAssistedProfileProposalFixture,
  validateAssistedProfileFixtureAtGateway,
} from '../../../utils/assisted-profile-proposal-fixtures';
import { AssistedProfileProposalMapper } from '../../../../src/models/assistant-contract/assisted-profile-proposal.mapper';
import { In, type Repository } from 'typeorm';
import request = require('supertest');

describe(describeName('Firewall Profile Draft E2E Tests'), () => {
  let app: Application;
  let adminUser: User;
  let adminUserSessionId: string;
  let fwCloud: FwCloud;
  let repository: Repository<FirewallProfileDraft>;
  let fwCloudRepository: Repository<FwCloud>;
  let auditLogRepository: Repository<AuditLog>;
  const draftIds: number[] = [];

  const draftsUrl = (cloudId: number = fwCloud.id) => `/fwclouds/${cloudId}/assistant/drafts`;
  const draftUrl = (draftId: number, cloudId: number = fwCloud.id) =>
    `/fwclouds/${cloudId}/assistant/drafts/${draftId}`;

  const makeDraft = async (
    status: FirewallProfileDraftStatus,
    overrides: Partial<FirewallProfileDraft> = {},
  ): Promise<FirewallProfileDraft> => {
    const draft = repository.create(
      makeFirewallProfileDraftAttributes(fwCloud.id, status, {
        proposal: { metadata: { schemaVersion: '1.0.0' }, generated: {} },
        ...overrides,
      }),
    );

    const saved = await repository.save(draft);
    draftIds.push(saved.id);
    return saved;
  };

  // Shared by both apply destinations: the /apply block applies it onto an
  // existing firewall, the /apply-new block has it create one. Identical in
  // both cases, so it lives beside `makeDraft` rather than being copied.
  const provisioningProposal = () => ({
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
  });

  const makeOtherFwCloud = (): Promise<FwCloud> =>
    fwCloudRepository.save({ name: StringHelper.randomize(10), locked: false, locked_by: null });

  beforeEach(async () => {
    app = testSuite.app;
    repository = db.getSource().manager.getRepository(FirewallProfileDraft);
    fwCloudRepository = db.getSource().manager.getRepository(FwCloud);
    auditLogRepository = db.getSource().manager.getRepository(AuditLog);

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
        FIREWALL_PROFILE_DRAFT_DISCARD_AUDIT_CALL,
        FIREWALL_PROFILE_DRAFT_TRANSITION_AUDIT_CALL,
      ]),
    });

    const ids = draftIds.splice(0);
    if (ids.length > 0) {
      await repository.delete(ids);
    }
  });

  describe('GET /fwclouds/:fwcloud/assistant/drafts', () => {
    it('should reject guest users', async () => {
      await request(app.express).get(draftsUrl()).expect(401);
    });

    it('should reject users without access to the FWCloud', async () => {
      const regularUser = await createUser({ role: 0 });
      const regularUserSessionId = generateSession(regularUser);

      await request(app.express)
        .get(draftsUrl())
        .set('Cookie', [attachSession(regularUserSessionId)])
        .expect(401);
    });

    it('should allow users with access to the FWCloud and scope results to that FWCloud only', async () => {
      const draft = await makeDraft('validated');
      const otherFwCloud = await makeOtherFwCloud();
      const foreignDraft = await makeDraft('validated', { fwCloudId: otherFwCloud.id });

      await request(app.express)
        .get(draftsUrl())
        .set('Cookie', [attachSession(adminUserSessionId)])
        .expect(200)
        .then((response) => {
          const ids = (response.body.data as Array<{ id: number }>).map((item) => item.id);
          expect(ids).to.include(draft.id);
          expect(ids).to.not.include(foreignDraft.id);
        });
    });

    it('should include drafts created by other users of the same FWCloud, exposing their user_id', async () => {
      const creator = await createUser({ role: 0 });
      const draft = await makeDraft('validated', { createdBy: creator.id });

      const regularUserSessionId = await createFwCloudMemberSession(fwCloud);

      await request(app.express)
        .get(draftsUrl())
        .set('Cookie', [attachSession(regularUserSessionId)])
        .expect(200)
        .then((response) => {
          const found = (response.body.data as Array<{ id: number; user_id: number }>).find(
            (item) => item.id === draft.id,
          );
          expect(found).to.not.be.undefined;
          expect(found.user_id).to.equal(creator.id);
        });
    });
  });

  describe('GET /fwclouds/:fwcloud/assistant/drafts/:draft', () => {
    it('should reject guest users', async () => {
      const draft = await makeDraft('validated');
      await request(app.express).get(draftUrl(draft.id)).expect(401);
    });

    it('should reject users without access to the FWCloud', async () => {
      const draft = await makeDraft('validated');
      const regularUser = await createUser({ role: 0 });
      const regularUserSessionId = generateSession(regularUser);

      await request(app.express)
        .get(draftUrl(draft.id))
        .set('Cookie', [attachSession(regularUserSessionId)])
        .expect(401);
    });

    it('should allow users with access to the FWCloud to read a draft created by someone else', async () => {
      const creator = await createUser({ role: 0 });
      const draft = await makeDraft('preview_ok', {
        createdBy: creator.id,
        targetIds: { firewallId: 1 },
        stepLog: [{ step: 'validated', status: 'success', timestamp: new Date().toISOString() }],
      });

      const regularUserSessionId = await createFwCloudMemberSession(fwCloud);

      await request(app.express)
        .get(draftUrl(draft.id))
        .set('Cookie', [attachSession(regularUserSessionId)])
        .expect(200)
        .then((response) => {
          const body = response.body.data;
          expect(body.id).to.equal(draft.id);
          expect(body.user_id).to.equal(creator.id);
          expect(body.status).to.equal('preview_ok');
          expect(body).to.have.property('proposal');
          expect(body).to.have.property('step_log');
          expect(body).to.have.property('target_ids');
          expect(body).to.not.have.property('idempotency_key_ref');
          expect(body).to.not.have.property('proposal_hash');
          expect(body).to.not.have.property('preview_hash');
          expect(body).to.not.have.property('apply_hash');
          expect(body.reconciliation).to.equal(null);
        });
    });

    it('should expose unambiguous reconciliation data for an apply_failed draft with partial target-orchestration progress', async () => {
      const draft = await makeDraft('apply_failed', {
        targetIds: { firewallId: 120, interfaceIds: [301, 302] },
        stepLog: [
          {
            step: 'target_created',
            status: 'success',
            timestamp: new Date().toISOString(),
            targetKind: 'firewall',
            resourceIds: { firewallId: 120 },
          },
          {
            step: 'interfaces_created',
            status: 'failed',
            timestamp: new Date().toISOString(),
            targetKind: 'firewall',
            resourceIds: { interfaceIds: [301, 302] },
            errorCode: 'INTERFACE_CREATION_FAILED',
          },
        ],
      });

      const regularUserSessionId = await createFwCloudMemberSession(fwCloud);

      await request(app.express)
        .get(draftUrl(draft.id))
        .set('Cookie', [attachSession(regularUserSessionId)])
        .expect(200)
        .then((response) => {
          const body = response.body.data;
          expect(body.status).to.equal('apply_failed');
          expect(body.target_ids).to.deep.equal({ firewallId: 120, interfaceIds: [301, 302] });
          expect(body.step_log).to.have.length(2);
          expect(body.reconciliation).to.deep.equal({
            target: { kind: 'firewall', id: 120 },
            interfaceIds: [301, 302],
            completedSteps: ['target_created'],
            failedStep: 'interfaces_created',
            errorCode: 'INTERFACE_CREATION_FAILED',
          });
        });
    });

    it('should not leak a draft belonging to another FWCloud (404, non-leaking)', async () => {
      const otherFwCloud = await makeOtherFwCloud();
      const regularUserSessionId = await createFwCloudMemberSession(otherFwCloud);

      const draft = await makeDraft('validated');

      await request(app.express)
        .get(draftUrl(draft.id, otherFwCloud.id))
        .set('Cookie', [attachSession(regularUserSessionId)])
        .expect(404);
    });

    it('should remain readable after expiration, reporting status = expired', async () => {
      const draft = await makeDraft('expired');

      await request(app.express)
        .get(draftUrl(draft.id))
        .set('Cookie', [attachSession(adminUserSessionId)])
        .expect(200)
        .then((response) => {
          expect(response.body.data.id).to.equal(draft.id);
          expect(response.body.data.status).to.equal('expired');
          expect(response.body.data.expired_at).to.not.be.null;
        });
    });
  });

  describe('POST /fwclouds/:fwcloud/assistant/drafts/:draft/preview', () => {
    it('describes the target by the name the proposal gave the infrastructure', async () => {
      const draft = await makeDraft('validated', {
        proposal: {
          ...provisioningProposal(),
          name: 'Small office basic internet',
          model: {
            ...provisioningProposal().model,
            uiDefaults: { targetKind: 'firewall', targetName: 'FW-Oficina' },
          },
        },
      });

      await request(app.express)
        .post(`${draftUrl(draft.id)}/preview`)
        .set('Cookie', [attachSession(adminUserSessionId)])
        .send({})
        .expect(200)
        .then((response) => {
          // Every other field of this block describes the infrastructure, so
          // its name must too -- reporting the profile's name here is what made
          // the reviewer see the wrong one in the destination field.
          expect(response.body.data.target.name).to.equal('FW-Oficina');
        });
    });

    it('falls back to the profile name for drafts mapped before the target name was kept', async () => {
      const draft = await makeDraft('validated', {
        proposal: { ...provisioningProposal(), name: 'Small office basic internet' },
      });

      await request(app.express)
        .post(`${draftUrl(draft.id)}/preview`)
        .set('Cookie', [attachSession(adminUserSessionId)])
        .send({})
        .expect(200)
        .then((response) => {
          expect(response.body.data.target.name).to.equal('Small office basic internet');
        });
    });
  });

  describe('POST /fwclouds/:fwcloud/assistant/drafts/:draft/apply', () => {
    const applyUrl = (draftId: number, cloudId: number = fwCloud.id) =>
      `${draftUrl(draftId, cloudId)}/apply`;
    const PREVIEW_HASH = 'e2e-preview-hash';
    let target: FwCloudProduct;
    let interfaceRepository: Repository<Interface>;
    const makePreviewOkDraft = (overrides: Partial<FirewallProfileDraft> = {}) =>
      makeDraft('preview_ok', {
        proposal: provisioningProposal(),
        previewHash: PREVIEW_HASH,
        ...overrides,
      });
    const applyBody = (firewallId: number = target.firewall.id) => ({
      preview_hash: PREVIEW_HASH,
      target: { kind: 'firewall', id: firewallId },
    });

    beforeEach(async () => {
      // The target firewall must live in the SAME FWCloud the draft belongs
      // to (ProfileApplicationService rejects cross-FWCloud targets), so this
      // describe block points the shared `fwCloud` fixture at a freshly
      // built FwCloudFactory product instead of reusing the bare row the
      // outer beforeEach created.
      target = await new FwCloudFactory().make();
      fwCloud = target.fwcloud;
      interfaceRepository = db.getSource().manager.getRepository(Interface);
    });

    afterEach(async () => {
      await db
        .getSource()
        .manager.getRepository(AuditLog)
        .delete({ call: In([PROFILE_APPLICATION_AUDIT_CALL]) });
    });

    it('should reject guest users', async () => {
      const draft = await makePreviewOkDraft();
      await request(app.express)
        .post(applyUrl(draft.id))
        .set('Idempotency-Key', StringHelper.randomize(16))
        .send(applyBody())
        .expect(401);
    });

    it('should reject users without access to the FWCloud', async () => {
      const draft = await makePreviewOkDraft();
      const regularUser = await createUser({ role: 0 });
      const regularUserSessionId = generateSession(regularUser);

      await request(app.express)
        .post(applyUrl(draft.id))
        .set('Cookie', [attachSession(regularUserSessionId)])
        .set('Idempotency-Key', StringHelper.randomize(16))
        .send(applyBody())
        .expect(401);
    });

    it('should reject a request with no Idempotency-Key header with 400', async () => {
      const draft = await makePreviewOkDraft();

      await request(app.express)
        .post(applyUrl(draft.id))
        .set('Cookie', [attachSession(adminUserSessionId)])
        .send(applyBody())
        .expect(400);
    });

    it('should reject a preview_hash that does not match with 422, leaving the draft untouched', async () => {
      const draft = await makePreviewOkDraft();

      await request(app.express)
        .post(applyUrl(draft.id))
        .set('Cookie', [attachSession(adminUserSessionId)])
        .set('Idempotency-Key', StringHelper.randomize(16))
        .send({ preview_hash: 'stale-hash', target: applyBody().target })
        .expect(422);

      const reloaded = await repository.findOneByOrFail({ id: draft.id });
      expect(reloaded.status).to.equal('preview_ok');
    });

    it('should reject an apply attempt from any status other than preview_ok with 409', async () => {
      const draft = await makeDraft('validated');

      await request(app.express)
        .post(applyUrl(draft.id))
        .set('Cookie', [attachSession(adminUserSessionId)])
        .set('Idempotency-Key', StringHelper.randomize(16))
        .send(applyBody())
        .expect(409)
        .then((response) => {
          expect(response.body.currentStatus).to.equal('validated');
          expect(response.body.attemptedStatus).to.equal('apply_pending');
        });
    });

    it('should honour the confirmation-token handshake used by production deployments', async () => {
      const previousConfirmationTokenSetting = app.config.get('confirmation_token');
      app.config.set('confirmation_token', true);

      try {
        const draft = await makePreviewOkDraft();

        const tokenResponse = await request(app.express)
          .post(applyUrl(draft.id))
          .set('Cookie', [attachSession(adminUserSessionId)])
          .set('Idempotency-Key', StringHelper.randomize(16))
          .send(applyBody())
          .expect(403);

        const confirmationToken = tokenResponse.body.fwc_confirm_token;
        expect(confirmationToken).to.be.a('string');

        await request(app.express)
          .post(applyUrl(draft.id))
          .set('Cookie', [attachSession(adminUserSessionId)])
          .set('x-fwc-confirm-token', confirmationToken)
          .set('Idempotency-Key', StringHelper.randomize(16))
          .send(applyBody())
          .expect(200)
          .then((response) => {
            expect(response.body.data.status).to.equal('applied');
          });
      } finally {
        app.config.set('confirmation_token', previousConfirmationTokenSetting);
      }
    });

    it('should apply the previewed profile onto the chosen existing firewall and reach applied', async () => {
      const draft = await makePreviewOkDraft();

      await request(app.express)
        .post(applyUrl(draft.id))
        .set('Cookie', [attachSession(adminUserSessionId)])
        .set('Idempotency-Key', StringHelper.randomize(16))
        .send(applyBody())
        .expect(200)
        .then((response) => {
          expect(response.body.data.status).to.equal('applied');
          expect(response.body.data.target_ids.firewallId).to.equal(target.firewall.id);
          expect(
            response.body.data.step_log.map((entry: { step: string }) => entry.step),
          ).to.deep.equal(['apply_pending', 'applied']);
        });

      const interfaces = await interfaceRepository.find({
        where: { firewallId: target.firewall.id },
      });
      expect(interfaces.map((iface) => iface.name)).to.include.members(['WAN', 'LAN']);

      const profileAuditEntries = await db
        .getSource()
        .manager.getRepository(AuditLog)
        .find({ where: { call: PROFILE_APPLICATION_AUDIT_CALL, fwCloudId: fwCloud.id } });
      expect(profileAuditEntries).to.have.length(1);
    });

    it('should accept the body the UI actually sends, including acknowledged_assumption_ids', async () => {
      const draft = await makePreviewOkDraft();

      // Regression: the UI has always sent this field (see the fwcloud-ui
      // AssistedProfileApplyRequest model) while the DTO did not declare it,
      // and the global pipeline runs `forbidNonWhitelisted` -- so every real
      // apply from the UI was a 422 before the field was declared.
      await request(app.express)
        .post(applyUrl(draft.id))
        .set('Cookie', [attachSession(adminUserSessionId)])
        .set('Idempotency-Key', StringHelper.randomize(16))
        .send({ ...applyBody(), acknowledged_assumption_ids: ['assumption-1', 'assumption-2'] })
        .expect(200)
        .then((response) => {
          expect(response.body.data.status).to.equal('applied');
        });
    });

    it('should return the exact cached response for a repeated same-key submission, without re-applying', async () => {
      const draft = await makePreviewOkDraft();
      const idempotencyKey = StringHelper.randomize(16);
      const send = () =>
        request(app.express)
          .post(applyUrl(draft.id))
          .set('Cookie', [attachSession(adminUserSessionId)])
          .set('Idempotency-Key', idempotencyKey)
          .send(applyBody());

      const first = await send().expect(200);
      expect(first.body.data.status).to.equal('applied');

      const second = await send().expect(200);
      expect(second.body.data).to.deep.equal(first.body.data);

      const profileAuditEntries = await db
        .getSource()
        .manager.getRepository(AuditLog)
        .find({ where: { call: PROFILE_APPLICATION_AUDIT_CALL, fwCloudId: fwCloud.id } });
      expect(profileAuditEntries).to.have.length(1);
    });

    it('should perform exactly one real apply when two identical requests race on the same Idempotency-Key', async () => {
      const draft = await makePreviewOkDraft();
      const idempotencyKey = StringHelper.randomize(16);
      const send = () =>
        request(app.express)
          .post(applyUrl(draft.id))
          .set('Cookie', [attachSession(adminUserSessionId)])
          .set('Idempotency-Key', idempotencyKey)
          .send(applyBody());

      // True concurrency has two valid outcomes for the loser: it either
      // observes the winner's completed, cached response (200) or, if it is
      // still in progress, a 409 "in progress" -- never a second real apply.
      const results = await Promise.all([send(), send()]);
      for (const response of results) {
        expect([200, 409]).to.include(response.status);
      }
      expect(results.some((response) => response.status === 200)).to.equal(true);

      const profileAuditEntries = await db
        .getSource()
        .manager.getRepository(AuditLog)
        .find({ where: { call: PROFILE_APPLICATION_AUDIT_CALL, fwCloudId: fwCloud.id } });
      expect(profileAuditEntries).to.have.length(1);
    });

    it('should transition to apply_failed with a readable error when the target does not belong to the FWCloud', async () => {
      const otherTarget = await new FwCloudFactory().make();
      const draft = await makePreviewOkDraft();

      await request(app.express)
        .post(applyUrl(draft.id))
        .set('Cookie', [attachSession(adminUserSessionId)])
        .set('Idempotency-Key', StringHelper.randomize(16))
        .send(applyBody(otherTarget.firewall.id))
        .expect(200)
        .then((response) => {
          expect(response.body.data.status).to.equal('apply_failed');
          const failedStep = response.body.data.step_log.find(
            (entry: { step: string }) => entry.step === 'apply_failed',
          );
          expect(failedStep.status).to.equal('failed');
          expect(failedStep.message).to.be.a('string');
        });
    });
  });

  describe('POST /fwclouds/:fwcloud/assistant/drafts/:draft/apply-new', () => {
    const applyNewUrl = (draftId: number, cloudId: number = fwCloud.id) =>
      `${draftUrl(draftId, cloudId)}/apply-new`;
    const PREVIEW_HASH = 'e2e-apply-new-preview-hash';
    let product: FwCloudProduct;
    let firewallRepository: Repository<Firewall>;
    let previousFirewallLimit: number;
    // Deliberately a member session rather than the suite's admin one: creating
    // a firewall goes through the legacy `Firewall.updateFWMaster`, which joins
    // on `user__fwcloud` and so requires the acting user to be a member of the
    // FWCloud -- something `FwCloudPolicy.userCanAccessFwCloud` does not
    // require of a role-1 admin.
    let memberSessionId: string;

    const makePreviewOkDraft = (overrides: Partial<FirewallProfileDraft> = {}) =>
      makeDraft('preview_ok', {
        proposal: provisioningProposal(),
        previewHash: PREVIEW_HASH,
        ...overrides,
      });
    const applyNewBody = (target: Record<string, unknown> = { kind: 'firewall' }) => ({
      preview_hash: PREVIEW_HASH,
      target,
    });
    const countFirewalls = () => firewallRepository.count({ where: { fwCloudId: fwCloud.id } });

    beforeEach(async () => {
      // Unlike /apply, this endpoint creates the firewall itself, so the
      // FWCloud needs its object tree (the new firewall is inserted under the
      // FIREWALLS root node) and no firewall-count limit in the way.
      product = await new FwCloudFactory().make();
      fwCloud = product.fwcloud;
      await Tree.createAllTreeCloud(fwCloud);
      previousFirewallLimit = app.config.get('limits').firewalls;
      app.config.set('limits.firewalls', 0);
      firewallRepository = db.getSource().manager.getRepository(Firewall);
      memberSessionId = await createFwCloudMemberSession(fwCloud);
    });

    afterEach(async () => {
      app.config.set('limits.firewalls', previousFirewallLimit);
      await db
        .getSource()
        .manager.getRepository(AuditLog)
        .delete({ call: In([PROFILE_APPLICATION_AUDIT_CALL]) });
    });

    it('should reject guest users', async () => {
      const draft = await makePreviewOkDraft();
      await request(app.express)
        .post(applyNewUrl(draft.id))
        .set('Idempotency-Key', StringHelper.randomize(16))
        .send(applyNewBody())
        .expect(401);
    });

    it('should reject users without access to the FWCloud', async () => {
      const draft = await makePreviewOkDraft();
      const regularUser = await createUser({ role: 0 });
      const regularUserSessionId = generateSession(regularUser);

      await request(app.express)
        .post(applyNewUrl(draft.id))
        .set('Cookie', [attachSession(regularUserSessionId)])
        .set('Idempotency-Key', StringHelper.randomize(16))
        .send(applyNewBody())
        .expect(401);
    });

    it('should reject a request with no Idempotency-Key header with 400', async () => {
      const draft = await makePreviewOkDraft();

      await request(app.express)
        .post(applyNewUrl(draft.id))
        .set('Cookie', [attachSession(memberSessionId)])
        .send(applyNewBody())
        .expect(400);
    });

    it('should reject the sibling /apply body shape instead of silently ignoring the id', async () => {
      const draft = await makePreviewOkDraft();

      await request(app.express)
        .post(applyNewUrl(draft.id))
        .set('Cookie', [attachSession(memberSessionId)])
        .set('Idempotency-Key', StringHelper.randomize(16))
        .send(applyNewBody({ kind: 'firewall', id: product.firewall.id }))
        .expect(422);

      const reloaded = await repository.findOneByOrFail({ id: draft.id });
      expect(reloaded.status).to.equal('preview_ok');
    });

    it('should reject a preview_hash that does not match with 422, leaving the draft untouched', async () => {
      const draft = await makePreviewOkDraft();

      await request(app.express)
        .post(applyNewUrl(draft.id))
        .set('Cookie', [attachSession(memberSessionId)])
        .set('Idempotency-Key', StringHelper.randomize(16))
        .send({ preview_hash: 'stale-hash', target: { kind: 'firewall' } })
        .expect(422);

      const reloaded = await repository.findOneByOrFail({ id: draft.id });
      expect(reloaded.status).to.equal('preview_ok');
    });

    it('should reject an attempt from any status other than preview_ok with 409', async () => {
      const draft = await makeDraft('validated');

      await request(app.express)
        .post(applyNewUrl(draft.id))
        .set('Cookie', [attachSession(memberSessionId)])
        .set('Idempotency-Key', StringHelper.randomize(16))
        .send(applyNewBody())
        .expect(409);
    });

    it('should reject a confirmation for a different target kind than the proposal, creating nothing', async () => {
      const draft = await makePreviewOkDraft();
      const before = await countFirewalls();

      await request(app.express)
        .post(applyNewUrl(draft.id))
        .set('Cookie', [attachSession(memberSessionId)])
        .set('Idempotency-Key', StringHelper.randomize(16))
        .send(applyNewBody({ kind: 'cluster' }))
        .expect(422)
        .then((response) => {
          expect(response.body.confirmedKind).to.equal('cluster');
          expect(response.body.proposalKind).to.equal('firewall');
        });

      const reloaded = await repository.findOneByOrFail({ id: draft.id });
      expect(reloaded.status).to.equal('preview_ok');
      expect(await countFirewalls()).to.equal(before);
    });

    it('should create the firewall the proposal describes and reach applied', async () => {
      const draft = await makePreviewOkDraft();
      const before = await countFirewalls();
      let createdFirewallId: number;

      await request(app.express)
        .post(applyNewUrl(draft.id))
        .set('Cookie', [attachSession(memberSessionId)])
        .set('Idempotency-Key', StringHelper.randomize(16))
        .send(applyNewBody())
        .expect(200)
        .then((response) => {
          expect(response.body.data.status).to.equal('applied');
          createdFirewallId = response.body.data.target_ids.firewallId;
          expect(createdFirewallId).to.be.a('number');
          // Created, not the FWCloud's pre-existing firewall.
          expect(createdFirewallId).to.not.equal(product.firewall.id);
          expect(
            response.body.data.step_log.map((entry: { step: string }) => entry.step),
          ).to.deep.equal([
            'apply_pending',
            'target_created',
            'interfaces_created',
            'profile_applied',
            'applied',
          ]);
        });

      expect(await countFirewalls()).to.equal(before + 1);

      const interfaces = await db
        .getSource()
        .manager.getRepository(Interface)
        .find({ where: { firewallId: createdFirewallId! } });
      expect(interfaces.map((iface) => iface.name)).to.include.members(['WAN', 'LAN']);
    });

    it('should accept the body the UI actually sends, including acknowledged_assumption_ids', async () => {
      const draft = await makePreviewOkDraft();

      await request(app.express)
        .post(applyNewUrl(draft.id))
        .set('Cookie', [attachSession(memberSessionId)])
        .set('Idempotency-Key', StringHelper.randomize(16))
        .send({ ...applyNewBody(), acknowledged_assumption_ids: ['assumption-1'] })
        .expect(200)
        .then((response) => {
          expect(response.body.data.status).to.equal('applied');
        });
    });

    it('should name the created firewall from the request when a name is given', async () => {
      const draft = await makePreviewOkDraft();
      const chosenName = `edge-${StringHelper.randomize(8)}`;

      const response = await request(app.express)
        .post(applyNewUrl(draft.id))
        .set('Cookie', [attachSession(memberSessionId)])
        .set('Idempotency-Key', StringHelper.randomize(16))
        .send(applyNewBody({ kind: 'firewall', name: chosenName }))
        .expect(200);

      const firewall = await firewallRepository.findOneByOrFail({
        id: response.body.data.target_ids.firewallId,
      });
      expect(firewall.name).to.equal(chosenName);
    });

    // Generation now refuses to produce such a proposal, but orchestration must
    // still apply one: drafts persisted before that rule exist, and an
    // explicitly empty provisioning block stays valid for every other route
    // that creates a profile. The two rules are separate on purpose -- this one
    // is about not exploding on a stored draft, not about what a description
    // may produce.
    it('should apply a stored draft that declares no interfaces or rules', async () => {
      const fixture = makeAssistedProfileProposalFixture({ schemaVersion: '1.2.0' }) as Record<
        string,
        any
      >;
      fixture.generated.target.name = 'FW-Test';
      fixture.generated.target.interfaces = [];
      fixture.generated.profile.requiredRoles = [];
      fixture.generated.roleAssignments.interfaceRoles = [];
      fixture.generated.rules = [];
      const proposal = new AssistedProfileProposalMapper().map(
        validateAssistedProfileFixtureAtGateway(fixture),
      );
      expect(proposal.model.provision).to.deep.equal({ interfaces: [], rules: [] });
      const draft = await makePreviewOkDraft({
        proposal: proposal as unknown as Record<string, unknown>,
      });
      const before = await countFirewalls();

      const response = await request(app.express)
        .post(applyNewUrl(draft.id))
        .set('Cookie', [attachSession(memberSessionId)])
        .set('Idempotency-Key', StringHelper.randomize(16))
        .send(applyNewBody())
        .expect(200);

      expect(response.body.data.status).to.equal('applied');
      expect(response.body.data.target_ids.interfaceIds).to.deep.equal([]);
      expect(response.body.data.target_ids.profileId).to.be.a('number');
      expect(await countFirewalls()).to.equal(before + 1);
      const firewallId = response.body.data.target_ids.firewallId;
      const firewall = await firewallRepository.findOneByOrFail({ id: firewallId });
      expect(firewall.name).to.equal('FW-Test');
      const interfaces = await db
        .getSource()
        .manager.getRepository(Interface)
        .find({ where: { firewallId } });
      // Base FWCloud creation supplies its internal loopback independently
      // of the profile. The empty proposal must add no network interfaces.
      expect(interfaces.map((iface) => iface.name)).to.deep.equal(['lo']);
      const reloaded = await repository.findOneByOrFail({ id: draft.id });
      expect(reloaded.status).to.equal('applied');
      expect(reloaded.stepLog!.every((entry) => entry.status !== 'failed')).to.equal(true);
    });

    it('should reject a whitespace-only name with 422 before creating anything', async () => {
      const draft = await makePreviewOkDraft();
      const before = await countFirewalls();

      await request(app.express)
        .post(applyNewUrl(draft.id))
        .set('Cookie', [attachSession(memberSessionId)])
        .set('Idempotency-Key', StringHelper.randomize(16))
        .send(applyNewBody({ kind: 'firewall', name: '   ' }))
        .expect(422);

      expect(await countFirewalls()).to.equal(before);
    });

    it('should return the exact cached response for a repeated same-key submission, creating one firewall', async () => {
      const draft = await makePreviewOkDraft();
      const before = await countFirewalls();
      const idempotencyKey = StringHelper.randomize(16);
      const send = () =>
        request(app.express)
          .post(applyNewUrl(draft.id))
          .set('Cookie', [attachSession(memberSessionId)])
          .set('Idempotency-Key', idempotencyKey)
          .send(applyNewBody());

      const first = await send().expect(200);
      expect(first.body.data.status).to.equal('applied');

      // The first mutating request took the FWCloud lock, which `LockValidation`
      // keys on express's own `req.sessionID` (FwCloud.getFwcloudAccess ->
      // `mylock`). A real browser keeps one express session across both
      // submissions and therefore owns the lock on the retry; this harness
      // fakes sessions per request, so the lock is released here instead of
      // asserting a 403 that production would never return. The rest of the
      // suite never hits this because its admin session has no `user__fwcloud`
      // row, and `LockValidation` no-ops when access is false.
      await db
        .getSource()
        .query('UPDATE fwcloud SET locked = 0, locked_by = NULL WHERE id = ?', [fwCloud.id]);

      const second = await send().expect(200);
      expect(second.body.data).to.deep.equal(first.body.data);

      // The cached replay must not have created a second firewall.
      expect(await countFirewalls()).to.equal(before + 1);
    });
  });

  describe('DELETE /fwclouds/:fwcloud/assistant/drafts/:draft (discard)', () => {
    it('should reject guest users and not change the draft state', async () => {
      const draft = await makeDraft('validated');
      await request(app.express).delete(draftUrl(draft.id)).expect(401);

      const persisted = await repository.findOneOrFail({ where: { id: draft.id } });
      expect(persisted.status).to.equal('validated');
    });

    it('should reject users without access to the FWCloud and not change the draft state', async () => {
      const draft = await makeDraft('validated');
      const regularUser = await createUser({ role: 0 });
      const regularUserSessionId = generateSession(regularUser);

      await request(app.express)
        .delete(draftUrl(draft.id))
        .set('Cookie', [attachSession(regularUserSessionId)])
        .expect(401);

      const persisted = await repository.findOneOrFail({ where: { id: draft.id } });
      expect(persisted.status).to.equal('validated');
    });

    (['validated', 'preview_ok', 'apply_failed'] as const).forEach((status) => {
      it(`should discard a draft from '${status}', keep the row, and audit it`, async () => {
        const creator = await createUser({ role: 0 });
        const draft = await makeDraft(status, { createdBy: creator.id });

        await request(app.express)
          .delete(draftUrl(draft.id))
          .set('Cookie', [attachSession(adminUserSessionId)])
          .expect(200)
          .then((response) => {
            expect(response.body.data.status).to.equal('discarded');
          });

        const persisted = await repository.findOneOrFail({ where: { id: draft.id } });
        expect(persisted.status).to.equal('discarded');
        expect(persisted.discardedAt).to.not.be.null;

        const auditEntries = await auditLogRepository.find({
          where: {
            call: FIREWALL_PROFILE_DRAFT_DISCARD_AUDIT_CALL,
            fwCloudId: fwCloud.id,
          },
        });

        expect(auditEntries).to.have.lengthOf(1);
        const data = JSON.parse(auditEntries[0].data);
        expect(data.draftId).to.equal(draft.id);
        expect(data.fwCloudId).to.equal(fwCloud.id);
        expect(data.creatorUserId).to.equal(creator.id);
        expect(data.actorUserId).to.equal(adminUser.id);
        expect(data.previousStatus).to.equal(status);
        expect(data.newStatus).to.equal('discarded');
      });
    });

    it('should allow another FWCloud member to discard a draft they did not create', async () => {
      const creator = await createUser({ role: 0 });
      const draft = await makeDraft('validated', { createdBy: creator.id });

      const regularUserSessionId = await createFwCloudMemberSession(fwCloud);

      await request(app.express)
        .delete(draftUrl(draft.id))
        .set('Cookie', [attachSession(regularUserSessionId)])
        .expect(200);

      const persisted = await repository.findOneOrFail({ where: { id: draft.id } });
      expect(persisted.status).to.equal('discarded');
    });

    it('should reject discarding an applied draft with 409 and the current/attempted state, without persisting it', async () => {
      const draft = await makeDraft('applied');

      await request(app.express)
        .delete(draftUrl(draft.id))
        .set('Cookie', [attachSession(adminUserSessionId)])
        .expect(409)
        .then((response) => {
          expect(response.body.currentStatus).to.equal('applied');
          expect(response.body.attemptedStatus).to.equal('discarded');
          expect(response.body.draftId).to.equal(draft.id);
        });

      const persisted = await repository.findOneOrFail({ where: { id: draft.id } });
      expect(persisted.status).to.equal('applied');
    });

    it('should reject discarding an expired draft with 409, proving the expiration guard is enforced for free by the state machine', async () => {
      const draft = await makeDraft('expired');

      await request(app.express)
        .delete(draftUrl(draft.id))
        .set('Cookie', [attachSession(adminUserSessionId)])
        .expect(409)
        .then((response) => {
          expect(response.body.currentStatus).to.equal('expired');
          expect(response.body.attemptedStatus).to.equal('discarded');
          expect(response.body.draftId).to.equal(draft.id);
        });

      const persisted = await repository.findOneOrFail({ where: { id: draft.id } });
      expect(persisted.status).to.equal('expired');
    });

    it('should not create a discard audit entry for a rejected transition', async () => {
      const draft = await makeDraft('discarded');

      await request(app.express)
        .delete(draftUrl(draft.id))
        .set('Cookie', [attachSession(adminUserSessionId)])
        .expect(409);

      const auditEntries = await auditLogRepository.find({
        where: {
          call: FIREWALL_PROFILE_DRAFT_DISCARD_AUDIT_CALL,
          fwCloudId: fwCloud.id,
        },
      });
      expect(auditEntries).to.have.lengthOf(0);
    });

    it('should not leak or modify a draft belonging to another FWCloud (404, non-leaking)', async () => {
      const otherFwCloud = await makeOtherFwCloud();
      const regularUserSessionId = await createFwCloudMemberSession(otherFwCloud);

      const draft = await makeDraft('validated');

      await request(app.express)
        .delete(draftUrl(draft.id, otherFwCloud.id))
        .set('Cookie', [attachSession(regularUserSessionId)])
        .expect(404);

      const persisted = await repository.findOneOrFail({ where: { id: draft.id } });
      expect(persisted.status).to.equal('validated');
    });
  });

  /**
   * These cover only what the shared test app can prove synchronously:
   * authorization, DTO validation, the 2KB byte limit, rate limiting, and
   * the 202 admission response. They deliberately do not assert on the
   * background pipeline's eventual outcome (draft persistence, Channel
   * events, agent-failure classification) — this test environment's
   * AgentHttpClient singleton is permanently unusable (no
   * ASSISTED_PROFILE_AGENT_URL configured; see assistant-availability.e2e.spec.ts),
   * and AssistedProfileGenerationService resolves it lazily so that doesn't
   * block admission. The full pipeline is covered against a real fake agent
   * in assisted-profile-generation-pipeline.e2e.spec.ts. Because the
   * background pipeline for an accepted request here still runs (and fails)
   * asynchronously, it may leave a stray audit row after this suite exits;
   * that is a cosmetic side effect of this shared test app, not a defect.
   */
  describe('POST /fwclouds/:fwcloud/assistant/drafts/generate', () => {
    const generateUrl = (cloudId: number = fwCloud.id) => `${draftsUrl(cloudId)}/generate`;

    afterEach(async () => {
      await auditLogRepository.delete({
        call: ASSISTED_PROFILE_GENERATION_AUDIT_CALL,
        fwCloudId: fwCloud.id,
      });
    });

    it('should reject guest users', async () => {
      await request(app.express)
        .post(generateUrl())
        .send({ instruction: 'Create a firewall with WAN and LAN' })
        .expect(401);
    });

    it('should reject users without access to the FWCloud', async () => {
      const regularUser = await createUser({ role: 0 });
      const regularUserSessionId = generateSession(regularUser);

      await request(app.express)
        .post(generateUrl())
        .set('Cookie', [attachSession(regularUserSessionId)])
        .send({ instruction: 'Create a firewall with WAN and LAN' })
        .expect(401);
    });

    it('should reject an empty instruction with 422', async () => {
      await request(app.express)
        .post(generateUrl())
        .set('Cookie', [attachSession(adminUserSessionId)])
        .send({ instruction: '' })
        .expect(422);
    });

    it('should reject a whitespace-only instruction with 422', async () => {
      await request(app.express)
        .post(generateUrl())
        .set('Cookie', [attachSession(adminUserSessionId)])
        .send({ instruction: '   \n\t  ' })
        .expect(422);
    });

    it('should reject a request with neither instruction nor clarification', async () => {
      await request(app.express)
        .post(generateUrl())
        .set('Cookie', [attachSession(adminUserSessionId)])
        .send({})
        .expect(422);
    });

    it('should reject an invalid targetKind with 422', async () => {
      await request(app.express)
        .post(generateUrl())
        .set('Cookie', [attachSession(adminUserSessionId)])
        .send({ instruction: 'Create a firewall', targetKind: 'not-a-real-kind' })
        .expect(422);
    });

    it('should reject an unrecognized structured field (e.g. credentials) with 422', async () => {
      await request(app.express)
        .post(generateUrl())
        .set('Cookie', [attachSession(adminUserSessionId)])
        .send({ instruction: 'Create a firewall', credentials: { apiKey: 'leak-me' } })
        .expect(422);
    });

    it('should reject an instruction larger than 2KB with a typed 422, and never persist a draft', async () => {
      // Multi-byte characters prove this is a byte limit, not a character
      // count: 2049 'é' characters is 2049 UTF-16 code units but 4098 UTF-8
      // encoded bytes.
      const oversized = 'é'.repeat(2049);

      await request(app.express)
        .post(generateUrl())
        .set('Cookie', [attachSession(adminUserSessionId)])
        .send({ instruction: oversized })
        .expect(422)
        .then((response) => {
          expect(response.body.code).to.equal('ASSISTED_PROFILE_INSTRUCTION_TOO_LARGE');
          expect(response.body.maxBytes).to.equal(2048);
        });

      expect(await repository.count({ where: { fwCloudId: fwCloud.id } })).to.equal(0);
    });

    it('should accept a valid instruction and return 202 with a stable generation_id', async () => {
      const response = await request(app.express)
        .post(generateUrl())
        .set('Cookie', [attachSession(adminUserSessionId)])
        .send({
          instruction: 'Create a firewall with WAN and LAN',
          language: 'en',
          targetKind: 'firewall',
        })
        .expect(202);

      expect(response.body.data.generation_id).to.be.a('string');
      expect(response.body.data.generation_id).to.match(/^gen_/);
    });

    it('should not leak a foreign FWCloud through the generate route either', async () => {
      const otherFwCloud = await makeOtherFwCloud();
      const regularUserSessionId = await createFwCloudMemberSession(fwCloud);

      await request(app.express)
        .post(generateUrl(otherFwCloud.id))
        .set('Cookie', [attachSession(regularUserSessionId)])
        .send({ instruction: 'Create a firewall' })
        .expect(401);
    });

    it('should return 429 once the per-user rate limit is exceeded, distinct from validation errors', async () => {
      // A fresh admin (role 1) user is used deliberately: an FWCloud-member
      // session would hit the legacy per-FWCloud LockValidation middleware
      // (src/middleware/LockValidation.ts) across repeated mutating
      // requests, which is unrelated to this endpoint's own rate limiter.
      // Admin users have no `user__fwcloud` row and bypass that lock.
      const limitedAdmin = await createUser({ role: 1 });
      const limitedUserSessionId = generateSession(limitedAdmin);

      for (let attempt = 0; attempt < 5; attempt += 1) {
        await request(app.express)
          .post(generateUrl())
          .set('Cookie', [attachSession(limitedUserSessionId)])
          .send({ instruction: `Create a firewall, attempt ${attempt}` })
          .expect(202);
      }

      await request(app.express)
        .post(generateUrl())
        .set('Cookie', [attachSession(limitedUserSessionId)])
        .send({ instruction: 'Create a firewall, attempt 6' })
        .expect(429)
        .then((response) => {
          expect(response.body.code).to.equal('ASSISTED_PROFILE_GENERATION_RATE_LIMITED');
        });
    });
  });

  describe('when the deployment flag is disabled', () => {
    beforeEach(() => {
      app.config.set('assisted_profile.enabled', false);
    });

    afterEach(() => {
      app.config.set('assisted_profile.enabled', true);
    });

    it('returns 404 for GET /drafts', async () => {
      await request(app.express)
        .get(draftsUrl())
        .set('Cookie', [attachSession(adminUserSessionId)])
        .expect(404);
    });

    it('returns 404 for GET /drafts/:draft', async () => {
      await request(app.express)
        .get(draftUrl(1))
        .set('Cookie', [attachSession(adminUserSessionId)])
        .expect(404);
    });

    it('returns 404 for DELETE /drafts/:draft', async () => {
      await request(app.express)
        .delete(draftUrl(1))
        .set('Cookie', [attachSession(adminUserSessionId)])
        .expect(404);
    });

    it('returns 404 for POST /drafts/generate and never creates a draft or an audit row', async () => {
      await request(app.express)
        .post(`${draftsUrl()}/generate`)
        .set('Cookie', [attachSession(adminUserSessionId)])
        .send({ instruction: 'Create a firewall with WAN and LAN' })
        .expect(404);

      expect(await repository.count({ where: { fwCloudId: fwCloud.id } })).to.equal(0);
      // Scoped to this test's own (freshly created) fwCloud, not a global
      // count: an unrelated test's fire-and-forget generation pipeline can
      // land an async audit row for a *different* fwCloud at any time (see
      // the doc comment on the parent 'POST .../generate' describe block).
      expect(
        await auditLogRepository.count({
          where: { call: ASSISTED_PROFILE_GENERATION_AUDIT_CALL, fwCloudId: fwCloud.id },
        }),
      ).to.equal(0);
    });

    it('leaves GET /fwclouds/:fwcloud/assistant/profiles unaffected', async () => {
      await request(app.express)
        .get(`/fwclouds/${fwCloud.id}/assistant/profiles`)
        .set('Cookie', [attachSession(adminUserSessionId)])
        .expect(200);
    });
  });

  describe('Regression: existing assistant/profiles and ai-assistant namespaces', () => {
    it('keeps GET /fwclouds/:fwcloud/assistant/profiles registered and working', async () => {
      await request(app.express)
        .get(`/fwclouds/${fwCloud.id}/assistant/profiles`)
        .set('Cookie', [attachSession(adminUserSessionId)])
        .expect(200)
        .then((response) => {
          expect(response.body.data).to.be.an('array');
        });
    });

    it('keeps the /aiassistant namespace registered and unaffected', async () => {
      const response = await request(app.express).get('/aiassistant');
      expect(response.type).to.match(/json/);
      expect(response.body).to.have.property('status');
    });
  });
});
