import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import Model from "../../../Model";
import { OpenVPN } from "../OpenVPN";

const tableName: string = 'openvpn_status_history';

@Entity(tableName)
export class OpenVPNStatusHistory extends Model {

    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    name: string;

    @Column()
    address: string;

    @Column({
        name: 'mb_received',
    })
    megaBytesReceived: number;

    @Column({
        name: 'mb_sent',
    })
    megaBytesSent: number;

    @Column({
        name: 'connected_at_timestamp',
    })
    connectedAtTimestampInSeconds: number;

    @Column({
        name: 'disconnected_at_timestamp',
    })
    disconnectedAtTimestampInSeconds: number;

    @Column({
        name: 'timestamp'
    })
    timestampInSeconds: number;

    @Column({name: 'openvpn_server_id'})
    openVPNServerId: number;

    @ManyToOne(() => OpenVPN, model => model.historyRecords)
    @JoinColumn({
        name: 'openvpn_server_id'
    })
    openVPNServer: OpenVPN;

    public getTableName(): string {
        return tableName;
    }
    
}