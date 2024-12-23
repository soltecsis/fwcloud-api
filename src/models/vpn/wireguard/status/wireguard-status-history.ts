import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import Model from '../../../Model';
import { WireGuard } from '../WireGuard';

const tableName: string = 'openvpn_status_history';

@Entity(tableName)
export class WireGuardStatusHistory extends Model {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column()
  address: string;

  @Column({
    name: 'bytes_received',
  })
  bytesReceived: string;

  @Column({
    name: 'bytes_sent',
  })
  bytesSent: string;

  @Column({
    name: 'connected_at_timestamp',
  })
  connectedAtTimestampInSeconds: number;

  @Column({
    name: 'disconnected_at_timestamp',
  })
  disconnectedAtTimestampInSeconds: number;

  @Column({
    name: 'timestamp',
  })
  timestampInSeconds: number;

  @Column({ name: 'openvpn_server_id' })
  openVPNServerId: number;

  @ManyToOne(() => WireGuard, (model) => model.historyRecords)
  @JoinColumn({
    name: 'openvpn_server_id',
  })
  openVPNServer: WireGuard;
  wireGuardServer: any;

  public getTableName(): string {
    return tableName;
  }
}
