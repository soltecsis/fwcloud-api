import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { AIModel } from './ai-assistant-models.model';

@Entity('ai_credentials')
export class AICredentials {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'api_key', type: 'varchar', nullable: false })
  apiKey: string;

  @Column({ name: 'model_id', type: 'int', nullable: false })
  aiModelId: number;

  @ManyToOne(() => AIModel, (model) => model.credentials, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'model_id' })
  model: AIModel;
}
