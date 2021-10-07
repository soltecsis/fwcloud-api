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
        name: 'bytes_received'
    })
    bytesReceived: number;

    @Column({
        name: 'bytes_sent'
    })
    bytesSent: number;

    @Column({
        name: 'connected_at'
    })
    connectedAt: Date;

    @Column()
    timestamp: number;

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