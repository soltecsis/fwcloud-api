import { Service } from "../../fonaments/services/service";
import { Firewall } from "./Firewall";
import { Progress } from "../../fonaments/http/progress/progress";
import { Task } from "../../fonaments/http/progress/task";
import { FSHelper } from "../../utils/fs-helper";
import * as path from "path";
import * as fs from "fs";
import { Compiler } from "./compiler";
import { Installer } from "./installer";
import ObjectHelpers from "../../utils/object-helpers";
import { getRepository } from "typeorm";
import { IPObj } from "../ipobj/IPObj";
import { InternalServerException } from "../../fonaments/exceptions/internal-server-exception";

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
    public compile(firewall: Firewall): Progress<Firewall> {
        const progress: Progress<Firewall> = new Progress(firewall);
        
        if (firewall.fwCloudId === undefined || firewall.fwCloudId === null) {
            throw new Error('Firewall does not belong to a fwcloud');
        }
        
        progress.procedure('Compiling firewall', (task: Task) => {
            task.addTask(() => { return this.createFirewallPolicyDirectory(firewall) }, 'Creating directory');
            task.addTask(() => { return (new Compiler(firewall).compile(this._headerPath, this._footerPath)) }, 'Compiling script');
        }, 'Firewall compiled');

        return progress;
    }

    public async install(firewall: Firewall, customSSHConfig: Partial<SSHConfig>): Promise<Progress<Firewall>> {
        const progress: Progress<Firewall> = new Progress(firewall);

        const ipObj: IPObj = await getRepository(IPObj).findOne({where: {id: firewall.install_ipobj}});

        if (!ipObj) {
            throw new InternalServerException('Firewall does not have address');
        }

        const sshConfig: SSHConfig = <SSHConfig>ObjectHelpers.merge({
            host: ipObj.address,
            port: firewall.install_port,
            username: firewall.install_user,
            password: firewall.install_pass
        }, customSSHConfig);
        
        progress.procedure('Installing firewall policies', (task: Task) => {
            task.addTask(() => (new Installer(firewall)).install(sshConfig), 'Installing script');
        }, 'Firewall installed');

        return progress;
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