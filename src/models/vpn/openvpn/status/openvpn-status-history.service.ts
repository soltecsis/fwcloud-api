import { getRepository, QueryBuilder, Repository, SelectQueryBuilder } from "typeorm";
import { Service } from "../../../../fonaments/services/service";
import { OpenVPN } from "../OpenVPN";
import { OpenVPNStatusHistory } from "./openvpn-status-history";

export type CreateOpenVPNStatusHistoryData = {
    timestamp: number;
    name: string;
    address: string;
    bytesReceived: number;
    bytesSent: number;
    connectedAt: Date;
    disconnectedAt?: Date;
}

export type FindOpenVPNStatusHistoryOptions = {
    rangeTimestamp?: [number, number],
    name?: string,
    address?: string,
    openVPNServerId?: number;
}

export type ClientHistoryConnection = {
    connected_at: Date,
    disconnected_at: Date | null,
    bytesSent: number,
    bytesReceived: number,
    address: string
}

export type ClientHistory = {
    connections: ClientHistoryConnection[]
}

export type FindResponse = {
    [cn: string]: ClientHistory
}

export class OpenVPNStatusHistoryService extends Service {
    protected _repository: Repository<OpenVPNStatusHistory>;

    public async build(): Promise<Service> {
        this._repository = getRepository(OpenVPNStatusHistory);
        return this;
    }

    /**
     * Creates and persists a batch.
     * It detects CN disconnection and creates entries with disconnectedAt information
     * 
     * @param serverOpenVPNId 
     * @param data 
     * @returns 
     */
    async create(serverOpenVPNId: number, data: CreateOpenVPNStatusHistoryData[]): Promise<OpenVPNStatusHistory[]> {
        // Makes sure openvpn is a server
        const serverOpenVPN: OpenVPN = await getRepository(OpenVPN).createQueryBuilder('openvpn')
            .innerJoin('openvpn.crt', 'crt')
            .innerJoinAndSelect('openvpn.firewall', 'firewall')
            .where('openvpn.parentId IS NULL')
            .andWhere('crt.type =  2')
            .andWhere('openvpn.id = :id', {id: serverOpenVPNId})
            .getOneOrFail();

        // Get the timestamps of the records to be persisted
        // IMPORTANT! timestamps must be ordered from lower to higher in order to detect disconnection correctly
        let timestamps: number[] = [...new Set(data.map(item => item.timestamp))].sort((a,b) => a < b ? 1 : -1);

        // This covers the case when data is empty. Artificially we set the current timestamp in order
        // to detect disconnections.
        if (timestamps.length === 0) {
            timestamps = [new Date().getTime()];
        }
        
        // Get the last entry already persisted from the openvpn server. The entry's timestamp will be used to
        // retrieve the last batch. If there is not lastEntry means there is not lastBatch thus all disconnect detection logic
        // won't be applied.
        const lastEntry: OpenVPNStatusHistory | undefined = await getRepository(OpenVPNStatusHistory).createQueryBuilder('history')
            .where('history.openVPNServerId = :openvpn', {openvpn: serverOpenVPN.id})
            .orderBy('history.timestamp', 'DESC')
            .getOne()
        
        let lastbatch: OpenVPNStatusHistory[] = [];
        if (lastEntry) {
            const lastTimestamp: number = lastEntry.timestamp;
            
            lastbatch = await getRepository(OpenVPNStatusHistory).createQueryBuilder('history')
            .where('history.openVPNServerId = :openvpn', {openvpn: serverOpenVPN.id})
            .andWhere('history.timestamp = :timestamp', {timestamp: lastTimestamp})
            .getMany();
        }

        let entries: OpenVPNStatusHistory[] = [];

        for(let timestamp of timestamps) {
            const batch: CreateOpenVPNStatusHistoryData[] = data.filter(item => item.timestamp === timestamp);
        
            // If the current batch doesn't have an entry which exists on the previous batch,
            // then we must add an entry to the batch with a disconnectedAt value
            lastbatch.filter(item => item.disconnectedAt === null).forEach(persisted => {
                //If the persisted name is not present in the batch, then we must set as disconnected
                if (batch.findIndex(item => persisted.name === item.name ) < 0) {
                    batch.push({
                        timestamp,
                        name: persisted.name,
                        address: persisted.address,
                        bytesReceived: persisted.bytesReceived,
                        bytesSent: persisted.bytesSent,
                        connectedAt: persisted.connectedAt,
                        disconnectedAt: new Date(timestamp),
                    });
                }
            });

            //Once this batch is persisted, they become lastbatch for the next iteration
            lastbatch = await getRepository(OpenVPNStatusHistory).save(batch.map(item => {
                (item as OpenVPNStatusHistory).openVPNServerId = serverOpenVPN.id;
                return item;
            }));

            entries = entries.concat(lastbatch);
        }
        return entries;
    }

    async find(options: FindOpenVPNStatusHistoryOptions = {}): Promise<FindResponse> {
        const query: SelectQueryBuilder<OpenVPNStatusHistory> = this._repository.createQueryBuilder('record');

        if (Object.prototype.hasOwnProperty.call(options, "rangeTimestamp")) {
            query.andWhere(`record.timestamp BETWEEN :start and :end`, {
                start: options.rangeTimestamp[0],
                end: options.rangeTimestamp[1]
            })
        }

        if (Object.prototype.hasOwnProperty.call(options, "name")) {
            query.andWhere(`record.name = :name`, {name: options.name})
        }

        if (Object.prototype.hasOwnProperty.call(options, "address")) {
            query.andWhere(`record.address = :address`, {address: options.address})
        }

        if (Object.prototype.hasOwnProperty.call(options, "openVPNServerId")) {
            query.andWhere(`record.openVPNServerId = :openVPNServerId`, {openVPNServerId: options.openVPNServerId})
        }

        const results: OpenVPNStatusHistory[] = await query.orderBy('timestamp', 'ASC').getMany();
        let names: string[] = [...new Set(results.map(item => item.name))];
        let result: FindResponse = {}

        for(let name of names) {
            const entries: OpenVPNStatusHistory[] = results.filter(item => item.name === name);
            let connections: ClientHistoryConnection[] = [];
            
            let currentConnection: undefined | ClientHistoryConnection = undefined;
            for(let entry of entries) {
                if (currentConnection === undefined) {
                    currentConnection = {
                        connected_at: entry.connectedAt,
                        disconnected_at: null,
                        bytesSent: entry.bytesSent,
                        bytesReceived: entry.bytesReceived,
                        address: entry.address
                    }

                    currentConnection.bytesReceived = entry.bytesReceived;
                    currentConnection.bytesSent = entry.bytesSent;

                    if (entry.disconnectedAt) {
                        currentConnection.disconnected_at = entry.disconnectedAt
                        connections.push(currentConnection);
                        currentConnection = undefined;
                    }
                }
            }
            if (currentConnection) {
                connections.push(currentConnection);
            }

            result[name] = {
                connections: connections
            }
        }

        return result;
    }
}