import { BeforeInsert, BeforeUpdate, Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import Model from '../Model';
import {
  ASSISTED_PROFILE_ANONYMIZATION_VERSION,
  assertAnonymizedProposalIsSafe,
} from './assisted-profile-proposal-anonymizer';
import type { AssistedProfileRejectionCategory } from './assisted-profile-rejected-proposal.types';

export const ASSISTED_PROFILE_REJECTED_PROPOSAL_TABLE = 'assisted_profile_rejected_proposal';

/**
 * An anonymized sample of a proposal the Assisted Profile validation flow
 * rejected, captured only while the opt-in capture flag is enabled.
 *
 * This is **not** a draft: it has no state machine, no FWCloud/user ownership
 * and no relation to `firewall_profile_draft`. It exists solely so a pilot can
 * later evaluate rejection patterns, and it disappears on its own at
 * `expiresAt`. There is deliberately no column for the original proposal — the
 * only representation that ever reaches this entity is the anonymized one.
 */
@Entity(ASSISTED_PROFILE_REJECTED_PROPOSAL_TABLE)
@Index('IDX_assisted_profile_rejected_proposal_expires_at', ['expiresAt'])
export class AssistedProfileRejectedProposal extends Model {
  @PrimaryGeneratedColumn()
  id: number;

  /** One of `ASSISTED_PROFILE_REJECTION_CATEGORIES`. */
  @Column({ name: 'rejection_category', type: 'varchar', length: 64 })
  rejectionCategory: AssistedProfileRejectionCategory;

  /** Taxonomy code behind the category, e.g. `schema_violation`. */
  @Column({ name: 'rejection_code', type: 'varchar', length: 128, nullable: true })
  rejectionCode: string | null;

  @Column({ name: 'contract_version', type: 'varchar', length: 64, nullable: true })
  contractVersion: string | null;

  /** Output of `AssistedProfileProposalAnonymizer`, never a raw proposal. */
  @Column({ name: 'anonymized_proposal', type: 'simple-json' })
  anonymizedProposal: unknown;

  @Column({ name: 'anonymization_version', type: 'varchar', length: 64 })
  anonymizationVersion: string;

  /** SHA-256 of the canonicalized *anonymized* payload; never of the original. */
  @Column({ name: 'proposal_fingerprint', type: 'char', length: 64, nullable: true })
  proposalFingerprint: string | null;

  /** fwcloud-api's own generated request id (a UUID), never a client value. */
  @Column({ name: 'request_id', type: 'varchar', length: 255, nullable: true })
  requestId: string | null;

  @Column({ name: 'captured_at', type: 'timestamp' })
  capturedAt: Date;

  @Column({ name: 'expires_at', type: 'timestamp' })
  expiresAt: Date;

  /**
   * Last line of defence, mirroring `FirewallProfileDraft.rejectSecrets()`: the
   * entity refuses to persist a payload that does not satisfy the anonymization
   * invariant, whatever the caller believes it produced.
   */
  @BeforeInsert()
  @BeforeUpdate()
  rejectNonAnonymizedPayload(): void {
    if (this.anonymizationVersion !== ASSISTED_PROFILE_ANONYMIZATION_VERSION) {
      throw new Error(
        `Rejected Assisted Profile proposals must carry anonymization version ` +
          `'${ASSISTED_PROFILE_ANONYMIZATION_VERSION}'`,
      );
    }
    assertAnonymizedProposalIsSafe(this.anonymizedProposal);
  }

  public getTableName(): string {
    return ASSISTED_PROFILE_REJECTED_PROPOSAL_TABLE;
  }
}
