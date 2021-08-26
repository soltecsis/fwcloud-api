import { Service } from "../../fonaments/services/service";
import { Firewall } from "./Firewall";
import { FSHelper } from "../../utils/fs-helper";
import * as path from "path";
import * as fs from "fs";
import { Compiler } from "./compiler";
import { Installer } from "./installer";
import ObjectHelpers from "../../utils/object-helpers";
import { EventEmitter } from "typeorm/platform/PlatformTools";
import { User } from "../user/User";
import db from "../../database/database-manager";
import { IPObj } from "../ipobj/IPObj";
import { getCustomRepository, getRepository, In } from "typeorm";
import { FirewallRepository } from "./firewall.repository";
import { AbstractApplication } from "../../fonaments/abstract-application";
import { number } from "yargs";

export type SSHConfig = {
    host: string,
    port: number,
    username: string,
    password: string
};

export class FirewallService extends Service {
    protected _dataDir: string;
    protected _scriptFilename: string;
    protected _headerPath: string;
    protected _footerPath: string;

    protected _repository: FirewallRepository;

    constructor(app: AbstractApplication) {
        super(app);
        this._repository = getCustomRepository(FirewallRepository);
    }

    public async build(): Promise<FirewallService> {
        this._dataDir = this._app.config.get('policy').data_dir;
        this._scriptFilename = this._app.config.get('policy').script_name;
        this._headerPath = this._app.config.get('policy').header_file;
        this._footerPath = this._app.config.get('policy').footer_file;

        return this;
    }

    /**
     * Compile a firewall
     * 
     * @param firewall 
     */
    public async compile(firewall: Firewall, eventEmitter: EventEmitter = new EventEmitter()): Promise<Firewall> {
        if (firewall.fwCloudId === undefined || firewall.fwCloudId === null) {
            throw new Error('Firewall does not belong to a fwcloud');
        }
        
        await this.createFirewallPolicyDirectory(firewall);
        await (new Compiler(firewall)).compile(this._headerPath, this._footerPath, eventEmitter);

        return firewall;
    }

    public async install(firewall: Firewall, customSSHConfig: Partial<SSHConfig>, eventEmitter: EventEmitter = new EventEmitter()): Promise<Firewall> {
        const ipObj: IPObj = await getRepository(IPObj).findOne({id: firewall.install_ipobj, interfaceId: firewall.install_interface});
        const sshConfig: SSHConfig = <SSHConfig>ObjectHelpers.merge({
            host: ipObj.address,
            port: firewall.install_port,
            username: firewall.install_user,
            password: firewall.install_pass
        }, customSSHConfig);
        
        await (new Installer(firewall)).install(sshConfig, eventEmitter);
        await Firewall.updateFirewallStatus(firewall.fwCloudId, firewall.id,"&~2");
        await Firewall.updateFirewallInstallDate(firewall.fwCloudId, firewall.id);

        return firewall;
    }

    public async markAsUncompiled(ids: number[]): Promise<Firewall[]>
    public async markAsUncompiled(id: number): Promise<Firewall>
    public async markAsUncompiled(idOrIds: number | number[]): Promise<Firewall | Firewall[]> {
        if (Array.isArray(idOrIds)) {
            const firewalls: Firewall[] = await this._repository.find({
                where: {
                    id: In(idOrIds)
                }
            });
            return await this._repository.markAsUncompiled(firewalls);
        }

        const firewall: Firewall = await this._repository.findOneOrFail(idOrIds);
        await getCustomRepository(FirewallRepository).markAsUncompiled(firewall);
        return this._repository.findOneOrFail(idOrIds);
    }

    /**
     * Create compilation output directories
     * 
     * @param firewall 
     */
    protected async createFirewallPolicyDirectory(firewall: Firewall): Promise<void> {
        const directoryPath: string = path.join(this._dataDir, firewall.fwCloudId.toString(), firewall.id.toString());

        if (FSHelper.directoryExists(directoryPath)) {
            FSHelper.rmDirectorySync(directoryPath);
        }

        FSHelper.mkdirSync(directoryPath);
        fs.writeFileSync(path.join(directoryPath, this._scriptFilename), "");
    }
}