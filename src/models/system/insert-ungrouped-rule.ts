import { Repository } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { Offset } from '../../offset';

interface SystemRulePosition {
  id: number;
  groupId: number | null;
  rule_order: number;
}

export async function insertUngroupedSystemRule<T extends SystemRulePosition>(
  repository: Repository<T>,
  firewallId: number,
  referenceId: number,
  offset: Offset,
  saveRule: (rules: Repository<T>, order: number) => Promise<T>,
): Promise<T> {
  if (!referenceId || (offset !== Offset.Above && offset !== Offset.Below)) {
    throw new Error('An ungrouped insertion requires a reference rule and a direction.');
  }

  return repository.manager.transaction(async (manager) => {
    await manager.query('SELECT id FROM firewall WHERE id = ? FOR UPDATE', [firewallId]);

    const rules = manager.getRepository(repository.target);
    const ordered = await rules
      .createQueryBuilder('rule')
      .select(['rule.id', 'rule.groupId', 'rule.rule_order'])
      .where('rule.firewallId = :firewallId', { firewallId })
      .orderBy('rule.rule_order', 'ASC')
      .addOrderBy('rule.id', 'ASC')
      .setLock('pessimistic_write')
      .getMany();
    const referenceIndex = ordered.findIndex((rule) => rule.id === referenceId);
    const reference = ordered[referenceIndex];
    const below = offset === Offset.Below;
    const neighbor = ordered[referenceIndex + (below ? 1 : -1)];
    if (!reference?.groupId || neighbor?.groupId === reference.groupId) {
      throw new Error('The reference rule is no longer at the group boundary.');
    }

    const insertionIndex = referenceIndex + (below ? 1 : 0);
    const order = (ordered[insertionIndex - 1]?.rule_order ?? 0) + 1;
    let previousOrder = order;
    for (const rule of ordered.slice(insertionIndex)) {
      if (rule.rule_order > previousOrder) break;

      previousOrder++;
      await rules.update(rule.id, {
        rule_order: previousOrder,
      } as unknown as QueryDeepPartialEntity<T>);
    }
    return saveRule(rules, order);
  });
}
