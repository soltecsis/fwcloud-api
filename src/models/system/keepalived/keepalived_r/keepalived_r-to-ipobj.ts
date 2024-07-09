import { Entity, PrimaryColumn, Column, ManyToMany, JoinColumn, ManyToOne } from 'typeorm';
import Model from '../../../Model';
import { KeepalivedRule } from './keepalived_r.model';
import { IPObj } from '../../../ipobj/IPObj';

const tableName: string = 'keepalived_r__ipobj';

@Entity(tableName)
export class KeepalivedToIPObj extends Model {
  @PrimaryColumn({
    name: 'rule',
  })
  keepalivedRuleId: number;

  @PrimaryColumn({
    name: 'ipobj',
  })
  ipObjId: number;

  @Column({ type: Number })
  order: number;

  @ManyToOne(() => KeepalivedRule, (keepalivedRule) => keepalivedRule.virtualIps, {
    orphanedRowAction: 'delete',
  })
  @JoinColumn({ name: 'rule' })
  keepalivedRule: KeepalivedRule;

  @ManyToOne(() => IPObj, (ipObj) => ipObj.keepalivedRuleToIPObjs, {
    orphanedRowAction: 'delete',
  })
  @JoinColumn({ name: 'ipobj' })
  ipObj: IPObj;

  public getTableName(): string {
    return tableName;
  }
}
