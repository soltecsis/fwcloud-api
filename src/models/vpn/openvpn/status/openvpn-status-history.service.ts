import { getRepository, Repository, SelectQueryBuilder } from "typeorm";
import { Service } from "../../../../fonaments/services/service";
import { OpenVPN } from "../OpenVPN";
import { OpenVPNStatusHistory } from "./openvpn-status-history";

export type CreateOpenVPNStatusHistoryData = {
    timestampInSeconds: number;
    name: string;
    address: string;
    megaBytesReceived: number;
    megaBytesSent: number;
    connectedAt: Date;
    disconnectedAt?: Date;
}

export type FindOpenVPNStatusHistoryOptions = {
    rangeTimestamp?: [Date, Date],
    name?: string,
    address?: string
}

export type GraphOpenVPNStatusHistoryOptions = {
    limit?: number
} & FindOpenVPNStatusHistoryOptions;

export type ClientHistoryConnection = {
    connected_at: Date,
    disconnected_at: Date | null,
    megaBytesSent: number,
    megaBytesReceived: number,
    address: string
}

export type ClientHistory = {
    connections: ClientHistoryConnection[]
}

export type FindResponse = {
    [cn: string]: ClientHistory
}

type GraphDataPoint = {
    timestamp: number,
    megaBytesReceived: number,
    megaBytesReceivedSpeed: number,
    megaBytesSent: number,
    megaBytesSentSpeed: number,
}

export type GraphDataResponse = GraphDataPoint[];


export class OpenVPNStatusHistoryService extends Service {
    protected _repository: Repository<OpenVPNStatusHistory>;

    public async build(): Promise<Service> {
        this._repository = getRepository(OpenVPNStatusHistory);
        return this;
    }

    /**
     * Creates and persists a batch.
     * It detects CN disconnection and updates entries with disconnectedAt information
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

        // Get the last entry already persisted from the openvpn server. This entry is used to get  its timestamp as it will be used to
        // retrieve the last batch. If there is not lastEntry means there is not lastBatch thus all disconnect detection logic
        // won't be applied.
        const lastEntry: OpenVPNStatusHistory | undefined = await getRepository(OpenVPNStatusHistory).createQueryBuilder('history')
            .where('history.openVPNServerId = :openvpn', {openvpn: serverOpenVPN.id})
            .orderBy('history.timestamp', 'DESC')
            .getOne()
        
        let lastTimestampedBatch: OpenVPNStatusHistory[] = [];
        if (lastEntry) {
            lastTimestampedBatch = await getRepository(OpenVPNStatusHistory).createQueryBuilder('history')
            .where('history.openVPNServerId = :openvpn', {openvpn: serverOpenVPN.id})
            .andWhere('history.timestamp = :timestamp', {timestamp: lastEntry.timestamp})
            .getMany();
        }

        // If the data is empty, then detect disconnections and returns.
        if (data.length === 0) {
            // In this case, all previous connections will be set as disconnected.
            await this.detectDisconnections([], lastTimestampedBatch);
            return [];
        }

        // Get the timestamps of the records to be persisted
        // IMPORTANT! timestamps must be ordered from lower to higher in order to detect disconnection correctly
        let timestamps: number[] = [...new Set(data.map(item => item.timestampInSeconds))].sort((a,b) => a < b ? -1 : 1);

        let entries: OpenVPNStatusHistory[] = [];

        for(let timestamp of timestamps) {
            const timestampedBatch: CreateOpenVPNStatusHistoryData[] = data.filter(item => item.timestampInSeconds === timestamp);
        
            await this.detectDisconnections(timestampedBatch, lastTimestampedBatch);

            //Once this batch is persisted, they become lastTimestampedBatch for the next iteration
            lastTimestampedBatch = await getRepository(OpenVPNStatusHistory).save(timestampedBatch.map<Partial<OpenVPNStatusHistory>>(item => ({
                timestamp: item.timestampInSeconds,
                name: item.name,
                address: item.address,
                megaBytesReceived: item.megaBytesReceived,
                megaBytesSent: item.megaBytesSent,
                connectedAt: item.connectedAt,
                openVPNServerId: serverOpenVPN.id
            })));

            entries = entries.concat(lastTimestampedBatch);
        }
        return entries;
    }

    /**
     * Finds OpenVPNStatusHistory based on the openvpn server id and the options provided
     * 
     * @param openVpnServerId 
     * @param options 
     * @returns 
     */
    find(openVpnServerId: number, options: FindOpenVPNStatusHistoryOptions = {}): Promise<OpenVPNStatusHistory[]> {
        const query: SelectQueryBuilder<OpenVPNStatusHistory> = this._repository.createQueryBuilder('record')
            .andWhere(`record.openVPNServerId = :serverId`, {serverId: openVpnServerId});

        if (Object.prototype.hasOwnProperty.call(options, "rangeTimestamp")) {
            query.andWhere(`record.timestamp BETWEEN :start and :end`, {
                start: options.rangeTimestamp[0].getTime() / 1000,
                end: options.rangeTimestamp[1].getTime() / 1000
            })
        }

        if (Object.prototype.hasOwnProperty.call(options, "name")) {
            query.andWhere(`record.name like :name`, {name: options.name})
        }

        if (Object.prototype.hasOwnProperty.call(options, "address")) {
            query.andWhere(`record.address = :address`, {address: options.address})
        }

        return query.orderBy('timestamp', 'ASC').getMany();
    }

    /**
     * Return the data required to generate the history table
     * 
     * @param openVpnServerId 
     * @param options 
     * @returns 
     */
    async history(openVpnServerId: number, options: FindOpenVPNStatusHistoryOptions = {}): Promise<FindResponse> {
        const results: OpenVPNStatusHistory[] = await this.find(openVpnServerId, options);

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
                        megaBytesSent: entry.megaBytesSent,
                        megaBytesReceived: entry.megaBytesReceived,
                        address: entry.address
                    }
                }

                currentConnection.megaBytesReceived = entry.megaBytesReceived;
                currentConnection.megaBytesSent = entry.megaBytesSent;
                
                if (entry.disconnectedAt) {
                    currentConnection.disconnected_at = entry.disconnectedAt
                    connections.push(currentConnection);
                    currentConnection = undefined;
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

    /**
     * Returns the graph points data in order to print graphs
     * 
     * @param openVpnServerId 
     * @param options 
     * @returns 
     */
    async graph(openVpnServerId: number, options: GraphOpenVPNStatusHistoryOptions = {}): Promise<GraphDataResponse> {
        const results: OpenVPNStatusHistory[] = await this.find(openVpnServerId, options);

        // Get results timestamps
        // IMPORTANT! timestamps must be ordered from lower to higher in order to detect disconnection correctly
        let timestamps: number[] = [...new Set(results.map(item => item.timestamp))].sort((a,b) => a < b ? -1 : 1);

        const response: GraphDataResponse = timestamps.map(timestamp => {
            //Get all records with the same timestamp
            const records: OpenVPNStatusHistory[] = results.filter(item => item.timestamp === timestamp);

            // Then calculate megaBytesReceived/megaBytesSent accumulated.
            // megaBytesReceviedSent will contain all megaBytesReceived added in index 0 and all megaBytesSent added in index 1
            const megaBytesReceivedSent: [number, number] = records.reduce<[number, number]>((megaBytes: [number, number], item: OpenVPNStatusHistory) => {
                return [megaBytes[0] + item.megaBytesReceived, megaBytes[1] + item.megaBytesSent];
            }, [0, 0])

            return {
                timestamp: timestamp * 1000,
                megaBytesReceived: megaBytesReceivedSent[0],
                megaBytesSent: megaBytesReceivedSent[1],
                megaBytesReceivedSpeed: null,
                megaBytesSentSpeed: null
            };
        });

        return this.limitGraphPoints(response, options.limit)
            // megaBytesReceivedSpeed and megaBytesSentSpeed calculation
            .map((item, index, results) => {
                // If index = 0, there is not previous value thus speeds must be null
                if (index !== 0) {
                    const previous = results[index - 1];
                    item.megaBytesReceivedSpeed = item.megaBytesReceived - previous.megaBytesReceived > 0
                        ? (item.megaBytesReceived - previous.megaBytesReceived) / ((item.timestamp - previous.timestamp) / 1000)
                        : 0;

                    item.megaBytesSentSpeed = item.megaBytesSent - previous.megaBytesSent > 0
                        ? (item.megaBytesSent - previous.megaBytesSent) / ((item.timestamp - previous.timestamp) / 1000)
                        : 0;
                }

                return item;
            }
        );
    }

    /**
     * If the results contains more than limit points, it calculates average points based on provided points
     * in order to fit the limit
     * 
     * @param data 
     * @param limit 
     * @returns 
     */
    protected limitGraphPoints(data: GraphDataResponse, limit: number = Infinity): GraphDataResponse {
        if (data.length < limit) {
            return data;
        }

        const count: number = Math.ceil(data.length / limit);
        const result: GraphDataResponse = []

        while(data.length > 0) {
            const group: GraphDataResponse = data.splice(0, count);

            result.push({
                //Timestamp median
                timestamp: group[0].timestamp + ((group[group.length - 1].timestamp - group[0].timestamp)/2),
                // megaBytesReceived / Sent average
                megaBytesReceived: group.reduce<number>((average, item) => { return average + item.megaBytesReceived}, 0) / group.length,
                megaBytesSent: group.reduce<number>((average, item) => { return average + item.megaBytesSent}, 0) / group.length,
                megaBytesSentSpeed: null,
                megaBytesReceivedSpeed: null
            });
        }

        return result;
    }

    /**
     * Detects client disconnections. If a client disconnection is detected, then
     * a Date is set into "disconnectedAt" in the previous entry.
     *
     * A client has disconnected when:
     *
     *  1. It is present in the previous timestamped bacth but it isn't in the new one.
     *  2. It is present in both batches but using different address.
     *
     * @param newTimestampedBatch
     * @param previousTimestampedBatch
     */
    protected async detectDisconnections(newTimestampedBatch: CreateOpenVPNStatusHistoryData[], previousTimestampedBatch: OpenVPNStatusHistory[]): Promise<void> {
        // If the current batch doesn't have an entry which exists on the previous batch,
        // then we must add an entry to the batch with a disconnectedAt value
        for (let previous of previousTimestampedBatch.filter(item => item.disconnectedAt === null)) {
            const matchIndex: number = newTimestampedBatch.findIndex(item => previous.name === item.name);

            //If the persisted batch name is not present in the current batch, then we must set as disconnected
            if ( matchIndex < 0) {
                previous.disconnectedAt = new Date(previous.timestamp);
                await getRepository(OpenVPNStatusHistory).save(previous);

            } else {
                // If the persisted batch name is present in the current batch but its address is different,
                // then is a new connection.
                if (previous.address !== newTimestampedBatch[matchIndex].address) {
                    previous.disconnectedAt = new Date(previous.timestamp);
                    await getRepository(OpenVPNStatusHistory).save(previous);
                }
            }
        }
    }
}