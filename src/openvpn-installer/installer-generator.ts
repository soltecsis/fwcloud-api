import path from "path";
import * as child_process from "child_process";
import * as fs from "fs-extra";
import { InvalidConnectionNameException } from "../../tests/Unit/openvpn-installer/exceptions/invalid-connection-name.exception";
import { EventEmitter } from "typeorm/platform/PlatformTools";

export class InstallerGenerator {
    static connectionNameRegExp = new RegExp(/^[a-zA-Z0-9]+([a-zA-Z0-9-_]*[a-zA-Z0-9]+)*$/);
    protected _workspace: string;
    protected _configFilename: string;
    protected _configPath: string;
    protected _outputPath: string;
    protected _configData: string;
    protected _originalOutputPath: string;


    constructor(workspace: string, name: string, configData: string, outputPath: string) {

        if (! this.isConnectionNameValid(name)) {
            throw new InvalidConnectionNameException(name);
        }

        this._workspace = workspace;
        this._configFilename = name + '.ovpn';
        this._configPath = path.join(this._workspace, "fwcloud-vpn", this._configFilename);
        this._originalOutputPath = path.join(this._workspace, "fwcloud-vpn", "fwcloud-vpn.exe");
        this._outputPath = outputPath;
        this._configData = configData;
    }

    public generate(): string {
        try {
            this.clean();
            fs.writeFileSync(this._configPath, this._configData);
            this.runCommand(this._configFilename);

            if (!fs.existsSync(path.dirname(this._outputPath))) {
                fs.mkdirpSync(path.dirname(this._outputPath));
            }

            fs.copyFileSync(this._originalOutputPath, this._outputPath);

            this.clean();
            return this._outputPath;
        } catch(e) {
            this.clean();
            throw e;
        }
    }

    protected isConnectionNameValid(name: string): boolean {
        if(!name) {
            return false;
        }

        return InstallerGenerator.connectionNameRegExp.test(name);
    }

    protected runCommand(configFilename: string) {
        const command: string = `cd ${path.join(this._workspace, "fwcloud-vpn")}/ && ../Bin/makensis -DCONFIG "${configFilename}"`;

        child_process.execSync(command);
    }

    protected clean(): void {
        this.removeConfigFile();
        this.removeOriginalGeneratedFile();
    }

    protected removeConfigFile(): void {
        if(fs.existsSync(this._configPath)) {
            fs.unlinkSync(this._configPath);
        }
    }

    protected removeOriginalGeneratedFile(): void {
        if(fs.existsSync(this._originalOutputPath)) {
            fs.unlinkSync(this._originalOutputPath);
        }
    }
}