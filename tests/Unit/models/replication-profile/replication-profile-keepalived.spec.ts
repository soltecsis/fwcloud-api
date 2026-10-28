import { expect } from '../../../mocha/global-setup';
import { getProfileProvisioning } from '../../../../src/models/replication-profile/policy-replication.types';
import { validateReplicationProfilePayload } from '../../../../src/models/replication-profile/replication-profile-validation.service';

const MANUAL_KEEPALIVED =
  '# VRRP settings\nvrrp_instance VI_1 {\n  interface eth1\n  virtual_router_id 51\n}\n';

describe('Replication profile native Keepalived settings', () => {
  for (const field of ['provision', 'policyStructure', 'policy_structure']) {
    const payload = (entry: unknown) => ({
      targetKind: 'firewall',
      model: { [field]: { system: { keepalived: [entry] } } },
    });

    it(`preserves manual configuration and flags through JSON in ${field}`, () => {
      const entry = { rule_type: 2, cfg_text: MANUAL_KEEPALIVED, active: false, style: 'custom' };
      const model = JSON.parse(JSON.stringify(payload(entry).model));
      const parsed = getProfileProvisioning(model).system.keepalived[0];
      expect(parsed).to.include(entry);
      expect(parsed.interfaceRole).to.eq(undefined);
      expect(parsed.virtualIps).to.deep.eq([]);
      expect(validateReplicationProfilePayload(payload(entry))).to.deep.eq([]);
    });

    it(`preserves structured settings and legacy defaults in ${field}`, () => {
      const entry = {
        rule_type: 1,
        active: false,
        style: 'custom',
        interfaceRole: 'lan',
        masterNode: 1,
        virtualIps: [{ kind: 'address', value: '192.0.2.5' }],
      };
      const parsed = getProfileProvisioning(payload(entry).model).system.keepalived[0];
      expect(parsed).to.include({
        rule_type: 1,
        active: false,
        style: 'custom',
        interfaceRole: 'lan',
        masterNode: 1,
      });
      expect(parsed.virtualIps).to.have.length(1);
      expect(parsed.virtualIps[0]).to.include(entry.virtualIps[0]);
      const legacy = getProfileProvisioning(payload({}).model).system.keepalived[0];
      expect(legacy).not.to.have.property('rule_type');
      expect(legacy).not.to.have.property('active');
    });

    for (const entry of [
      { rule_type: 2 },
      { rule_type: 2, cfg_text: ' \r\n\t' },
      { rule_type: 2, cfg_text: 'vrrp\0instance' },
      { rule_type: 9 },
      { rule_type: '2', cfg_text: MANUAL_KEEPALIVED },
      { cfg_text: MANUAL_KEEPALIVED },
      { active: 'false' },
      { style: 'x'.repeat(51) },
    ]) {
      it(`rejects malformed native settings ${JSON.stringify(entry).slice(0, 50)} in ${field}`, () => {
        const errors = validateReplicationProfilePayload(payload(entry));
        expect(
          errors.some(
            (error) =>
              error.code === 'invalid_keepalived_configuration' &&
              error.path === `model.${field}.system.keepalived[0]`,
          ),
        ).to.eq(true);
      });
    }
  }
});
