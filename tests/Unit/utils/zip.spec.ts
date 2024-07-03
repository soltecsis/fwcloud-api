import { describeName, playgroundPath, expect } from '../../mocha/global-setup';
import * as path from 'path';
import { Zip } from '../../../src/utils/zip';
import { FSHelper } from '../../../src/utils/fs-helper';
import * as fs from 'fs-extra';

describe(describeName('Zip Unit Tests'), async () => {
  const pathToBeZipped: string = path.join(playgroundPath, 'to_zip');

  beforeEach(async () => {
    FSHelper.mkdirSync(pathToBeZipped);
    fs.writeFileSync(path.join(pathToBeZipped, 'test.txt'), 'test');
  });

  describe('zip()', () => {
    it('should throw an exception if the zip file does not exist', async () => {
      const filepath: string = path.join(playgroundPath, 'test');
      const destinationpath: string = path.join(playgroundPath, 'dest.zip');

      const t = () => {
        return Zip.zip(filepath, destinationpath);
      };

      await expect(t()).to.be.rejected;
    });

    it('should zip a directory', async () => {
      const destinationPath: string = path.join(playgroundPath, 'dest.zip');

      await Zip.zip(pathToBeZipped, destinationPath);

      expect(fs.existsSync(destinationPath)).to.be.true;
    });

    it('should use the zipped path as a destination path if it is not provided', async () => {
      await Zip.zip(pathToBeZipped);

      expect(fs.existsSync(pathToBeZipped + '.zip')).to.be.true;
    });
  });

  describe('unzip()', () => {
    const pathZipped: string = path.join(playgroundPath, 'test.zip');
    const output: string = path.join(playgroundPath, 'output');
    beforeEach(async () => {
      await Zip.zip(pathToBeZipped, pathZipped);
    });

    it('should throw an exception if the zip file does not exist', async () => {
      const t = () => {
        return Zip.unzip(path.join(playgroundPath, 'invented.zip'), output);
      };

      expect(t()).to.be.rejected;
    });

    it('should unzip a file', async () => {
      await Zip.unzip(pathZipped, output);

      expect(fs.existsSync(output)).to.be.true;
      expect(fs.existsSync(path.join(output, 'test.txt'))).to.be.true;
    });
  });
});
