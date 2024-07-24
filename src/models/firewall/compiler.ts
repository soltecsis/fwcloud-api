import { Firewall } from './Firewall';
import * as fs from 'fs';
import { EventEmitter } from 'typeorm/platform/PlatformTools';

export class Compiler {
  protected _firewall: Firewall;

  constructor(firewall: Firewall) {
    this._firewall = firewall;
  }

  public async compile(
    headerPath: string,
    footerPath: string,
    eventEmitter: EventEmitter,
  ): Promise<void> {
    return new Promise<void>(() => {
      const outputPath: string = this._firewall.getPolicyFilePath();
      fs.createWriteStream(outputPath);
    });
  }
}
