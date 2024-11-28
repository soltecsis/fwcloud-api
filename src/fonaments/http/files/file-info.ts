import * as fs from 'fs-extra';
import * as path from 'path';
import { FwCloudError } from '../../exceptions/error';

export class FileInfo {
  readonly basename: string;
  readonly filename: string;
  readonly filepath: string;
  readonly extensions: string;
  readonly size: number;

  constructor(filepath: string) {
    try {
      const stat = fs.statSync(filepath);
      this.filepath = filepath;
      this.basename = path.basename(filepath);
      this.extensions = path.extname(filepath);
      this.size = stat.size;
    } catch (e) {
      throw new FwCloudError('Uploaded file not found', e.stack);
    }
  }
}
