import { getRepository, Repository, SelectQueryBuilder } from "typeorm";
import { Service } from "../../../../fonaments/services/service";
import { OpenVPN } from "../OpenVPN";
import { OpenVPNStatusHistory } from "./openvpn-status-history";

export type CreateOpenVPNStatusHistoryData = {
    timestampInSeconds: number;
    name: string;
    address: string;
    bytesReceived: number;
    bytesSent: number;
    connectedAtTimestampInSeconds: number;
    disconnectedAtTimestampInSeconds?: number;
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

type GraphDataPoint = {
    timestamp: number,
    bytesReceived: number,
    bytesReceivedSpeed: number,
    bytesSent: number,
    bytesSentSpeed: number,
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
            .orderBy('history.timestampInSeconds', 'DESC')
            .getOne()
        
        let lastTimestampedBatch: OpenVPNStatusHistory[] = [];
        if (lastEntry) {
            lastTimestampedBatch = await getRepository(OpenVPNStatusHistory).createQueryBuilder('history')
            .where('history.openVPNServerId = :openvpn', {openvpn: serverOpenVPN.id})
            .andWhere('history.timestampInSeconds = :timestamp', {timestamp: lastEntry.timestampInSeconds})
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
                timestampInSeconds: item.timestampInSeconds,
                name: item.name,
                address: item.address,
                bytesReceived: item.bytesReceived,
                bytesSent: item.bytesSent,
                connectedAtTimestampInSeconds: item.connectedAtTimestampInSeconds,
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
            query.andWhere(`record.timestampInSeconds BETWEEN :start and :end`, {
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

        return query.orderBy('record.timestampInSeconds', 'ASC').getMany();
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
                        connected_at: new Date(entry.connectedAtTimestampInSeconds * 1000),
                        disconnected_at: null,
                        bytesSent: entry.bytesSent,
                        bytesReceived: entry.bytesReceived,
                        address: entry.address
                    }
                }

                currentConnection.bytesReceived = entry.bytesReceived;
                currentConnection.bytesSent = entry.bytesSent;
                
                if (entry.disconnectedAtTimestampInSeconds) {
                    currentConnection.disconnected_at = new Date(entry.disconnectedAtTimestampInSeconds * 1000);
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
        let timestamps: number[] = [...new Set(results.map(item => item.timestampInSeconds))].sort((a,b) => a < b ? -1 : 1);

        const response: GraphDataResponse = timestamps.map(timestampInSeconds => {
            //Get all records with the same timestamp
            const records: OpenVPNStatusHistory[] = results.filter(item => item.timestampInSeconds === timestampInSeconds);

            // Then calculate bytesReceived/bytesSent accumulated.
            // bytesReceviedSent will contain all bytesReceived added in index 0 and all bytesSent added in index 1
            const bytesReceivedSent: [number, number] = records.reduce<[number, number]>((bytes: [number, number], item: OpenVPNStatusHistory) => {
                return [bytes[0] + item.bytesReceived, bytes[1] + item.bytesSent];
            }, [0, 0])

            return {
                timestamp: timestampInSeconds * 1000,
                bytesReceived: bytesReceivedSent[0],
                bytesSent: bytesReceivedSent[1],
                bytesReceivedSpeed: null,
                bytesSentSpeed: null
            };
        });

        return this.limitGraphPoints(response, options.limit)
            // bytesReceivedSpeed and bytesSentSpeed calculation
            .map((item, index, results) => {
                // If index = 0, there is not previous value thus speeds must be null
                if (index !== 0) {
                    const previous = results[index - 1];
                    item.bytesReceivedSpeed = item.bytesReceived - previous.bytesReceived > 0
                        ? (item.bytesReceived - previous.bytesReceived) / ((item.timestamp - previous.timestamp) / 1000)
                        : 0;

                    item.bytesSentSpeed = item.bytesSent - previous.bytesSent > 0
                        ? (item.bytesSent - previous.bytesSent) / ((item.timestamp - previous.timestamp) / 1000)
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
                // bytesReceived / Sent average
                bytesReceived: group.reduce<number>((average, item) => { return average + item.bytesReceived}, 0) / group.length,
                bytesSent: group.reduce<number>((average, item) => { return average + item.bytesSent}, 0) / group.length,
                bytesSentSpeed: null,
                bytesReceivedSpeed: null
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
        for (let previous of previousTimestampedBatch.filter(item => item.disconnectedAtTimestampInSeconds === null)) {
            const matchIndex: number = newTimestampedBatch.findIndex(item => previous.name === item.name);

            //If the persisted batch name is not present in the current batch, then we must set as disconnected
            if ( matchIndex < 0) {
                previous.disconnectedAtTimestampInSeconds = previous.timestampInSeconds;
                await getRepository(OpenVPNStatusHistory).save(previous);

            } else {
                // If the persisted batch name is present in the current batch but its address is different,
                // then is a new connection.
                if (previous.address !== newTimestampedBatch[matchIndex].address) {
                    previous.disconnectedAtTimestampInSeconds = previous.timestampInSeconds;
                    await getRepository(OpenVPNStatusHistory).save(previous);
                }
            }
        }
    }
}