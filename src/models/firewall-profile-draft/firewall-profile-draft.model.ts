import {
  BeforeInsert,
  BeforeUpdate,
  AfterLoad,
  Column,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import Model from '../Model';
import { assertProfileDefinitionHasNoSecrets } from '../replication-profile/replication-profile-secret.guard';
import { hashFirewallProfileDraftValue } from './firewall-profile-draft.hash';
import type {
  FirewallProfileDraftStatus,
  FirewallProfileDraftStepLogEntry,
  FirewallProfileDraftTargetIds,
} from './firewall-profile-draft.types';

export const FIREWALL_PROFILE_DRAFT_TABLE = 'firewall_profile_draft';

@Entity(FIREWALL_PROFILE_DRAFT_TABLE)
@Index('IDX_firewall_profile_draft_fwcloud_status', ['fwCloudId', 'status'])
export class FirewallProfileDraft extends Model {
  private loadedProposalHash?: string;

  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'fwcloud_id', type: 'int' })
  fwCloudId: number;

  @Column({ name: 'created_by', type: 'int', nullable: true })
  createdBy: number | null;

  @Column({ name: 'updated_by', type: 'int', nullable: true })
  updatedBy: number | null;

  @Column({ type: 'varchar', length: 32 })
  status: FirewallProfileDraftStatus;

  @Column({ name: 'contract_version', type: 'varchar', length: 64 })
  contractVersion: string;

  @Column({ type: 'simple-json' })
  proposal: unknown;

  @Column({ name: 'proposal_hash', type: 'char', length: 64 })
  proposalHash: string;

  @Column({ name: 'preview_hash', type: 'char', length: 64, nullable: true })
  previewHash: string | null;

  @Column({ name: 'apply_hash', type: 'char', length: 64, nullable: true })
  applyHash: string | null;

  @Column({ name: 'step_log', type: 'simple-json', nullable: true })
  stepLog: FirewallProfileDraftStepLogEntry[] | null;

  @Column({ name: 'target_ids', type: 'simple-json', nullable: true })
  targetIds: FirewallProfileDraftTargetIds | null;

  @Column({ name: 'idempotency_key_ref', type: 'varchar', length: 255, nullable: true })
  idempotencyKeyRef: string | null;

  @Column({ name: 'request_id', type: 'varchar', length: 255, nullable: true })
  requestId: string | null;

  @Column({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;

  @Column({ name: 'validated_at', type: 'timestamp', nullable: true })
  validatedAt: Date | null;

  @Column({ name: 'previewed_at', type: 'timestamp', nullable: true })
  previewedAt: Date | null;

  @Column({ name: 'apply_pending_at', type: 'timestamp', nullable: true })
  applyPendingAt: Date | null;

  @Column({ name: 'applied_at', type: 'timestamp', nullable: true })
  appliedAt: Date | null;

  @Column({ name: 'failed_at', type: 'timestamp', nullable: true })
  failedAt: Date | null;

  @Column({ name: 'discarded_at', type: 'timestamp', nullable: true })
  discardedAt: Date | null;

  @Column({ name: 'expired_at', type: 'timestamp', nullable: true })
  expiredAt: Date | null;

  @BeforeInsert()
  @BeforeUpdate()
  rejectSecrets(): void {
    assertProfileDefinitionHasNoSecrets(this.proposal);
    assertProfileDefinitionHasNoSecrets(this.stepLog);
  }

  @BeforeInsert()
  setProposalHash(): void {
    const hash = hashFirewallProfileDraftValue(this.proposal);
    if (this.proposalHash && this.proposalHash !== hash) {
      throw new Error('Firewall Profile draft proposal hash does not match its proposal');
    }
    this.proposalHash = hash;
  }

  @BeforeInsert()
  initializeLifecycle(): void {
    const now = new Date();
    this.status = this.status ?? 'validated';
    this.createdAt = this.createdAt ?? now;
    this.updatedAt = this.updatedAt ?? now;
    if (this.status === 'validated') {
      this.validatedAt = this.validatedAt ?? now;
    }
  }

  @AfterLoad()
  rememberProposalHash(): void {
    this.loadedProposalHash = this.proposalHash;
  }

  @BeforeUpdate()
  rejectProposalMutation(): void {
    const currentHash = hashFirewallProfileDraftValue(this.proposal);
    if (this.loadedProposalHash && currentHash !== this.loadedProposalHash) {
      throw new Error('A validated Firewall Profile draft proposal is immutable');
    }
    if (this.proposalHash !== currentHash) {
      throw new Error('Firewall Profile draft proposal hash does not match its proposal');
    }
  }

  public getTableName(): string {
    return FIREWALL_PROFILE_DRAFT_TABLE;
  }
}
