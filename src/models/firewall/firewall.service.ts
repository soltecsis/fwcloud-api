import { Service } from "../../fonaments/services/service";
import { Firewall } from "./Firewall";
import { Progress } from "../../fonaments/http/progress/progress";
import { Task } from "../../fonaments/http/progress/task";
import { FSHelper } from "../../utils/fs-helper";
import * as path from "path";
import * as fs from "fs";
import { Compiler } from "./compiler";

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

    protected async createFirewallPolicyDirectory(firewall: Firewall): Promise<void> {
        const directoryPath: string = path.join(this._dataDir, firewall.fwCloudId.toString(), firewall.id.toString());

        if (FSHelper.directoryExists(directoryPath)) {
            FSHelper.rmDirectorySync(directoryPath);
        }

        FSHelper.mkdirSync(directoryPath);
        fs.writeFileSync(path.join(directoryPath, this._scriptFilename), "");
    }

    protected async compileHeader(firewall: Firewall): Promise<void> {
        const filePath: string = path.join(this._dataDir, firewall.fwCloudId.toString(), firewall.id.toString(), this._scriptFilename);

        fs.appendFileSync(filePath, fs.readFileSync(this._headerPath, 'utf8'));
    }

    protected async compileFooter(firewall: Firewall): Promise<void> {
        const filePath: string = path.join(this._dataDir, firewall.fwCloudId.toString(), firewall.id.toString(), this._scriptFilename);

        fs.appendFileSync(filePath, fs.readFileSync(this._footerPath, 'utf8'));
    }
}