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
import { FirewallProfileDraft } from '../../../../src/models/firewall-profile-draft/firewall-profile-draft.model';
import { FIREWALL_PROFILE_DRAFT_TRANSITION_AUDIT_CALL } from '../../../../src/models/firewall-profile-draft/firewall-profile-draft-state.service';
import { FIREWALL_PROFILE_DRAFT_DISCARD_AUDIT_CALL } from '../../../../src/models/firewall-profile-draft/firewall-profile-draft.service';
import { FIREWALL_PROFILE_DRAFT_PREVIEW_AUDIT_CALL } from '../../../../src/models/firewall-profile-draft/firewall-profile-draft-preview.service';
import { PROFILE_APPLICATION_AUDIT_CALL } from '../../../../src/models/replication-profile/profile-application.service';
import type { FirewallProfileDraftStatus } from '../../../../src/models/firewall-profile-draft/firewall-profile-draft.types';
import { AssistedProfileMetricsService } from '../../../../src/models/assisted-profile-metrics/assisted-profile-metrics.service';
import {
  ASSISTED_PROFILE_COUNTER_DECLARATIONS,
  ASSISTED_PROFILE_METRIC_NAMES,
} from '../../../../src/models/assisted-profile-metrics/assisted-profile-metrics.types';
import type { AssistedProfileMetricsDto } from '../../../../src/controllers/assisted-profile-metrics/dto/assisted-profile-metrics-response.dto';
import StringHelper from '../../../../src/utils/string.helper';
import { describeName, expect, testSuite } from '../../../mocha/global-setup';
import {
  attachSession,
  createFwCloudMemberSession,
  createUser,
  generateSession,
} from '../../../utils/utils';
import { metricSeriesKeys, metricValue } from '../../../utils/assisted-profile-metrics.reader';
import { makeFirewallProfileDraftAttributes } from '../../../utils/firewall-profile-draft-factory';
import { FwCloudFactory, FwCloudProduct } from '../../../utils/fwcloud-factory';
import { makeMappedAssistedProfileProposal } from '../../../utils/assisted-profile-proposal-fixtures';
import { In, type Repository } from 'typeorm';
import request = require('supertest');

const METRICS_URL = '/assisted-profile/metrics';
const NAMES = ASSISTED_PROFILE_METRIC_NAMES;

/**
 * Values planted throughout the funnel that must never reach the metrics.
 * Deliberately the kinds of data the issue calls out: an address, a resource
 * name, an identity and a natural-language instruction.
 */
const IDENTIFIABLE = {
  email: 'user@example.com',
  firewallName: 'customer-firewall-01',
  address: '10.20.30.40',
  instruction: 'Open SSH from the Madrid office to customer-firewall-01 at 10.20.30.40',
};

describe(describeName('Assisted Profile adoption metrics E2E tests'), () => {
  let app: Application;
  let adminUser: User;
  let adminUserSessionId: string;
  let fwCloud: FwCloud;
  let repository: Repository<FirewallProfileDraft>;
  let fwCloudRepository: Repository<FwCloud>;
  let auditLogRepository: Repository<AuditLog>;
  let metricsService: AssistedProfileMetricsService;
  const draftIds: number[] = [];

  const draftUrl = (draftId: number, cloudId: number = fwCloud.id) =>
    `/fwclouds/${cloudId}/assistant/drafts/${draftId}`;

  const readMetrics = (
    sessionId: string = adminUserSessionId,
  ): Promise<AssistedProfileMetricsDto> =>
    request(app.express)
      .get(METRICS_URL)
      .set('Cookie', [attachSession(sessionId)])
      .expect(200)
      .then((response) => response.body.data as AssistedProfileMetricsDto);

  const valueOf = (
    body: AssistedProfileMetricsDto,
    name: string,
    labels: Record<string, string> = {},
  ): number => metricValue(body.families, name, labels);

  const seriesKeys = (body: AssistedProfileMetricsDto): string[] => metricSeriesKeys(body.families);

  const mappedProposal = (): unknown => makeMappedAssistedProfileProposal().proposal;

  const makeDraft = async (
    status: FirewallProfileDraftStatus,
    overrides: Partial<FirewallProfileDraft> = {},
  ): Promise<FirewallProfileDraft> => {
    const saved = await repository.save(
      repository.create(
        makeFirewallProfileDraftAttributes(fwCloud.id, status, {
          proposal: mappedProposal(),
          ...overrides,
        }),
      ),
    );
    draftIds.push(saved.id);
    return saved;
  };

  beforeEach(async () => {
    app = testSuite.app;
    repository = db.getSource().manager.getRepository(FirewallProfileDraft);
    fwCloudRepository = db.getSource().manager.getRepository(FwCloud);
    auditLogRepository = db.getSource().manager.getRepository(AuditLog);
    metricsService = await app.getService<AssistedProfileMetricsService>(
      AssistedProfileMetricsService.name,
    );
    metricsService.reset();

    adminUser = await createUser({ role: 1 });
    adminUserSessionId = generateSession(adminUser);

    fwCloud = await fwCloudRepository.save({
      name: StringHelper.randomize(10),
      locked: false,
      locked_by: null,
    });
  });

  afterEach(async () => {
    metricsService.reset();
    await auditLogRepository.delete({
      call: In([
        FIREWALL_PROFILE_DRAFT_TRANSITION_AUDIT_CALL,
        FIREWALL_PROFILE_DRAFT_DISCARD_AUDIT_CALL,
        FIREWALL_PROFILE_DRAFT_PREVIEW_AUDIT_CALL,
        PROFILE_APPLICATION_AUDIT_CALL,
      ]),
    });
    const ids = draftIds.splice(0);
    if (ids.length > 0) {
      await repository.delete(ids);
    }
  });

  describe('operator access', () => {
    it('rejects guest users', async () => {
      await request(app.express).get(METRICS_URL).expect(401);
    });

    it('rejects a non-administrator user', async () => {
      const regularUser = await createUser({ role: 0 });

      await request(app.express)
        .get(METRICS_URL)
        .set('Cookie', [attachSession(generateSession(regularUser))])
        .expect(401);
    });

    it('rejects a FWCloud member who is not an administrator', async () => {
      const memberSessionId = await createFwCloudMemberSession(fwCloud);

      await request(app.express)
        .get(METRICS_URL)
        .set('Cookie', [attachSession(memberSessionId)])
        .expect(401);
    });

    it('returns every declared counter to an administrator, zeros included', async () => {
      const body = await readMetrics();

      expect(body.families.map((family) => family.name)).to.deep.equal(
        ASSISTED_PROFILE_COUNTER_DECLARATIONS.map((declaration) => declaration.name),
      );
      expect(body.families.every((family) => family.type === 'counter')).to.equal(true);
      expect(body.families.every((family) => family.help.length > 0)).to.equal(true);
      expect(valueOf(body, NAMES.preview)).to.equal(0);
      expect(body.collection_started_at).to.be.a('string');
      expect(body.collected_at).to.be.a('string');
      expect(body.deployment_enabled).to.equal(true);
    });

    it('reports the deployment flag rather than hiding the counters when it is off', async () => {
      app.config.set('assisted_profile.enabled', false);
      try {
        const body = await readMetrics();
        expect(body.deployment_enabled).to.equal(false);
        expect(body.families).to.have.length(ASSISTED_PROFILE_COUNTER_DECLARATIONS.length);
      } finally {
        app.config.set('assisted_profile.enabled', true);
      }
    });

    it('does not audit the read itself', async () => {
      const before = await auditLogRepository.count();
      await readMetrics();
      await readMetrics();

      expect(await auditLogRepository.count()).to.equal(before);
    });
  });

  describe('preview funnel', () => {
    it('counts a successful preview and leaves the failure counter alone', async () => {
      const draft = await makeDraft('validated');

      await request(app.express)
        .post(`${draftUrl(draft.id)}/preview`)
        .set('Cookie', [attachSession(adminUserSessionId)])
        .expect(200);

      const body = await readMetrics();
      expect(valueOf(body, NAMES.preview)).to.equal(1);
      expect(valueOf(body, NAMES.previewFailed, { reason: 'illegal_state' })).to.equal(0);
    });

    it('counts a 409 preview attempt only as a bounded failure class', async () => {
      const draft = await makeDraft('applied');

      await request(app.express)
        .post(`${draftUrl(draft.id)}/preview`)
        .set('Cookie', [attachSession(adminUserSessionId)])
        .expect(409);

      const body = await readMetrics();
      expect(valueOf(body, NAMES.preview)).to.equal(0);
      expect(valueOf(body, NAMES.previewFailed, { reason: 'illegal_state' })).to.equal(1);
    });

    it('does not move any counter for a read of the draft', async () => {
      const draft = await makeDraft('validated');
      const before = await readMetrics();

      await request(app.express)
        .get(draftUrl(draft.id))
        .set('Cookie', [attachSession(adminUserSessionId)])
        .expect(200);

      const after = await readMetrics();
      expect(after.families).to.deep.equal(before.families);
    });
  });

  describe('discard funnel', () => {
    it('counts a valid discard exactly once and ignores a repeated one', async () => {
      const draft = await makeDraft('validated');
      const discard = () =>
        request(app.express)
          .delete(draftUrl(draft.id))
          .set('Cookie', [attachSession(adminUserSessionId)]);

      await discard().expect(200);
      await discard().expect(409);

      expect(valueOf(await readMetrics(), NAMES.draftDiscarded)).to.equal(1);
    });
  });

  describe('apply funnel', () => {
    const PREVIEW_HASH = 'metrics-e2e-preview-hash';
    let target: FwCloudProduct;

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
      // The apply target must live in the draft's own FWCloud.
      target = await new FwCloudFactory().make();
      fwCloud = target.fwcloud;
    });

    it('counts a successful apply as applied', async () => {
      const draft = await makePreviewOkDraft();

      await request(app.express)
        .post(`${draftUrl(draft.id)}/apply`)
        .set('Cookie', [attachSession(adminUserSessionId)])
        .set('Idempotency-Key', StringHelper.randomize(16))
        .send(applyBody())
        .expect(200);

      const body = await readMetrics();
      expect(valueOf(body, NAMES.apply, { result: 'applied' })).to.equal(1);
      expect(valueOf(body, NAMES.apply, { result: 'apply_failed' })).to.equal(0);
    });

    it('counts an injected apply failure as apply_failed only', async () => {
      const otherTarget = await new FwCloudFactory().make();
      const draft = await makePreviewOkDraft();

      await request(app.express)
        .post(`${draftUrl(draft.id)}/apply`)
        .set('Cookie', [attachSession(adminUserSessionId)])
        .set('Idempotency-Key', StringHelper.randomize(16))
        .send(applyBody(otherTarget.firewall.id))
        .expect(200)
        .then((response) => expect(response.body.data.status).to.equal('apply_failed'));

      const body = await readMetrics();
      expect(valueOf(body, NAMES.apply, { result: 'apply_failed' })).to.equal(1);
      expect(valueOf(body, NAMES.apply, { result: 'applied' })).to.equal(0);
    });

    it('does not count an Idempotency-Key replay a second time', async () => {
      const draft = await makePreviewOkDraft();
      const idempotencyKey = StringHelper.randomize(16);
      const send = () =>
        request(app.express)
          .post(`${draftUrl(draft.id)}/apply`)
          .set('Cookie', [attachSession(adminUserSessionId)])
          .set('Idempotency-Key', idempotencyKey)
          .send(applyBody());

      const first = await send().expect(200);
      const replay = await send().expect(200);

      expect(replay.body.data).to.deep.equal(first.body.data);
      expect(valueOf(await readMetrics(), NAMES.apply, { result: 'applied' })).to.equal(1);
    });

    it('does not count an apply rejected for a stale preview hash', async () => {
      const draft = await makePreviewOkDraft();

      await request(app.express)
        .post(`${draftUrl(draft.id)}/apply`)
        .set('Cookie', [attachSession(adminUserSessionId)])
        .set('Idempotency-Key', StringHelper.randomize(16))
        .send({ preview_hash: 'stale-hash', target: applyBody().target })
        .expect(422);

      const body = await readMetrics();
      expect(valueOf(body, NAMES.apply, { result: 'applied' })).to.equal(0);
      expect(valueOf(body, NAMES.apply, { result: 'apply_failed' })).to.equal(0);
    });
  });

  describe('privacy', () => {
    it('exposes none of the identifiable values driven through the funnel', async () => {
      const draft = await makeDraft('validated', {
        instructionOriginal: IDENTIFIABLE.instruction,
        requestId: `req-${IDENTIFIABLE.firewallName}`,
        proposal: {
          ...(mappedProposal() as Record<string, unknown>),
          name: IDENTIFIABLE.firewallName,
        },
      });

      await request(app.express)
        .post(`${draftUrl(draft.id)}/preview`)
        .set('Cookie', [attachSession(adminUserSessionId)])
        .expect(200);
      await request(app.express)
        .delete(draftUrl(draft.id))
        .set('Cookie', [attachSession(adminUserSessionId)])
        .expect(200);

      const body = await readMetrics();
      expect(valueOf(body, NAMES.preview)).to.equal(1);
      expect(valueOf(body, NAMES.draftDiscarded)).to.equal(1);

      const serialized = JSON.stringify(body);
      for (const value of Object.values(IDENTIFIABLE)) {
        expect(serialized, `metrics leaked ${value}`).to.not.contain(value);
      }
      expect(serialized).to.not.contain(adminUser.username);
      expect(serialized).to.not.contain(fwCloud.name);
      expect(serialized).to.not.match(/\d+\.\d+\.\d+\.\d+/);
    });

    it('exposes no draft, user, FWCloud or request identifier as a label', async () => {
      const draft = await makeDraft('validated');

      await request(app.express)
        .post(`${draftUrl(draft.id)}/preview`)
        .set('Cookie', [attachSession(adminUserSessionId)])
        .expect(200);

      const body = await readMetrics();
      const labelNames = [...new Set(body.families.flatMap((family) => family.label_names))].sort();
      expect(labelNames).to.deep.equal(['attempt', 'outcome', 'reason', 'result']);

      const labelValues = body.families.flatMap((family) =>
        family.samples.flatMap((sample) => Object.values(sample.labels)),
      );
      for (const value of labelValues) {
        expect(value).to.match(/^[a-z][a-z0-9_]*$/);
      }
      const serialized = JSON.stringify(
        body.families.flatMap((family) => family.samples.map((sample) => sample.labels)),
      );
      expect(serialized).to.not.contain(String(draft.id));
      expect(serialized).to.not.contain(String(fwCloud.id));
      expect(serialized).to.not.contain(String(adminUser.id));
    });
  });

  describe('cardinality', () => {
    it('adds no series whatever the users, FWClouds and drafts are', async () => {
      const before = seriesKeys(await readMetrics());

      for (let index = 0; index < 4; index++) {
        const otherCloud = await fwCloudRepository.save({
          name: `${IDENTIFIABLE.firewallName}-${index}`,
          locked: false,
          locked_by: null,
        });
        const otherUser = await createUser({ role: 1 });
        const otherSession = generateSession(otherUser);
        const saved = await repository.save(
          repository.create(
            makeFirewallProfileDraftAttributes(otherCloud.id, 'validated', {
              proposal: mappedProposal(),
              requestId: `req-${index}-${IDENTIFIABLE.address}`,
              instructionOriginal: IDENTIFIABLE.instruction,
            }),
          ),
        );
        draftIds.push(saved.id);

        await request(app.express)
          .post(`/fwclouds/${otherCloud.id}/assistant/drafts/${saved.id}/preview`)
          .set('Cookie', [attachSession(otherSession)])
          .expect(200);
      }

      const after = await readMetrics();
      expect(seriesKeys(after)).to.deep.equal(before);
      expect(valueOf(after, NAMES.preview)).to.equal(4);
      expect(JSON.stringify(after)).to.not.contain(IDENTIFIABLE.firewallName);
    });
  });
});
