import { In, Repository, SelectQueryBuilder } from 'typeorm';
import { Service } from '../../../../fonaments/services/service';
import { OpenVPN } from '../OpenVPN';
import { OpenVPNStatusHistory } from './openvpn-status-history';
import db from '../../../../database/database-manager';

export type CreateOpenVPNStatusHistoryData = {
  timestampInSeconds: number;
  name: string;
  address: string;
  bytesReceived: number;
  bytesSent: number;
  connectedAtTimestampInSeconds: number;
  disconnectedAtTimestampInSeconds?: number;
};

export type CreateOpenVPNStatusHistorySummary = {
  entries: OpenVPNStatusHistory[];
  insertedEntries: number;
  updatedDisconnections: number;
};

export type FindOpenVPNStatusHistoryOptions = {
  rangeTimestamp?: [Date, Date];
  name?: string;
  address?: string;
  page?: number;
  limit?: number;
  sort?: OpenVPNHistorySortField;
  order?: OpenVPNHistorySortOrder;
};

export type GraphOpenVPNStatusHistoryOptions = {
  limit?: number;
} & Omit<FindOpenVPNStatusHistoryOptions, 'page' | 'sort' | 'order'>;

export type OpenVPNHistorySortField =
  'cn' | 'address' | 'connected_at' | 'disconnected_at' | 'bytesReceived' | 'bytesSent';

export type OpenVPNHistorySortOrder = 'ASC' | 'DESC';

export type ClientHistoryConnection = {
  connected_at: Date;
  disconnected_at: Date | null;
  bytesSent: number;
  bytesReceived: number;
  address: string;
};

export type ClientHistory = {
  connections: ClientHistoryConnection[];
};

export type FindResponse = {
  [cn: string]: ClientHistory;
};

export type PaginatedFindResponse = {
  history: FindResponse;
  pagination: {
    page: number;
    limit: number;
    total: number;
  };
};

type GraphDataPoint = {
  timestamp: number;
  bytesReceived: number;
  bytesReceivedSpeed: number;
  bytesSent: number;
  bytesSentSpeed: number;
};

export type GraphDataResponse = GraphDataPoint[];

type HistoryConnectionRow = {
  name: string;
  address: string;
  bytesReceived: string;
  bytesSent: string;
  connectedAtTimestampInSeconds: number;
  disconnectedAtTimestampInSeconds: number | null;
};

export class OpenVPNStatusHistoryService extends Service {
  protected _repository: Repository<OpenVPNStatusHistory>;

  public async build(): Promise<Service> {
    this._repository = db.getSource().manager.getRepository(OpenVPNStatusHistory);
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
  async create(
    serverOpenVPNId: number,
    data: CreateOpenVPNStatusHistoryData[],
  ): Promise<OpenVPNStatusHistory[]> {
    const result = await this.createWithSummary(serverOpenVPNId, data);
    return result.entries;
  }

  /**
   * Creates and persists a batch while returning synchronization counters.
   *
   * @param serverOpenVPNId
   * @param data
   * @returns
   */
  async createWithSummary(
    serverOpenVPNId: number,
    data: CreateOpenVPNStatusHistoryData[],
  ): Promise<CreateOpenVPNStatusHistorySummary> {
    // Makes sure openvpn is a server
    const serverOpenVPN: OpenVPN = await db
      .getSource()
      .manager.getRepository(OpenVPN)
      .createQueryBuilder('openvpn')
      .innerJoin('openvpn.crt', 'crt')
      .innerJoinAndSelect('openvpn.firewall', 'firewall')
      .where('openvpn.parentId IS NULL')
      .andWhere('crt.type =  2')
      .andWhere('openvpn.id = :id', { id: serverOpenVPNId })
      .getOneOrFail();

    // Get the last entry already persisted from the openvpn server. This entry is used to get  its timestamp as it will be used to
    // retrieve the last batch. If there is not lastEntry means there is not lastBatch thus all disconnect detection logic
    // won't be applied.
    const lastEntry: OpenVPNStatusHistory | undefined = await db
      .getSource()
      .manager.getRepository(OpenVPNStatusHistory)
      .createQueryBuilder('history')
      .where('history.openVPNServerId = :openvpn', { openvpn: serverOpenVPN.id })
      .orderBy('history.timestampInSeconds', 'DESC')
      .limit(1)
      .getOne();

    let lastTimestampedBatch: OpenVPNStatusHistory[] = [];
    if (lastEntry) {
      lastTimestampedBatch = await db
        .getSource()
        .manager.getRepository(OpenVPNStatusHistory)
        .createQueryBuilder('history')
        .where('history.openVPNServerId = :openvpn', { openvpn: serverOpenVPN.id })
        .andWhere('history.timestampInSeconds = :timestamp', {
          timestamp: lastEntry.timestampInSeconds,
        })
        .getMany();
    }

    // If the data is empty, then detect disconnections and returns.
    let updatedDisconnections = 0;

    if (data.length === 0) {
      // In this case, all previous connections will be set as disconnected.
      updatedDisconnections += await this.detectDisconnections([], lastTimestampedBatch);
      return {
        entries: [],
        insertedEntries: 0,
        updatedDisconnections,
      };
    }

    // Get the timestamps of the records to be persisted
    // IMPORTANT! timestamps must be ordered from lower to higher in order to detect disconnection correctly
    const timestamps: number[] = [...new Set(data.map((item) => item.timestampInSeconds))].sort(
      (a, b) => (a < b ? -1 : 1),
    );

    let entries: OpenVPNStatusHistory[] = [];

    for (const timestamp of timestamps) {
      const timestampedBatch: CreateOpenVPNStatusHistoryData[] = data.filter(
        (item) => item.timestampInSeconds === timestamp,
      );
      updatedDisconnections += await this.detectDisconnections(
        timestampedBatch,
        lastTimestampedBatch,
      );

      const persistedBatch = await db
        .getSource()
        .manager.getRepository(OpenVPNStatusHistory)
        .save(
          timestampedBatch.map<Partial<OpenVPNStatusHistory>>((item) => ({
            timestampInSeconds: item.timestampInSeconds,
            name: item.name,
            address: item.address,
            bytesReceived: item.bytesReceived.toString(),
            bytesSent: item.bytesSent.toString(),
            connectedAtTimestampInSeconds: item.connectedAtTimestampInSeconds,
            openVPNServerId: serverOpenVPN.id,
          })),
        );

      //Once this batch is persisted, they become lastTimestampedBatch for the next iteration
      lastTimestampedBatch = await db
        .getSource()
        .manager.getRepository(OpenVPNStatusHistory)
        .findBy({ id: In(persistedBatch.map((item) => item.id)) });

      entries = entries.concat(lastTimestampedBatch);
    }
    return {
      entries,
      insertedEntries: entries.length,
      updatedDisconnections,
    };
  }

  /**
   * Finds OpenVPNStatusHistory based on the openvpn server id and the options provided
   *
   * @param openVpnServerId
   * @param options
   * @returns
   */
  find(
    openVpnServerId: number,
    options: FindOpenVPNStatusHistoryOptions = {},
  ): Promise<OpenVPNStatusHistory[]> {
    return this.buildFindQuery(openVpnServerId, options)
      .orderBy('record.timestampInSeconds', 'ASC')
      .getMany();
  }

  protected buildFindQuery(
    openVpnServerId: number,
    options: FindOpenVPNStatusHistoryOptions = {},
  ): SelectQueryBuilder<OpenVPNStatusHistory> {
    const query: SelectQueryBuilder<OpenVPNStatusHistory> = this._repository
      .createQueryBuilder('record')
      .andWhere(`record.openVPNServerId = :serverId`, { serverId: openVpnServerId });

    if (Object.prototype.hasOwnProperty.call(options, 'rangeTimestamp')) {
      query.andWhere(`record.timestampInSeconds BETWEEN :start and :end`, {
        start: options.rangeTimestamp[0].getTime() / 1000,
        end: options.rangeTimestamp[1].getTime() / 1000,
      });
    }

    if (Object.prototype.hasOwnProperty.call(options, 'name')) {
      query.andWhere(`record.name like :name`, { name: options.name });
    }

    if (Object.prototype.hasOwnProperty.call(options, 'address')) {
      query.andWhere(`record.address = :address`, { address: options.address });
    }

    return query;
  }

  /**
   * Return the data required to generate the history table
   *
   * @param openVpnServerId
   * @param options
   * @returns
   */
  history(openVpnServerId: number): Promise<FindResponse>;
  history(
    openVpnServerId: number,
    options: FindOpenVPNStatusHistoryOptions & { page?: undefined; limit?: undefined },
  ): Promise<FindResponse>;
  history(
    openVpnServerId: number,
    options: FindOpenVPNStatusHistoryOptions & ({ page: number } | { limit: number }),
  ): Promise<PaginatedFindResponse>;
  history(
    openVpnServerId: number,
    options: FindOpenVPNStatusHistoryOptions,
  ): Promise<FindResponse | PaginatedFindResponse>;
  async history(
    openVpnServerId: number,
    options: FindOpenVPNStatusHistoryOptions = {},
  ): Promise<FindResponse | PaginatedFindResponse> {
    if (options.page || options.limit) {
      return this.paginatedHistory(openVpnServerId, options);
    }

    const results: OpenVPNStatusHistory[] = await this.find(openVpnServerId, options);

    const result: FindResponse = this.buildHistoryResponse(results);

    return result;
  }

  protected async paginatedHistory(
    openVpnServerId: number,
    options: FindOpenVPNStatusHistoryOptions = {},
  ): Promise<PaginatedFindResponse> {
    const page = Math.max(1, options.page ?? 1);
    const limit = Math.min(Math.max(1, options.limit ?? 50), 200);
    const offset = (page - 1) * limit;

    const [rows, total] = await Promise.all([
      this.findConnectionRows(openVpnServerId, options, limit, offset),
      this.countConnectionRows(openVpnServerId, options),
    ]);

    const result: FindResponse = this.buildHistoryResponseFromConnectionRows(rows);

    return {
      history: result,
      pagination: {
        page,
        limit,
        total,
      },
    };
  }

  protected findConnectionRows(
    openVpnServerId: number,
    options: FindOpenVPNStatusHistoryOptions,
    limit: number,
    offset: number,
  ): Promise<HistoryConnectionRow[]> {
    const query = this.buildConnectionRowsQuery(openVpnServerId, options);
    const order = options.order ?? 'ASC';

    switch (options.sort) {
      case 'address':
        query.orderBy('address', order);
        break;
      case 'connected_at':
        query.orderBy('connectedAtTimestampInSeconds', order);
        break;
      case 'disconnected_at':
        query.orderBy('disconnectedAtTimestampInSeconds', order);
        break;
      case 'bytesReceived':
        query.orderBy('bytesReceived', order);
        break;
      case 'bytesSent':
        query.orderBy('bytesSent', order);
        break;
      case 'cn':
      default:
        query.orderBy('record.name', order);
        break;
    }

    if (options.sort !== 'cn') {
      query.addOrderBy('record.name', 'ASC');
    }

    if (options.sort !== 'connected_at') {
      query.addOrderBy('connectedAtTimestampInSeconds', 'ASC');
    }

    query.limit(limit).offset(offset);

    return query.getRawMany<HistoryConnectionRow>();
  }

  protected countConnectionRows(
    openVpnServerId: number,
    options: FindOpenVPNStatusHistoryOptions,
  ): Promise<number> {
    const query = this.buildConnectionRowsQuery(openVpnServerId, options);
    const countQuery = db
      .getSource()
      .manager.createQueryBuilder()
      .select('COUNT(*)', 'total')
      .from(`(${query.getQuery()})`, 'connections')
      .setParameters(query.getParameters());

    return countQuery.getRawOne<{ total: string }>().then((result) => parseInt(result.total, 10));
  }

  protected buildConnectionRowsQuery(
    openVpnServerId: number,
    options: FindOpenVPNStatusHistoryOptions,
  ): SelectQueryBuilder<OpenVPNStatusHistory> {
    return this.buildFindQuery(openVpnServerId, options)
      .select('record.name', 'name')
      .addSelect('MAX(record.address)', 'address')
      .addSelect('MAX(record.bytesReceived)', 'bytesReceived')
      .addSelect('MAX(record.bytesSent)', 'bytesSent')
      .addSelect('record.connectedAtTimestampInSeconds', 'connectedAtTimestampInSeconds')
      .addSelect('MAX(record.disconnectedAtTimestampInSeconds)', 'disconnectedAtTimestampInSeconds')
      .groupBy('record.name')
      .addGroupBy('record.connectedAtTimestampInSeconds');
  }

  protected buildHistoryResponse(results: OpenVPNStatusHistory[]): FindResponse {
    const names: string[] = [...new Set(results.map((item) => item.name))];
    const result: FindResponse = {};

    for (const name of names) {
      const entries: OpenVPNStatusHistory[] = results.filter((item) => item.name === name);
      const connections: ClientHistoryConnection[] = [];

      let currentConnection: undefined | ClientHistoryConnection = undefined;
      for (const entry of entries) {
        if (currentConnection === undefined) {
          currentConnection = {
            connected_at: new Date(entry.connectedAtTimestampInSeconds * 1000),
            disconnected_at: null,
            bytesSent: parseInt(entry.bytesSent),
            bytesReceived: parseInt(entry.bytesReceived),
            address: entry.address,
          };
        }

        currentConnection.bytesReceived = parseInt(entry.bytesReceived);
        currentConnection.bytesSent = parseInt(entry.bytesSent);

        if (entry.disconnectedAtTimestampInSeconds) {
          currentConnection.disconnected_at = new Date(
            entry.disconnectedAtTimestampInSeconds * 1000,
          );
          connections.push(currentConnection);
          currentConnection = undefined;
        }
      }
      if (currentConnection) {
        connections.push(currentConnection);
      }

      result[name] = {
        connections: connections,
      };
    }

    return result;
  }

  protected buildHistoryResponseFromConnectionRows(rows: HistoryConnectionRow[]): FindResponse {
    const result: FindResponse = {};

    for (const row of rows) {
      if (!result[row.name]) {
        result[row.name] = {
          connections: [],
        };
      }

      result[row.name].connections.push({
        connected_at: new Date(row.connectedAtTimestampInSeconds * 1000),
        disconnected_at: row.disconnectedAtTimestampInSeconds
          ? new Date(row.disconnectedAtTimestampInSeconds * 1000)
          : null,
        bytesSent: parseInt(row.bytesSent, 10),
        bytesReceived: parseInt(row.bytesReceived, 10),
        address: row.address,
      });
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
  async graph(
    openVpnServerId: number,
    options: GraphOpenVPNStatusHistoryOptions = {},
  ): Promise<GraphDataResponse> {
    const results: OpenVPNStatusHistory[] = await this.find(openVpnServerId, options);

    const graph: GraphDataResponse = this.buildGraphResponse(results, options.limit);

    return graph;
  }

  protected buildGraphResponse(results: OpenVPNStatusHistory[], limit?: number): GraphDataResponse {
    const timestampBytes: Map<number, [number, number]> = new Map();

    for (const item of results) {
      const bytesReceivedSent: [number, number] = timestampBytes.get(item.timestampInSeconds) ?? [
        0, 0,
      ];

      bytesReceivedSent[0] += parseInt(item.bytesReceived);
      bytesReceivedSent[1] += parseInt(item.bytesSent);
      timestampBytes.set(item.timestampInSeconds, bytesReceivedSent);
    }

    const response: GraphDataResponse = Array.from(timestampBytes.entries()).map(
      ([timestampInSeconds, bytesReceivedSent]) => {
        return {
          timestamp: timestampInSeconds * 1000,
          bytesReceived: bytesReceivedSent[0],
          bytesSent: bytesReceivedSent[1],
          bytesReceivedSpeed: null,
          bytesSentSpeed: null,
        };
      },
    );

    return (
      this.limitGraphPoints(response, limit)
        // bytesReceivedSpeed and bytesSentSpeed calculation
        .map((item, index, results) => {
          // If index = 0, there is not previous value thus speeds must be null
          if (index !== 0) {
            const previous = results[index - 1];
            item.bytesReceivedSpeed =
              item.bytesReceived - previous.bytesReceived > 0
                ? (item.bytesReceived - previous.bytesReceived) /
                  ((item.timestamp - previous.timestamp) / 1000)
                : 0;

            item.bytesSentSpeed =
              item.bytesSent - previous.bytesSent > 0
                ? (item.bytesSent - previous.bytesSent) /
                  ((item.timestamp - previous.timestamp) / 1000)
                : 0;
          }

          return item;
        })
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
    const result: GraphDataResponse = [];

    while (data.length > 0) {
      const group: GraphDataResponse = data.splice(0, count);

      result.push({
        //Timestamp median
        timestamp:
          group[0].timestamp + (group[group.length - 1].timestamp - group[0].timestamp) / 2,
        // bytesReceived / Sent average
        bytesReceived:
          group.reduce<number>((average, item) => {
            return average + item.bytesReceived;
          }, 0) / group.length,
        bytesSent:
          group.reduce<number>((average, item) => {
            return average + item.bytesSent;
          }, 0) / group.length,
        bytesSentSpeed: null,
        bytesReceivedSpeed: null,
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
  protected async detectDisconnections(
    newTimestampedBatch: CreateOpenVPNStatusHistoryData[],
    previousTimestampedBatch: OpenVPNStatusHistory[],
  ): Promise<number> {
    let updatedDisconnections = 0;

    // If the current batch doesn't have an entry which exists on the previous batch,
    // then we must add an entry to the batch with a disconnectedAt value
    for (const previous of previousTimestampedBatch.filter(
      (item) => item.disconnectedAtTimestampInSeconds === null,
    )) {
      const matchIndex: number = newTimestampedBatch.findIndex(
        (item) => previous.name === item.name,
      );
      //If the persisted batch name is not present in the current batch, then we must set as disconnected
      if (matchIndex < 0) {
        previous.disconnectedAtTimestampInSeconds = previous.timestampInSeconds;
        await db.getSource().manager.getRepository(OpenVPNStatusHistory).save(previous);
        updatedDisconnections++;
      } else {
        // If the persisted batch name is present in the current batch but its address is different,
        // then is a new connection.
        if (previous.address !== newTimestampedBatch[matchIndex].address) {
          previous.disconnectedAtTimestampInSeconds = previous.timestampInSeconds;
          await db.getSource().manager.getRepository(OpenVPNStatusHistory).save(previous);
          updatedDisconnections++;
        }
      }
    }

    return updatedDisconnections;
  }
}
