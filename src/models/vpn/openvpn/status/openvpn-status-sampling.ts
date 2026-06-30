import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Firewall } from '../../../firewall/Firewall';
import Model from '../../../Model';
import { OpenVPN } from '../OpenVPN';

const tableName: string = 'openvpn_status_sampling';

export type OpenVPNStatusSamplingResult = 'accepted' | 'rejected' | 'success' | 'failed';

@Entity(tableName)
export class OpenVPNStatusSampling extends Model {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'tinyint', default: 0 })
  enabled: boolean;

  @Column({ name: 'openvpn' })
  openVPNId: number;

  @ManyToOne(() => OpenVPN, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'openvpn' })
  openVPN: OpenVPN;

  @Column({ name: 'collector_firewall', nullable: true })
  collectorFirewallId: number;

  @ManyToOne(() => Firewall, { nullable: true })
  @JoinColumn({ name: 'collector_firewall' })
  collectorFirewall: Firewall;

  @OneToMany(() => OpenVPNStatusSamplingFile, (file) => file.sampling, { cascade: true })
  files: OpenVPNStatusSamplingFile[];

  @Column({ name: 'last_sync_result', type: 'varchar', length: 20, nullable: true })
  lastSyncResult: OpenVPNStatusSamplingResult;

  @Column({ name: 'last_sync_error', type: 'text', nullable: true })
  lastSyncError: string;

  @Column({ name: 'last_synced_at', nullable: true })
  lastSyncedAt: Date;

  @Column({ name: 'last_poll_result', type: 'varchar', length: 20, nullable: true })
  lastPollResult: OpenVPNStatusSamplingResult;

  @Column({ name: 'last_poll_error', type: 'text', nullable: true })
  lastPollError: string;

  @Column({ name: 'last_polled_at', nullable: true })
  lastPolledAt: Date;

  @Column()
  created_at: Date;

  @Column()
  updated_at: Date;

  public getTableName(): string {
    return tableName;
  }
}

@Entity('openvpn_status_sampling_file')
export class OpenVPNStatusSamplingFile extends Model {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'sampling' })
  samplingId: number;

  @ManyToOne(() => OpenVPNStatusSampling, (sampling) => sampling.files, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sampling' })
  sampling: OpenVPNStatusSampling;

  @Column({ type: 'varchar', length: 4096 })
  path: string;

  @Column({ name: 'path_hash', type: 'char', length: 64 })
  pathHash: string;

  @Column()
  created_at: Date;

  @Column()
  updated_at: Date;

  public getTableName(): string {
    return 'openvpn_status_sampling_file';
  }
}
