import path from "path";
import * as child_process from "child_process";
import * as fs from "fs-extra";
import { InvalidConnectionNameException } from "../../tests/Unit/openvpn-installer/exceptions/invalid-connection-name.exception";
import { app, logger } from "../fonaments/abstract-application";

export class InstallerGenerator {
    static connectionNameRegExp = new RegExp(/^[a-zA-Z0-9]{1}([a-zA-Z0-9-_]{2,30})[a-zA-Z0-9]{1}$/);
    protected _workspace: string;
    protected _configFilename: string;
    protected _configPath: string;
    protected _outputPath: string;
    protected _configData: string;
    protected _originalOutputPath: string;
    protected _signOutputPath: string;


    constructor(workspace: string, name: string, configData: string, outputPath: string) {

        if (! this.isConnectionNameValid(name)) {
            throw new InvalidConnectionNameException(name);
        }

        this._workspace = workspace;
        this._configFilename = name + '.ovpn';
        this._configPath = path.join(this._workspace, "fwcloud-vpn", this._configFilename);
        this._originalOutputPath = path.join(this._workspace, "fwcloud-vpn", "fwcloud-vpn.exe");
        this._signOutputPath = path.join(this._workspace, "fwcloud-vpn", "fwcloud-vpn.sign.exe");
        this._outputPath = outputPath;
        this._configData = configData;
    }

    public generate(sign: boolean = true): string {
        try {
            this.clean();
            fs.writeFileSync(this._configPath, this._configData);
            this.generateExecutable(this._configFilename);

            if (this.shouldSignExecutable() && sign) {
                const binPath: string = app().config.get('openvpn.installer.osslsigncode.path');
                const certPath: string = app().config.get('openvpn.installer.osslsigncode.cert_path');
                const i: string = app().config.get('openvpn.installer.osslsigncode.i');
                const n: string = app().config.get('openvpn.installer.osslsigncode.n');
                
                try {
                    this.signExecutable(binPath, certPath, i, n)
                } catch(e) {
                    logger().error('Error during openvpn installer signing: ' + e.message);
                    logger().info('Creating executable unsigned');
                    return this.generate(false);
                }
            }

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

    /**
     * Returns whether the executable should be signed
     */
    public shouldSignExecutable(): boolean {
        if (! this.osslsigncodeExists()) {
            logger().warn('osslsigncode does not exists. Path was: ' + app().config.get('openvpn.installer.osslsigncode.path'));

            return false;
        }

        if (! this.osslsignCertificateExists()) {
            logger().warn('openvpn installer sign certificate does not exists. Path was: ' + app().config.get('openvpn.installer.osslsigncode.cert_path'));

            return false;
        }

        if (app().config.get('openvpn.installer.osslsigncode.i') !== null) {
            logger().warn(`osslsigncode "i" argument missing`);
            
            return false;
        }

        if (app().config.get('openvpn.installer.osslsigncode.n') !== null) {
            logger().warn(`osslsigncode "n" argument missing`);
            
            return false;
        }

        return true;
    }

    /**
     * Returns whether osslsigncode binary path is defined and exists
     */
    public osslsigncodeExists(): boolean {
        const binPath: string = app().config.get('openvpn.installer.osslsigncode.path');
        if ( binPath !== null) {
            return fs.existsSync(binPath);
        }

        return false;
    }

    /**
     * Returns whether sign certificate path is defined and exists
     */
    public osslsignCertificateExists(): boolean {
        const certPath: string = app().config.get('openvpn.installer.osslsigncode.cert_path');
        if ( certPath !== null) {
            return fs.existsSync(certPath);
        }

        return false;
    }

    protected isConnectionNameValid(name: string): boolean {
        if(!name) {
            return false;
        }

        return InstallerGenerator.connectionNameRegExp.test(name);
    }

    /**
     * Generates openvpn installer 
     * 
     * @param configFilename 
     */
    protected generateExecutable(configFilename: string) {
        const command: string = `cd ${path.join(this._workspace, "fwcloud-vpn")}/ && ../Bin/makensis -DCONFIG_F="${configFilename}" fwcloud-vpn.nsi`;

        child_process.execSync(command);
    }

    /**
     * Signs openvpn installer
     * 
     * @param osslsigncodePath 
     * @param certPath 
     * @param i 
     * @param n 
     */
    protected signExecutable(osslsigncodePath: string, certPath: string, i: string, n: string) {
        const command: string = `cd ${path.join(this._workspace, "fwcloud-vpn")}/ && ${osslsigncodePath} sign -pkcs12 ${certPath} -n ${n} -i ${i} -in ${this._originalOutputPath} -out ${this._signOutputPath}`;

        child_process.execSync(command);

        fs.moveSync(this._signOutputPath, this._originalOutputPath);
    }

    protected clean(): void {
        this.removeConfigFile();
        this.removeOriginalGeneratedFile();
        this.removeSignedGeneratedFile();
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

    protected removeSignedGeneratedFile(): void {
        if(fs.existsSync(this._signOutputPath)) {
            fs.unlinkSync(this._signOutputPath);
        }
    }
}