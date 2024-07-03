import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { Mark } from '../../ipobj/Mark';
import Model from '../../Model';
import { RoutingRule } from './routing-rule.model';

const tableName: string = 'routing_r__mark';

@Entity(tableName)
export class RoutingRuleToMark extends Model {
  @PrimaryColumn({
    name: 'rule',
  })
  routingRuleId: number;

  @PrimaryColumn({
    name: 'mark',
  })
  markId: number;

  @Column({
    type: Number,
  })
  order: number;

  @ManyToOne(() => RoutingRule, (model) => model.routingRuleToMarks, {
    orphanedRowAction: 'delete',
  })
  @JoinColumn({
    name: 'rule',
  })
  routingRule: RoutingRule;

  @ManyToOne(() => Mark, (model) => model.routingRuleToMarks, {
    orphanedRowAction: 'delete',
  })
  @JoinColumn({
    name: 'mark',
  })
  mark: Mark;

  public getTableName(): string {
    return tableName;
  }
}
