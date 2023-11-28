import { FindManyOptions, FindOneOptions, Repository, getRepository } from "typeorm";
import { Service } from "../../../../fonaments/services/service";
import { DHCPRule } from "../dhcp_r/dhcp_r.model";
import { DHCPGroup } from "./dhcp_g.model";
import { Firewall } from "../../../firewall/Firewall";

interface IFindManyDHCPGPath {
    fwcloudId?: number;
    firewallId?: number;
}

interface IFindOneDHCPGPath extends IFindManyDHCPGPath {
    id: number;
}

interface ICreateDHCGroup {
    firewallId: number;
    name: string;
    comment?: string;
    style?: string;
    rules: Partial<DHCPRule>[];
}

interface IUpdateDHCPGroup {
    name: string;
    comment?: string;
    style?: string;
    rules: Partial<DHCPRule>[];
}

export class DHCPGroupService extends Service {
    protected _repository: Repository<DHCPGroup>;

    findManyInPath(path: IFindManyDHCPGPath): Promise<DHCPGroup[]> {
        return this._repository.find(this.getFindInPathOptions(path));
    }

    findOneInPath(path: IFindOneDHCPGPath, options?: FindOneOptions<DHCPGroup>): Promise<DHCPGroup | undefined> {
        return this._repository.findOne(this.getFindInPathOptions(path, options));
    }

    protected getFindInPathOptions(path: Partial<IFindOneDHCPGPath>,options: FindOneOptions<DHCPGroup> | FindManyOptions<DHCPGroup> = {}): FindOneOptions<DHCPGroup> | FindManyOptions<DHCPGroup> {
        return Object.assign({
            join: {
                alias: 'group',
                innerJoin: {
                    fwcloud: 'group.fwcloud',
                    firewall: 'firewall.firewall',
                }
            },
            where: {
                fwcloud: path.fwcloudId,
                firewall: path.firewallId,
            }
        },options)
    }


    async create(data: ICreateDHCGroup): Promise<DHCPGroup> {
        const groupData: Partial<DHCPGroup> = {
            name: data.name,
            firewall: getRepository(Firewall).findOne(data.firewallId) as unknown as Firewall,
            style: data.style,
        };

        const group: DHCPGroup = await this._repository.save(groupData);
        return this._repository.findOne(group.id);
    }
    
    async update(id: number, data: IUpdateDHCPGroup): Promise<DHCPGroup> {
        let group: DHCPGroup = await this._repository.preload(Object.assign(data, {id}));
        group = await this._repository.save(group);
        return this._repository.findOne(group.id);
    }

    async remove(path: IFindOneDHCPGPath): Promise<DHCPGroup> {
        const group: DHCPGroup = await this.findOneInPath(path);
        getRepository(DHCPRule).update(group.rules.map(rule => rule.id), {
            group: null
        });
        await this._repository.remove(group);
        return group;
    }
}