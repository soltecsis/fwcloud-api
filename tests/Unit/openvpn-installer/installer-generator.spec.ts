import { describeName, playgroundPath } from '../../mocha/global-setup';
import path from 'path';
import { FSHelper } from '../../../src/utils/fs-helper';
import { expect } from 'chai';
import * as fs from 'fs-extra';
import { InstallerGenerator } from '../../../src/openvpn-installer/installer-generator';
import { InvalidConnectionNameException } from './exceptions/invalid-connection-name.exception';
import sinon from 'sinon';
import { app } from '../../../src/fonaments/abstract-application';
import { randomUUID } from 'crypto';

describe(describeName('InstallerGenerator Unit Tests'), () => {
  let workspace: string;
  let generator: InstallerGenerator;
  let connectionName: string;
  let outputPath: string;
  let sandbox: sinon.SinonSandbox;

  beforeEach(async () => {
    sandbox = sinon.createSandbox();
    workspace = path.join(playgroundPath, 'lib/nsis-' + randomUUID());
    outputPath = path.join(workspace, 'output.exe');
    await FSHelper.copy('lib/nsis-3.05', workspace);
    connectionName = 'connectionTest';

    sandbox
      .stub(InstallerGenerator.prototype, 'generateExecutable' as keyof InstallerGenerator)
      .callsFake(() => {
        return fs.writeFileSync(path.join(workspace, 'fwcloud-vpn', 'fwcloud-vpn.exe'), '');
      });
  });

  afterEach(async () => {
    sandbox.restore();
    await fs.remove(workspace);
  });

  describe('constructor()', () => {
    it('should throw an exception for invalid start characters', () => {
      const names = ['-connection', ' connection', '_connection', '$connection'];
      for (const name of names) {
        expect(() => new InstallerGenerator(workspace, name, '', outputPath)).to.throw(
          InvalidConnectionNameException,
        );
      }
    });

    it('should throw an exception for invalid end characters', () => {
      const names = [
        'connection-',
        'connection ',
        'connection_',
        'connection$',
        'connec$tion',
        'connec Tion',
      ];
      for (const name of names) {
        expect(() => new InstallerGenerator(workspace, name, '', outputPath)).to.throw(
          InvalidConnectionNameException,
        );
      }
    });

    it('should throw for name longer than limit', () => {
      expect(
        () =>
          new InstallerGenerator(
            workspace,
            'connectionconnectionconnectionconnection',
            '',
            outputPath,
          ),
      ).to.throw(InvalidConnectionNameException);
    });

    it('should accept valid connection names', () => {
      const names = ['connect-ion', 'connect_Ion', '1connect_Ion', '1connect_Ion1'];
      for (const name of names) {
        expect(() => new InstallerGenerator(workspace, name, '', outputPath)).not.to.throw();
      }
    });
  });

  describe('generate()', () => {
    it('should generate .ovpn file', () => {
      sandbox
        .stub(InstallerGenerator.prototype, 'removeConfigFile' as keyof InstallerGenerator)
        .returns(null as never);

      generator = new InstallerGenerator(workspace, connectionName, '<test></test>', outputPath);
      generator.generate();

      const ovpnPath = path.join(workspace, 'fwcloud-vpn', `${connectionName}.ovpn`);
      expect(fs.existsSync(ovpnPath)).to.be.true;
      expect(fs.readFileSync(ovpnPath, 'utf8')).to.equal('<test></test>');
    });

    it('should delete .ovpn after generating', () => {
      generator = new InstallerGenerator(workspace, connectionName, '<test></test>', outputPath);
      generator.generate();

      const ovpnPath = path.join(workspace, 'fwcloud-vpn', `${connectionName}.ovpn`);
      expect(fs.existsSync(ovpnPath)).to.be.false;
    });

    it('should generate .exe', () => {
      generator = new InstallerGenerator(workspace, connectionName, '<test></test>', outputPath);
      const pathOut = generator.generate();

      expect(fs.existsSync(pathOut)).to.be.true;
    });

    it('should clean files on error', () => {
      sandbox.restore();
      sandbox = sinon.createSandbox();
      sandbox
        .stub(InstallerGenerator.prototype, 'generateExecutable' as keyof InstallerGenerator)
        .throws(new Error('Fail'));

      generator = new InstallerGenerator(workspace, connectionName, '<test></test>', outputPath);
      expect(() => generator.generate()).to.throw();

      expect(fs.existsSync(path.join(workspace, 'fwcloud-vpn', 'fwcloud-vpn.exe'))).to.be.false;
      expect(fs.existsSync(path.join(workspace, 'fwcloud-vpn', `${connectionName}.ovpn`))).to.be
        .false;
    });

    it('should generate signed executable', () => {
      sandbox.stub(InstallerGenerator.prototype, 'shouldSignExecutable').returns(true);
      sandbox.stub(InstallerGenerator.prototype, 'signExecutable' as any).callsFake(() => {
        const signedPath = path.join(workspace, 'fwcloud-vpn', 'fwcloud-vpn.exe');
        fs.writeFileSync(signedPath, 'signed');
      });

      generator = new InstallerGenerator(workspace, connectionName, '<test></test>', outputPath);
      generator.generate(true);

      expect(fs.existsSync(outputPath)).to.be.true;
      expect(fs.readFileSync(outputPath, 'utf8')).to.equal('signed');
    });

    it('should not sign if sign=false', () => {
      sandbox.stub(InstallerGenerator.prototype, 'shouldSignExecutable').returns(true);
      const stub = sandbox.stub(
        InstallerGenerator.prototype,
        'signExecutable' as keyof InstallerGenerator,
      );

      generator = new InstallerGenerator(workspace, connectionName, '<test></test>', outputPath);
      generator.generate(false);

      expect(stub.called).to.be.false;
    });
  });
});
