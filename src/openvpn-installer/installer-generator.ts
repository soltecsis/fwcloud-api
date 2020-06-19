import path from "path";
import * as child_process from "child_process";
import * as fs from "fs";

export class InstallerGenerator {
    protected _workspace: string = "";
    protected _installerOutputPath: string = "";

    constructor(basePath: string) {
        this._workspace = path.join(basePath, "lib/nsis/fwcloud-vpn/");
        this._installerOutputPath = path.join(this._workspace, "fwcloud-vpn.exe");
    }

    public generate(name: string, configData: string): string {
        const configFilename: string = name + '.ovpn';
        const configPath: string = path.join(this._workspace, configFilename);
        const command: string = `cd lib/nsis/fwcloud-vpn/ && ../Bin/makensis -DCONFIG "${configFilename}"`;

        try {
            this.clean();
            fs.writeFileSync(configPath, configData);
            child_process.execSync(command);
            return this._installerOutputPath;
        } catch(e) {
            this.clean();
            throw e;
        }  
    }

    public clean(): void {
        if(fs.existsSync(this._configPath)) {
            fs.unlinkSync(this._configPath);
        }

        if(fs.existsSync(this._installerOutputPath)) {
            fs.unlinkSync(this._installerOutputPath);
        }
    }
}