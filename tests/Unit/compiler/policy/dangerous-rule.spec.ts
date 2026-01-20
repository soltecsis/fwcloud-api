/*
    Copyright 2025 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
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

import { describeName, expect } from '../../../mocha/global-setup';
import db from '../../../../src/database/database-manager';
import { PolicyRule, PolicyRuleOptMask } from '../../../../src/models/policy/PolicyRule';
import { PolicyTypesMap } from '../../../../src/models/policy/PolicyType';
import { PolicyRuleToInterface } from '../../../../src/models/policy/PolicyRuleToInterface';
import { RulePositionsMap } from '../../../../src/models/policy/PolicyPosition';
import {
  AvailablePolicyCompilers,
  PolicyCompiler,
} from '../../../../src/compiler/policy/PolicyCompiler';
import { RuleActionsMap } from '../../../../src/compiler/policy/PolicyCompilerTools';
import { IPObj } from '../../../../src/models/ipobj/IPObj';
import { Firewall, FireWallOptMask } from '../../../../src/models/firewall/Firewall';
import { FwCloud } from '../../../../src/models/fwcloud/FwCloud';
import { Interface } from '../../../../src/models/interface/Interface';
import StringHelper from '../../../../src/utils/string.helper';
import { EntityManager } from 'typeorm';

type Chain = 'INPUT' | 'FORWARD';
type IpType = 'IPv4' | 'IPv6';
type PolicyTypeKey = 'IPv4:INPUT' | 'IPv4:OUTPUT' | 'IPv4:FORWARD' | 'IPv6:INPUT' | 'IPv6:FORWARD';

type RuleActionKey = 'ACCEPT' | 'DROP' | 'REJECT';

type InterfaceBinding = 'in' | 'out' | 'both';

type CompileOptions = {
  comment?: string;
  optionsMask?: number;
  action?: RuleActionKey;
  interfaceBinding?: InterfaceBinding;
};

describe(describeName('Policy Compiler Unit Tests - Dangerous rule detection'), () => {
  let dbCon: any;
  let manager: EntityManager;
  let fwcloud: number;
  let firewall: number;
  let inboundInterfaceId: number;
  let outboundInterfaceId: number;
  let inboundInterfaceName: string;
  let outboundInterfaceName: string;

  before(async () => {
    dbCon = db.getQuery();
    manager = db.getSource().manager;

    fwcloud = (
      await manager
        .getRepository(FwCloud)
        .save(manager.getRepository(FwCloud).create({ name: StringHelper.randomize(10) }))
    ).id;

    const flagOpts = FireWallOptMask.PDR_WARNING | FireWallOptMask.PDR_CRITICAL;

    firewall = (
      await manager
        .getRepository(Firewall)
        .save(
          manager
            .getRepository(Firewall)
            .create({ name: StringHelper.randomize(10), fwCloudId: fwcloud, options: flagOpts }),
        )
    ).id;

    const interfaceRepository = manager.getRepository(Interface);
    inboundInterfaceName = `eth-in-${StringHelper.randomize(6)}`;
    inboundInterfaceId = (
      await interfaceRepository.save(
        interfaceRepository.create({
          name: inboundInterfaceName,
          type: '10',
          interface_type: '10',
          firewallId: firewall,
        }),
      )
    ).id;

    outboundInterfaceName = `eth-out-${StringHelper.randomize(6)}`;
    outboundInterfaceId = (
      await interfaceRepository.save(
        interfaceRepository.create({
          name: outboundInterfaceName,
          type: '10',
          interface_type: '10',
          firewallId: firewall,
        }),
      )
    ).id;
  });

  async function compileDangerousRule(
    compiler: AvailablePolicyCompilers,
    typeKey: PolicyTypeKey,
    options: CompileOptions = {},
  ) {
    const ruleId = await insertPolicyRule(typeKey, {
      action: options.action,
      optionsMask: options.optionsMask,
      comment: options.comment ?? null,
    });

    if (options.interfaceBinding) {
      await attachInterfacesToRule(ruleId, typeKey, options.interfaceBinding);
    }

    const result = await compileRules(compiler, typeKey, [ruleId]);
    return { result, ruleId };
  }

  async function attachInterfacesToRule(
    ruleId: number,
    typeKey: PolicyTypeKey,
    binding: InterfaceBinding,
  ) {
    const interfaceRepository = manager.getRepository(PolicyRuleToInterface);
    const attach = async (direction: 'In' | 'Out', interfaceId: number) => {
      const positionKey = `${typeKey}:${direction}`;
      const positionId = RulePositionsMap.get(positionKey);
      if (positionId === undefined) throw new Error(`Unknown policy position "${positionKey}"`);

      await interfaceRepository.save(
        interfaceRepository.create({
          policyRuleId: ruleId,
          interfaceId,
          policyPositionId: positionId,
          position_order: 1,
        }),
      );
    };

    const promises: Array<Promise<void>> = [];
    if (binding === 'in' || binding === 'both') {
      if (!inboundInterfaceId) throw new Error('Missing inbound interface for tests');
      promises.push(attach('In', inboundInterfaceId));
    }
    if (binding === 'out' || binding === 'both') {
      if (!outboundInterfaceId) throw new Error('Missing outbound interface for tests');
      promises.push(attach('Out', outboundInterfaceId));
    }

    await Promise.all(promises);
  }

  type GeneralRuleOptions = {
    action?: RuleActionKey;
    optionsMask?: number;
    active?: 0 | 1;
    comment?: string | null;
    special?: number;
    ruleOrder?: number;
  };

  async function insertPolicyRule(typeKey: PolicyTypeKey, options: GeneralRuleOptions = {}) {
    const policyType = PolicyTypesMap.get(typeKey);
    if (policyType === undefined) throw new Error(`Unknown policy type "${typeKey}"`);

    const actionKey = options.action ?? 'ACCEPT';
    const action = RuleActionsMap.get(actionKey);
    if (!action) throw new Error(`Missing ${actionKey} action`);

    return PolicyRule.insertPolicy_r({
      firewall,
      type: policyType,
      rule_order: options.ruleOrder ?? 1,
      action,
      active: options.active ?? 1,
      special: options.special ?? 0,
      options: options.optionsMask ?? PolicyRuleOptMask.STATEFUL,
      comment: options.comment ?? null,
      run_before: null,
      run_after: null,
      fw_apply_to: null,
    });
  }

  async function compileRules(
    compiler: AvailablePolicyCompilers,
    typeKey: PolicyTypeKey,
    ruleIds: number[],
  ) {
    const policyType = PolicyTypesMap.get(typeKey);
    if (policyType === undefined) throw new Error(`Unknown policy type "${typeKey}"`);

    const rulesData: any = await PolicyRule.getPolicyData(
      'compiler',
      dbCon,
      fwcloud,
      firewall,
      policyType,
      ruleIds,
      null,
    );

    return PolicyCompiler.compile(compiler, rulesData);
  }

  function expectDangerousMetadata(
    rule: any,
    ruleId: number,
    ipType: IpType,
    chain: Chain,
    hasComment: boolean,
    isCritical: boolean = true,
  ) {
    expect(rule.id).to.equal(ruleId);
    expect(rule.active).to.equal(1);
    if (hasComment) expect(rule.comment).to.be.a('string');
    else expect(rule.comment).to.eql(null);
    expect(rule.dangerousRuleData).to.exist;
    expect(rule.dangerousRuleData.ruleIPType).to.equal(ipType);
    expect(rule.dangerousRuleData.ruleChainType).to.equal(chain);
    expect(rule.dangerousRuleData.critical).to.equal(isCritical);
  }

  const iptablesScenarios: Array<{
    typeKey: PolicyTypeKey;
    ipType: IpType;
    chain: Chain;
    expected: {
      ACCEPT: { stateful: string; stateless: string };
      DROP: string;
      REJECT: string;
    };
  }> = [
    {
      typeKey: 'IPv4:INPUT',
      ipType: 'IPv4',
      chain: 'INPUT',
      expected: {
        ACCEPT: {
          stateful: '$IPTABLES -A INPUT -m conntrack --ctstate NEW -j ACCEPT\n',
          stateless: '$IPTABLES -A INPUT -j ACCEPT\n',
        },
        DROP: '$IPTABLES -A INPUT -j DROP\n',
        REJECT: '$IPTABLES -A INPUT -j REJECT\n',
      },
    },
    {
      typeKey: 'IPv4:FORWARD',
      ipType: 'IPv4',
      chain: 'FORWARD',
      expected: {
        ACCEPT: {
          stateful: '$IPTABLES -A FORWARD -m conntrack --ctstate NEW -j ACCEPT\n',
          stateless: '$IPTABLES -A FORWARD -j ACCEPT\n',
        },
        DROP: '$IPTABLES -A FORWARD -j DROP\n',
        REJECT: '$IPTABLES -A FORWARD -j REJECT\n',
      },
    },
    {
      typeKey: 'IPv6:INPUT',
      ipType: 'IPv6',
      chain: 'INPUT',
      expected: {
        ACCEPT: {
          stateful: '$IP6TABLES -A INPUT -m conntrack --ctstate NEW -j ACCEPT\n',
          stateless: '$IP6TABLES -A INPUT -j ACCEPT\n',
        },
        DROP: '$IP6TABLES -A INPUT -j DROP\n',
        REJECT: '$IP6TABLES -A INPUT -j REJECT\n',
      },
    },
    {
      typeKey: 'IPv6:FORWARD',
      ipType: 'IPv6',
      chain: 'FORWARD',
      expected: {
        ACCEPT: {
          stateful: '$IP6TABLES -A FORWARD -m conntrack --ctstate NEW -j ACCEPT\n',
          stateless: '$IP6TABLES -A FORWARD -j ACCEPT\n',
        },
        DROP: '$IP6TABLES -A FORWARD -j DROP\n',
        REJECT: '$IP6TABLES -A FORWARD -j REJECT\n',
      },
    },
  ];

  const nftablesScenarios: Array<{
    typeKey: PolicyTypeKey;
    ipType: IpType;
    chain: Chain;
    expected: {
      ACCEPT: { stateful: string; stateless: string };
      DROP: string;
      REJECT: string;
    };
  }> = [
    {
      typeKey: 'IPv4:INPUT',
      ipType: 'IPv4',
      chain: 'INPUT',
      expected: {
        ACCEPT: {
          stateful: '$NFT add rule ip filter INPUT ct state new counter accept\n',
          stateless: '$NFT add rule ip filter INPUT counter accept\n',
        },
        DROP: '$NFT add rule ip filter INPUT counter drop\n',
        REJECT: '$NFT add rule ip filter INPUT counter reject\n',
      },
    },
    {
      typeKey: 'IPv4:FORWARD',
      ipType: 'IPv4',
      chain: 'FORWARD',
      expected: {
        ACCEPT: {
          stateful: '$NFT add rule ip filter FORWARD ct state new counter accept\n',
          stateless: '$NFT add rule ip filter FORWARD counter accept\n',
        },
        DROP: '$NFT add rule ip filter FORWARD counter drop\n',
        REJECT: '$NFT add rule ip filter FORWARD counter reject\n',
      },
    },
    {
      typeKey: 'IPv6:INPUT',
      ipType: 'IPv6',
      chain: 'INPUT',
      expected: {
        ACCEPT: {
          stateful: '$NFT add rule ip6 filter INPUT ct state new counter accept\n',
          stateless: '$NFT add rule ip6 filter INPUT counter accept\n',
        },
        DROP: '$NFT add rule ip6 filter INPUT counter drop\n',
        REJECT: '$NFT add rule ip6 filter INPUT counter reject\n',
      },
    },
    {
      typeKey: 'IPv6:FORWARD',
      ipType: 'IPv6',
      chain: 'FORWARD',
      expected: {
        ACCEPT: {
          stateful: '$NFT add rule ip6 filter FORWARD ct state new counter accept\n',
          stateless: '$NFT add rule ip6 filter FORWARD counter accept\n',
        },
        DROP: '$NFT add rule ip6 filter FORWARD counter drop\n',
        REJECT: '$NFT add rule ip6 filter FORWARD counter reject\n',
      },
    },
  ];

  const vyosScenarios: Array<{
    typeKey: PolicyTypeKey;
    ipType: IpType;
    chain: Chain;
  }> = [
    { typeKey: 'IPv4:INPUT', ipType: 'IPv4', chain: 'INPUT' },
    { typeKey: 'IPv4:FORWARD', ipType: 'IPv4', chain: 'FORWARD' },
    { typeKey: 'IPv6:INPUT', ipType: 'IPv6', chain: 'INPUT' },
    { typeKey: 'IPv6:FORWARD', ipType: 'IPv6', chain: 'FORWARD' },
  ];

  describe('IPTables dangerous rule detection', () => {
    describe('stateful', () => {
      describe('ACCEPT', () => {
        iptablesScenarios.forEach(({ typeKey, ipType, chain, expected }) => {
          it(`marks ${typeKey} ACCEPT rule as dangerous`, async () => {
            const { result, ruleId } = await compileDangerousRule('IPTables', typeKey);
            expect(result).to.have.length(1);
            expect(result[0].cs).to.equal(expected.ACCEPT.stateful);
            expectDangerousMetadata(result[0], ruleId, ipType, chain, false);
          });
        });

        it('marks ACCEPT rule as dangerous even if it includes a comment', async () => {
          const comment = 'Regla peligrosa con comentario';
          const { result, ruleId } = await compileDangerousRule('IPTables', 'IPv4:INPUT', {
            comment,
          });
          expect(result).to.have.length(1);
          expect(result[0].cs).to.include(`-m comment --comment '${comment}'`);
          expect(result[0].cs).to.include('-m conntrack --ctstate NEW -j ACCEPT');
          expectDangerousMetadata(result[0], ruleId, 'IPv4', 'INPUT', true);
        });
      });

      describe('DROP', () => {
        iptablesScenarios.forEach(({ typeKey, ipType, chain, expected }) => {
          it(`marks ${typeKey} DROP rule as dangerous`, async () => {
            const { result, ruleId } = await compileDangerousRule('IPTables', typeKey, {
              action: 'DROP',
            });
            expect(result).to.have.length(1);
            expect(result[0].cs).to.equal(expected.DROP);
            expectDangerousMetadata(result[0], ruleId, ipType, chain, false);
          });
        });

        it('marks DROP rule as dangerous even if it includes a comment', async () => {
          const comment = 'Regla peligrosa con comentario';
          const { result, ruleId } = await compileDangerousRule('IPTables', 'IPv4:INPUT', {
            comment,
            action: 'DROP',
          });
          expect(result).to.have.length(1);
          expect(result[0].cs).to.include(`-m comment --comment '${comment}'`);
          expect(result[0].cs).to.include('-j DROP');
          expectDangerousMetadata(result[0], ruleId, 'IPv4', 'INPUT', true);
        });
      });

      describe('REJECT', () => {
        iptablesScenarios.forEach(({ typeKey, ipType, chain, expected }) => {
          it(`marks ${typeKey} REJECT rule as dangerous`, async () => {
            const { result, ruleId } = await compileDangerousRule('IPTables', typeKey, {
              action: 'REJECT',
            });
            expect(result).to.have.length(1);
            expect(result[0].cs).to.equal(expected.REJECT);
            expectDangerousMetadata(result[0], ruleId, ipType, chain, false);
          });
        });

        it('marks REJECT rule as dangerous even if it includes a comment', async () => {
          const comment = 'Regla peligrosa con comentario';
          const { result, ruleId } = await compileDangerousRule('IPTables', 'IPv4:INPUT', {
            comment,
            action: 'REJECT',
          });
          expect(result).to.have.length(1);
          expect(result[0].cs).to.include(`-m comment --comment '${comment}'`);
          expect(result[0].cs).to.include('-j REJECT');
          expectDangerousMetadata(result[0], ruleId, 'IPv4', 'INPUT', true);
        });
      });

      describe('rules with interfaces', () => {
        (['ACCEPT', 'DROP', 'REJECT'] as RuleActionKey[]).forEach((action) => {
          it(`marks IPv4:FORWARD ${action} rule with interfaces as a warning`, async () => {
            const { result, ruleId } = await compileDangerousRule('IPTables', 'IPv4:FORWARD', {
              action,
              interfaceBinding: 'both',
            });
            expect(result).to.have.length(1);
            expect(result[0].cs).to.include(`-i ${inboundInterfaceName}`);
            expect(result[0].cs).to.include(`-o ${outboundInterfaceName}`);
            expectDangerousMetadata(result[0], ruleId, 'IPv4', 'FORWARD', false, false);
          });
        });
      });
    });

    describe('stateless', () => {
      describe('ACCEPT', () => {
        iptablesScenarios.forEach(({ typeKey, ipType, chain, expected }) => {
          it(`marks ${typeKey} stateless ACCEPT rule as dangerous`, async () => {
            const { result, ruleId } = await compileDangerousRule('IPTables', typeKey, {
              optionsMask: PolicyRuleOptMask.STATELESS,
            });
            expect(result).to.have.length(1);
            expect(result[0].cs).to.equal(expected.ACCEPT.stateless);
            expectDangerousMetadata(result[0], ruleId, ipType, chain, false);
          });
        });

        it('marks stateless ACCEPT rule as dangerous even if it includes a comment', async () => {
          const comment = 'Regla peligrosa con comentario';
          const { result, ruleId } = await compileDangerousRule('IPTables', 'IPv4:INPUT', {
            comment,
            optionsMask: PolicyRuleOptMask.STATELESS,
          });
          expect(result).to.have.length(1);
          expect(result[0].cs).to.include(`-m comment --comment '${comment}'`);
          expect(result[0].cs).to.include('-j ACCEPT');
          expect(result[0].cs).to.not.include('--ctstate NEW');
          expectDangerousMetadata(result[0], ruleId, 'IPv4', 'INPUT', true);
        });
      });

      describe('DROP', () => {
        iptablesScenarios.forEach(({ typeKey, ipType, chain, expected }) => {
          it(`marks ${typeKey} stateless DROP rule as dangerous`, async () => {
            const { result, ruleId } = await compileDangerousRule('IPTables', typeKey, {
              action: 'DROP',
              optionsMask: PolicyRuleOptMask.STATELESS,
            });
            expect(result).to.have.length(1);
            expect(result[0].cs).to.equal(expected.DROP);
            expectDangerousMetadata(result[0], ruleId, ipType, chain, false);
          });
        });

        it('marks stateless DROP rule as dangerous even if it includes a comment', async () => {
          const comment = 'Regla peligrosa con comentario';
          const { result, ruleId } = await compileDangerousRule('IPTables', 'IPv4:INPUT', {
            comment,
            action: 'DROP',
            optionsMask: PolicyRuleOptMask.STATELESS,
          });
          expect(result).to.have.length(1);
          expect(result[0].cs).to.include(`-m comment --comment '${comment}'`);
          expect(result[0].cs).to.include('-j DROP');
          expect(result[0].cs).to.not.include('--ctstate NEW');
          expectDangerousMetadata(result[0], ruleId, 'IPv4', 'INPUT', true);
        });
      });

      describe('REJECT', () => {
        iptablesScenarios.forEach(({ typeKey, ipType, chain, expected }) => {
          it(`marks ${typeKey} stateless REJECT rule as dangerous`, async () => {
            const { result, ruleId } = await compileDangerousRule('IPTables', typeKey, {
              action: 'REJECT',
              optionsMask: PolicyRuleOptMask.STATELESS,
            });
            expect(result).to.have.length(1);
            expect(result[0].cs).to.equal(expected.REJECT);
            expectDangerousMetadata(result[0], ruleId, ipType, chain, false);
          });
        });

        it('marks stateless REJECT rule as dangerous even if it includes a comment', async () => {
          const comment = 'Regla peligrosa con comentario';
          const { result, ruleId } = await compileDangerousRule('IPTables', 'IPv4:INPUT', {
            comment,
            action: 'REJECT',
            optionsMask: PolicyRuleOptMask.STATELESS,
          });
          expect(result).to.have.length(1);
          expect(result[0].cs).to.include(`-m comment --comment '${comment}'`);
          expect(result[0].cs).to.include('-j REJECT');
          expect(result[0].cs).to.not.include('--ctstate NEW');
          expectDangerousMetadata(result[0], ruleId, 'IPv4', 'INPUT', true);
        });
      });

      describe('rules with interfaces', () => {
        (['ACCEPT', 'DROP', 'REJECT'] as RuleActionKey[]).forEach((action) => {
          it(`marks IPv4:FORWARD stateless ${action} rule with interfaces as a warning`, async () => {
            const { result, ruleId } = await compileDangerousRule('IPTables', 'IPv4:FORWARD', {
              action,
              optionsMask: PolicyRuleOptMask.STATELESS,
              interfaceBinding: 'both',
            });
            expect(result).to.have.length(1);
            expect(result[0].cs).to.include(`-i ${inboundInterfaceName}`);
            expect(result[0].cs).to.include(`-o ${outboundInterfaceName}`);
            expectDangerousMetadata(result[0], ruleId, 'IPv4', 'FORWARD', false, false);
          });
        });
      });
    });
  });

  describe('NFTables dangerous rule detection', () => {
    describe('stateful', () => {
      describe('ACCEPT', () => {
        nftablesScenarios.forEach(({ typeKey, ipType, chain, expected }) => {
          it(`marks ${typeKey} ACCEPT rule as dangerous`, async () => {
            const { result, ruleId } = await compileDangerousRule('NFTables', typeKey);
            expect(result).to.have.length(1);
            expect(result[0].cs).to.equal(expected.ACCEPT.stateful);
            expectDangerousMetadata(result[0], ruleId, ipType, chain, false);
          });
        });

        it('marks ACCEPT rule as dangerous even if it includes a comment', async () => {
          const comment = 'Regla peligrosa con comentario';
          const { result, ruleId } = await compileDangerousRule('NFTables', 'IPv4:INPUT', {
            comment,
          });
          expect(result).to.have.length(1);
          expect(result[0].cs).to.include(
            'counter accept comment \\"Regla peligrosa con comentario\\"',
          );
          expectDangerousMetadata(result[0], ruleId, 'IPv4', 'INPUT', true);
        });
      });

      describe('DROP', () => {
        nftablesScenarios.forEach(({ typeKey, ipType, chain, expected }) => {
          it(`marks ${typeKey} DROP rule as dangerous`, async () => {
            const { result, ruleId } = await compileDangerousRule('NFTables', typeKey, {
              action: 'DROP',
            });
            expect(result).to.have.length(1);
            expect(result[0].cs).to.equal(expected.DROP);
            expectDangerousMetadata(result[0], ruleId, ipType, chain, false);
          });
        });

        it('marks DROP rule as dangerous even if it includes a comment', async () => {
          const comment = 'Regla peligrosa con comentario';
          const { result, ruleId } = await compileDangerousRule('NFTables', 'IPv4:INPUT', {
            comment,
            action: 'DROP',
          });
          expect(result).to.have.length(1);
          expect(result[0].cs).to.include(
            'counter drop comment \\"Regla peligrosa con comentario\\"',
          );
          expectDangerousMetadata(result[0], ruleId, 'IPv4', 'INPUT', true);
        });
      });

      describe('REJECT', () => {
        nftablesScenarios.forEach(({ typeKey, ipType, chain, expected }) => {
          it(`marks ${typeKey} REJECT rule as dangerous`, async () => {
            const { result, ruleId } = await compileDangerousRule('NFTables', typeKey, {
              action: 'REJECT',
            });
            expect(result).to.have.length(1);
            expect(result[0].cs).to.equal(expected.REJECT);
            expectDangerousMetadata(result[0], ruleId, ipType, chain, false);
          });
        });

        it('marks REJECT rule as dangerous even if it includes a comment', async () => {
          const comment = 'Regla peligrosa con comentario';
          const { result, ruleId } = await compileDangerousRule('NFTables', 'IPv4:INPUT', {
            comment,
            action: 'REJECT',
          });
          expect(result).to.have.length(1);
          expect(result[0].cs).to.include(
            'counter reject comment \\"Regla peligrosa con comentario\\"',
          );
          expectDangerousMetadata(result[0], ruleId, 'IPv4', 'INPUT', true);
        });
      });

      describe('rules with interfaces', () => {
        (['ACCEPT', 'DROP', 'REJECT'] as RuleActionKey[]).forEach((action) => {
          it(`marks IPv4:FORWARD ${action} rule with interfaces as a warning`, async () => {
            const { result, ruleId } = await compileDangerousRule('NFTables', 'IPv4:FORWARD', {
              action,
              interfaceBinding: 'both',
            });
            expect(result).to.have.length(1);
            expect(result[0].cs).to.include(`iifname "${inboundInterfaceName}"`);
            expect(result[0].cs).to.include(`oifname "${outboundInterfaceName}"`);
            expectDangerousMetadata(result[0], ruleId, 'IPv4', 'FORWARD', false, false);
          });
        });
      });
    });

    describe('stateless', () => {
      describe('ACCEPT', () => {
        nftablesScenarios.forEach(({ typeKey, ipType, chain, expected }) => {
          it(`marks ${typeKey} stateless ACCEPT rule as dangerous`, async () => {
            const { result, ruleId } = await compileDangerousRule('NFTables', typeKey, {
              optionsMask: PolicyRuleOptMask.STATELESS,
            });
            expect(result).to.have.length(1);
            expect(result[0].cs).to.equal(expected.ACCEPT.stateless);
            expectDangerousMetadata(result[0], ruleId, ipType, chain, false);
          });
        });

        it('marks stateless ACCEPT rule as dangerous even if it includes a comment', async () => {
          const comment = 'Regla peligrosa con comentario';
          const { result, ruleId } = await compileDangerousRule('NFTables', 'IPv4:INPUT', {
            comment,
            optionsMask: PolicyRuleOptMask.STATELESS,
          });
          expect(result).to.have.length(1);
          expect(result[0].cs).to.include(
            'counter accept comment \\"Regla peligrosa con comentario\\"',
          );
          expect(result[0].cs).to.not.include('ct state new');
          expectDangerousMetadata(result[0], ruleId, 'IPv4', 'INPUT', true);
        });
      });

      describe('DROP', () => {
        nftablesScenarios.forEach(({ typeKey, ipType, chain, expected }) => {
          it(`marks ${typeKey} stateless DROP rule as dangerous`, async () => {
            const { result, ruleId } = await compileDangerousRule('NFTables', typeKey, {
              action: 'DROP',
              optionsMask: PolicyRuleOptMask.STATELESS,
            });
            expect(result).to.have.length(1);
            expect(result[0].cs).to.equal(expected.DROP);
            expectDangerousMetadata(result[0], ruleId, ipType, chain, false);
          });
        });

        it('marks stateless DROP rule as dangerous even if it includes a comment', async () => {
          const comment = 'Regla peligrosa con comentario';
          const { result, ruleId } = await compileDangerousRule('NFTables', 'IPv4:INPUT', {
            comment,
            action: 'DROP',
            optionsMask: PolicyRuleOptMask.STATELESS,
          });
          expect(result).to.have.length(1);
          expect(result[0].cs).to.include(
            'counter drop comment \\"Regla peligrosa con comentario\\"',
          );
          expect(result[0].cs).to.not.include('ct state new');
          expectDangerousMetadata(result[0], ruleId, 'IPv4', 'INPUT', true);
        });
      });

      describe('REJECT', () => {
        nftablesScenarios.forEach(({ typeKey, ipType, chain, expected }) => {
          it(`marks ${typeKey} stateless REJECT rule as dangerous`, async () => {
            const { result, ruleId } = await compileDangerousRule('NFTables', typeKey, {
              action: 'REJECT',
              optionsMask: PolicyRuleOptMask.STATELESS,
            });
            expect(result).to.have.length(1);
            expect(result[0].cs).to.equal(expected.REJECT);
            expectDangerousMetadata(result[0], ruleId, ipType, chain, false);
          });
        });

        it('marks stateless REJECT rule as dangerous even if it includes a comment', async () => {
          const comment = 'Regla peligrosa con comentario';
          const { result, ruleId } = await compileDangerousRule('NFTables', 'IPv4:INPUT', {
            comment,
            action: 'REJECT',
            optionsMask: PolicyRuleOptMask.STATELESS,
          });
          expect(result).to.have.length(1);
          expect(result[0].cs).to.include(
            'counter reject comment \\"Regla peligrosa con comentario\\"',
          );
          expect(result[0].cs).to.not.include('ct state new');
          expectDangerousMetadata(result[0], ruleId, 'IPv4', 'INPUT', true);
        });
      });

      describe('rules with interfaces', () => {
        (['ACCEPT', 'DROP', 'REJECT'] as RuleActionKey[]).forEach((action) => {
          it(`marks IPv4:FORWARD stateless ${action} rule with interfaces as a warning`, async () => {
            const { result, ruleId } = await compileDangerousRule('NFTables', 'IPv4:FORWARD', {
              action,
              optionsMask: PolicyRuleOptMask.STATELESS,
              interfaceBinding: 'both',
            });
            expect(result).to.have.length(1);
            expect(result[0].cs).to.include(`iifname "${inboundInterfaceName}"`);
            expect(result[0].cs).to.include(`oifname "${outboundInterfaceName}"`);
            expectDangerousMetadata(result[0], ruleId, 'IPv4', 'FORWARD', false, false);
          });
        });
      });
    });
  });

  describe('VyOS dangerous rule detection', () => {
    describe('stateful', () => {
      describe('ACCEPT', () => {
        vyosScenarios.forEach(({ typeKey, ipType, chain }) => {
          it(`marks ${typeKey} ACCEPT rule as dangerous`, async () => {
            const { result, ruleId } = await compileDangerousRule('VyOS', typeKey);
            expect(result).to.have.length(1);

            const trimmedLines = result[0].cs.trim().split('\n');
            expect(trimmedLines).to.have.length(2);
            const firewallKeyword = typeKey.startsWith('IPv6') ? 'ipv6-name' : 'name';

            expect(trimmedLines[0]).to.equal(
              `set firewall ${firewallKeyword} ${chain} rule ${ruleId} state new enable`,
            );
            expect(trimmedLines[1]).to.equal(
              `set firewall ${firewallKeyword} ${chain} rule ${ruleId} action accept`,
            );

            expectDangerousMetadata(result[0], ruleId, ipType, chain, false);
          });
        });

        it('marks ACCEPT rule as dangerous even if it includes a comment', async () => {
          const comment = 'Regla peligrosa con comentario';
          const { result, ruleId } = await compileDangerousRule('VyOS', 'IPv4:INPUT', {
            comment,
          });
          expect(result).to.have.length(1);

          const trimmedLines = result[0].cs.trim().split('\n');
          expect(trimmedLines).to.include(
            `set firewall name INPUT rule ${ruleId} description "${comment}"`,
          );
          expect(trimmedLines).to.include(
            `set firewall name INPUT rule ${ruleId} state new enable`,
          );
          expect(trimmedLines).to.include(`set firewall name INPUT rule ${ruleId} action accept`);

          expectDangerousMetadata(result[0], ruleId, 'IPv4', 'INPUT', true);
        });
      });

      describe('DROP', () => {
        vyosScenarios.forEach(({ typeKey, ipType, chain }) => {
          it(`marks ${typeKey} DROP rule as dangerous`, async () => {
            const { result, ruleId } = await compileDangerousRule('VyOS', typeKey, {
              action: 'DROP',
            });
            expect(result).to.have.length(1);

            const trimmedLines = result[0].cs.trim().split('\n');
            expect(trimmedLines).to.have.length(1);
            const firewallKeyword = typeKey.startsWith('IPv6') ? 'ipv6-name' : 'name';

            expect(trimmedLines[0]).to.equal(
              `set firewall ${firewallKeyword} ${chain} rule ${ruleId} action drop`,
            );

            expectDangerousMetadata(result[0], ruleId, ipType, chain, false);
          });
        });

        it('marks DROP rule as dangerous even if it includes a comment', async () => {
          const comment = 'Regla peligrosa con comentario';
          const { result, ruleId } = await compileDangerousRule('VyOS', 'IPv4:INPUT', {
            comment,
            action: 'DROP',
          });
          expect(result).to.have.length(1);

          const trimmedLines = result[0].cs.trim().split('\n');
          expect(trimmedLines).to.include(
            `set firewall name INPUT rule ${ruleId} description "${comment}"`,
          );
          expect(trimmedLines).to.include(`set firewall name INPUT rule ${ruleId} action drop`);
          expectDangerousMetadata(result[0], ruleId, 'IPv4', 'INPUT', true);
        });
      });

      describe('REJECT', () => {
        vyosScenarios.forEach(({ typeKey, ipType, chain }) => {
          it(`marks ${typeKey} REJECT rule as dangerous`, async () => {
            const { result, ruleId } = await compileDangerousRule('VyOS', typeKey, {
              action: 'REJECT',
            });
            expect(result).to.have.length(1);

            const trimmedLines = result[0].cs.trim().split('\n');
            expect(trimmedLines).to.have.length(1);
            const firewallKeyword = typeKey.startsWith('IPv6') ? 'ipv6-name' : 'name';

            expect(trimmedLines[0]).to.equal(
              `set firewall ${firewallKeyword} ${chain} rule ${ruleId} action reject`,
            );

            expectDangerousMetadata(result[0], ruleId, ipType, chain, false);
          });
        });

        it('marks REJECT rule as dangerous even if it includes a comment', async () => {
          const comment = 'Regla peligrosa con comentario';
          const { result, ruleId } = await compileDangerousRule('VyOS', 'IPv4:INPUT', {
            comment,
            action: 'REJECT',
          });
          expect(result).to.have.length(1);

          const trimmedLines = result[0].cs.trim().split('\n');
          expect(trimmedLines).to.include(
            `set firewall name INPUT rule ${ruleId} description "${comment}"`,
          );
          expect(trimmedLines).to.include(`set firewall name INPUT rule ${ruleId} action reject`);
          expectDangerousMetadata(result[0], ruleId, 'IPv4', 'INPUT', true);
        });
      });

      describe('rules with interfaces', () => {
        (['ACCEPT', 'DROP', 'REJECT'] as RuleActionKey[]).forEach((action) => {
          it(`marks IPv4:FORWARD ${action} rule with interfaces as a warning`, async () => {
            const { result, ruleId } = await compileDangerousRule('VyOS', 'IPv4:FORWARD', {
              action,
              interfaceBinding: 'both',
            });
            expect(result).to.have.length(1);
            expect(result[0].cs).to.include(
              `set firewall name FORWARD rule ${ruleId} inbound-interface ${inboundInterfaceName}`,
            );
            expect(result[0].cs).to.include(
              `set firewall name FORWARD rule ${ruleId} outbound-interface ${outboundInterfaceName}`,
            );
            expectDangerousMetadata(result[0], ruleId, 'IPv4', 'FORWARD', false, false);
          });
        });
      });
    });

    describe('stateless', () => {
      describe('ACCEPT', () => {
        vyosScenarios.forEach(({ typeKey, ipType, chain }) => {
          it(`marks ${typeKey} stateless ACCEPT rule as dangerous`, async () => {
            const { result, ruleId } = await compileDangerousRule('VyOS', typeKey, {
              optionsMask: PolicyRuleOptMask.STATELESS,
            });
            expect(result).to.have.length(1);

            const trimmedLines = result[0].cs.trim().split('\n');
            expect(trimmedLines).to.have.length(1);
            const firewallKeyword = typeKey.startsWith('IPv6') ? 'ipv6-name' : 'name';

            expect(trimmedLines[0]).to.equal(
              `set firewall ${firewallKeyword} ${chain} rule ${ruleId} action accept`,
            );

            expectDangerousMetadata(result[0], ruleId, ipType, chain, false);
          });
        });

        it('marks stateless ACCEPT rule as dangerous even if it includes a comment', async () => {
          const comment = 'Regla peligrosa con comentario';
          const { result, ruleId } = await compileDangerousRule('VyOS', 'IPv4:INPUT', {
            comment,
            optionsMask: PolicyRuleOptMask.STATELESS,
          });
          expect(result).to.have.length(1);

          const trimmedLines = result[0].cs.trim().split('\n');
          expect(trimmedLines).to.include(
            `set firewall name INPUT rule ${ruleId} description "${comment}"`,
          );
          expect(trimmedLines).to.include(`set firewall name INPUT rule ${ruleId} action accept`);
          expect(trimmedLines).to.not.include(
            `set firewall name INPUT rule ${ruleId} state new enable`,
          );

          expectDangerousMetadata(result[0], ruleId, 'IPv4', 'INPUT', true);
        });
      });

      describe('DROP', () => {
        vyosScenarios.forEach(({ typeKey, ipType, chain }) => {
          it(`marks ${typeKey} stateless DROP rule as dangerous`, async () => {
            const { result, ruleId } = await compileDangerousRule('VyOS', typeKey, {
              action: 'DROP',
              optionsMask: PolicyRuleOptMask.STATELESS,
            });
            expect(result).to.have.length(1);

            const trimmedLines = result[0].cs.trim().split('\n');
            expect(trimmedLines).to.have.length(1);
            const firewallKeyword = typeKey.startsWith('IPv6') ? 'ipv6-name' : 'name';

            expect(trimmedLines[0]).to.equal(
              `set firewall ${firewallKeyword} ${chain} rule ${ruleId} action drop`,
            );

            expectDangerousMetadata(result[0], ruleId, ipType, chain, false);
          });
        });

        it('marks stateless DROP rule as dangerous even if it includes a comment', async () => {
          const comment = 'Regla peligrosa con comentario';
          const { result, ruleId } = await compileDangerousRule('VyOS', 'IPv4:INPUT', {
            comment,
            action: 'DROP',
            optionsMask: PolicyRuleOptMask.STATELESS,
          });
          expect(result).to.have.length(1);

          const trimmedLines = result[0].cs.trim().split('\n');
          expect(trimmedLines).to.include(
            `set firewall name INPUT rule ${ruleId} description "${comment}"`,
          );
          expect(trimmedLines).to.include(`set firewall name INPUT rule ${ruleId} action drop`);
          expect(trimmedLines).to.not.include(
            `set firewall name INPUT rule ${ruleId} state new enable`,
          );
          expectDangerousMetadata(result[0], ruleId, 'IPv4', 'INPUT', true);
        });
      });

      describe('REJECT', () => {
        vyosScenarios.forEach(({ typeKey, ipType, chain }) => {
          it(`marks ${typeKey} stateless REJECT rule as dangerous`, async () => {
            const { result, ruleId } = await compileDangerousRule('VyOS', typeKey, {
              action: 'REJECT',
              optionsMask: PolicyRuleOptMask.STATELESS,
            });
            expect(result).to.have.length(1);

            const trimmedLines = result[0].cs.trim().split('\n');
            expect(trimmedLines).to.have.length(1);
            const firewallKeyword = typeKey.startsWith('IPv6') ? 'ipv6-name' : 'name';

            expect(trimmedLines[0]).to.equal(
              `set firewall ${firewallKeyword} ${chain} rule ${ruleId} action reject`,
            );

            expectDangerousMetadata(result[0], ruleId, ipType, chain, false);
          });
        });

        it('marks stateless REJECT rule as dangerous even if it includes a comment', async () => {
          const comment = 'Regla peligrosa con comentario';
          const { result, ruleId } = await compileDangerousRule('VyOS', 'IPv4:INPUT', {
            comment,
            action: 'REJECT',
            optionsMask: PolicyRuleOptMask.STATELESS,
          });
          expect(result).to.have.length(1);

          const trimmedLines = result[0].cs.trim().split('\n');
          expect(trimmedLines).to.include(
            `set firewall name INPUT rule ${ruleId} description "${comment}"`,
          );
          expect(trimmedLines).to.include(`set firewall name INPUT rule ${ruleId} action reject`);
          expect(trimmedLines).to.not.include(
            `set firewall name INPUT rule ${ruleId} state new enable`,
          );
          expectDangerousMetadata(result[0], ruleId, 'IPv4', 'INPUT', true);
        });
      });

      describe('rules with interfaces', () => {
        (['ACCEPT', 'DROP', 'REJECT'] as RuleActionKey[]).forEach((action) => {
          it(`marks IPv4:FORWARD stateless ${action} rule with interfaces as a warning`, async () => {
            const { result, ruleId } = await compileDangerousRule('VyOS', 'IPv4:FORWARD', {
              action,
              optionsMask: PolicyRuleOptMask.STATELESS,
              interfaceBinding: 'both',
            });
            expect(result).to.have.length(1);
            expect(result[0].cs).to.include(
              `set firewall name FORWARD rule ${ruleId} inbound-interface ${inboundInterfaceName}`,
            );
            expect(result[0].cs).to.include(
              `set firewall name FORWARD rule ${ruleId} outbound-interface ${outboundInterfaceName}`,
            );
            expectDangerousMetadata(result[0], ruleId, 'IPv4', 'FORWARD', false, false);
          });
        });
      });
    });
  });
});
