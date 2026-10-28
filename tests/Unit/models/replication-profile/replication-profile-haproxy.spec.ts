import { expect } from '../../../mocha/global-setup';
import { getProfileProvisioning } from '../../../../src/models/replication-profile/policy-replication.types';
import { validateReplicationProfilePayload } from '../../../../src/models/replication-profile/replication-profile-validation.service';
import { MANUAL_HAPROXY } from '../../../utils/manual-haproxy';

describe('Replication profile native HAProxy configurations', () => {
  it('preserves own invalid, null and undefined settings without importing inherited values', () => {
    const entry = Object.assign(Object.create({ style: 'inherited' }), {
      rule_type: '2',
      cfg_text: undefined,
      active: null,
    });
    const [parsed] = getProfileProvisioning({ provision: { system: { haproxy: [entry] } } }).system
      .haproxy;
    expect(parsed.rule_type).to.eq('2');
    expect(parsed).to.have.own.property('cfg_text', undefined);
    expect(parsed.active).to.eq(null);
    expect(parsed).not.to.have.property('style');
  });
  for (const field of ['provision', 'policyStructure', 'policy_structure']) {
    const payload = (entries: unknown[]) => ({
      targetKind: 'firewall',
      model: { [field]: { system: { haproxy: entries } } },
    });

    it(`preserves native manual and structured types independently through JSON in ${field}`, () => {
      const manual = { rule_type: 2, cfg_text: MANUAL_HAPROXY, active: false, style: 'custom' };
      const parsed = getProfileProvisioning(
        JSON.parse(JSON.stringify(payload([manual, { rule_type: 1 }, {}]).model)),
      );
      expect(parsed.system.haproxy[0]).to.include(manual);
      expect(parsed.system.haproxy[1].rule_type).to.eq(1);
      expect(parsed.system.haproxy[2]).not.to.have.property('rule_type');
      expect(validateReplicationProfilePayload(payload([manual]))).to.deep.eq([]);
    });

    it(`does not validate manual text as structured fields in ${field}`, () => {
      const entry = {
        rule_type: 2,
        cfg_text: MANUAL_HAPROXY,
        frontendService: 'not a port',
        frontendIp: { kind: 'address', value: 'not a structured address' },
      };
      expect(validateReplicationProfilePayload(payload([entry]))).to.deep.eq([]);
      expect(getProfileProvisioning(payload([entry]).model).system.haproxy[0].frontendIp).to.eq(
        null,
      );
    });

    for (const entry of [
      { rule_type: 2 },
      { rule_type: 2, cfg_text: '' },
      { rule_type: 2, cfg_text: ' \r\n\t' },
      { rule_type: 2, cfg_text: null },
      { rule_type: 2, cfg_text: 42 },
      { rule_type: 2, cfg_text: 'frontend\0x' },
      { rule_type: 9 },
      { rule_type: '2', cfg_text: MANUAL_HAPROXY },
      { cfg_text: MANUAL_HAPROXY },
      { rule_type: 2, cfg_text: MANUAL_HAPROXY, active: 'false' },
    ]) {
      it(`rejects malformed or ambiguous HAProxy ${JSON.stringify(entry).slice(0, 70)} in ${field}`, () => {
        const errors = validateReplicationProfilePayload(payload([entry]));
        expect(
          errors.some(
            (error) =>
              error.code === 'invalid_haproxy_configuration' &&
              error.path === `model.${field}.system.haproxy[0]`,
          ),
        ).to.eq(true);
      });
    }
  }

  it('retains existing structured port validation', () => {
    const errors = validateReplicationProfilePayload({
      targetKind: 'firewall',
      model: {
        provision: { system: { haproxy: [{ frontendService: { protocol: 'tcp', port: 99999 } }] } },
      },
    });
    expect(errors).not.to.be.empty;
  });

  it('rejects manual text that cannot fit native HAProxy storage, counting UTF-8 bytes', () => {
    for (const cfg_text of ['x'.repeat(65536), 'á'.repeat(32768)]) {
      const errors = validateReplicationProfilePayload({
        targetKind: 'firewall',
        model: { provision: { system: { haproxy: [{ rule_type: 2, cfg_text }] } } },
      });
      expect(errors[0].message).to.include('65535 bytes');
    }
  });
});
