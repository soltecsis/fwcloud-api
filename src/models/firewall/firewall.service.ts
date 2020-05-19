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

    public async install(firewall: Firewall, customSSHConfig: Partial<SSHConfig>, user: User, eventEmitter: EventEmitter = new EventEmitter()): Promise<Firewall> {
        const data: any = await Firewall.getFirewall({
            body: {
                firewall: firewall.id,
                fwcloud: firewall.fwCloudId
            },
            session: {
                user_id: user.id
            },
            dbCon: db.getQuery()
        });

        const sshConfig: SSHConfig = <SSHConfig>ObjectHelpers.merge({
            host: data.ip,
            port: data.install_port,
            username: data.install_user,
            password: data.install_pass
        }, customSSHConfig);
        
        await (new Installer(firewall)).install(sshConfig, eventEmitter);

        return firewall;
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