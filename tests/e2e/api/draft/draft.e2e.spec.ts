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
import { User } from '../../../../src/models/user/User';
import StringHelper from '../../../../src/utils/string.helper';
import { describeName, expect, testSuite } from '../../../mocha/global-setup';
import { attachSession, createUser, generateSession } from '../../../utils/utils';
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
    const now = new Date();
    const draft = repository.create({
      fwCloudId: fwCloud.id,
      createdBy: null,
      updatedBy: null,
      status,
      contractVersion: 'apg.mvp.v1',
      proposal: { metadata: { schemaVersion: '1.0.0' }, generated: {} },
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
    });

    const saved = await repository.save(draft);
    draftIds.push(saved.id);
    return saved;
  };

  const makeOtherFwCloud = (): Promise<FwCloud> =>
    fwCloudRepository.save({ name: StringHelper.randomize(10), locked: false, locked_by: null });

  const memberSession = async (cloud: FwCloud): Promise<string> => {
    const user = await createUser({ role: 0 });
    user.fwClouds = [cloud];
    await db.getSource().manager.getRepository(User).save(user);
    return generateSession(user);
  };

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

      const regularUserSessionId = await memberSession(fwCloud);

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

      const regularUserSessionId = await memberSession(fwCloud);

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
        });
    });

    it('should not leak a draft belonging to another FWCloud (404, non-leaking)', async () => {
      const otherFwCloud = await makeOtherFwCloud();
      const regularUserSessionId = await memberSession(otherFwCloud);

      const draft = await makeDraft('validated');

      await request(app.express)
        .get(draftUrl(draft.id, otherFwCloud.id))
        .set('Cookie', [attachSession(regularUserSessionId)])
        .expect(404);
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

      const regularUserSessionId = await memberSession(fwCloud);

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
      const regularUserSessionId = await memberSession(otherFwCloud);

      const draft = await makeDraft('validated');

      await request(app.express)
        .delete(draftUrl(draft.id, otherFwCloud.id))
        .set('Cookie', [attachSession(regularUserSessionId)])
        .expect(404);

      const persisted = await repository.findOneOrFail({ where: { id: draft.id } });
      expect(persisted.status).to.equal('validated');
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
