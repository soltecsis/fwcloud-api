import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { AI } from './ai-assistant.model';
import { AICredentials } from './ai-assistant-credentials.model';

@Entity('ai_models')
export class AIModel {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', nullable: false })
  name: string;

  @Column({ name: 'ai_id', type: 'int', nullable: false })
  aiId: number;

  @ManyToOne(() => AI, (ai) => ai.models, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ai_id' })
  ai: AI;

  @OneToMany(() => AICredentials, (credentials) => credentials.model)
  credentials: AICredentials[];
}
