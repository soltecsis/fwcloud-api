import 'reflect-metadata';
import { strict as assert } from 'node:assert';
import { getProfileProvisioning } from '../../../../src/models/replication-profile/policy-replication.types';
import { validateReplicationProfilePayload } from '../../../../src/models/replication-profile/replication-profile-validation.service';
import { PolicyReplicationService } from '../../../../src/models/replication-profile/policy-replication.service';
import { IPTablesCompiler } from '../../../../src/compiler/policy/iptables/iptables-compiler';
import { NFTablesCompiler } from '../../../../src/compiler/policy/nftables/nftables-compiler';
import { VyOSCompiler } from '../../../../src/compiler/policy/vyos/vyos-compiler';

const start = '2026-10-01T08:15:30+02:00';
const end = '2026-10-31T19:45:59+01:00';
const periods = [
  { time_start: start, time_end: end },
  { time_start: start },
  { time_end: end },
  { time_start: null, time_end: null },
  { time_start: '', time_end: '' },
  {},
];
const invalid = [
  { time_start: 'invalid' },
  { time_end: 'invalid' },
  { time_start: false },
  { time_end: [] },
  { time_start: end, time_end: start },
];

describe('Replication profile rule validity periods', () => {
  for (const field of ['provision', 'policyStructure', 'policy_structure']) {
    it(`${field}: preserves native dates and missing legacy fields through JSON and parsing`, () => {
      const model = JSON.parse(
        JSON.stringify({
          [field]: { rules: periods.map((period) => ({ chain: 'forward', ...period })) },
        }),
      );
      const before = JSON.stringify(model);
      const rules = getProfileProvisioning(model).rules;
      rules.forEach((rule, index) => {
        for (const date of ['time_start', 'time_end'] as const) {
          assert.equal(rule[date], periods[index][date]);
          assert.equal(
            Object.prototype.hasOwnProperty.call(rule, date),
            Object.prototype.hasOwnProperty.call(periods[index], date),
          );
        }
      });
      assert.deepEqual(validateReplicationProfilePayload({ targetKind: 'firewall', model }), []);
      assert.equal(JSON.stringify(model), before);
    });

    it(`${field}: rejects invalid dates/ranges without mutating or stripping their values`, () => {
      for (const period of invalid) {
        const model = { [field]: { rules: [{ chain: 'forward', ...period }] } };
        const before = JSON.stringify(model);
        const errors = validateReplicationProfilePayload({ targetKind: 'firewall', model });
        assert.ok(
          errors.some(
            (error) =>
              error.code === 'invalid_rule_validity' &&
              error.path.startsWith(`model.${field}.rules[0].time_`),
          ),
        );
        assert.equal(JSON.stringify(model), before);
        const [parsed] = getProfileProvisioning(model).rules;
        for (const date of ['time_start', 'time_end'] as const)
          assert.deepEqual(parsed[date], period[date]);
      }
    });
  }

  it('allows equal boundaries and compares explicit timezone offsets as instants', () => {
    for (const time_end of ['2026-10-01T06:15:30Z', '2026-10-01T03:15:31-03:00']) {
      assert.deepEqual(
        validateReplicationProfilePayload({
          targetKind: 'firewall',
          model: { provision: { rules: [{ time_start: start, time_end }] } },
        }),
        [],
      );
    }
  });

  it('rejects invalid dates in saved editor rules even when provision takes precedence on apply', () => {
    const errors = validateReplicationProfilePayload({
      targetKind: 'firewall',
      model: {
        provision: { rules: [{}] },
        policyStructure: { rules: [{ time_start: end, time_end: start }] },
      },
    });
    assert.ok(
      errors.some(
        (error) =>
          error.code === 'invalid_rule_validity' &&
          error.path === 'model.policyStructure.rules[0].time_end',
      ),
    );
  });

  for (const mode of ['replace_defaults', 'merge', 'dry_run'] as const) {
    it(`${mode}: rejects invalid periods before accessing or modifying a target`, async () => {
      // No service/application/database initialization: a target access would throw here.
      const service = Object.create(PolicyReplicationService.prototype) as PolicyReplicationService;
      for (const period of invalid) {
        const provision = getProfileProvisioning({ provision: { rules: [{}, period] } });
        const result = await service.provisionPolicyFromProfile(
          { kind: 'firewall', id: 1 },
          provision,
          1,
          mode,
        );
        assert.equal(result.applied, false);
        assert.ok(result.errors.some((error) => /time_start|time_end/.test(error)));
        assert.deepEqual(result.createdRules, []);
      }
    });
  }

  for (const Compiler of [IPTablesCompiler, NFTablesCompiler, VyOSCompiler]) {
    for (const type of [1, 2, 3, 4, 5, 61, 62, 63, 64, 65]) {
      it(`${Compiler.name}, policy ${type}: compiles both, partial and absent periods`, () => {
        for (const period of periods) {
          const data = {
            id: 1,
            type,
            action: 1,
            special: 0,
            options: 6,
            firewall_options: 0,
            mark_code: 0,
            positions: Array.from({ length: 6 }, (_, id) => ({ id, ipobjs: [] })),
            ...period,
          };
          if (type === 5 || type === 65) {
            data.positions[4].ipobjs.push({
              type: 5,
              address: type === 5 ? '192.0.2.10' : '2001:db8::10',
            });
          }
          const script = new Compiler(data).ruleCompile();
          if (Compiler === IPTablesCompiler) {
            assert.equal(script.includes('--datestart'), !!period.time_start);
            assert.equal(script.includes('--datestop'), !!period.time_end);
            if (period.time_start) assert.ok(script.includes('--datestart 2026-10-01T06:15:30'));
            if (period.time_end) assert.ok(script.includes('--datestop 2026-10-31T18:45:59'));
          } else if (Compiler === NFTablesCompiler) {
            assert.equal(script.includes('meta time \\>='), !!period.time_start);
            assert.equal(script.includes('meta time \\<'), !!period.time_end);
            if (period.time_start)
              assert.ok(script.includes(`meta time \\>= ${Date.parse(start) / 1000}`));
            if (period.time_end)
              assert.ok(script.includes(`meta time \\< ${Date.parse(end) / 1000 + 1}`));
          } else {
            assert.equal(script.includes('time utc'), false);
            assert.equal(script.includes('time startdate'), !!period.time_start);
            assert.equal(script.includes('time stopdate'), !!period.time_end);
            if (period.time_start)
              assert.ok(script.includes("time startdate '2026-10-01T06:15:30'"));
            if (period.time_end) assert.ok(script.includes("time stopdate '2026-10-31T18:45:59'"));
          }
        }
      });
    }

    it(`${Compiler.name}: refuses to compile invalid dates or ranges`, () => {
      for (const period of invalid) {
        assert.throws(
          () =>
            new Compiler({
              id: 1,
              type: 3,
              action: 1,
              special: 0,
              positions: Array.from({ length: 5 }, () => ({ ipobjs: [] })),
              ...period,
            }).ruleCompile(),
          /time_start|time_end/,
        );
      }
    });
  }

  for (const Compiler of [IPTablesCompiler, NFTablesCompiler]) {
    it(`${Compiler.name}: gates marking and saved connection marks with the same period`, () => {
      const script = new Compiler({
        id: 1,
        type: 3,
        action: 1,
        special: 0,
        options: 0,
        firewall_options: 0,
        mark_code: 37,
        time_start: start,
        time_end: end,
        positions: Array.from({ length: 5 }, (_, id) => ({ id, ipobjs: [] })),
      }).ruleCompile();
      const entries = script
        .split('\n')
        .filter((line) =>
          /-A (FORWARD|PREROUTING) |add rule ip (filter|mangle) (FORWARD|PREROUTING) /.test(line),
        );
      assert.equal(entries.length, 5);
      for (const entry of entries) {
        assert.ok(
          entry.includes(
            Compiler === IPTablesCompiler
              ? '--datestart 2026-10-01T06:15:30'
              : `meta time \\>= ${Date.parse(start) / 1000}`,
          ),
        );
        assert.ok(
          entry.includes(
            Compiler === IPTablesCompiler
              ? '--datestop 2026-10-31T18:45:59'
              : `meta time \\< ${Date.parse(end) / 1000 + 1}`,
          ),
        );
      }
    });
  }
});
