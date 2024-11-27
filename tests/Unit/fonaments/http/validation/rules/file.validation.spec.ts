import { describeName, expect, playgroundPath } from '../../../../../mocha/global-setup';
import { FileInfo } from '../../../../../../src/fonaments/http/files/file-info';
import * as fs from 'fs-extra';
import * as path from 'path';
import { IsFile } from '../../../../../../src/fonaments/validation/rules/file.validation';
import { ValidatorConstraintInterface } from 'class-validator';

describe(describeName('File Rule Unit Test'), () => {
  const rule: ValidatorConstraintInterface = new IsFile();

  describe('passes()', () => {
    it('should return false if the value is null', async () => {
      expect(await rule.validate(undefined)).to.be.false;
    });

    it('should return false if the value is undefined', async () => {
      expect(await rule.validate(null)).to.be.false;
    });

    it('should return true if the value is FileInfo', async () => {
      fs.writeFileSync(path.join(playgroundPath, 'test.txt'), '');
      expect(await rule.validate(new FileInfo(path.join(playgroundPath, 'test.txt')))).to.be.true;
    });

    it('should return false if the value is not FileInfo', async () => {
      expect(await rule.validate('other')).to.be.false;
      expect(await rule.validate(10)).to.be.false;
    });
  });
});
