import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { AIModel } from './ai-assistant-models.model';

@Entity('ai')
export class AI {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', nullable: false })
  name: string;

  @OneToMany(() => AIModel, (model) => model.ai)
  models: AIModel[];
}
