import { getRepository, QueryBuilder, Repository, SelectQueryBuilder } from "typeorm";
import { Service } from "../../../../fonaments/services/service";
import { OpenVPNStatusHistory } from "./openvpn-status-history";

export type CreateOpenVPNStatusHistoryData = {
    timestamp: number;
    name: string;
    address: string;
    bytesReceived: number;
    bytesSent: number;
    connectedAt: Date;
    openVPNServerId: number;
}

export type FindOpenVPNStatusHistoryOptions = {
    rangeTimestamp?: [number, number],
    name?: string,
    address?: string,
    openVPNServerId?: number;
}

export class OpenVPNStatusHistoryService extends Service {
    protected _repository: Repository<OpenVPNStatusHistory>;

    public async build(): Promise<Service> {
        this._repository = getRepository(OpenVPNStatusHistory);
        return this;
    }

    async create(data: CreateOpenVPNStatusHistoryData): Promise<OpenVPNStatusHistory> {
        return await this._repository.save(data)
    }

    async find(options: FindOpenVPNStatusHistoryOptions = {}): Promise<OpenVPNStatusHistory[]> {
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

        return query.getMany();
    }
}