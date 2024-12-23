import path from 'path';
import * as child_process from 'child_process';
import * as fs from 'fs-extra';
import { InvalidConnectionNameException } from '../../tests/Unit/wireguard-installer/exceptions/invalid-connection-name.exception';
import { app, logger } from '../fonaments/abstract-application';

export class InstallerGenerator {
  static connectionNameRegExp = new RegExp(/^[a-zA-Z0-9]{1}([a-zA-Z0-9-_]{2,30})[a-zA-Z0-9]{1}$/);
  protected _workspace: string;
  protected _configFilename: string;
  protected _configPath: string;
  protected _outputPath: string;
  protected _configData: string;
  protected _originalOutputPath: string;
  protected _signOutputPath: string;

  protected _osslsigncodePath: string;

  constructor(workspace: string, name: string, configData: string, outputPath: string) {
    if (!this.isConnectionNameValid(name)) {
      throw new InvalidConnectionNameException(name);
    }

    this._workspace = workspace;
    this._configFilename = name + '.ovpn';
    this._configPath = path.join(this._workspace, 'fwcloud-vpn', this._configFilename);
    this._originalOutputPath = path.join(this._workspace, 'fwcloud-vpn', 'fwcloud-vpn.exe');
    this._signOutputPath = path.join(this._workspace, 'fwcloud-vpn', 'fwcloud-vpn.sign.exe');
    this._outputPath = outputPath;
    this._configData = configData;
    this._osslsigncodePath =
      app().config.get('wireGuard.installer.osslsigncode.path') ?? this.guessOsslSignCodePath();
  }

  public generate(sign: boolean = true): string {
    try {
      this.clean();
      fs.writeFileSync(this._configPath, this._configData);
      this.generateExecutable(this._configFilename);

      if (this.shouldSignExecutable() && sign) {
        const certPath: string = app().config.get('wireGuard.installer.osslsigncode.cert_path');
        const url: string = app().config.get('wireGuard.installer.osslsigncode.url');
        const description: string = app().config.get(
          'wireGuard.installer.osslsigncode.description',
        );

        try {
          this.signExecutable(this._osslsigncodePath, certPath, url, description);
        } catch (e) {
          logger().error('Error during wireGuard installer signing: ' + e.message);
          logger().info('Creating executable unsigned');
          return this.generate(false);
        }
      } else {
        logger().info('WireGuard installer executable unsigned generated');
      }

      if (!fs.existsSync(path.dirname(this._outputPath))) {
        fs.mkdirpSync(path.dirname(this._outputPath));
      }

      fs.copyFileSync(this._originalOutputPath, this._outputPath);

      this.clean();
      return this._outputPath;
    } catch (e) {
      this.clean();
      throw e;
    }
  }

  /**
   * Returns whether the executable should be signed
   */
  public shouldSignExecutable(): boolean {
    if (!this.osslsigncodeExists()) {
      if (this._osslsigncodePath === null) {
        logger().warn('osslsigncode path not defined');
      } else {
        logger().warn('osslsigncode not found in ' + this._osslsigncodePath);
      }

      return false;
    }

    if (!this.osslsignCertificateExists()) {
      logger().warn(
        'WireGuard installer sign certificate does not exists. Path was: ' +
          app().config.get('wireGuard.installer.osslsigncode.cert_path'),
      );

      return false;
    }

    if (app().config.get('wireGuard.installer.osslsigncode.url') !== null) {
      logger().warn(`osslsigncode "i" argument missing`);

      return false;
    }

    if (app().config.get('wireGuard.installer.osslsigncode.description') !== null) {
      logger().warn(`osslsigncode "n" argument missing`);

      return false;
    }

    return true;
  }

  /**
   * Returns whether osslsigncode binary path is defined and exists
   */
  public osslsigncodeExists(): boolean {
    return this._osslsigncodePath !== null;
  }

  /**
   * Guess osslsigncode bin path
   */
  public guessOsslSignCodePath(): string {
    const command: string = `which osslsigncode`;

    try {
      const binPath: string = child_process.execSync(command).toString().replace('\n', '');

      if (fs.existsSync(binPath)) {
        return binPath;
      }
    } catch (e) {
      return null;
    }
  }

  /**
   * Returns whether sign certificate path is defined and exists
   */
  public osslsignCertificateExists(): boolean {
    const certPath: string = app().config.get('wireGuard.installer.osslsigncode.cert_path');
    if (certPath !== null) {
      return fs.existsSync(certPath);
    }

    return false;
  }

  protected isConnectionNameValid(name: string): boolean {
    if (!name) {
      return false;
    }

    return InstallerGenerator.connectionNameRegExp.test(name);
  }

  /**
   * Generates wireGuard installer
   *
   * @param configFilename
   */
  protected generateExecutable(configFilename: string) {
    const command: string = `cd ${path.join(this._workspace, 'fwcloud-vpn')}/ && ../Bin/makensis -DCONFIG_F="${configFilename}" fwcloud-vpn.nsi`;

    child_process.execSync(command);
  }

  /**
   * Signs wireGuard installer
   *
   * @param osslsigncodePath
   * @param certPath
   * @param i
   * @param n
   */
  protected signExecutable(osslsigncodePath: string, certPath: string, i: string, n: string) {
    const command: string = `${osslsigncodePath} sign -pkcs12 ${certPath} -n ${n} -i ${i} -in ${this._originalOutputPath} -out ${this._signOutputPath}`;

    child_process.execSync(command);

    fs.moveSync(this._signOutputPath, this._originalOutputPath);
  }

  protected clean(): void {
    this.removeConfigFile();
    this.removeOriginalGeneratedFile();
    this.removeSignedGeneratedFile();
  }

  protected removeConfigFile(): void {
    if (fs.existsSync(this._configPath)) {
      fs.unlinkSync(this._configPath);
    }
  }

  protected removeOriginalGeneratedFile(): void {
    if (fs.existsSync(this._originalOutputPath)) {
      fs.unlinkSync(this._originalOutputPath);
    }
  }

  protected removeSignedGeneratedFile(): void {
    if (fs.existsSync(this._signOutputPath)) {
      fs.unlinkSync(this._signOutputPath);
    }
  }
}
